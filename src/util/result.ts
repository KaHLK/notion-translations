enum ResultVariant {
    OK = 0,
    ERR = 1,
}

export type Result<T, E> = Ok<T, E> | Err<T, E>;
export function ok<T>(value: T): Result<T, never> {
    return new Ok(value);
}
export function err<E>(error: E): Result<never, E> {
    return new Err(error);
}

abstract class _Result<T, E> {
    abstract type: ResultVariant;
    abstract toString(): String;

    isOk(): this is Ok<T, E> {
        return this.type === ResultVariant.OK;
    }

    isErr(): this is Err<T, E> {
        return this.type === ResultVariant.ERR;
    }

    ok(this: Result<T, E>): T | null {
        if (this.isOk()) {
            return this.value;
        }
        return null;
    }

    err(this: Result<T, E>): E | null {
        if (this.isErr()) {
            return this.error;
        }
        return null;
    }

    map<U>(this: Result<T, E>, cb: (value: T) => U): Result<U, E> {
        if (this.isOk()) {
            return ok(cb(this.value));
        }
        return err(this.error);
    }

    mapOr<U>(this: Result<T, E>, def: U, cb: (value: T) => U): U {
        if (this.isOk()) {
            return cb(this.value);
        }
        return def;
    }

    mapErr<F>(this: Result<T, E>, cb: (error: E) => F): Result<T, F> {
        if (this.isErr()) {
            return err(cb(this.error));
        }
        return ok(this.value);
    }

    *iter(this: Result<T, E>): Generator<T> {
        if (this.isOk()) {
            yield this.value;
        }
    }

    unwrap(this: Result<T, E>): T {
        if (this.isOk()) {
            return this.value;
        } else {
            throw this.error;
        }
    }

    unwrapOr(this: Result<T, E>, def: T): T {
        if (this.isOk()) {
            return this.value;
        }
        return def;
    }

    unwrapOrElse(this: Result<T, E>, cb: () => T): T {
        if (this.isOk()) {
            return this.value;
        }
        return cb();
    }
}

class Ok<T, E> extends _Result<T, E> {
    type = ResultVariant.OK;
    #value: T;
    get value() {
        return this.#value;
    }

    constructor(value: T) {
        super();

        this.#value = value;
    }

    toString(): String {
        return `Ok { value: ${this.value} }`;
    }
}

class Err<T, E> extends _Result<T, E> {
    type = ResultVariant.ERR;
    #error: E;
    get error() {
        return this.#error;
    }

    constructor(err: E) {
        super();

        this.#error = err;
    }

    toString(): String {
        return `Err { error: ${this.error} }`;
    }
}
