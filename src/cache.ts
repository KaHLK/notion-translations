import { readFile, mkdir, rm, writeFile } from "fs/promises";

import { exists } from "./util/fs";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

type FetchedCache = {
    [id: string]: { last_updated: number; pages: PageObjectResponse[] };
};

const data_dir = process.env.APPDATA || `${process.env.HOME}/.local/share`;
const cache_dir = `${data_dir}/notion-translations`;
const path = `${cache_dir}/cache.json`;

export class GenCache {
    #data: FetchedCache;
    private constructor(data: FetchedCache) {
        this.#data = data;
    }

    static empty(): GenCache {
        return new GenCache({});
    }

    static async open(): Promise<GenCache> {
        if (!(await exists(path))) {
            return GenCache.empty();
        }

        try {
            const cache_str = (await readFile(path)).toString();
            const obj = JSON.parse(cache_str) as FetchedCache;
            return new GenCache(obj);
        } catch (e) {
            return GenCache.empty();
        }
    }

    async save() {
        if (!(await exists(cache_dir))) {
            await mkdir(cache_dir, { recursive: true });
        }
        await writeFile(path, JSON.stringify(this.#data, undefined, 4));
    }

    get(id: string): FetchedCache[string] | undefined {
        return this.#data[id];
    }

    store(id: string, last_updated: number, pages: PageObjectResponse[]) {
        this.#data[id] = { last_updated, pages };
    }
}
