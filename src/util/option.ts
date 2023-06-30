import { Result, ok, err } from "./result";

enum OptionVariant {
    Some = 0,
    None = 1,
}

export type Option<T> = Some<T> | None<T>;
export function some<T>(value: T): Option<T> {
    return new Some(value);
}
export function none<T = never>(): Option<T> {
    return new None();
}

abstract class OptionImpl<T> {
    abstract type: OptionVariant;
    abstract toString(): String;

    get some(): T | null {
        if (this.isSome()) {
            return this.value;
        }
        return null;
    }

    isSome(): this is Some<T> {
        return this.type === OptionVariant.Some;
    }

    isNone(): this is None<T> {
        return this.type === OptionVariant.None;
    }

    isSomeAnd(predicate: (v: T) => boolean): this is Some<T> {
        return this.isSome() && predicate(this.value);
    }

    expect(this: Option<T>, msg: string): T {
        if (this.isSome()) {
            return this.value;
        }
        throw new Error(msg);
    }

    unwrap(this: Option<T>): T {
        return this.expect("Value not available on None");
    }

    unwrapOr(this: Option<T>, def: T): T {
        if (this.isSome()) {
            return this.value;
        }
        return def;
    }

    unwrapOrElse(this: Option<T>, cb: () => T): T {
        if (this.isSome()) {
            return this.value;
        }
        return cb();
    }

    inspect(this: Option<T>, cb: (v: T) => void): Option<T> {
        if (this.isSome()) {
            cb(this.value);
        }
        return this;
    }

    map<U>(this: Option<T>, cb: (v: T) => U): Option<U> {
        if (this.isSome()) {
            return some(cb(this.value));
        }
        return none();
    }

    mapOr<U>(this: Option<T>, def: U, cb: (v: T) => U): U {
        if (this.isSome()) {
            return cb(this.value);
        }
        return def;
    }

    mapOrElse<U>(this: Option<T>, def: () => U, cb: (v: T) => U): U {
        if (this.isSome()) {
            return cb(this.value);
        }
        return def();
    }

    *iter(this: Option<T>): Generator<T> {
        if (this.isSome()) {
            yield this.value;
        }
    }

    and<U>(this: Option<T>, other: Option<U>): Option<U> {
        if (this.isSome()) {
            return other;
        }
        return none();
    }

    andThen<U>(this: Option<T>, cb: (v: T) => Option<U>): Option<U> {
        if (this.isSome()) {
            return cb(this.value);
        }
        return none();
    }

    filter(this: Option<T>, predicate: (v: T) => boolean): Option<T> {
        if (this.isSomeAnd(predicate)) {
            return this;
        }
        return none();
    }

    or(this: Option<T>, other: Option<T>): Option<T> {
        if (this.isSome()) {
            return this;
        }
        return other;
    }

    orElse(this: Option<T>, cb: () => Option<T>): Option<T> {
        if (this.isSome()) {
            return this;
        }
        return cb();
    }

    xor(this: Option<T>, other: Option<T>): Option<T> {
        if (this.isSome() !== other.isSome()) {
            return this.isSome() ? this : other;
        }
        return none();
    }

    zip<U>(this: Option<T>, other: Option<U>): Option<[T, U]> {
        if (this.isSome() && other.isSome()) {
            return some([this.value, other.value]);
        }
        return none();
    }

    zipWith<U, R>(
        this: Option<T>,
        other: Option<U>,
        cb: (x: T, y: U) => R,
    ): Option<R> {
        if (this.isSome() && other.isSome()) {
            return some(cb(this.value, other.value));
        }
        return none();
    }

    unzip<T, U>(this: Option<[T, U]>): [Option<T>, Option<U>] {
        if (this.isSome()) {
            return [some(this.value[0]), some(this.value[1])];
        }
        return [none(), none()];
    }

    flatten<T>(this: Option<Option<T>>): Option<T> {
        if (this.isSome()) {
            return this.value;
        }
        return none();
    }

    transpose<E>(this: Option<Result<T, E>>): Result<Option<T>, E> {
        if (this.isSome()) {
            if (this.value.isOk()) {
                return ok(some(this.value.value));
            }
            return err(this.value.error);
        }
        return ok(none());
    }

    /* Missing functions:
     * ok_or
     * ok_or_else
     * from
     */
}

class Some<T> extends OptionImpl<T> {
    type = OptionVariant.Some;
    #value: T;
    get value() {
        return this.#value;
    }

    constructor(value: T) {
        super();

        this.#value = value;
    }

    toString(): String {
        return `Some { value: ${this.value} }`;
    }
}

class None<T> extends OptionImpl<T> {
    type = OptionVariant.None;
    // @ts-ignore: Required for type-safe value  access
    #v: never;

    toString(): String {
        return "None";
    }
}
