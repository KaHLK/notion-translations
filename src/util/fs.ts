import { constants } from "fs";
import { access, writeFile, rm, rmdir, readdir, stat } from "fs/promises";
import { join } from "path";

import { Result, err, ok } from "./result";

export async function exists(path: string): Promise<boolean> {
    try {
        await access(path, constants.R_OK | constants.W_OK);
        return true;
    } catch (_) {
        return false;
    }
}

export async function save(path: string, contents: string) {
    await writeFile(path, contents, { encoding: "utf8" });
}

export async function delete_dir(path: string): Promise<Result<null, Error>> {
    const entries = await readdir(path);
    for (const entry of entries) {
        const p = join(path, entry);
        const stats = await stat(p);
        if (stats.isDirectory()) {
            const res = await delete_dir(p);
            if (res.isErr()) {
                return res;
            }
            continue;
        }
        try {
            await rm(p);
        } catch (e) {
            return err(e as Error);
        }
    }
    try {
        await rmdir(path);
    } catch (e) {
        return err(e as Error);
    }

    return ok(null);
}
