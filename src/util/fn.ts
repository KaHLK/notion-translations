export function notImplementedYet(...msg: string[]): never {
    console.warn(...msg);
    throw new Error("Not yet implemented");
}

export function* range(
    begin: number,
    end: number,
    step = 1,
): IterableIterator<number> {
    const _step = step > 0 ? step : 1;
    const [s, e] = begin > end ? [end, begin] : [begin, end];
    for (let i = s; i < e; i += _step) {
        yield i;
    }
}
