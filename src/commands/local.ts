import { Client } from "@notionhq/client";
import chalk from "chalk";

import { Config } from "../config";
import { get_databases } from "../api";
import { Database } from "../model";
import { notImplementedYet } from "../util/fn";
import { choose } from "../util/cli";

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
        const database: Database = { id: db.id, name: db.title[0].plain_text };
        if (idx >= 0) {
            config.update_database(idx, database);
        } else {
            available.push(database);
        }
    }

    if (available.length === 1) {
        notImplementedYet("TODO: Ask if the user want to add the single table");
    }

    const arr = choose(
        "Multiple tables found. Please pick the ones you want to process",
        available,
        (v, idx) => `${chalk.cyan(idx + 1)}: ${chalk.redBright(v.name)}`,
    );
    config.add_databases(arr);
}

export async function remove(config: Config) {
    notImplementedYet(
        "TODO: List databases in config and allow for removing one/multiple",
    );
}

export async function list(config: Config) {
    notImplementedYet("TODO: List databases in config");
}

export async function sync(config: Config, client: Client) {
    notImplementedYet(
        "TODO: Update names in the config with the names in notion. Also allow for removing databases that no longer exist on notion",
    );
}
