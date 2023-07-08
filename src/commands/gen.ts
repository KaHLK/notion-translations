import { Client } from "@notionhq/client";
import { Config } from "../config";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { get_from_database } from "../api";
import { notImplementedYet } from "../util/fn";
import { confirm } from "../util/cli";

type Properties = PageObjectResponse["properties"][string];
type Title = Extract<Properties, { type: "title" }>;
type RichText = Extract<Properties, { type: "rich_text" }>;

interface GenerateOptions {
    format: "i18next" | "android";
    category?: boolean;
    ci?: boolean;
    ignore?: boolean;
}
export async function generate(
    config: Config,
    client: Client,
    options: GenerateOptions,
) {
    const pages: PageObjectResponse[] = [];
    for (const db of config.databases) {
        console.log(`Fetching pages from database '${db.name}'`);
        const res = await get_from_database(client, db.id);
        if (res.isErr()) {
            console.error(res.error);
            continue;
        }

        pages.push(...res.value);
    }

    console.log("Parsing pages");
    // TODO: Turn duplicates into map
    const duplicates: [string, RichText][] = [];
    const missing_translations: Map<string, string[]> = new Map();
    type Language = Map<string, { value: RichText; context: RichText }>;
    const map: Map<string, Language> = new Map();
    for (const page of pages) {
        const properties = Object.entries(page.properties);
        const _title = properties.find(([_, p]) => p.type === "title");
        const _context = properties.find(([n]) => n === "context");
        const rest = properties.filter(
            ([n, p]) => n !== "context" && p.type === "rich_text",
        ) as [string, RichText][];

        if (!_title || !_context) {
            console.log(
                `Page with id '${page.id}' did not contain a title or context column`,
            );
            continue;
        }
        const title = (_title[1] as Title).title
            .map((t) => t.plain_text)
            .join("_");
        const context = _context[1] as RichText;

        for (const [name, prop] of rest) {
            if (prop.rich_text.length === 0) {
                const arr = missing_translations.get(name) ?? [];
                missing_translations.set(name, arr.concat(title));
                continue;
            }

            const dict: Language = map.get(name) ?? new Map();
            if (dict.has(name)) {
                duplicates.push([title, prop]);
                continue;
            }
            dict.set(title, {
                value: prop,
                context,
            });
            map.set(name, dict);
        }
    }

    if (!options.ignore && duplicates.length > 0) {
        console.log("Found", duplicates.length, "duplicates");
        for (const [title, prop] of duplicates) {
            notImplementedYet(
                "TODO: Handle duplicate keys. If option.ci === true, say no to all prompts (just list the duplicates)",
            );
        }
    }

    const num_missing = Array.from(missing_translations.values()).reduce(
        (acc, cur) => acc + cur.length,
        0,
    );
    if (!options.ignore && num_missing > 0) {
        let answer = !options.ci;
        if (options.ci === undefined) {
            answer = (
                await confirm(
                    `Found ${num_missing} missing translations. Do you want to have them listed?`,
                    true,
                )
            ).expect("Please answer with a 'y' or 'n'.");
        }
        if (answer) {
            for (const [lang, keys] of missing_translations.entries()) {
                console.group(`${lang}:`);
                for (const key of keys) {
                    console.log(`'${key}'`);
                }
                console.groupEnd();
                console.log();
            }
        }
    }

    notImplementedYet("TODO: Generate the files");
}
