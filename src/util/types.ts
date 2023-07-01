export type NonFunctionMembers<T> = {
    [P in keyof T as T[P] extends Function ? never : P]: T[P];
};

export type Writable<T> = {
    -readonly [P in keyof T]: Writable<T[P]>;
};
