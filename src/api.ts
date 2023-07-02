import { Client, collectPaginatedAPI } from "@notionhq/client";
import {
    DatabaseObjectResponse,
    UpdateDatabaseParameters,
} from "@notionhq/client/build/src/api-endpoints";

import { map_error } from "./util/notion";
import { Result, err, ok } from "./util/result";

export async function get_databases(
    client: Client,
): Promise<Result<DatabaseObjectResponse[], Error>> {
    try {
        const res = (await collectPaginatedAPI(client.search, {
            filter: { value: "database", property: "object" },
        })) as DatabaseObjectResponse[];

        return ok(res);
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
