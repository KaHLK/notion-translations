import { readFile, rm, writeFile } from "node:fs/promises";

import { CONFIG_FILE } from "./constants";
import type { Database } from "./model";
import { exists } from "./util/fs";
import { err, ok, type Result } from "./util/result";
import type { NonFunctionMembers } from "./util/types";

type ConfigJson = Partial<NonFunctionMembers<Config>>;

export class Config {
    #path: string;
    out: string;
    databases: Database[];
    plural_key?: string;
    list_key?: string;

    private constructor(
        {
            out,
            databases,
            plural_key,
            list_key,
        }: {
            out: string;
            databases: Database[];
            plural_key?: string;
            list_key?: string;
        },
        path: string = CONFIG_FILE,
    ) {
        this.#path = path;
        this.out = out;
        this.databases = databases;
        this.plural_key = plural_key;
        this.list_key = list_key;
    }

    /**
     * Creates an empty config
     *
     * @returns A new empty config
     */
    static empty(path?: string): Config {
        return new Config({ out: "", databases: [] }, path);
    }

    /**
     * Read the Config from a json file (saved via Config.save())
     *
     * @returns A result that contains either a Config object or an Error
     */
    static async from_file(
        path: string = CONFIG_FILE,
    ): Promise<Result<Config, Error>> {
        let config_str = "";
        try {
            config_str = (await readFile(path)).toString();
        } catch (e) {
            return err(new Error(`Failed to read config file (${e})`));
        }
        try {
            const obj = JSON.parse(config_str) as ConfigJson;
            const config = new Config(
                {
                    out: obj.out ?? "",
                    databases: obj.databases ?? [],
                    plural_key: obj.plural_key,
                    list_key: obj.list_key,
                },
                path,
            );
            return ok(config);
        } catch (e) {
            // TODO: Return different errors instead of throwing completely, and then handle the errors better
            console.error("Failed to parse config file at:", path);
            throw e;
        }
    }

    /**
     * Delete the config file (saved via Config.save())
     */
    static async rm() {
        if (await exists(CONFIG_FILE)) {
            await rm(CONFIG_FILE);
        }
    }

    /**
     * Save the config to a json file
     * @returns
     */
    async save() {
        await writeFile(this.#path, JSON.stringify(this, undefined, 4));
    }

    is_empty(): boolean {
        return this.databases.length === 0;
    }

    add_databases(databases: Database[]) {
        this.databases = this.databases.filter(
            (d) => !databases.some((db) => db.id === d.id),
        );
        this.databases.push(...databases);
    }
    update_database_at(index: number, db: Database) {
        this.databases[index] = db;
    }
    update_database(db: Database) {
        const idx = this.databases.findIndex((d) => d.id === db.id);
        if (idx >= 0) {
            this.update_database_at(idx, db);
            return true;
        }
        return false;
    }
    remove_database_at(index: number) {
        this.databases.splice(index, 1);
    }
    remove_database(db: Database) {
        const idx = this.databases.findIndex((d) => d.id === db.id);
        if (idx >= 0) {
            this.remove_database_at(idx);
            return true;
        }
        return false;
    }
    remove_all_databases() {
        this.databases = [];
    }
}
