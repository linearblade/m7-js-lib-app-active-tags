/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */


/**
 * requireLibs(root, targets, opts?)
 *
 * Standalone dependency validator for nested paths.
 * Does NOT rely on m7 lib utilities (array/hash), so it can run during bootstrap.
 *
 * @param {object} root - root object to validate against (e.g. window.lib)
 * @param {string|string[]} targets - space-delimited string or array of dot-paths
 * @param {object} [opts]
 * @param {string} [opts.mod='[requireLibs]'] - label for error messages
 * @param {boolean} [opts.returnMap=false] - return {path:value} instead of array
 * @param {boolean} [opts.allowFalsy=true] - if false, falsy values fail (rare)
 * @returns {any[]|Record<string, any>} resolved values
 * @throws Error if any target is missing
 */

export function requireLibs(root, targets, opts = {}) {
    opts = lib.hash.to(opts, "mod");
    const mod       = lib.hash.get(opts, "mod", "[requireLibs]");
    const returnMap = !!lib.hash.get(opts, "returnMap", false);
    const die       = lib.hash.get(opts, "die", true);

    // default policy: must exist, and resolved value must NOT be nullish
    const truthy = !!lib.hash.get(opts, "truthy", false);

    if (!lib.utils.baseType(root, "object")) {
	throw new Error(`${mod} invalid root (expected object)`);
    }

    const list = lib.array.to(targets, /\s+/);

    const outArr = [];
    const outMap = {};
    const missing = [];

    for (const path of list) {
	// structural existence check first (fast + pinpoints missing paths)
	if (!lib.hash.exists(root, path)) {
	    missing.push(path);
	    continue;
	}

	const val = lib.hash.get(root, path);

	// default: disallow null/undefined
	const ok = truthy ? !!val : (val !== null && val !== undefined);

	if (!ok) {
	    missing.push(path);
	    continue;
	}

	outArr.push(val);
	outMap[path] = val;
    }

    if (missing.length && die) {
	throw new Error(`${mod} missing required targets: ${missing.join(", ")}`);
    }

    return returnMap ? outMap : outArr;
}

export default requireLibs;
