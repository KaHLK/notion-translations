import { Client } from "@notionhq/client";
import {
    CreateDatabaseParameters,
    DatabaseObjectResponse,
    PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";

import {
    DatabaseUpdate,
    create_database,
    get_database,
    get_pages,
    update_database,
} from "../api";
import { Config } from "../config";
import { Database, database_object_to_database } from "../model";
import { autocomplete, confirm, get_text } from "../util/cli";
import { notImplementedYet } from "../util/fn";
import { Result, err, ok } from "../util/result";

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

type Property = CreateDatabaseParameters["properties"][string];
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

    const pages = await get_pages(client);
    if (pages.isErr()) {
        console.error(
            "Failed to get pages shared with this integration",
            pages.error,
        );
        return;
    }
    if (pages.value.length === 0) {
        console.warn(
            "No 'non-database child'-pages are shared with this integration.",
        );
        return;
    }
    const parent = (
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
    ).expect("Expected a page to be selected. Exiting");

    console.log(`Creating new database '${_name}'`);
    const props: [string, Property][] = [
        ["key", { type: "title", title: {} }],
        ["context", { type: "rich_text", rich_text: {} }],
        ...Array.from(properties).map<[string, Property]>((prop) => [
            prop,
            { type: "rich_text", rich_text: {} },
        ]),
    ];
    const database: CreateDatabaseParameters = {
        parent: { page_id: parent },
        title: [
            {
                text: {
                    content: _name,
                },
            },
        ],
        properties: Object.fromEntries(props),
    };

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

export async function new_from_import(config: Config, client: Client) {
    notImplementedYet(
        "TODO: Create a new database(s) from an imported file (should support json and xml)",
    );
}
