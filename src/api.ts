import { type Client, collectPaginatedAPI } from "@notionhq/client";
import type {
    CreateDatabaseParameters,
    CreatePageParameters,
    DatabaseObjectResponse,
    PageObjectResponse,
    QueryDatabaseParameters,
    SearchParameters,
    UpdateDatabaseParameters,
    UpdateDatabaseResponse,
    UpdatePageParameters,
} from "@notionhq/client/build/src/api-endpoints.ts";
import { map_error, type Notion } from "./util/notion.ts";
import { err, ok, type Result } from "./util/result.ts";
import { with_retry } from "./util/retry.ts";

export async function get_databases(
    client: Client,
): Promise<Result<DatabaseObjectResponse[], Error>> {
    try {
        const res = (await collectPaginatedAPI(search_with_retry(client), {
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
        const res = await with_retry(`retrieve database '${id}'`, () =>
            client.databases.retrieve({ database_id: id }),
        );

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
        const res = await with_retry("create database", () =>
            client.databases.create(db),
        );
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
): Promise<Result<UpdateDatabaseResponse, Error>> {
    try {
        const res = await with_retry(`update database '${id}'`, () =>
            client.databases.update({ database_id: id, ...update }),
        );

        return ok(res);
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
            (await collectPaginatedAPI(search_with_retry(client), {
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
        const res = await with_retry(`query database '${database_id}'`, () =>
            client.databases.query({ database_id, ...filter }),
        );
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
    try {
        const res = await collectPaginatedAPI(query_with_retry(client, id), {
            database_id: id,
        });

        return ok(res as PageObjectResponse[]);
    } catch (e) {
        return err(
            map_error(
                e,
                `Error occurred trying to get pages from database '${id}'`,
            ),
        );
    }
}

export async function get_page_from_database(
    client: Client,
    id: string,
    title_query: string,
): Promise<Result<PageObjectResponse | undefined, Error>> {
    try {
        const res = (await collectPaginatedAPI(query_with_retry(client, id), {
            database_id: id,
            filter: {
                property: "key",
                title: {
                    equals: title_query,
                },
            },
        })) as PageObjectResponse[];

        const idx = res
            .map((r) =>
                (r.properties.key as Notion.Title).title
                    .map((t) => t.plain_text)
                    .join(""),
            )
            .indexOf(title_query);

        if (idx >= 0) {
            return ok(res[idx]);
        }
        return ok(undefined);
    } catch (e) {
        return err(
            map_error(
                e,
                `Error occurred trying to get pages from database '${id}'`,
            ),
        );
    }
}

export async function create_page(
    client: Client,
    page: CreatePageParameters,
): Promise<Result<PageObjectResponse, Error>> {
    try {
        const res = await with_retry("create page", () =>
            client.pages.create(page),
        );
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
        const res = await with_retry(`update page '${page.page_id}'`, () =>
            client.pages.update(page),
        );
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

function query_with_retry(client: Client, id: string) {
    return (args: QueryDatabaseParameters) =>
        with_retry(`query database '${id}'`, () =>
            client.databases.query(args),
        );
}

function search_with_retry(client: Client) {
    return (args: SearchParameters) =>
        with_retry("search", () => client.search(args));
}
