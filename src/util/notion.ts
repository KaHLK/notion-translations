import { isNotionClientError } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints.ts";

export function map_error(e: unknown, message: string): Error {
    if (isNotionClientError(e)) {
        return new Error(`${message} \n[${e.code}] ${e.message}`);
    }
    return new Error(`Unknown error occurred: ${e} | ${message}`);
}

// biome-ignore lint/style/noNamespace: Keep for now
export namespace Notion {
    export type Properties = PageObjectResponse["properties"][string];
    export type Title = Extract<Properties, { type: "title" }>;
    export type RichText = Extract<Properties, { type: "rich_text" }>;

    export type Lng = string & { readonly lng: unique symbol };
    export type Key = string & { readonly title: unique symbol };

    export enum LanguageValueType {
        Single,
        List,
        Plural,
    }
    export type SingleValue = {
        type: LanguageValueType.Single;
        value: string;
        context: string;
    };
    export type MultipleValue = {
        type: LanguageValueType.List | LanguageValueType.Plural;
        values: (SingleValue & { plural?: string })[];
    };
    export type Language = Map<Key, SingleValue | MultipleValue>;
}
