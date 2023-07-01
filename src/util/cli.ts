import prompts from "prompts";

import { enumerate, range } from "./fn";
import { Option, none, some } from "./option";

type PrintFn<T> = (v: T, idx: number) => string;
type ParseFn = (
    answer: string,
    min: number,
    max: number,
) => Option<Set<number>>;

export async function select_from_list<T>(
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

export async function confirm(msg: string): Promise<boolean> {
    const res = await prompts({ type: "confirm", message: msg, name: "" });
    return res[""] as boolean;
}
