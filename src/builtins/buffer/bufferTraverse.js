/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

import helpers from "../../class/engine/helpers.js";

/**
 * Normalize args into a plain object.
 * - If args is scalar => { value: args }
 * - If args is array  => { value: args[0] }
 * - If args is object => args
 *
 * @param {Object} lib
 * @param {*} args
 * @returns {Object}
 */
function normalizeArgs(lib, args) {
    if (lib.utils.isScalar(args)) return { value: args };
    if (lib.array.is(args)) return { value: args[0] };
    if (args && typeof args === "object") return args;
    return {};
}

/**
 * Convert a path into tokens.
 *
 * Supports:
 *  - "a.b.c"
 *  - "a[0].b"
 *  - ["a", 0, "b"]
 *
 * @param {*} path
 * @returns {Array<string|number>}
 */
function tokenizePath(path) {
    if (Array.isArray(path)) return path;
    if (!path || typeof path !== "string") return [];

    // Convert bracket notation: a[0].b -> a.0.b
    const s = path.replace(/\[(\d+)\]/g, ".$1");
    return s.split(".").filter(Boolean).map(tok => {
	// numeric tokens become numbers
	return (/^\d+$/).test(tok) ? Number(tok) : tok;
    });
}

/**
 * `buffer.traverse` builtin.
 *
 * Resolves a deep path from current buffer value and overwrites buffer
 * with the resolved sub-value.
 *
 * Argument shapes:
 * - `{ path: "a.b[0].c", required?: boolean }`
 * - `{ value: "a.b[0].c", required?: boolean }`
 * - positional/scalar args normalize to `{ value: <arg> }`
 *
 * Path behavior:
 * - bracket notation is normalized (`a[0].b` -> `a.0.b`)
 * - lookup uses `lib.hash.get(root, dotPath)`
 *
 * Required behavior:
 * - default `required` is `true`
 * - when required and path is missing (`undefined`), returns `SR_error`
 *
 * Side effects:
 * - writes resolved value back into `buffer`
 * - records traversal metadata in buffer meta: `{ traverse: { path, tokens } }`
 * - mirrors latest buffer value into `inputs.buffer`
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {*} [params.args]
 * @param {Object} [params.inputs]
 * @param {Object} params.buffer
 * @param {*} [params.step]
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export default async function bufferTraverse({ lib, args, inputs, buffer, step } = {}) {
    try {
	const opts = normalizeArgs(lib, args);
	const path = opts.path ?? opts.value ?? null;
	const required = ("required" in opts) ? !!opts.required : true;

	const tokens = tokenizePath(path);
	if (!tokens.length) {
	    return helpers.SR_error(new Error("buffer.traverse: missing/invalid path"), {
		op: "buffer.traverse",
		step,
		path
	    });
	}

	const root = buffer.get();

	// lib.hash.get expects "a.b.c" form.
	const dotPath = tokens.map(String).join(".");
	const out = lib.hash.get(root, dotPath);

	if (required && out === undefined) {
	    return helpers.SR_error(new Error("buffer.traverse: path not found"), {
		op: "buffer.traverse",
		step,
		path,
		tokens
	    });
	}

	buffer.set(out, { traverse: { path, tokens } });

	if (inputs && typeof inputs === "object") inputs.buffer = buffer.get();

	return helpers.SR_ok({ op: "buffer.traverse", step, path, tokens });
    } catch (err) {
	return helpers.SR_error(err, { op: "buffer.traverse", step });
    }
}
