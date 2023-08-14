import { Client } from "@notionhq/client";
import { Argument, Command, Option } from "commander";
import dotenv from "dotenv";

import { Gen, Local, Remote, Util } from "./commands";
import { Config } from "./config";
import { CONFIG_FILE } from "./constants";

interface GlobalOptions {
    config?: string;
}

export default async function main(): Promise<number> {
    dotenv.config();

    if (!process.env.NOTION_TOKEN) {
        console.error(
            "Please specify a notion api token through the NOTION_TOKEN environment variable",
        );
        return 1;
    }

    const notion = new Client({
        auth: process.env.NOTION_TOKEN,
        fetch: fetch,
    });

    let config: Config;

    const app = new Command();
    app.name("notion-translations")
        .description("Fetch and parse translations from notion databases")
        .addOption(
            new Option(
                "-c, --config <PATH>",
                "Overwrite the path to the config file",
            ),
        );

    app.command("init")
        .description(
            `Initialize the tool for a directory. Creates a '${CONFIG_FILE}' with the required values.`,
        )
        .option(
            "-o, --out-dir <path>",
            "The path to save the processed language files to",
        )
        .action(async (options, cmd) => {
            config = await get_config(cmd);
            await Util.init(options, config);
        });

    app.command("clean")
        .description("Cleans all temporary files")
        .option("-a, --all", "Also remove all config files")
        .action(async (options) => await Util.clean(options));

    const local = app
        .command("local")
        .description("Manipulate the local list of databases to work with");

    local
        .command("add")
        .description("Add new databases to the list")
        .action(async (_, cmd) => {
            config = await get_config(cmd);
            await Local.add(config, notion);
        });
    local
        .command("rm")
        .description("Remove a database from the list")
        .action(async (_, cmd) => {
            config = await get_config(cmd);
            await Local.remove(config);
        });
    local
        .command("list")
        .description("List all databases in the list")
        .action(async (_, cmd) => {
            config = await get_config(cmd);
            Local.list(config);
        });
    local
        .command("sync")
        .description(
            "Sync the title and properties of the databases in the list with their counterparts on notion",
        )
        .action(async (_, cmd) => {
            config = await get_config(cmd);
            await Local.sync(config, notion);
        });

    const remote = app
        .command("remote")
        .description("Manipulate remote databases");

    remote
        .command("new")
        .description(
            "Create a new remote database with all the languages the other databases have.",
        )
        .option("--name <name>", "The name of the database to create")
        .action(async (options, cmd) => {
            config = await get_config(cmd);
            await Remote.new_database(config, notion, options.name);
        });

    remote
        .command("normalize")
        .description(
            "Normalize the databases so that they all have the same languages (Only adds languages to databases, doesn't delete any)",
        )
        .option(
            "-d, --dry-run",
            "Print the updates to be performed, but don't perform them",
        )
        .action(async (options, cmd) => {
            config = await get_config(cmd);
            await Remote.normalize(config, notion, options);
        });

    remote
        .command("import")
        .description("Create a new database with the values from a json file.")
        .argument("file", "Name of the file to import")
        .option(
            "--append [id]",
            "Append the imported values to an existing database",
        )
        .addArgument(
            new Argument(
                "format",
                "The format to use for parsing the file",
            ).choices(Remote.import_formats),
        )
        .action(async (file, format, options, cmd) => {
            config = await get_config(cmd);
            await Remote.new_from_import(config, notion, file, format, options);
        });
    // TODO: 'lang <name>' -> create a new property (row) in all databases.

    app.command("gen")
        .description("Generate language files from the tables in notion")
        .addOption(
            new Option("-f, --format <format>", "The format to output")
                .choices(Gen.generate_formats)
                .default(Gen.generate_formats[0]),
        )
        .option(
            "--ci",
            "Answers no to all duplicates and lists the missing translations",
        )
        .option("-i, --ignore", "Ignore all prompts")
        .option("-S, --skip-cache", "Skip the cache entirely")
        .action(async (_options, cmd) => {
            config = await get_config(cmd);
            await Gen.generate(config, notion, cmd.optsWithGlobals());
        });

    await app.parseAsync(process.argv);

    config ??= Config.empty();
    await config.save();

    return 0;
}

async function get_config(cmd: Command): Promise<Config> {
    const options = cmd.optsWithGlobals() as GlobalOptions;
    return (await Config.from_file(options.config)).unwrapOrElse(() =>
        Config.empty(options.config),
    );
}
