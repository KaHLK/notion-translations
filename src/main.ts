import { Client } from "@notionhq/client";
import { Command } from "commander";
import dotenv from "dotenv";

import { Config } from "./config";
import { CONFIG_FILE } from "./constants";
import { Util } from "./commands";

export default async function main(): Promise<number> {
    dotenv.config();

    if (!process.env.NOTION_TOKEN) {
        console.error(
            "Please specify a notion api token through the NOTION_TOKEN environment variable",
        );
        return 1;
    }

    const config = await get_config();
    const notion = new Client({
        auth: process.env.NOTION_TOKEN,
    });

    const app = new Command();
    app.name("notion-translations").description(
        "Fetch and parse translations from notion databases",
    );

    app.command("init")
        .description(
            `Initialize the tool for a directory. Creates a '${CONFIG_FILE}' with the required values.`,
        )
        .option(
            "-o, --out-dir <path>",
            "The path to save the processed language files to",
        )
        .action(async (_, opt) => await Util.init(opt.opts(), config));

    app.command("clean")
        .description("Cleans all temporary files")
        .option("-a, --all", "Also remove all config files")
        .action(async (_, opt) => await Util.clean(opt.opts()));

    const db = app
        .command("db")
        .description("Manipulate the list of databases to work with");

    db.command("add")
        .description("Add new databases to the list")
        .action(async () => {});
    db.command("rm")
        .description("Remove a database from the list")
        .action(async () => {});
    db.command("list")
        .description("List all databases in the list")
        .action(() => {});
    db.command("sync")
        .description(
            "Sync the title and properties of the databases in the list with their counterparts on notion",
        )
        .action(async () => {});
    db.command("new")
        .description(
            "Create a new database with all the languages the other databases have.",
        )
        .argument("name", "The name of the database to create")
        .action(async (arg) => {});

    db.command("normalize")
        .description(
            "Normalize the databases so that they all have the same languages (Only adds languages to databases, doesn't delete any)",
        )
        .option(
            "--dry-run",
            "Print the updates to be performed, but don't perform them",
        )
        .action(async (options) => {});
    // TODO: 'lang <name>' -> create a new property (row) in all databases.
    // TODO: 'import <name> <file>' -> takes a .json and creates a new database with a specified name and inserts the values from the json

    app.command("gen")
        .description("Generate language files from the tables in notion")
        .option(
            "-f, --format <format>",
            "The format to output. Possible options: i18next",
            "i18next",
        )
        .option(
            "-c, --category",
            "Add each table as a 'category' in the generated files (A nesting level).",
        )
        .action(async (_, opt) => {});

    await app.parseAsync(process.argv);

    await config.save();

    return 0;
}

async function get_config(): Promise<Config> {
    return (await Config.from_file()).unwrapOrElse(Config.empty);
}
