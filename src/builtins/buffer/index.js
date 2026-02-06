// builtins/buffer.js
// Builtins: buffer.set, buffer.get, buffer.traverse, buffer.clear
// VM signature: ({ job, lib, args, trigger, ticket, inputs, buffer, ctx, step }) => StageResultLike

import helpers from "../../class/engine/helpers.js";

/**
 * Normalize args into a plain object.
 * - If args is scalar => { value: args }
 * - If args is array  => { value: args[0] }
 * - If args is object => args
 */
function normalizeArgs(lib, args) {
    if (lib?.utils?.isScalar?.(args)) return { value: args };
    if (lib?.array?.is?.(args)) return { value: args[0] };
    if (args && typeof args === "object") return args;
    return {};
}

/**
 * Convert a path into tokens.
 * Supports:
 *  - "a.b.c"
 *  - "a[0].b"
 *  - ["a", 0, "b"]
 */
function tokenizePath(lib, path) {
    if (Array.isArray(path)) return path;
    if (!path || typeof path !== "string") return [];

    // Convert bracket notation: a[0].b -> a.0.b
    const s = path.replace(/\[(\d+)\]/g, ".$1");
    return s.split(".").filter(Boolean).map(tok => {
	// numeric tokens become numbers
	return (/^\d+$/).test(tok) ? Number(tok) : tok;
    });
}

function getBufferOrError(buffer, step) {
    if (!buffer || typeof buffer.get !== "function" || typeof buffer.set !== "function") {
	return helpers.SR_error(
	    new Error("buffer.* builtin: missing buffer slot (expected buffer.get/set/clear)"),
	    { op: "buffer", step }
	);
    }
    return null;
}

// -----------------------------------------------------------------------------
// buffer.set
// -----------------------------------------------------------------------------
export async function bufferSet({ lib, args, inputs, buffer, step } = {}) {
    try {
	const bad = getBufferOrError(buffer, step);
	if (bad) return bad;

	const opts = normalizeArgs(lib, args);
	const value = ("value" in opts) ? opts.value : null;
	const meta = opts.meta && typeof opts.meta === "object" ? opts.meta : null;

	buffer.set(value, meta);

	// convenience mirror (optional): expose latest value
	if (inputs && typeof inputs === "object") inputs.buffer = buffer.get();

	return helpers.SR_ok({ op: "buffer.set", step });
    } catch (err) {
	return helpers.SR_error(err, { op: "buffer.set", step });
    }
}

// -----------------------------------------------------------------------------
// buffer.get
// -----------------------------------------------------------------------------
export async function bufferGet({ inputs, buffer, step } = {}) {
    try {
	const bad = getBufferOrError(buffer, step);
	if (bad) return bad;

	const value = buffer.get();

	// convenience: mirror into inputs.buffer (so other ops can read it easily)
	if (inputs && typeof inputs === "object") inputs.buffer = value;

	return helpers.SR_ok({ op: "buffer.get", step, value });
    } catch (err) {
	return helpers.SR_error(err, { op: "buffer.get", step });
    }
}

// -----------------------------------------------------------------------------
// buffer.clear
// -----------------------------------------------------------------------------
export async function bufferClear({ inputs, buffer, step } = {}) {
    try {
	const bad = getBufferOrError(buffer, step);
	if (bad) return bad;

	if (typeof buffer.clear === "function") buffer.clear();
	else buffer.set(null);

	if (inputs && typeof inputs === "object") inputs.buffer = buffer.get();

	return helpers.SR_ok({ op: "buffer.clear", step });
    } catch (err) {
	return helpers.SR_error(err, { op: "buffer.clear", step });
    }
}

// -----------------------------------------------------------------------------
// buffer.traverse
// Moves buffer.value => buffer.value[path]
// args:
//   { path: "a.b[0].c", required: true|false }
// -----------------------------------------------------------------------------
export async function bufferTraverse({ lib, args, inputs, buffer, step } = {}) {
    try {
	const bad = getBufferOrError(buffer, step);
	if (bad) return bad;

	const opts = normalizeArgs(lib, args);
	const path = opts.path ?? opts.value ?? null;
	const required = ("required" in opts) ? !!opts.required : true;

	const tokens = tokenizePath(lib, path);
	if (!tokens.length) {
	    return helpers.SR_error(new Error("buffer.traverse: missing/invalid path"), {
		op: "buffer.traverse",
		step,
		path
	    });
	}

	const root = buffer.get();

	// Prefer lib.hash.get if available (handles deep paths consistently)
	let out;
	if (lib?.hash?.get) {
	    // lib.hash.get usually expects "a.b.c" form; rebuild for it.
	    const dotPath = tokens.map(String).join(".");
	    out = lib.hash.get(root, dotPath);
	} else {
	    // Manual traversal
	    out = root;
	    for (const k of tokens) {
		if (out == null) break;
		out = out[k];
	    }
	}

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

// -----------------------------------------------------------------------------
// Export bundle
// -----------------------------------------------------------------------------
export const BUFFER = {
    set: bufferSet,
    get: bufferGet,
    clear: bufferClear,
    traverse: bufferTraverse,
};

export default BUFFER;
