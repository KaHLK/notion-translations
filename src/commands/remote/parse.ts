import { open, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { type Element, xml2js } from "xml-js";
import type { Config } from "../../config";
import { get_text } from "../../util/cli";
import { none, type Option, some } from "../../util/option";

export const import_formats = [
    "aggregate",
    "key-value",
    "poeditor-export-json",
    "android",
] as const;
export type ImportFormat = (typeof import_formats)[number];

type KeyValueJSON = {
    [key: string]: string | { [v: string]: string };
};
type AggregateJSON = {
    [key: string]: {
        [lng: string]: string;
    };
};
type POEditorExportJSON = {
    term: string;
    definition: string;
    context: string;
    term_plural: string;
    reference: string;
    comment: string;
}[];

async function read_json<T>(path: string): Promise<Option<T>> {
    try {
        const str = (await readFile(path)).toString();
        return some(JSON.parse(str));
    } catch (e) {
        console.error(
            "Failed to read file. Expected file to be of .json format",
            e,
        );
        return none();
    }
}

type TranslationUnit = {
    key: string;
    context: string;
    languages: Record<string, string>;
};
export async function parse_file(
    file_path: string,
    format: ImportFormat,
): Promise<Option<TranslationUnit[]>> {
    if (format === "android") {
        return await parse_android(file_path);
    }
    const res = await (await read_json(file_path)).andThenAsync(
        async (file) => {
            switch (format) {
                case "key-value": {
                    return await parse_key_value(file);
                }
                case "aggregate": {
                    return parse_aggregate(file);
                }
                case "poeditor-export-json": {
                    return await parse_poeditor_export(file);
                }
            }
        },
    );

    return res;
}

async function parse_key_value(
    file: unknown,
): Promise<Option<TranslationUnit[]>> {
    if (
        typeof file !== "object" ||
        !Object.values(file as object).every((v) =>
            typeof v === "object"
                ? Object.values(v).every((v) => typeof v === "string")
                : typeof v === "string",
        )
    ) {
        console.error(
            "Expected file to be of 'key-value' format, but encountered an error",
        );
        return none();
    }
    const key_values = file as KeyValueJSON;

    const lng = (
        await get_text("What language does this file describe")
    ).expect("Expected a language to be entered. Exiting");

    return some(
        Object.entries(key_values).map<TranslationUnit>(([key, value]) => {
            if (typeof value === "object") {
                const [_key, v] = Object.entries(value)[0];
                return {
                    key: _key,
                    languages: { [lng]: v },
                    context: key,
                };
            } else {
                return {
                    key,
                    languages: { [lng]: value },
                    context: "",
                };
            }
        }),
    );
}

function parse_aggregate(file: unknown): Option<TranslationUnit[]> {
    if (
        typeof file !== "object" ||
        !Object.values(file as object).every(
            (v) =>
                typeof v === "object" &&
                Object.values(v).every((v) => typeof v === "string"),
        )
    ) {
        console.error(
            "Expected file to be of 'aggregate' format, but encountered an error",
        );
        return none();
    }
    const aggregate = file as AggregateJSON;
    const res: TranslationUnit[] = [];
    for (const [key, values] of Object.entries(aggregate)) {
        res.push({ key, languages: values, context: "" });
    }

    return some(res);
}

async function parse_poeditor_export(
    file: unknown,
): Promise<Option<TranslationUnit[]>> {
    if (
        !Array.isArray(file) ||
        !file.every(
            (v) =>
                v.term !== undefined &&
                v.definition !== undefined &&
                v.context !== undefined,
        )
    ) {
        console.error(
            "Expected file to be of 'poeditor export' format, but encountered an error",
        );
        return none();
    }
    const poe = file as POEditorExportJSON;

    const lng = (
        await get_text("What language does this file describe")
    ).expect("Expected a language to be entered. Exiting");

    return some(
        poe.map<TranslationUnit>((v) => ({
            context: v.context,
            key: v.term,
            languages: { [lng]: v.definition },
        })),
    );
}

async function parse_android(
    file_path: string,
): Promise<Option<TranslationUnit[]>> {
    const entries: [string, Element[]][] = [];

    const file_info = await stat(file_path);
    if (file_info.isDirectory()) {
        const defaultLng = (
            await get_text(
                "What language does the 'values/strings.xml' file describe",
            )
        ).expect("Expected a language to be entered. Exiting");
        entries.push(
            ...(
                await Promise.all(
                    (
                        await readdir(file_path)
                    )
                        .filter((v) => v.startsWith("values"))
                        .map((v) => {
                            const [_, lng] = v.split("-");
                            return read_xml(
                                path.join(file_path, v, "strings.xml"),
                                lng ?? defaultLng ?? "en",
                            );
                        }),
                )
            )
                .filter((v) => v.isSome())
                .map((v) => v.value),
        );
    } else {
        const lng = (
            await get_text(
                "What language does the 'values/strings.xml' file describe",
            )
        ).expect("Expected a language to be entered. Exiting");
        const file = xml2js((await readFile(file_path)).toString());

        const el = file.elements[0] as Element;
        if (el.name !== "resources") {
            console.error("Expected 'resources' as outer xml element of file");
            return none();
        }
        entries.push([lng, el.elements ?? []]);
    }

    if (entries.length === 0) {
        return none();
    }

    const res = new Map<string, TranslationUnit>();
    for (const [lng, elements] of entries) {
        for (const el of elements) {
            if (el.type !== "element") {
                continue;
            }
            const key = el.attributes?.name as string;
            const unit = res.get(key) ?? { key, context: "", languages: {} };
            switch (el.name) {
                case "string": {
                    const value = el.elements?.at(0)?.text as string;
                    if (value === undefined) {
                        console.error("Text not defined for", key);
                        continue;
                    }
                    unit.languages[lng] = value;
                    break;
                }
                case "string-array":
                case "plurals": {
                    console.warn(
                        "'string-array' and 'plurals' are not yet supported",
                    );
                    continue;
                }
                default: {
                    console.info(`Unhandled tag type '${el.type}'`);
                    continue;
                }
            }
            res.set(key, unit);
        }
    }
    return some(Array.from(res.values()));
}

async function read_xml(
    file_path: string,
    lng: string,
): Promise<Option<[string, Element[]]>> {
    const file = xml2js((await readFile(file_path)).toString());

    const el = file.elements[0] as Element;
    if (el.name !== "resources") {
        console.error(
            "Expected 'resources' as outer xml element of file",
            file_path,
        );
        return none();
    }

    return some([lng, el.elements ?? []]);
}
