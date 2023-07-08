import { Client } from "@notionhq/client";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { mkdir } from "fs/promises";

import { Config } from "../config";
import { get_from_database } from "../api";
import { notImplementedYet } from "../util/fn";
import { confirm } from "../util/cli";
import { exists, save } from "../util/fs";

type Properties = PageObjectResponse["properties"][string];
type Title = Extract<Properties, { type: "title" }>;
type RichText = Extract<Properties, { type: "rich_text" }>;

type Lng = string & { readonly lng: unique symbol };
type Key = string & { readonly title: unique symbol };

type Language = Map<Key, { value: RichText; context: RichText }>;

interface GenerateOptions {
    format: "i18next" | "android";
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
    const { duplicates, missing, languages } = parse_pages(pages);

    const num_duplication = Array.from(duplicates.values()).reduce(
        (acc, cur) => acc + cur.length,
        0,
    );
    if (!options.ignore && num_duplication > 0) {
        console.log("Found", num_duplication, "duplicates");
        for (const [title, prop] of duplicates) {
            notImplementedYet(
                "TODO: Handle duplicate keys. If option.ci === true, say no to all prompts (just list the duplicates)",
            );
        }
    }

    const num_missing = Array.from(missing.values()).reduce(
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
            for (const [lang, keys] of missing.entries()) {
                console.group(`${lang}:`);
                for (const key of keys) {
                    console.log(`'${key}'`);
                }
                console.groupEnd();
                console.log();
            }
        }
    }

    console.log("Generating language files");
    for (const [lng_name, lng] of languages) {
        let path: string;
        let str: string;
        switch (options.format) {
            case "android": {
                str = gen_android(lng);
                const dir = await get_dir(
                    config.out,
                    (dir) => `${dir}-${lng_name}`,
                );
                path = `${dir}strings.xml`;
                break;
            }

            case "i18next": {
                str = gen_i18next(lng);
                path = `${await get_dir(config.out)}${lng_name}.json`;
                break;
            }
        }

        await save(path, str);
    }
}

async function get_dir(
    dir?: string,
    transform?: (v: string) => string,
): Promise<string> {
    if (dir) {
        const path = transform ? transform(dir) : dir;
        if (!(await exists(transform ? transform(dir) : dir))) {
            await mkdir(path, { recursive: true });
        }
        return `${path}/`;
    }
    return "";
}

function parse_pages(pages: PageObjectResponse[]): {
    duplicates: Map<string, RichText[]>;
    missing: Map<string, string[]>;
    languages: Map<Lng, Language>;
} {
    const missing: Map<Lng, Key[]> = new Map();
    const duplicates: Map<Key, RichText[]> = new Map();

    const languages: Map<Lng, Language> = new Map();
    for (const page of pages) {
        const properties = Object.entries(page.properties);
        const _title = properties.find(([_, p]) => p.type === "title");
        const _context = properties.find(([n]) => n === "context");

        if (!_title || !_context) {
            console.log(
                `Page with id '${page.id}' did not contain a title or context column`,
            );
            continue;
        }

        const title = (_title[1] as Title).title
            .map((t) => t.plain_text)
            .join("_") as Key;
        const context = _context[1] as RichText;
        const rest = properties.filter(
            ([n, p]) => n !== "context" && p.type === "rich_text",
        ) as [Lng, RichText][];

        for (const [name, prop] of rest) {
            if (prop.rich_text.length === 0) {
                const arr = missing.get(name) ?? [];
                missing.set(name, arr.concat(title));
                continue;
            }

            const dict: Language = languages.get(name) ?? new Map();
            if (dict.has(title)) {
                const arr = duplicates.get(title) ?? [];
                duplicates.set(title, arr.concat(prop));
                continue;
            }
            dict.set(title, {
                value: prop,
                context,
            });
            languages.set(name, dict);
        }
    }

    return {
        duplicates,
        missing,
        languages,
    };
}

function gen_i18next(lng: Language): string {
    const out: { [key: Key]: string } = {};
    for (const [key, { value }] of lng) {
        out[key] = value.rich_text.map((v) => v.plain_text).join(" ");
    }
    return JSON.stringify(out, undefined, 4);
}

function gen_android(lng: Language): string {
    const out: string[] = [
        `<?xml version="1.0" encoding="utf-8"?>`,
        `<resources xmlns:tools="http://schemas.android.com/tools"`,
    ];
    for (const [key, { value }] of lng) {
        out.push(
            `    <string name="${key}">${value.rich_text
                .map((v) => v.plain_text)
                .join(" ")}</string>`,
        );
    }
    out.push("</resources>");
    return out.join("\n");
}
