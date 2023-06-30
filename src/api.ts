import { Client, collectPaginatedAPI } from "@notionhq/client";
import { Result, ok, err } from "./util/result";
import { DatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { map_error } from "./util/notion";

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
                "Error accurred trying to get all databases shared with this integration",
            ),
        );
    }
}
