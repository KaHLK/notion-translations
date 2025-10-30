export type NonFunctionMembers<T> = {
    // biome-ignore lint/complexity/noBannedTypes: Don't know the specific shape of the function here
    [P in keyof T as T[P] extends Function ? never : P]: T[P];
};
