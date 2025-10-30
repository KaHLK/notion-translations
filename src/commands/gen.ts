import { mkdir } from "node:fs/promises";
import type { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints.ts";

import { get_from_database } from "../api.ts";
import { GenCache } from "../cache.ts";
import type { Config } from "../config.ts";
import type { Database } from "../model.ts";
import { confirm } from "../util/cli.ts";
import { exists, save } from "../util/fs.ts";
import { Notion } from "../util/notion.ts";
import { err, type Result } from "../util/result.ts";
import { gen_resx } from "./gen/resx.ts";

// TODO: Allow for setting the name of the output files (in some form of format, where a part is replaced with the language or it is appended if no replaceable part is found).

export const generate_formats = ["i18next", "android", "resx"] as const;
export type GenerateFormat = (typeof generate_formats)[number];

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
        console.info(
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

    console.info("Parsing pages");
    const { duplicates, missing, languages } = parse_pages(
        pages,
        config.databases,
        { plural: config.plural_key, list: config.list_key },
    );

    const num_duplication = duplicates.size;
    if (!options.ignore && num_duplication > 0) {
        const msg = `Found ${num_duplication} duplicate${
            num_duplication > 1 ? "s" : ""
        }`;
        if (options.ci) {
            console.info(`${msg}:`);
        }
        if (
            options.ci ||
            (
                await confirm(`${msg}. Do you want to have them listed?`, true)
            ).isSomeAnd((v) => v)
        ) {
            for (const title of duplicates) {
                console.info(`  '${title}'`);
            }
            console.info();
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
            console.info("Missing translations:");
            for (const [lang, keys] of missing.entries()) {
                console.group(`${lang}:`);
                for (const key of keys) {
                    console.info(`'${key}'`);
                }
                console.groupEnd();
                console.info();
            }
        }
    }

    if (languages.size === 0) {
        console.warn("No values/languages found. Not generating any files");
        return;
    }

    console.info("Generating language files");
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

        console.info("Saving", lng_name, "to file:", path);
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
        console.info(`Found cached values for '${db.name}'`);
        return cached.map((v) => v.pages) as Result<
            PageObjectResponse[],
            never
        >;
    }

    if (cached.error.isErr()) {
        return err(cached.error.error);
    }

    console.info(`Fetching pages from database '${db.name}'`);
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
    keys: { plural?: string; list?: string },
): {
    duplicates: Set<Notion.Key>;
    missing: Map<string, string[]>;
    languages: Map<Notion.Lng, Notion.Language>;
} {
    const missing: Map<Notion.Lng, Notion.Key[]> = new Map();
    const duplicates: Set<Notion.Key> = new Set();

    const languages: Map<Notion.Lng, Notion.Language> = new Map();
    for (const page of pages) {
        const title_property = page.properties.key as Notion.Title | undefined;
        const context_property = page.properties.context as
            | Notion.RichText
            | undefined;

        if (
            !(
                title_property &&
                title_property.type === "title" &&
                context_property
            )
        ) {
            console.info(
                `Page with id '${page.id}' did not contain a title or context column`,
            );
            continue;
        }

        let plural_value: string | undefined;
        if (keys.plural !== undefined) {
            const item = page.properties[keys.plural];
            if (item.type !== "select") {
                console.error(
                    `Column '${keys.plural}' should be a 'Select' column`,
                );
                continue;
            }
            plural_value = item.select?.name.toLowerCase();
        }
        let is_list = false;
        if (keys.list !== undefined) {
            const item = page.properties[keys.list];
            if (item.type !== "checkbox") {
                console.error(
                    `Column '${keys.list}' should be a 'Checkbox' column`,
                );
                continue;
            }
            is_list = item.checkbox;
        }

        const db = databases.find(
            (db) =>
                page.parent.type === "database_id" &&
                db.id === page.parent.database_id,
        );

        const title = (title_property as Notion.Title).title
            .map((t) => t.plain_text)
            .join("_") as Notion.Key;
        const context = get_richtext(context_property as Notion.RichText);

        const properties = Object.entries(page.properties);
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
            if (dict.has(title) && !is_list && plural_value === undefined) {
                duplicates.add(title);
                continue;
            }
            if (is_list || plural_value !== undefined) {
                const value = (dict.get(title) as Notion.MultipleValue) ?? {
                    type: is_list
                        ? Notion.LanguageValueType.List
                        : Notion.LanguageValueType.Plural,
                    values: [],
                };
                value.values.push({
                    type: Notion.LanguageValueType.Single,
                    value: text,
                    context,
                    plural: plural_value,
                });
                dict.set(title, value);
            } else {
                dict.set(title, {
                    type: Notion.LanguageValueType.Single,
                    value: text,
                    context,
                });
            }
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
    for (const [key, item] of lng) {
        if (item.type !== Notion.LanguageValueType.Single) {
            console.error(
                "Items are not allowed to be lists or plurals when exporting to i18next format",
            );
            continue;
        }
        out[key] = item.value;
    }
    return JSON.stringify(out, undefined, 4);
}

function gen_android(lng: Notion.Language): string {
    const out: string[] = [
        `<?xml version="1.0" encoding="utf-8"?>`,
        `<resources xmlns:tools="http://schemas.android.com/tools"`,
    ];
    for (const [key, item] of lng) {
        switch (item.type) {
            case Notion.LanguageValueType.Single: {
                out.push(`    <string name="${key}">${item.value}</string>`);
                continue;
            }
            case Notion.LanguageValueType.List: {
                out.push(`    <string-array name="${key}">`);
                for (const value of item.values) {
                    out.push(`        <item>${value.value}</item>`);
                }
                out.push("    </string-array>");
                continue;
            }
            case Notion.LanguageValueType.Plural: {
                out.push(`    <plurals name="${key}">`);
                for (const value of item.values) {
                    out.push(
                        `        <item quantity="${value.plural}">${value.value}</item>`,
                    );
                }
                out.push("    </plurals>");
                continue;
            }
        }
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
