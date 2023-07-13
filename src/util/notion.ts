import { isNotionClientError } from "@notionhq/client";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export function map_error(e: unknown, message: string): Error {
    if (isNotionClientError(e)) {
        return Error(`${message} \n[${e.code}] ${e.message}`);
    } else {
        return Error(`Unknown error occurred: ${e} | ${message}`);
    }
}

export namespace Notion {
    export type Properties = PageObjectResponse["properties"][string];
    export type Title = Extract<Properties, { type: "title" }>;
    export type RichText = Extract<Properties, { type: "rich_text" }>;

    export type Lng = string & { readonly lng: unique symbol };
    export type Key = string & { readonly title: unique symbol };

    export type Language = Map<Key, { value: RichText; context: RichText }>;
}
