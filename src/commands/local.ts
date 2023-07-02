import { Client } from "@notionhq/client";
import chalk from "chalk";

import { get_databases } from "../api";
import { Config } from "../config";
import { Database, database_object_to_database } from "../model";
import { autocomplete_multiselect, confirm } from "../util/cli";

export async function add(config: Config, client: Client) {
    const databases = (await get_databases(client)).unwrap();

    if (databases.length === 0) {
        console.error(
            "No tables shared with this integration. Add some through the notion ui",
        );
        return;
    }

    const available: Database[] = [];
    for (const db of databases) {
        const idx = config.databases.findIndex((t) => t.id === db.id);
        const database: Database = database_object_to_database(db);
        if (idx >= 0) {
            config.update_database_at(idx, database);
        } else {
            available.push(database);
        }
    }

    if (available.length === 0) {
        console.warn(
            "All databases shared with this integration is already saved locally. To see all databases use the 'local list'-command",
        );
        return;
    }

    if (available.length === 1) {
        const answer = await confirm(
            `Found one database (${available[0].name}). Do you want to add it?`,
        );
        if (answer) {
            config.add_databases(available);
        }
        return;
    }

    const arr = (
        await autocomplete_multiselect(
            "Multiple tables found. Please pick the ones you want to process",
            available.map((db) => ({ title: db.name, value: db })),
        )
    ).expect("Expected tables to be selected. Exiting");

    config.add_databases(arr);
}

export async function remove(config: Config) {
    if (config.databases.length === 0) {
        console.warn("No databases to remove.");
        return;
    }

    if (config.databases.length === 1) {
        const answer = await confirm(
            `One database saved. Do you want to delete '${config.databases[0].name}'?`,
        );
        if (answer) {
            config.remove_database_at(0);
        }
        return;
    }

    const arr = (
        await autocomplete_multiselect(
            "Pick the databases you want to remove",
            config.databases.map((db) => ({ title: db.name, value: db })),
        )
    ).expect("Expected a database to be selected. Exiting");

    for (const db of arr) {
        config.remove_database(db);
    }
}

export function list(config: Config) {
    if (config.databases.length === 0) {
        console.warn("No databases currently used.");
        return;
    }
    console.group("Databases used for generating language files:");
    for (const db of config.databases) {
        console.log(`${chalk.cyan(db.name)} (${chalk.red(db.id)})`);
    }
    console.groupEnd();
}

export async function sync(config: Config, client: Client) {
    const databases = (await get_databases(client)).unwrap();

    if (databases.length === 0) {
        if (config.databases.length > 0) {
            const answer = await confirm(
                "All of the local databases are no longer shared with this integration. Do you want to remove them?",
                true,
            );
            if (answer) {
                config.remove_all_databases();
            }
        } else {
            console.error(
                "No tables shared with this integration. Add some through the notion ui",
            );
        }
        return;
    }

    let i = 0;
    let deleted = 0;
    for (let j = 0; j < config.databases.length; j++) {
        const db = config.databases[j];
        const updated = databases.find((d) => d.id === db.id);
        if (!updated) {
            const answer = await confirm(
                `Database '${chalk.cyan(
                    db.name,
                )}' is no longer shared with this database. Do you want to delete it locally?`,
                true,
            );

            if (answer) {
                config.remove_database(db);
                deleted++;
                j--;
            }
            continue;
        }
        config.update_database(database_object_to_database(updated));
        i++;
    }
    console.log(
        `Updated ${i} databases${
            deleted > 0 ? ` and deleted ${deleted} databases locally` : ""
        }`,
    );
}
