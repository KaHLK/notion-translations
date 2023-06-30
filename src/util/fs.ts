import { constants } from "fs";
import { access } from "fs/promises";

export async function exists(path: string): Promise<boolean> {
    try {
        await access(path, constants.R_OK | constants.W_OK);
        return true;
    } catch (_) {
        return false;
    }
}
