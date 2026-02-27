/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

// builtins/e/index.js

const E = {
    SELF:    "self",
    RESET:   "reset",
    FIND:    "find",
    CLOSEST: "closest",
    PARENT:  "parent",
    CHILD:   "child",
};

/**
 * Validate and return the job root element (`job.e`).
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {Object} params.job
 * @returns {Element}
 * @throws {Error} If `job.e` is not resolvable to a DOM element.
 */
function _root({ lib, job }) {
    const root = lib.hash.get(job, "e");
    lib.dom.attempt(root, true);
    return root;
}

/**
 * `e.reset` builtin.
 *
 * Sets `ticket.target` to the job root element (`job.e`).
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {Object} params.job
 * @param {Object} params.ticket
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function eReset({ lib, job, ticket } = {}) {
    try {
        ticket.target = _root({ lib, job });
        return { status: "ok", detail: { op: E.RESET } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: E.RESET } };
    }
}

/**
 * `e.self` builtin.
 *
 * Alias of `e.reset`; sets `ticket.target` to the job root element (`job.e`).
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {Object} params.job
 * @param {Object} params.ticket
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function eSelf({ lib, job, ticket } = {}) {
    try {
        ticket.target = _root({ lib, job });
        return { status: "ok", detail: { op: E.SELF } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: E.SELF } };
    }
}

/**
 * `e.find` builtin.
 *
 * Resolves from root element only:
 * `ticket.target = job.e.querySelector(selector)`.
 *
 * Argument shapes:
 * - hash args: `{ selector }`
 * - positional args: `[selector]`
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {Object} params.job
 * @param {*} [params.args]
 * @param {Object} params.ticket
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function eFind({ lib, job, args, ticket } = {}) {
    try {
        const root = _root({ lib, job });
        const selector = lib.hash.is(args) ? args.selector : lib.array.to(args)[0];
        const next = root.querySelector(selector);
        lib.dom.attempt(next, true);
        ticket.target = next;
        return { status: "ok", detail: { op: E.FIND, selector } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: E.FIND } };
    }
}

/**
 * `e.closest` builtin.
 *
 * Resolves from root element only:
 * `ticket.target = job.e.closest(selector)`.
 *
 * Argument shapes:
 * - hash args: `{ selector }`
 * - positional args: `[selector]`
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {Object} params.job
 * @param {*} [params.args]
 * @param {Object} params.ticket
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function eClosest({ lib, job, args, ticket } = {}) {
    try {
        const root = _root({ lib, job });
        const selector = lib.hash.is(args) ? args.selector : lib.array.to(args)[0];
        const next = root.closest(selector);
        lib.dom.attempt(next, true);
        ticket.target = next;
        return { status: "ok", detail: { op: E.CLOSEST, selector } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: E.CLOSEST } };
    }
}

/**
 * `e.parent` builtin.
 *
 * Resolves from root element only:
 * - `job.e.parentElement` when no selector is provided, or
 * - `job.e.closest(selector)?.parentElement` when selector is provided.
 *
 * Argument shapes:
 * - hash args: `{ selector }`
 * - positional args: `[selector]`
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {Object} params.job
 * @param {*} [params.args]
 * @param {Object} params.ticket
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function eParent({ lib, job, args, ticket } = {}) {
    try {
        const root = _root({ lib, job });
        const selector = lib.hash.is(args) ? args.selector : lib.array.to(args)[0];
        const next = selector ? root.closest(selector)?.parentElement : root.parentElement;
        lib.dom.attempt(next, true);
        ticket.target = next;
        return { status: "ok", detail: { op: E.PARENT, selector: selector || null } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: E.PARENT } };
    }
}

/**
 * `e.child` builtin.
 *
 * Resolves from root element only:
 * `ticket.target = job.e.children[index]`.
 *
 * Argument shapes:
 * - hash args: `{ index }`
 * - positional args: `[index]`
 *
 * Index normalization:
 * - Parsed via `lib.number.toInt(rawIndex, 0)`.
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {Object} params.job
 * @param {*} [params.args]
 * @param {Object} params.ticket
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function eChild({ lib, job, args, ticket } = {}) {
    try {
        const root = _root({ lib, job });
        const rawIndex = lib.hash.is(args) ? args.index : lib.array.to(args)[0];
        const index = lib.number.toInt(rawIndex, 0);
        const next = root.children[index];
        lib.dom.attempt(next, true);
        ticket.target = next;
        return { status: "ok", detail: { op: E.CHILD, index } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: E.CHILD } };
    }
}

export default {
    [E.SELF]:    eSelf,
    [E.RESET]:   eReset,
    [E.FIND]:    eFind,
    [E.CLOSEST]: eClosest,
    [E.PARENT]:  eParent,
    [E.CHILD]:   eChild,
};

export { E };
