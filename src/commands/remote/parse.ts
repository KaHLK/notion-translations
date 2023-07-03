import { readFile } from "node:fs/promises";

import { Option, some, none } from "../../util/option";
import { get_text } from "../../util/cli";

export const import_formats = [
    "aggregate",
    "key-value",
    "poeditor-export-json",
] as const;
export type ImportFormat = typeof import_formats[number];

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

async function read_json(path: string): Promise<Option<unknown>> {
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
    languages: { [lng: string]: string };
    context: string;
};
export async function parse_file(
    file_path: string,
    format: ImportFormat,
): Promise<Option<TranslationUnit[]>> {
    const res = await (
        await read_json(file_path)
    ).andThenAsync(async (file) => {
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
    });

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
