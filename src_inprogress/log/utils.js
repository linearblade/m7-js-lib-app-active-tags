import { CONSOLE_LEVEL } from './constants.js';
/**
 * Validate and normalize a bucket name.
 *
 * Behavior (strict):
 * - Accepts non-empty strings.
 * - Accepts finite numbers and coerces them to strings.
 * - Rejects `null`, `undefined`, empty string, NaN, Infinity,
 *   and all other non-string / non-number values.
 *
 * Error handling:
 * - If `die` is true (default), throws on invalid input.
 * - If `die` is false, returns null on invalid input.
 *
 * @param {any} value The bucket name input.
 * @param {boolean} [die=true] Throw on invalid input.
 * @returns {string|null} Normalized bucket name, or null if invalid and `die` is false.
 * @throws {Error} If the name is invalid and `die` is true.
 */
export function validateBucketName(value, die = true) {
    const fail = () => {
        if (!die) return null;
        throw new Error("bucket name must be a non-empty string or finite number");
    };

    if (typeof value === "string") {
        if (value.length === 0) return fail();
        return value;
    }

    if (typeof value === "number") {
        if (!Number.isFinite(value)) return fail();
        return String(value);
    }

    return fail();
}

/**
 * Normalize console emission policy into a numeric CONSOLE_LEVEL.
 *
 * - falsy => OFF
 * - true  => ALL
 * - number => returned as-is
 * - string => looked up in CONSOLE_LEVEL (case-insensitive)
 *
 * @private
 * @param {any} value
 * @returns {number} console level enum value
 */
export function _normalizeConsoleLevel(value) {
    // falsy => OFF
    if (!value) return CONSOLE_LEVEL.OFF;

    // true => ALL
    if (value === true) return CONSOLE_LEVEL.ALL;

    // numeric => clamp to enum range
    if (Number.isFinite(value)) {
	const min = CONSOLE_LEVEL.OFF;
	const max = CONSOLE_LEVEL.ALL;
	if (value < min) return min;
	if (value > max) return max;
	return value;
    }
    // string => enum lookup
    if (typeof value === "string") {
        const key = value.toUpperCase();
        if (key in CONSOLE_LEVEL) {
            return CONSOLE_LEVEL[key];
        }
    }

    // fallback
    return CONSOLE_LEVEL.OFF;
}
/**
 * Normalize a clock function.
 *
 * - falsy => Date.now
 * - function => returned as-is
 * - otherwise => throws
 *
 * @private
 * @param {any} value
 * @returns {Function} () => number (epoch ms)
 * @throws {Error} if value is not a function
 */
export function _getClock(value) {
    if (!value) return Date.now;

    if (typeof value === "function") {
        return value;
    }

    throw new Error("[log] invalid clock: expected function");
}



/**
 * Normalize a value into a function reference.
 *
 * - falsy => null
 * - function => returned as-is
 * - otherwise:
 *   - if `lib.func.get` exists, attempt resolution
 *   - if resolved value is a function => returned
 *   - else => throws
 *
 * @private
 * @param {any} value
 * @param {string} [label='function'] Label used in error messages
 * @returns {Function|null}
 * @throws {Error} if value cannot be resolved to a function
 */
export function _getFunction(value, label = "function") {
    // falsy => null (undefined, null, false, "", 0, etc.)
    if (!value) return null;

    // already a function
    if (typeof value === "function") return value;

    // attempt lib.func.get resolution (if available)
    if (typeof lib !== "undefined" && lib.func && typeof lib.func.get === "function") {
        const resolved = lib.func.get(value);
        if (typeof resolved === "function") {
	    return resolved;
        }
    }

    // barf
    throw new Error(`[log] invalid ${label}: expected function or resolvable reference`);
}

/**
 * Normalize and validate bucket max size.
 *
 * - falsy / 0 / "0" => unlimited (0)
 * - positive integer => ring buffer size
 * - negative / float / non-numeric => throws
 *
 * @private
 * @param {any} value
 * @returns {number} max size (0 = unlimited)
 * @throws {Error} on invalid value
 */
export function _normalizeLogMax(value) {
    // falsy => unlimited
    if (!value) return 0;

    // string "0" => unlimited
    if (value === "0") return 0;

    // numeric or numeric string
    const num = typeof value === "string" ? Number(value) : value;

    // reject non-numeric
    if (!Number.isFinite(num)) {
        throw new Error(`[log] invalid max value (not numeric): ${value}`);
    }

    // reject floats
    if (!Number.isInteger(num)) {
        throw new Error(`[log] invalid max value (must be integer): ${value}`);
    }

    // reject negatives
    if (num < 0) {
        throw new Error(`[log] invalid max value (negative): ${value}`);
    }

    // 0 already handled, but keep explicit
    if (num === 0) return 0;

    // positive integer => ring buffer size
    return num;
}

/**
 * Best-effort deep clone.
 *
 * Cloning strategy (in order):
 * 1) Use `structuredClone` when available.
 *    - Provides deep cloning with cycle support and rich type handling.
 *    - May throw for unsupported values (functions, streams, class instances, etc.).
 *
 * 2) Fall back to `lib.utils.deepCopy` when available.
 *    - Deep-copies plain objects and arrays.
 *    - Preserves class instances, functions, and unsupported objects by reference
 *      (PHP-style semantics).
 *
 * 3) Final fallback: return the original value by reference.
 *
 * Guarantees:
 * - This function never throws.
 * - Logging will not fail due to cloning errors.
 * - When cloning is not possible, the original reference is preserved.
 *
 * Notes:
 * - Cloning is conservative by design and intended for snapshotting log payloads.
 * - Complex objects such as DOM nodes, network responses, streams, and class
 *   instances may not be fully cloned.
 *
 * @param {any} value Value to clone.
 * @returns {any} Cloned value, or the original value if cloning is not possible.
 */
export function cloneBestEffort(value) {
    // primitives / null / undefined
    if (value == null) return value;

    const t = typeof value;
    if (t !== "object" && t !== "function") return value;

    // 1) Prefer structuredClone if available
    try {
        if (typeof structuredClone === "function") {
            return structuredClone(value);
        }
    } catch {
        // fall through
    }

    // 2) Fall back to lib.utils.deepCopy if available
    try {
        if (
            typeof lib !== "undefined" &&
            lib &&
            lib.utils &&
            typeof lib.utils.deepCopy === "function"
        ) {
            return lib.utils.deepCopy(value);
        }
    } catch {
        // fall through
    }

    // 3) Last resort: return original reference
    return value;
}

/**
 * Create a normalized log record with a strict header/body split.
 *
 * - `header` contains system-supplied fields
 * - `body` contains user-supplied payload
 *
 * @param {any} entry
 * @param {Object} [ctx]
 * @param {Function} [ctx.clock]    Optional clock override.
 * @param {string}   [ctx.source]   Logger / worker name.
 * @param {string}   [ctx.level]    Severity level.
 * @param {string}   [ctx.event]    Optional event name.
 * @param {any}      [ctx.trace]    Optional trace payload.
 * @param {number}   [ctx.lastAt]
 *        Previous record timestamp (epoch ms). When provided, `header.lastAt` is set
 *        and `header.delta` is computed as `header.at - lastAt`.
 * @param {boolean}  [ctx.clone=false]
 *        When true, clones `body` best-effort to reduce mutation-by-reference.
 *
 * @returns {{header: Object, body: Object}}
 */
export function makeRecord(entry, ctx = {}) {
    const isObj =
          entry &&
          typeof entry === "object" &&
          !Array.isArray(entry);

    let body = isObj ? entry : { value: entry };

    const clock =
          typeof ctx.clock === "function"
          ? ctx.clock
          : _getClock(undefined);

    const header = { at: clock() };

    if (ctx.source != null) header.source = ctx.source;
    if (ctx.level  != null) header.level  = ctx.level;
    if (ctx.event  != null) header.event  = ctx.event;
    if (ctx.trace  != null) header.trace  = ctx.trace;
    if (ctx.lastAt != null) {
	header.lastAt = ctx.lastAt;
	header.delta  = header.at - ctx.lastAt;
    }
    
    if (ctx.clone === true) {
        body = cloneBestEffort(body);
    }

    return { header, body };
}

/**
 * Map a log level string to a CONSOLE_LEVEL threshold.
 *
 * @param {string} level
 * @returns {number}
 */
export function levelToConsoleLevel(level) {
    const lv = String(level || "log").toLowerCase();

    if (lv === "error") return CONSOLE_LEVEL.ERROR;
    if (lv === "warn" || lv === "warning") return CONSOLE_LEVEL.WARN;
    if (lv === "info") return CONSOLE_LEVEL.INFO;

    return CONSOLE_LEVEL.LOG;
}

/**
 * Decide whether a record should be printed to console based on policy.
 *
 * Printing is determined by comparing the resolved console policy against
 * the severity level derived from `record.header.level`.
 *
 * Behavior:
 * - If no policy is provided, defaults to OFF.
 * - If policy is ALL, always prints.
 * - Otherwise, prints only if `policy >= levelToConsoleLevel(record.header.level)`.
 *
 * @param {Object} record
 *        A normalized log record.
 *        Expected to contain `record.header.level`.
 *
 * @param {Object} [ctx]
 * @param {number|string|boolean|null|undefined} [ctx.console]
 *        Console emission policy override.
 *        This value is normalized internally.
 *
 * @returns {boolean}
 */

export function shouldPrint(record, ctx = {}) {
    const policy = ("console" in ctx)
          ? _normalizeConsoleLevel(ctx.console)
          : CONSOLE_LEVEL.OFF;

    if (policy === CONSOLE_LEVEL.OFF) return false;
    if (policy === CONSOLE_LEVEL.ALL) return true;
    const need = levelToConsoleLevel(record?.header?.level);
    return policy >= need;
}
/**
 * Print a record to console (best-effort).
 *
 * Intentionally minimal:
 * - no formatting
 * - no args spreading
 * - prints the user payload (`record.body`) only
 *
 * @param {{header?: Object, body?: any}} record
 * @returns {void}
 */
export function printRecord(record) {
    if (!record) return;

    const c = (typeof console !== "undefined") ? console : null;
    if (!c) return;

    const level = String(record?.header?.level || "log").toLowerCase();

    try {
        if (level === "error" && typeof c.error === "function") {
            c.error(record.body);
            return;
        }
        if ((level === "warn" || level === "warning") && typeof c.warn === "function") {
            c.warn(record.body);
            return;
        }
        if (level === "info" && typeof c.info === "function") {
            c.info(record.body);
            return;
        }

        if (typeof c.log === "function") {
            c.log(record.body);
        }
    } catch {
        // never let console printing break logging
    }
}

export default {
    _getClock,
    _getFunction,
    _normalizeConsoleLevel,
    _normalizeLogMax,
    levelToConsoleLevel,
    shouldPrint,
    printRecord,
    makeRecord,
    cloneBestEffort,
    validateBucketName
};
