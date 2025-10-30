import type { DatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints.ts";
import type { Notion } from "./util/notion.ts";

export interface LangMapping {
    [key: Notion.Lng]: string;
}

export interface Database {
    id: string;
    name: string;
    lang_mapping?: LangMapping;
}

export function database_object_to_database(
    db: DatabaseObjectResponse,
): Database {
    return {
        id: db.id,
        name: db.title[0].plain_text,
    };
}
