import _prompt from "prompt-sync";

import { enumerate, range } from "./fn";
import { Option, none, some } from "./option";

const prompt = _prompt({ sigint: true });

type PrintFn<T> = (v: T, idx: number) => string;
type ParseFn = (
    answer: string,
    min: number,
    max: number,
) => Option<Set<number>>;

function choose_print<T>(
    msg: string,
    list: T[],
    print: PrintFn<T>,
    parse: ParseFn = parse_answer,
): T[] {
    for (const [v, idx] of enumerate(list[Symbol.iterator]())) {
        console.log(print(v, idx));
    }

    let numbers: Option<Set<number>>;
    do {
        const answer = prompt(msg);
        numbers = parse(answer, 1, list.length);
    } while (numbers.isNone());
    return numbers
        .map(Array.from<number>)
        .unwrapOr([])
        .map((v) => list[v - 1]);
}

export function choose<T>(msg: string, list: T[], print: PrintFn<T>): T[] {
    return choose_print(
        `${msg} (eg: 1 2/1-2 or leave empty to skip) > `,
        list,
        print,
    );
}

const parse_answer: ParseFn = (answer, min, max) => {
    const nums: Set<number> = new Set();
    const individuals = answer.split(" ");
    const insert = (v: number): boolean => v >= min && v <= max;
    try {
        for (const v of individuals) {
            if (v.length === 0) {
                continue;
            }

            if (v.includes("-")) {
                const [start, end] = v
                    .split("-")
                    .map((v) => Number.parseInt(v));
                for (const i of range(start, end + 1)) {
                    if (!insert(i)) {
                        return none();
                    }
                    nums.add(i);
                }
            } else {
                const num = Number.parseInt(v);
                if (!insert(num)) {
                    return none();
                }
                nums.add(num);
            }
        }
    } catch (_e) {
        return none();
    }

    return some(nums);
};
