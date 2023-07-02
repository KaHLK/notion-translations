import prompts from "prompts";

import { Option, none, some } from "./option";

export async function autocomplete_multiselect<T>(
    msg: string,
    list: { title: string; value: T }[],
): Promise<Option<T[]>> {
    const res = await prompts({
        type: "autocompleteMultiselect",
        name: "",
        message: msg,
        choices: list,
    });
    const v = res[""] as T[];
    if (v === undefined) {
        return none();
    }
    return some(v);
}

export async function autocomplete<T>(
    msg: string,
    list: { title: string; value: T }[],
): Promise<Option<T>> {
    const res = await prompts({
        type: "autocomplete",
        name: "",
        message: msg,
        choices: list,
    });

    const v = res[""];
    if (v === undefined) {
        return none();
    }
    return some(v);
}

export async function confirm(
    msg: string,
    initial?: boolean,
): Promise<Option<boolean>> {
    const res = await prompts({
        type: "confirm",
        message: msg,
        name: "",
        initial,
    });
    const v = res[""] as boolean;
    if (v === undefined) {
        return none();
    }
    return some(v);
}

export async function get_text(msg: string): Promise<Option<string>> {
    const res = await prompts({
        type: "text",
        name: "",
        message: msg,
    });

    const v = res[""] as string;
    if (v === undefined) {
        return none();
    }
    return some(v);
}
