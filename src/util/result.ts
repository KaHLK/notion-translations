import { Option, some, none } from "./option";

enum ResultVariant {
    OK = 0,
    ERR = 1,
}

export type Result<T, E> = Ok<T, E> | Err<E, T>;
export function ok<T>(value: T): Result<T, never> {
    return new Ok(value);
}
export function err<E>(error: E): Result<never, E> {
    return new Err(error);
}

abstract class ResultImpl<T, E> {
    abstract type: ResultVariant;
    abstract toString(): String;

    isOk(): this is Ok<T, E> {
        return this.type === ResultVariant.OK;
    }

    isErr(): this is Err<E, T> {
        return this.type === ResultVariant.ERR;
    }

    isOkAnd(
        this: Result<T, E>,
        predicate: (value: T) => boolean,
    ): this is Ok<T, E> {
        return this.isOk() && predicate(this.value);
    }

    isErrAnd(
        this: Result<T, E>,
        predicate: (value: E) => boolean,
    ): this is Err<T, E> {
        return this.isErr() && predicate(this.error);
    }

    get ok(): Option<T> {
        if (this.isOk()) {
            return some(this.value);
        }
        return none();
    }

    get err(): Option<E> {
        if (this.isErr()) {
            return some(this.error);
        }
        return none();
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

    expect(this: Result<T, E>, msg: string): T {
        if (this.isOk()) {
            return this.value;
        }
        throw new Error(msg);
    }

    expectErr(this: Result<T, E>, msg: string): E {
        if (this.isErr()) {
            return this.error;
        }
        throw new Error(msg);
    }

    unwrap(this: Result<T, E>): T {
        if (this.isOk()) {
            return this.value;
        }
        throw this.error;
    }

    unwrapOr(this: ResultImpl<T, E>, def: T): T {
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

    and<U>(this: Result<T, E>, other: Result<U, E>): Result<U, E> {
        if (this.isOk()) {
            return other;
        }
        return err(this.error);
    }

    andThen<U>(
        this: Result<T, E>,
        cb: (value: T) => Result<U, E>,
    ): Result<U, E> {
        if (this.isOk()) {
            return cb(this.value);
        }
        return err(this.error);
    }

    or(this: Result<T, E>, other: Result<T, E>): Result<T, E> {
        if (this.isOk()) {
            return this;
        }
        return other;
    }

    transpose(this: Result<Option<T>, E>): Option<Result<T, E>> {
        if (this.isOk()) {
            if (this.value.isSome()) {
                return some(ok(this.value.value));
            }
            return none();
        }
        return some(err(this.error));
    }
    /* Missing functions:
     * map_or_else
     * inspect
     * inspect_err
     * expect_err
     * unwrap_err
     * or_else
     * flatten
     * from
     */
}

class Ok<T, E> extends ResultImpl<T, E> {
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

class Err<E, T> extends ResultImpl<T, E> {
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
