import { APIErrorCode, APIResponseError } from "@notionhq/client";

export type RetryOptions = {
    max_attempts?: number;
    base_ms?: number;
    cap_ms?: number;
    sleep?: (ms: number) => Promise<void>;
    random?: () => number;
    log?: (msg: string) => void;
};

/**
 * Retries `fn` while Notion answers `rate_limited` (HTTP 429).
 * Delay uses full jitter so concurrent CI jobs don't retry in lockstep;
 * `Retry-After` sets its floor. Other errors, and the last rate-limit
 * error once attempts run out, are rethrown unchanged.
 */
export async function with_retry<T>(
    label: string,
    fn: () => Promise<T>,
    {
        max_attempts = 6,
        base_ms = 1000,
        cap_ms = 60_000,
        sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
        random = Math.random,
        log = console.warn,
    }: RetryOptions = {},
): Promise<T> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await fn();
        } catch (e) {
            if (!is_rate_limited(e) || attempt >= max_attempts) {
                throw e;
            }
            const floor = retry_after_ms(e.headers);
            const backoff = Math.min(cap_ms, base_ms * 2 ** (attempt - 1));
            // Retry-After above backoff still gets a jitter window
            const ceil = Math.max(backoff, floor + base_ms);
            const delay = Math.round(floor + random() * (ceil - floor));
            log(
                `Notion rate limited: ${label}, attempt ${attempt}/${max_attempts}, retrying in ${(delay / 1000).toFixed(1)}s`,
            );
            await sleep(delay);
        }
    }
}

function is_rate_limited(e: unknown): e is APIResponseError {
    return (
        APIResponseError.isAPIResponseError(e) &&
        e.code === APIErrorCode.RateLimited
    );
}

/** `Retry-After` in ms: seconds or HTTP date. 0 when absent or invalid. */
export function retry_after_ms(headers: unknown, now = Date.now()): number {
    const value = header(headers, "retry-after")?.trim();
    if (!value) {
        return 0;
    }
    const seconds = Number(value);
    if (Number.isFinite(seconds)) {
        return Math.max(0, seconds * 1000);
    }
    const date = Date.parse(value);
    return Number.isNaN(date) ? 0 : Math.max(0, date - now);
}

function header(headers: unknown, name: string): string | undefined {
    if (typeof headers !== "object" || headers === null) {
        return undefined;
    }
    if ("get" in headers && typeof headers.get === "function") {
        return headers.get(name) ?? undefined;
    }
    const entry = Object.entries(headers).find(
        ([k]) => k.toLowerCase() === name,
    );
    return typeof entry?.[1] === "string" ? entry[1] : undefined;
}
