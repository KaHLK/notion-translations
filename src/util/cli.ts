import prompts from "prompts";

export async function autocomplete_multiselect<T>(
    msg: string,
    list: { title: string; value: T }[],
): Promise<T[]> {
    const res = await prompts({
        type: "autocompleteMultiselect",
        name: "",
        message: msg,
        choices: list,
    });
    return res[""] as T[];
}

export async function confirm(
    msg: string,
    initial?: boolean,
): Promise<boolean> {
    const res = await prompts({
        type: "confirm",
        message: msg,
        name: "",
        initial,
    });
    return res[""] as boolean;
}
