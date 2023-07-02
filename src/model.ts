import { DatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export interface Database {
    id: string;
    name: string;
}

export function database_object_to_database(
    db: DatabaseObjectResponse,
): Database {
    return {
        id: db.id,
        name: db.title[0].plain_text,
    };
}
