import { mkdir, readFile, writeFile } from "fs/promises";

import { Client } from "@notionhq/client";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { get_database, query_database } from "./api";
import { exists } from "./util/fs";
import { Option, none, some } from "./util/option";
import { Result, err, ok } from "./util/result";

export type CacheEntry = { last_updated: number; pages: PageObjectResponse[] };
type FetchedCache = {
    [id: string]: CacheEntry;
};

const data_dir = process.env.APPDATA || `${process.env.HOME}/.local/share`;
const cache_dir = `${data_dir}/notion-translations`;
const path = `${cache_dir}/cache.json`;

export class GenCache {
    #data: FetchedCache;
    #client: Client;

    private constructor(data: FetchedCache, client: Client) {
        this.#client = client;
        this.#data = data;
    }

    static empty(client: Client): GenCache {
        return new GenCache({}, client);
    }

    static async open(client: Client): Promise<GenCache> {
        if (!(await exists(path))) {
            return GenCache.empty(client);
        }

        try {
            const cache_str = (await readFile(path)).toString();
            const obj = JSON.parse(cache_str) as FetchedCache;
            return new GenCache(obj, client);
        } catch (e) {
            return GenCache.empty(client);
        }
    }

    async save() {
        if (!(await exists(cache_dir))) {
            await mkdir(cache_dir, { recursive: true });
        }
        await writeFile(path, JSON.stringify(this.#data, undefined, 4));
    }

    get(id: string): Option<CacheEntry> {
        const v = this.#data[id];
        return v === undefined ? none() : some(v);
    }

    store(id: string, last_updated: number, pages: PageObjectResponse[]) {
        this.#data[id] = { last_updated, pages };
    }

    /**
     * Get's a "valid" cache entry of a specified database.
     * A valid database, is one where the cached value is up-to-date with
     * what is stored on notion.
     *
     * Returns ok with the cache entry, if the cache is found to be up-to-date.
     * Returns err, if the cache entry is not up-to-date (or none exists).
     * - The err contains a none if there is no cache entry.
     * - The err constains some number that describes the "last_edited_time"
     *   value of the element that caused the cache entry to be invalidated.
     * - The err contains an error if there was any error from notion in the
     *   process of fetching update information
     *
     * @param id Id of the database to get valid entry for
     * @returns
     */
    async get_valid_entry(
        id: string,
    ): Promise<Result<CacheEntry, Result<Option<number>, Error>>> {
        const cached = this.get(id);
        // Immediately return none, if no cache entry was found.
        if (cached.isNone()) {
            return err(ok(none()));
        }

        const db_info = await get_database(this.#client, id);
        // Immediately return any error from notion
        if (db_info.isErr()) {
            return err(err(db_info.error));
        }

        // Check if the database is newer than the cache entry
        const last_db_update = Date.parse(db_info.value.last_edited_time);
        if (last_db_update > cached.value.last_updated) {
            // Database was updated (page added/removed)
            return err(ok(some(last_db_update)));
        }

        const page_info = (
            await query_database(this.#client, id, {
                filter_properties: ["title"],
                sorts: [
                    {
                        direction: "descending",
                        timestamp: "last_edited_time",
                    },
                ],
                page_size: 1,
            })
        ).map((arr) => arr.at(0));
        // Immediately return any error from notion
        if (page_info.isErr()) {
            return err(err(page_info.error));
        }

        if (page_info.value !== undefined) {
            const last_page_update = Date.parse(
                page_info.value.last_edited_time,
            );
            if (last_page_update > cached.value.last_updated) {
                // A page was updated
                return err(ok(some(last_page_update)));
            }
        }

        // Cache entry is deemed to be up-to-date, so return it.
        return ok(cached.value);
    }
}
