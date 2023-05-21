import { isNotionClientError } from "@notionhq/client";

export function map_error(e: unknown, message: string): Error {
    if (isNotionClientError(e)) {
        return Error(`${message} \n[${e.code}] ${e.message}`);
    } else {
        return Error(`Unknown error occurred: ${e} | ${message}`);
    }
}
