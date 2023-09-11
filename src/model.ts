import { DatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Notion } from "./util/notion";

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
