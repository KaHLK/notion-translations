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

export function* enumerate<T>(it: Iterator<T>): Generator<[T, number]> {
    let v;
    let i = 0;
    // rome-ignore lint/suspicious/noAssignInExpressions: Uses inline assignment to v, to allow for a smaller footprint
    while (!(v = it.next()).done) {
        yield [v.value, i++];
    }
}
