import { Client } from "@notionhq/client";

import { Config } from "../config";
import { notImplementedYet } from "../util/fn";
import { DatabaseUpdate, get_database, update_database } from "../api";
import { DatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Database, database_object_to_database } from "../model";
import { confirm } from "../util/cli";

export async function new_database(config: Config, client: Client) {
    notImplementedYet(
        "TODO: Create a new remote database in notion, with all of the same properties of the other databases in the config. If the databases are not normalized, ask if the fields should be merged or fail/stop",
    );
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
    const dbs: DatabaseObjectResponse[] = [];
    for (const db of config.databases) {
        const res = await get_database(client, db.id);
        if (res.isOk()) {
            dbs.push(res.value);
        } else {
            // TODO: Handle errors
        }
    }
    const properties: Set<string> = new Set();
    for (const db of dbs) {
        for (const prop of Object.values(db.properties)) {
            if (prop.type !== "rich_text") {
                continue;
            }
            properties.add(prop.name);
        }
    }
    const all_properties = Array.from(properties).concat("context");

    const missing_properties = dbs
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
            // TODO: Handle errors
        }
    }
}

export async function new_from_import(config: Config, client: Client) {
    notImplementedYet(
        "TODO: Create a new database(s) from an imported file (should support json and xml)",
    );
}
