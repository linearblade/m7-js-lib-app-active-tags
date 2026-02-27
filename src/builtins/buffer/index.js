/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

// builtins/buffer/index.js
// Builtins: buffer.set, buffer.get, buffer.clear, buffer.dump, buffer.traverse, buffer.assert
// VM signature: ({ job, lib, args, trigger, ticket, inputs, buffer, ctx, step }) => StageResultLike

import helpers from "../../class/engine/helpers.js";
import bufferTraverse from "./bufferTraverse.js";
import bufferAssert from "./bufferAssert.js";

/**
 * Write a value into a destination expression target for `buffer.get`.
 *
 * Destination contract:
 * - `dst` is an unresolved expression string (for example `window:app.data`)
 * - `expr.parse(...)` must resolve to `{ src, prop }`
 * - This helper writes only to `prop` on `src` (no source rebinding semantics)
 *
 * Validation:
 * - `src` must be truthy
 * - `prop` must be non-empty (`isEmpty` allows numeric `0`)
 *
 * Write behavior:
 * - DOM `src`    -> `lib.dom.set(src, prop, value)`
 * - non-DOM `src`-> `lib.hash.set(src, prop, value)`
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {Object} params.expr
 * @param {Object} [params.job]
 * @param {Object} [params.ticket]
 * @param {*} [params.ctx]
 * @param {string} params.dst
 * @param {*} params.value
 * @throws {Error} If destination does not resolve to writable `{ src, prop }`.
 * @returns {void}
 */
function writeExprDestination({ lib, expr, job, ticket, ctx, dst, value }) {
    const parsed = expr.parse(
	{
	    job,
	    ticket,
	    ctx,
	    env: lib.hash.get(lib, "_env"),
	},
	dst
    );

    const [src, prop] = lib.hash.expand(parsed, "src prop");

    // This helper writes to a property path; it does not support rebinding `src`.
    // `isEmpty(prop)` allows 0 while rejecting empty/null paths.
    if (!src || lib.utils.isEmpty(prop)) {
	throw new Error(`buffer.get: destination did not resolve to writable target '${dst}'`);
    }

    if (lib.dom.is(src)) {
	lib.dom.set(src, prop, value);
	return;
    }

    lib.hash.set(src, prop, value);
    return;
}

/**
 * `buffer.set` builtin.
 *
 * Writes value/meta into ticket buffer.
 *
 * Argument parsing:
 * - uses `lib.args.parse(args, {}, { parms: "value meta", pop: true })`
 * - supports hash args (`{ value, meta }`)
 * - supports positional args (`[value, meta]`)
 * - supports trailing hash merge when `pop:true` applies
 *
 * Defaults:
 * - missing `value` => `null`
 * - missing `meta`  => `null`
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {*} [params.args]
 * @param {Object} [params.inputs]
 * @param {Object} params.buffer
 * @param {*} [params.step]
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function bufferSet({ lib, args, inputs, buffer, step } = {}) {
    try {
	const parsed = lib.args.parse(args, {}, { parms: "value meta", pop: true });
	const value = parsed.value === undefined ? null : parsed.value;
	const meta = parsed.meta === undefined ? null : parsed.meta;

	buffer.set(value, meta);

	return helpers.SR_ok({ op: "buffer.set", step });
    } catch (err) {
	return helpers.SR_error(err, { op: "buffer.set", step });
    }
}

/**
 * `buffer.get` builtin.
 *
 * Reads current buffer value (or one nested path) and mirrors it to `inputs.buffer`.
 *
 * Argument shapes:
 * - hash args: `{ src, dst }`
 * - positional args: `[src, dst]`
 *
 * Source behavior:
 * - no `src` => returns full `buffer.get()`
 * - `src` => deep path lookup via `lib.hash.get(buffer.get(), src)`
 *
 * Destination behavior:
 * - when `dst` is provided, writes resolved value into destination expression target
 * - destination is parsed with `expr.parse(...)` and written via `{ src, prop }`
 *
 * Notes:
 * - `src` is treated as a buffer path, not an expression target.
 * - `dst` is unresolved DSL expression text by design.
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {*} [params.args]
 * @param {Object} [params.job]
 * @param {Object} [params.ticket]
 * @param {*} [params.ctx]
 * @param {Object} [params.expr]
 * @param {Object} [params.inputs]
 * @param {Object} params.buffer
 * @param {*} [params.step]
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`) with detail:
 *   `{ op, step, src, dst, value }`.
 */
export async function bufferGet({ lib, args, job, ticket, ctx, expr, inputs, buffer, step } = {}) {
    try {
	const parsed = lib.args.parse(args, {}, { parms: "src dst", pop: true });
	const src = lib.hash.getUntilNotEmpty(parsed, "src from path key", null);
	const dst = lib.hash.getUntilNotEmpty(parsed, "dst to target", null);
	const rawBuffer = buffer.get();
	const value = src ? lib.hash.get(rawBuffer, src) : rawBuffer;

	if (!lib.utils.isEmpty(dst)) {
	    writeExprDestination({ lib, expr, job, ticket, ctx, dst, value });
	}

	// convenience: mirror into inputs.buffer (so other ops can read it easily)
	if (inputs && typeof inputs === "object") inputs.buffer = value;

	return helpers.SR_ok({
	    op: "buffer.get",
	    step,
	    src: lib.utils.isEmpty(src) ? null : src,
	    dst: lib.utils.isEmpty(dst) ? null : dst,
	    value,
	});
    } catch (err) {
	return helpers.SR_error(err, { op: "buffer.get", step });
    }
}

/**
 * `buffer.clear` builtin.
 *
 * Clears ticket buffer via `buffer.clear()`.
 *
 * Side effects:
 * - resets buffer value/meta according to Buffer implementation
 * - mirrors resulting value to `inputs.buffer`
 *
 * @param {Object} params
 * @param {Object} [params.inputs]
 * @param {Object} params.buffer
 * @param {*} [params.step]
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function bufferClear({ inputs, buffer, step } = {}) {
    try {
	buffer.clear();

	if (inputs && typeof inputs === "object") inputs.buffer = buffer.get();

	return helpers.SR_ok({ op: "buffer.clear", step });
    } catch (err) {
	return helpers.SR_error(err, { op: "buffer.clear", step });
    }
}

/**
 * `buffer.dump` builtin.
 *
 * Logs current buffer value and metadata to console for diagnostics.
 *
 * Behavior:
 * - Always returns `ok`, even if logging throws.
 * - Does not mutate buffer contents.
 * - Optionally mirrors snapshot into `inputs.bufferDump`.
 *
 * Args (optional hash):
 * - `label`       : console label prefix
 * - `includeMeta` : include `buffer.meta()` in log output (default true)
 * - `includeValue`: include `buffer.get()` in log output (default true)
 * - `toInputs`    : when true, write snapshot to `inputs.bufferDump`
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {*} [params.args]
 * @param {Object} [params.inputs]
 * @param {Object} params.buffer
 * @param {*} [params.step]
 * @returns {Promise<Object>} StageResult-like `ok`.
 */
export async function bufferDump({ lib, args, inputs, buffer, step } = {}) {
    const opts = lib.hash.to(args);
    const includeMeta = !lib.bool.no(lib.hash.get(opts, "includeMeta"));
    const includeValue = !lib.bool.no(lib.hash.get(opts, "includeValue"));
    const label = lib.str.to(lib.hash.get(opts, "label"), true).trim() || "[AT][buffer.dump]";
    const toInputs = lib.bool.yes(lib.hash.get(opts, "toInputs"));

    let value = null;
    let meta = null;
    let logError = null;

    try {
        value = includeValue ? buffer.get() : null;
        meta = includeMeta ? buffer.meta() : null;

        if (includeValue && includeMeta) {
            console.warn(label);
            console.warn({ value, meta });
        } else if (includeValue) {
            console.warn(label);
            console.warn({ value });
        } else if (includeMeta) {
            console.warn(label);
            console.warn({ meta });
        } else {
            console.warn(label);
        }
    } catch (err) {
        logError = err;
        try {
            console.warn(`${label} (logging failed)`, err);
        } catch (noop) {
            // keep stage success semantics
        }
    }

    if (toInputs && inputs && typeof inputs === "object") {
        inputs.bufferDump = { value, meta, error: logError ? String(logError.message || logError) : null };
    }

    return helpers.SR_ok({
        op: "buffer.dump",
        step,
        dumped: true,
        includeMeta,
        includeValue,
        logError: !!logError,
    });
}

export { bufferTraverse, bufferAssert };

// -----------------------------------------------------------------------------
// Export bundle
// -----------------------------------------------------------------------------
export const BUFFER = {
    set: bufferSet,
    get: bufferGet,
    clear: bufferClear,
    dump: bufferDump,
    traverse: bufferTraverse,
    assert: bufferAssert,
};

export default BUFFER;
