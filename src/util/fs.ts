import { constants } from "fs";
import { access, writeFile } from "fs/promises";

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
