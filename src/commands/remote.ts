import { Client } from "@notionhq/client";
import {
    CreateDatabaseParameters,
    CreatePageParameters,
    DatabaseObjectResponse,
    PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";

import {
    DatabaseUpdate,
    create_database,
    create_page,
    get_database,
    get_page_from_database,
    get_pages,
    update_database,
    update_page,
} from "../api";
import { Config } from "../config";
import { Database, database_object_to_database } from "../model";
import { autocomplete, confirm, get_text } from "../util/cli";
import { Result, err, ok } from "../util/result";
import { Option, none, some } from "../util/option";
import { ImportFormat, parse_file } from "./remote/parse";

async function get_local_databases(
    config: Config,
    client: Client,
): Promise<Result<DatabaseObjectResponse[], Error>> {
    const dbs: DatabaseObjectResponse[] = [];
    for (const db of config.databases) {
        const res = await get_database(client, db.id);
        if (res.isOk()) {
            dbs.push(res.value);
        } else {
            return err(res.error);
        }
    }
    return ok(dbs);
}

function get_all_properties(dbs: DatabaseObjectResponse[]): Set<string> {
    return new Set(
        dbs.flatMap((db) =>
            Object.values(db.properties)
                .filter((prop) => prop.type === "rich_text")
                .map((prop) => prop.name),
        ),
    );
}

async function get_parent_page(client: Client): Promise<Option<string>> {
    const pages = await get_pages(client);
    if (pages.isErr()) {
        console.error(
            "Failed to get pages shared with this integration",
            pages.error,
        );
        return none();
    }
    if (pages.value.length === 0) {
        console.warn(
            "No 'non-database child'-pages are shared with this integration.",
        );
        return none();
    }
    return some(
        (
            await autocomplete(
                "What should be the parent of the new database?",
                pages.value.map((page) => {
                    const title = Object.values(page.properties).filter(
                        (prop) => prop.type === "title",
                    )[0] as Extract<
                        PageObjectResponse["properties"][string],
                        { type: "title" }
                    >;
                    return { title: title.title[0].plain_text, value: page.id };
                }),
            )
        ).expect("Expected a page to be selected. Exiting"),
    );
}

function construct_database_request(
    parent: string,
    name: string,
    properties: Set<string>,
): CreateDatabaseParameters {
    const props: [string, DatabaseProperty][] = [
        ["key", { type: "title", title: {} }],
        ["context", { type: "rich_text", rich_text: {} }],
        ...Array.from(properties).map<[string, DatabaseProperty]>((prop) => [
            prop,
            { type: "rich_text", rich_text: {} },
        ]),
    ];
    return {
        parent: { page_id: parent },
        title: [
            {
                text: {
                    content: name,
                },
            },
        ],
        properties: Object.fromEntries(props),
    };
}

type DatabaseProperty = CreateDatabaseParameters["properties"][string];
export async function new_database(
    config: Config,
    client: Client,
    name?: string,
) {
    if (config.databases.length === 0) {
        console.warn("No databases saved locally. Exiting");
        return;
    }
    const dbs = await get_local_databases(config, client);
    if (dbs.isErr()) {
        console.error("Failed to get database information", dbs.error);
        return;
    }
    const properties = get_all_properties(dbs.value);

    let _name = name;
    if (!_name) {
        _name = (
            await get_text("What should the new database be named?")
        ).expect("Expected a name to be entered. Exiting");
    }

    const parent = (await get_parent_page(client)).unwrap();

    console.log(`Creating new database '${_name}'`);
    const database = construct_database_request(parent, _name, properties);

    const res = await create_database(client, database);

    if (res.isErr()) {
        console.error("Failed to create database", res.error);
        return;
    }

    console.log("Successfully created database. Saving locally");

    config.add_databases([database_object_to_database(res.value)]);
}

type NormalizationAction =
    | { type: "add"; value: string; column_type: "rich_text" | "title" }
    | { type: "update_title"; value: string };
type NormalizeOptions = {
    dryRun?: boolean;
};
export async function normalize(
    config: Config,
    client: Client,
    options: NormalizeOptions,
) {
    if (config.databases.length === 0) {
        console.warn("No databases saved locally. Exiting");
        return;
    }
    const dbs = await get_local_databases(config, client);
    if (dbs.isErr()) {
        console.error("Failed to get database information", dbs.error);
        return;
    }
    const properties = get_all_properties(dbs.value);
    const all_properties = Array.from(properties).concat("context");

    const missing_properties = dbs.value
        .map<[Database, NormalizationAction[]]>((db) => {
            const properties = Object.values(db.properties);
            const missing: NormalizationAction[] = [];
            for (const prop of all_properties) {
                if (
                    !properties.some(
                        (p) => p.type === "rich_text" && p.name === prop,
                    )
                ) {
                    missing.push({
                        type: "add",
                        value: prop,
                        column_type: "rich_text",
                    });
                }
            }
            const title = properties.find((p) => p.type === "title");
            if (title && title.name !== "key") {
                missing.push({
                    type: "update_title",
                    value: "key",
                });
            } else if (!title) {
                missing.push({
                    type: "add",
                    value: "key",
                    column_type: "title",
                });
            }
            return [database_object_to_database(db), missing];
        })
        .filter(([_, updates]) => updates.length > 0);

    if (missing_properties.length === 0) {
        console.log("No updates to perfrom");
        return;
    }

    console.group("Updates");
    for (const [db, updates] of missing_properties) {
        console.group(`${db.name}: `);
        for (const update of updates) {
            switch (update.type) {
                case "add":
                    console.log(
                        `Add column '${update.value} of type '${update.column_type}'`,
                    );
                    break;
                case "update_title":
                    console.log(`Change title to '${update.value}'`);
                    break;
            }
        }
        console.groupEnd();
        console.log();
    }
    console.groupEnd();
    if (options.dryRun) {
        console.log("Dry-run, nothing done.");
        return;
    }

    const answer = await confirm("Perform these updates?", true);
    if (!answer) {
        console.log("Nothing done.");
        return;
    }

    for (const [db, updates] of missing_properties) {
        const db_update: DatabaseUpdate = {};
        for (const update of updates) {
            switch (update.type) {
                case "add": {
                    db_update.properties ??= {};
                    db_update.properties[update.value] = {
                        name: update.value,
                        type: update.column_type,
                        [update.column_type]: {},
                    };
                    break;
                }
                case "update_title": {
                    db_update.properties ??= {};
                    db_update.properties["title"] = {
                        type: "title",
                        title: {},
                        name: update.value,
                    };
                    break;
                }
            }
        }

        console.log(`Updating database '${db.name}'`);
        const res = await update_database(client, db.id, db_update);
        if (res.isErr()) {
            console.error(res.err);
        }
    }
}

export { import_formats } from "./remote/parse";
type DatabasePageProperties = Extract<
    CreatePageParameters,
    { parent: { database_id: string } }
>["properties"];
type PageProperty = Extract<DatabasePageProperties[string], object>;
type ImportOptions = {
    append?: string;
};
export async function new_from_import(
    config: Config,
    client: Client,
    file_path: string,
    format: ImportFormat,
    options: ImportOptions,
) {
    const _units = await parse_file(file_path, format);
    if (_units.isNone()) {
        return;
    }
    const units = _units.value;

    let parent_id: string;
    let parent_name: string;
    if (!options.append) {
        const dbs = await get_local_databases(config, client);
        if (dbs.isErr()) {
            console.error("Failed to get database information", dbs.error);
            return;
        }
        const properties = get_all_properties(dbs.value);

        let db_name = file_path.split(".").filter((v) => v.length > 0)[0];
        const answer = (
            await confirm(
                `About to create database with name ${db_name}. Do you want to change the name?`,
            )
        ).expect("Expected y/n to be chosen. Exiting");
        if (answer) {
            db_name = (
                await get_text("Please enter the desired database name")
            ).expect("Expected name to be entered. Exiting");
        }

        console.log("Fetching pages");
        const parent = (await get_parent_page(client)).unwrap();
        console.log(`Creating new database '${db_name}'`);
        const database = construct_database_request(
            parent,
            db_name,
            properties,
        );

        const res = await create_database(client, database);
        if (res.isErr()) {
            console.error(`Failed to create database ${db_name}`, res.error);
            return;
        }
        parent_id = res.value.id;
        parent_name = res.value.title.at(0)?.plain_text ?? "";
    } else {
        parent_id = options.append;
        parent_name =
            (await get_database(client, parent_id)).unwrap().title.at(0)
                ?.plain_text ?? "";
    }

    if (!config.databases.some((db) => db.id === parent_id)) {
        const answer = await confirm("Should the database be saved?", true);
        if (answer.isSomeAnd((v) => v)) {
            config.databases.push({ id: parent_id, name: parent_name });
        }
    }
    let i = 0;
    for (const unit of units) {
        i++;
        const existing = await get_page_from_database(
            client,
            parent_id,
            unit.key,
        );

        if (existing.isErr()) {
            return;
        }

        const props: Extract<
            CreatePageParameters,
            { parent: { database_id: string } }
        >["properties"] = {};
        if (!existing.value) {
            props["key"] = {
                type: "title",
                title: [{ text: { content: unit.key } }],
            };
            props["context"] = {
                type: "rich_text",
                rich_text: [{ text: { content: unit.context } }],
            };
        }
        for (const [lng, value] of Object.entries(unit.languages)) {
            props[lng] = {
                type: "rich_text",
                rich_text: [{ text: { content: value } }],
            };
        }

        const res = await (async () => {
            if (existing.value) {
                console.log(
                    `Updating page '${unit.key}' (${i} of ${units.length})`,
                );
                return await update_page(client, {
                    page_id: existing.value.id,
                    properties: props,
                });
            }
            console.log(
                `Creating page '${unit.key}' (${i} of ${units.length})`,
            );
            return await create_page(client, {
                parent: { database_id: parent_id, type: "database_id" },
                properties: props,
            });
        })();
        if (res.isErr()) {
            console.error(
                `Error occurred trying to create page '${unit.key}'`,
                res.error,
            );
            return;
        }
    }
}
