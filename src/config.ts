import { readFile, rm, writeFile } from "fs/promises";

import { CONFIG_FILE } from "./constants";
import { Database } from "./model";
import { exists } from "./util/fs";
import { Result, err, ok } from "./util/result";
import { NonFunctionMembers } from "./util/types";

type ConfigJson = Partial<NonFunctionMembers<Config>>;

export class Config {
    out: string;
    databases: Database[];

    private constructor(out: string, databases: Database[]) {
        this.out = out;
        this.databases = databases;
    }

    /**
     * Creates an empty config
     *
     * @returns A new empty config
     */
    static empty(): Config {
        return new Config("", []);
    }

    /**
     * Read the Config from a json file (saved via Config.save())
     *
     * @returns A result that contains either a Config object or an Error
     */
    static async from_file(): Promise<Result<Config, Error>> {
        try {
            const config_str = (await readFile(CONFIG_FILE)).toString();
            const obj = JSON.parse(config_str) as ConfigJson;
            return ok(new Config(obj.out ?? "", obj.databases ?? []));
        } catch (e) {
            return err(new Error(`Failed to read or parse config file (${e})`));
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
        await writeFile(CONFIG_FILE, JSON.stringify(this, undefined, 4));
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
