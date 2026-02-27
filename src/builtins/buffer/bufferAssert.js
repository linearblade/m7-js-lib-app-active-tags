/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

import helpers from "../../class/engine/helpers.js";

/**
 * Resolve predicate callable for `buffer.assert`.
 *
 * Resolution order:
 * 1) direct function value
 * 2) user/global function path via `lib.func.get(pred)` (root/default lookup)
 * 3) `lib.*` function path against explicit root `{ lib }`
 *
 * This preserves user/root precedence, while still allowing explicit
 * `lib.` predicate references when desired.
 *
 * @param {Object} lib
 * @param {*} pred
 * @returns {Function|null}
 */
function resolvePredicate(lib, pred) {
    if (typeof pred === "function") return pred;
    if (!lib.str.is(pred)) return null;

    const token = pred.trim();
    if (!token) return null;

    const userFn = lib.func.get(token);
    if (userFn) return userFn;

    if (token.indexOf("lib.") === 0) {
	return lib.func.get(token, { root: { lib } }) || null;
    }

    return null;
}

/**
 * `buffer.assert` builtin.
 *
 * Assert a value from buffer against expected value or predicate function.
 *
 * Argument shapes:
 * - hash args: `{ key, value, predicate }`
 * - positional args: `[key, value, predicate]`
 * - aliases:
 *   - `key`: `key` | `path`
 *   - expected: `value` | `val` | `expected`
 *   - predicate: `predicate` | `pred`
 *
 * Semantics:
 * - `key` is optional path into current buffer value.
 *   - when absent, assertion source is full `buffer.get()`
 *   - when present, source is `lib.hash.get(buffer.get(), key)`
 * - `predicate` (or `pred`) overrides default comparison logic.
 * - Without predicate:
 *   - boolish expected => compare bool intent
 *   - scalar expected  => compare normalized string forms
 *   - otherwise        => strict equality (`===`)
 *
 * Predicate contract:
 * - Called as `await pred(actual, expected, detail)`.
 * - Truthy return => pass; falsey return => fail.
 *
 * Failure model:
 * - assertion failure returns `SR_error("buffer.assert: assertion failed")`
 * - unresolved predicate returns `SR_error("...predicate did not resolve...")`
 * - detail payload includes mode/key/actual/expected/predicate
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {*} [params.args]
 * @param {Object} params.buffer
 * @param {*} [params.step]
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export default async function bufferAssert({ lib, args, buffer, step } = {}) {
    try {
	const parsed = lib.args.parse(args, {}, { parms: "key value predicate", pop: true });
	const key = lib.hash.getUntilNotEmpty(parsed, "key path", null);
	const expected = lib.hash.getUntilNotEmpty(parsed, "value val expected", undefined);
	const predSpec = lib.hash.getUntilNotEmpty(parsed, "predicate pred", null);

	const root = buffer.get();
	const actual = lib.utils.isEmpty(key) ? root : lib.hash.get(root, key);

	let pass = false;
	let mode = "compare";

	if (!lib.utils.isEmpty(predSpec)) {
	    mode = "predicate";
	    const pred = resolvePredicate(lib, predSpec);
	    if (!pred) {
		return helpers.SR_error(
		    new Error("buffer.assert: predicate did not resolve to function"),
		    { op: "buffer.assert", step, key, predicate: predSpec }
		);
	    }

	    const detail = { key, actual, expected, buffer };
	    pass = !!(await pred(actual, expected, detail));
	} else if (lib.bool.ish(expected)) {
	    mode = "bool";
	    pass = (lib.bool.yes(actual) === lib.bool.yes(expected));
	} else if (lib.utils.baseType(expected, "string number boolean")) {
	    mode = "scalar";
	    const lhs = lib.str.to(actual, true).trim();
	    const rhs = lib.str.to(expected, true).trim();
	    pass = (lhs === rhs);
	} else {
	    mode = "strict";
	    pass = (actual === expected);
	}

	if (!pass) {
	    return helpers.SR_error(
		new Error("buffer.assert: assertion failed"),
		{
		    op: "buffer.assert",
		    step,
		    key,
		    mode,
		    actual,
		    expected,
		    predicate: predSpec || null,
		}
	    );
	}

	return helpers.SR_ok({
	    op: "buffer.assert",
	    step,
	    key,
	    mode,
	    actual,
	    expected,
	    predicate: predSpec || null,
	});
    } catch (err) {
	return helpers.SR_error(err, { op: "buffer.assert", step });
    }
}
