import { readFile, rm, writeFile } from "fs/promises";

import { Result, err, ok } from "./util/result";
import { CONFIG_FILE } from "./constants";
import { exists } from "./util/fs";
import { Database } from "./model";

type NonFunctionMembers<T> = {
    [P in keyof T as T[P] extends Function ? never : P]: T[P];
};

type Writable<T> = {
    -readonly [P in keyof T]: Writable<T[P]>;
};

type ConfigJson = Partial<Writable<NonFunctionMembers<Config>>>;

export class Config {
    out: string;
    #databases: Database[];

    get databases(): readonly Database[] {
        return this.#databases;
    }

    private constructor(out: string, databases: Database[]) {
        this.out = out;
        this.#databases = databases;
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
        this.#databases = this.#databases.filter(
            (d) => !databases.some((db) => db.id === d.id),
        );
        this.#databases.push(...databases);
    }
    update_database(index: number, db: Database) {
        this.#databases[index] = db;
    }
}
