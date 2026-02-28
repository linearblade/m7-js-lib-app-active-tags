/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

import ActiveTags from "../ActiveTags.js";
import CONSTANTS from "../constants.js";
import VERSION from "../version.js";

const MOD = "[activeTags.standalone]";

function isObject(v) {
    return !!v && typeof v === "object";
}

function asObject(v) {
    return isObject(v) ? v : {};
}

function requiredPath(root, path) {
    if (!isObject(root)) return false;
    const parts = String(path).split(".");
    let cur = root;
    for (const part of parts) {
        if (!isObject(cur) || !(part in cur)) return false;
        cur = cur[part];
    }
    return typeof cur === "function";
}

function validateLib(lib) {
    if (!isObject(lib)) {
        throw new Error(`${MOD} invalid lib (expected object).`);
    }

    const requiredFns = [
        "require.all",
        "require.service",
        "hash.get",
        "hash.set",
    ];

    const missing = [];
    for (const path of requiredFns) {
        if (!requiredPath(lib, path)) missing.push(path);
    }

    if (missing.length > 0) {
        throw new Error(`${MOD} lib missing required functions: ${missing.join(", ")}`);
    }

    return lib;
}

/**
 * Resolve lib from a global root (`globalThis` by default).
 *
 * @param {Object} [opts]
 * @param {Object} [opts.root]
 *   Explicit root object to read from.
 * @param {string} [opts.key="lib"]
 *   Global key that holds the lib instance.
 * @returns {Object}
 */
export function resolveStandaloneLib(opts = {}) {
    opts = asObject(opts);
    const root = isObject(opts.root)
        ? opts.root
        : (typeof globalThis !== "undefined" ? globalThis : null);

    const keyRaw = typeof opts.key === "string" ? opts.key : "lib";
    const key = keyRaw.trim() || "lib";

    if (!root || !isObject(root)) {
        throw new Error(`${MOD} cannot resolve global root.`);
    }

    const lib = root[key];
    if (!lib) {
        throw new Error(`${MOD} missing global '${key}'.`);
    }

    return validateLib(lib);
}

/**
 * Create an ActiveTags instance in standalone mode.
 *
 * @param {Object} [conf={}]
 *   ActiveTags runtime config.
 * @param {Object} [opts={}]
 * @param {Object} [opts.lib]
 *   Explicit lib instance override.
 * @param {Object} [opts.root]
 *   Optional global root for lookup when `opts.lib` is not provided.
 * @param {string} [opts.key="lib"]
 *   Optional global key for lookup when `opts.lib` is not provided.
 * @returns {{ lib: Object, ActiveTags: Function, AT: Object, CONSTANTS: Object, VERSION: string }}
 */
export function createActiveTags(conf = {}, opts = {}) {
    opts = asObject(opts);
    const lib = opts.lib ? validateLib(opts.lib) : resolveStandaloneLib(opts);
    const AT = new ActiveTags(lib, conf);
    return { lib, ActiveTags, AT, CONSTANTS, VERSION };
}

/**
 * Create and start an ActiveTags instance in standalone mode.
 *
 * @param {Object} [conf={}]
 *   ActiveTags runtime config.
 * @param {Object} [opts={}]
 *   Same options as `createActiveTags`.
 * @returns {Promise<{ lib: Object, ActiveTags: Function, AT: Object, CONSTANTS: Object, VERSION: string }>}
 */
export async function startActiveTags(conf = {}, opts = {}) {
    const ctx = createActiveTags(conf, opts);
    await ctx.AT.start();
    return ctx;
}

// Best-effort global lib export for convenience consumers.
// This may be null when loaded in non-browser/non-global-lib contexts.
const lib = (() => {
    try {
        return resolveStandaloneLib();
    } catch (err) {
        return null;
    }
})();

export { ActiveTags, CONSTANTS, VERSION, lib };

export default {
    lib,
    ActiveTags,
    CONSTANTS,
    VERSION,
    createActiveTags,
    startActiveTags,
    resolveStandaloneLib,
};
