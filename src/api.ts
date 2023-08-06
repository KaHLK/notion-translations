import { Client, collectPaginatedAPI } from "@notionhq/client";
import {
    CreateDatabaseParameters,
    CreatePageParameters,
    DatabaseObjectResponse,
    PageObjectResponse,
    QueryDatabaseParameters,
    UpdateDatabaseParameters,
    UpdatePageParameters,
} from "@notionhq/client/build/src/api-endpoints";

import { Notion, map_error } from "./util/notion";
import { Result, err, ok } from "./util/result";

export async function get_databases(
    client: Client,
): Promise<Result<DatabaseObjectResponse[], Error>> {
    try {
        const res = (await collectPaginatedAPI(client.search, {
            filter: { value: "database", property: "object" },
        })) as DatabaseObjectResponse[];

        return ok(res.filter((db) => !db.archived));
    } catch (e) {
        return err(
            map_error(
                e,
                "Error occurred trying to get all databases shared with this integration",
            ),
        );
    }
}

export async function get_database(
    client: Client,
    id: string,
): Promise<Result<DatabaseObjectResponse, Error>> {
    try {
        const res = await client.databases.retrieve({ database_id: id });

        return ok(res as DatabaseObjectResponse);
    } catch (e) {
        return err(
            map_error(e, `Error occurred trying to fetch database '${id}'`),
        );
    }
}

export async function create_database(
    client: Client,
    db: CreateDatabaseParameters,
): Promise<Result<DatabaseObjectResponse, Error>> {
    try {
        const res = await client.databases.create(db);
        return ok(res as DatabaseObjectResponse);
    } catch (e) {
        return err(
            map_error(
                e,
                `Error occurred trying to create database '${
                    (db.title?.[0] as { text: { content: string } }).text
                        .content
                }`,
            ),
        );
    }
}

export type DatabaseUpdate = Omit<UpdateDatabaseParameters, "database_id">;
export async function update_database(
    client: Client,
    id: string,
    update: DatabaseUpdate,
): Promise<Result<null, Error>> {
    try {
        const res = await client.databases.update({
            database_id: id,
            ...update,
        });

        return ok(null);
    } catch (e) {
        return err(
            map_error(e, `Error occurred trying to update database'${id}'`),
        );
    }
}

export async function get_pages(
    client: Client,
): Promise<Result<PageObjectResponse[], Error>> {
    try {
        const res = (
            (await collectPaginatedAPI(client.search, {
                filter: { property: "object", value: "page" },
            })) as PageObjectResponse[]
        ).filter(
            (page) => page.parent.type !== "database_id" && !page.archived,
        );
        return ok(res);
    } catch (e) {
        return err(
            map_error(
                e,
                "Error occurred trying to get all pages shared with this integration.",
            ),
        );
    }
}

export async function query_database(
    client: Client,
    database_id: string,
    filter: Omit<QueryDatabaseParameters, "database_id"> = {},
): Promise<Result<PageObjectResponse[], Error>> {
    try {
        const res = await client.databases.query({
            database_id,
            ...filter,
        });
        return ok(res.results as PageObjectResponse[]);
    } catch (e) {
        return err(
            map_error(
                e,
                "Error occurred trying to get all pages shared with this integration",
            ),
        );
    }
}

export async function get_from_database(
    client: Client,
    id: string,
): Promise<Result<PageObjectResponse[], Error>> {
    return query_database(client, id);
}

export async function get_page_from_database(
    client: Client,
    id: string,
    title_query: string,
): Promise<Result<PageObjectResponse | undefined, Error>> {
    return (
        await query_database(client, id, {
            filter: {
                property: "key",
                title: {
                    equals: title_query,
                },
            },
        })
    ).map((res) => {
        const idx = res
            .map((r) =>
                (r.properties.key as Notion.Title).title
                    .map((t) => t.plain_text)
                    .join(" "),
            )
            .findIndex((t) => t === title_query);

        if (idx >= 0) {
            return res[idx];
        }
        return undefined;
    });
}

export async function create_page(
    client: Client,
    page: CreatePageParameters,
): Promise<Result<PageObjectResponse, Error>> {
    try {
        const res = await client.pages.create(page);
        return ok(res as PageObjectResponse);
    } catch (e) {
        return err(
            map_error(
                e,
                `Error occurred trying to create page '${
                    Object.values(page.properties).find(
                        (p) => p.type === "title",
                    )?.title[0].text.content
                }'`,
            ),
        );
    }
}

export async function update_page(client: Client, page: UpdatePageParameters) {
    try {
        const res = await client.pages.update(page);
        return ok(res as PageObjectResponse);
    } catch (e) {
        return err(
            map_error(
                e,
                `Error occurred trying to update page '${
                    Object.values(page.properties ?? {}).find(
                        (p) => p.type === "title",
                    )?.title[0].text.content
                }`,
            ),
        );
    }
}
