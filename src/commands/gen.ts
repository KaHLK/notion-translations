import { Client } from "@notionhq/client";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { mkdir } from "fs/promises";

import { get_from_database } from "../api";
import { GenCache } from "../cache";
import { Config } from "../config";
import { Database } from "../model";
import { confirm } from "../util/cli";
import { notImplementedYet } from "../util/fn";
import { exists, save } from "../util/fs";
import { Notion } from "../util/notion";
import { Result, err } from "../util/result";
import { gen_resx } from "./gen/resx";

// TODO: Allow for setting the name of the output files (in some form of format, where a part is replaced with the language or it is appended if no replaceable part is found).

export const generate_formats = ["i18next", "android", "resx"] as const;
export type GenerateFormat = typeof generate_formats[number];

interface GenerateOptions {
    format: GenerateFormat;
    ci?: boolean;
    ignore?: boolean;
    skipCache?: boolean;
}
export async function generate(
    config: Config,
    client: Client,
    options: GenerateOptions,
) {
    if (config.databases.length === 0) {
        console.log(
            "No databases in config (add some with `translations local add`). Exiting",
        );
        return;
    }
    const cache = options.skipCache
        ? GenCache.empty(client)
        : await GenCache.open(client);
    const pages: PageObjectResponse[] = [];
    try {
        for (const db of config.databases) {
            const res = await get_db_pages(db, cache, client);
            if (res.isErr()) {
                throw res.error;
            }

            pages.push(...res.value);
        }
    } finally {
        if (!options.skipCache) {
            await cache.save();
        }
    }

    console.log("Parsing pages");
    const { duplicates, missing, languages } = parse_pages(
        pages,
        config.databases,
    );

    const num_duplication = duplicates.size;
    if (!options.ignore && num_duplication > 0) {
        const msg = `Found ${num_duplication} duplicate${
            num_duplication > 1 ? "s" : ""
        }`;
        if (options.ci) {
            console.log(`${msg}:`);
        }
        if (
            options.ci ||
            (
                await confirm(`${msg}. Do you want to have them listed?`, true)
            ).isSomeAnd((v) => v)
        ) {
            for (const title of duplicates) {
                console.log(`  '${title}'`);
            }
            console.log();
        }
    }

    const num_missing = Array.from(missing.values()).reduce(
        (acc, cur) => acc + cur.length,
        0,
    );
    if (!options.ignore && num_missing > 0) {
        let answer = options.ci;
        if (options.ci === undefined) {
            answer = (
                await confirm(
                    `Found ${num_missing} missing translations. Do you want to have them listed?`,
                    true,
                )
            ).expect("Please answer with a 'y' or 'n'.");
        }
        if (answer) {
            console.log("Missing translations:");
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

    if (languages.size === 0) {
        console.warn("No values/languages found. Not generating any files");
        return;
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

            case "resx": {
                str = gen_resx(lng);
                path = `${await get_dir(
                    config.out,
                )}Repositories.LocalizationRepository.${lng_name}.resx`;
                break;
            }
        }

        console.log("Saving", lng_name, "to file:", path);
        await save(path, str);
    }
}

async function get_db_pages(
    db: Database,
    cache: GenCache,
    client: Client,
): Promise<Result<PageObjectResponse[], Error>> {
    const cached = await cache.get_valid_entry(db.id);

    if (cached.isOk()) {
        console.log(`Found cached values for '${db.name}'`);
        return cached.map((v) => v.pages) as Result<
            PageObjectResponse[],
            never
        >;
    }

    if (cached.error.isErr()) {
        return err(cached.error.error);
    }

    console.log(`Fetching pages from database '${db.name}'`);
    const pages = await get_from_database(client, db.id);
    if (pages.isErr()) {
        return pages;
    }

    const last_updated = cached.error.value.unwrapOrElse(() => {
        return Math.max(
            ...pages.value.map((v) => Date.parse(v.last_edited_time)),
        );
    });
    cache.store(db.id, last_updated, pages.value);

    return pages;
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

function parse_pages(
    pages: PageObjectResponse[],
    databases: Database[],
): {
    duplicates: Set<Notion.Key>;
    missing: Map<string, string[]>;
    languages: Map<Notion.Lng, Notion.Language>;
} {
    const missing: Map<Notion.Lng, Notion.Key[]> = new Map();
    const duplicates: Set<Notion.Key> = new Set();

    const languages: Map<Notion.Lng, Notion.Language> = new Map();
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

        const db = databases.find(
            (db) =>
                page.parent.type === "database_id" &&
                db.id === page.parent.database_id,
        );

        const title = (_title[1] as Notion.Title).title
            .map((t) => t.plain_text)
            .join("_") as Notion.Key;
        const context = get_richtext(_context[1] as Notion.RichText);
        const rest = properties.filter(
            ([n, p]) => n !== "context" && p.type === "rich_text",
        ) as [Notion.Lng, Notion.RichText][];

        for (const [name, prop] of rest) {
            const mapped_named = (db?.lang_mapping?.[name] ??
                name) as Notion.Lng;

            const text = get_richtext(prop);
            if (text.length === 0) {
                const arr = missing.get(mapped_named) ?? [];
                missing.set(mapped_named, arr.concat(title));
                continue;
            }

            const dict: Notion.Language =
                languages.get(mapped_named) ?? new Map();
            if (dict.has(title)) {
                duplicates.add(title);
                continue;
            }
            dict.set(title, {
                value: text,
                context,
            });
            languages.set(mapped_named, dict);
        }
    }

    return {
        duplicates,
        missing,
        languages,
    };
}

function gen_i18next(lng: Notion.Language): string {
    const out: { [key: Notion.Key]: string } = {};
    for (const [key, { value }] of lng) {
        out[key] = value;
    }
    return JSON.stringify(out, undefined, 4);
}

function gen_android(lng: Notion.Language): string {
    const out: string[] = [
        `<?xml version="1.0" encoding="utf-8"?>`,
        `<resources xmlns:tools="http://schemas.android.com/tools"`,
    ];
    for (const [key, { value }] of lng) {
        out.push(`    <string name="${key}">${value}</string>`);
    }
    out.push("</resources>");
    return out.join("\n");
}

function get_richtext(rich_text: Notion.RichText): string {
    return rich_text.rich_text
        .map((rt) => rt.plain_text)
        .join(" ")
        .trim();
}
