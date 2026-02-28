/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

import helpers from "../../class/engine/helpers.js";

// builtins/target/index.js

const TARGET = {
    PATCH:   "patch",
    RESET:   "reset",
    SET:     "set",
    PROP_GET:"propGet",
    PROP_SET:"propSet",
    CLASS_ADD: "classAdd",
    CLASS_REMOVE: "classRemove",
    CLASS_SET: "classSet",
    CLASS_RESET: "classReset",
    CLASS_TOGGLE: "classToggle",
    FROMBUF: "fromBuffer",
    TOBUF:   "toBuffer",
    CLOSEST: "closest",
    FIND:    "find",
    PARENT:  "parent",
    CHILD:   "child",
};

/**
 * Validate and return current working target.
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {Object} params.ticket
 * @returns {Element}
 * @throws {Error} If `ticket.target` is not resolvable to a DOM element.
 */
function _cur({ lib, ticket }) {
    const cur = ticket.target;
    lib.dom.attempt(cur, true);
    return cur;
}

/**
 * Resolve effective target element from explicit target or ticket target.
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {Object} [params.ticket]
 * @param {*} [params.target]
 * @returns {Element}
 * @throws {Error} If target cannot be resolved to DOM.
 */
function _resolveTarget({ lib, ticket, target }) {
    const hasExplicitTarget = _hasTargetInput({ lib, value: target });
    const el = hasExplicitTarget ? target : lib.hash.get(ticket, "target");
    return _attemptTargetInput({ lib, value: el });
}

function _hasTargetInput({ lib, value }) {
    if (lib.dom.is(value)) return true;
    return !lib.utils.isEmpty(value);
}

function _attemptTargetInput({ lib, value }) {
    if (lib.dom.is(value)) return value;
    return lib.dom.attempt(value, true);
}

function _normalizeClassTokens({ lib, raw }) {
    const sourceValues = lib.array.is(raw) ? raw : [raw];
    const tokens = [];
    const seen = new Set();

    for (const source of sourceValues) {
        const text = lib.str.to(source, true).trim();
        if (!text) continue;

        const chunks = text.split(/[,\s]+/);
        for (const chunk of chunks) {
            const token = lib.str.to(chunk, true).trim();
            if (!token || seen.has(token)) continue;
            seen.add(token);
            tokens.push(token);
        }
    }

    return tokens;
}

function _resolveClassArgs({ lib, args, op }) {
    const parsed = lib.args.parse(args, {}, { parms: "className target force", pop: true }) || {};
    const raw = lib.hash.getUntilNotEmpty(parsed, "className class classes cls name value", null);
    const classes = _normalizeClassTokens({ lib, raw });
    if (!classes.length) {
        throw new Error(`${op}: missing class name.`);
    }
    const targetRef = lib.hash.getUntilNotEmpty(parsed, "target selector", null);
    const forceRaw = lib.hash.getUntilNotEmpty(parsed, "force state", null);
    const force = lib.bool.ish(forceRaw) ? lib.bool.yes(forceRaw) : null;
    return { classes, targetRef, force };
}

function _resolveTraversal({ lib, ticket, job, args, parms = "" }) {
    const parsed = lib.args.parse(args, {}, { parms, pop: true }) || {};
    const targetRef = lib.hash.getUntilNotEmpty(parsed, "target scope from within", null);
    const wantsReset = lib.bool.yes(lib.hash.getUntilNotEmpty(parsed, "reset root", false));

    if (_hasTargetInput({ lib, value: targetRef })) {
        return { parsed, base: _attemptTargetInput({ lib, value: targetRef }), reset: wantsReset };
    }

    if (wantsReset) {
        const root = job && job.e ? job.e : lib.hash.get(ticket, "target");
        return { parsed, base: lib.dom.attempt(root, true), reset: true };
    }

    return { parsed, base: _cur({ lib, ticket }), reset: false };
}

function _resolveTargetFromParsed({ lib, ticket, job, target, parsed }) {
    const targetRef = lib.hash.getUntilNotEmpty(parsed, "target selector", null);
    const wantsReset = lib.bool.yes(lib.hash.getUntilNotEmpty(parsed, "reset root", false));

    if (_hasTargetInput({ lib, value: targetRef })) {
        return {
            el: _resolveTarget({ lib, ticket, target: targetRef }),
            targetRef,
            reset: wantsReset,
        };
    }

    if (wantsReset) {
        const root = job && job.e ? job.e : lib.hash.get(ticket, "target");
        return {
            el: lib.dom.attempt(root, true),
            targetRef: null,
            reset: true,
        };
    }

    return {
        el: _resolveTarget({ lib, ticket, target }),
        targetRef: null,
        reset: false,
    };
}



/**
 * Write value into an unresolved destination expression target.
 *
 * Destination must parse into target-ref shape `{ src, prop }`.
 */
function _writeExprDestination({ lib, expr, job, ticket, ctx, dst, value }) {
    const resolver = expr;

    const parsed = resolver.parse(
	{
	    job,
	    ticket,
	    ctx,
	    env: lib.hash.get(lib, "_env"),
	},
	dst
    );

    const src = lib.hash.get(parsed, "src");
    const prop = lib.hash.get(parsed, "prop");

    if (src == null || lib.utils.isEmpty(prop)) {
	throw new Error(`target.propGet: destination did not resolve to writable target '${dst}'`);
    }

    if (lib.dom.is(src)) {
	lib.dom.set(src, prop, value);
	return;
    }

    lib.hash.set(src, prop, value);
}

/**
 * `target.patch` builtin.
 *
 * Applies a patch object to the current working target (`ticket.target`).
 *
 * Sources:
 * - `data-attr-*` attributes on current target (prefix stripped)
 * - op args hash (wins over DOM attributes)
 *
 * Side effects:
 * - Writes each patch key via `lib.dom.set(target, key, value)`.
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {*} [params.args]
 * @param {Object} params.ticket
 * @param {Element} [params.target]
 * @param {*} [params.step]
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function targetPatch({ lib, args, ticket, target, job, step } = {}) {
    try {
        const parsed = lib.args.parse(args, {}, { parms: "target reset fromDom", pop: true }) || {};
        const resolved = _resolveTargetFromParsed({ lib, ticket, job, target, parsed });
        const el = resolved.el;

        const fromDomRaw = lib.hash.getUntilNotEmpty(parsed, "fromDom dom attrs fromAttributes", null);
        const includeFromDom = lib.bool.ish(fromDomRaw) ? lib.bool.yes(fromDomRaw) : true;
        const fromDom = includeFromDom ? (lib.dom.filterAttributes(el, /^data-attr-/, 1) || {}) : {};
        const fromArgs = lib.hash.to(parsed);
        delete fromArgs.target;
        delete fromArgs.selector;
        delete fromArgs.reset;
        delete fromArgs.root;
        delete fromArgs.fromDom;
        delete fromArgs.dom;
        delete fromArgs.attrs;
        delete fromArgs.fromAttributes;

        if (lib.hash.empty(fromArgs) && lib.array.is(args) && lib.hash.is(args[0])) {
            Object.assign(fromArgs, lib.hash.to(args[0]));
        }

        const patch = { ...fromDom, ...fromArgs };

        let applied = 0;
        for (const k in patch) {
            if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
            lib.dom.set(el, k, patch[k]);
            applied++;
        }

        return helpers.SR_ok({
            op: "target.patch",
            applied,
            keys: lib.hash.keys(patch),
            reset: resolved.reset,
            fromDom: includeFromDom,
            step,
        });
    } catch (err) {
        return helpers.SR_error(err, { op: "target.patch", step });
    }
}

/**
 * `target.reset` builtin.
 *
 * Resets `ticket.target` to job root element (`job.e`).
 *
 * @param {Object} params
 * @param {Object} params.job
 * @param {Object} params.lib
 * @param {Object} params.ticket
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function targetReset({ job, lib, ticket } = {}) {
    try {
        ticket.target = job.e;
        lib.dom.attempt(ticket.target, true);
        return { status: "ok", detail: { op: TARGET.RESET } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: TARGET.RESET } };
    }
}

/**
 * `target.set` builtin.
 *
 * Resolves a target reference into a DOM element and assigns it to `ticket.target`.
 *
 * Argument shapes:
 * - hash args: `{ selector }`
 * - positional args: `[selector]`
 *
 * Resolution is delegated to `lib.dom.attempt(...)`.
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {*} [params.args]
 * @param {Object} params.ticket
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function targetSet({ lib, args, ticket, job } = {}) {
    try {
        const parsed = lib.args.parse(args, {}, { parms: "target reset", pop: true }) || {};
        let targetRef = lib.hash.getUntilNotEmpty(parsed, "target selector", null);
        const wantsReset = lib.bool.yes(lib.hash.getUntilNotEmpty(parsed, "reset root", false));

        if (!_hasTargetInput({ lib, value: targetRef }) && !lib.hash.is(args)) {
            targetRef = lib.array.to(args)[0];
        }

        let next = null;
        if (_hasTargetInput({ lib, value: targetRef })) {
            next = _attemptTargetInput({ lib, value: targetRef });
        } else if (wantsReset) {
            const root = job && job.e ? job.e : lib.hash.get(ticket, "target");
            next = lib.dom.attempt(root, true);
        } else {
            return {
                status: "error",
                error: new Error("target.set: missing target"),
                detail: { op: TARGET.SET },
            };
        }

        ticket.target = next;

        return {
            status: "ok",
            detail: {
                op: TARGET.SET,
                targetRef: _hasTargetInput({ lib, value: targetRef }) ? targetRef : null,
                reset: wantsReset,
            },
        };
    } catch (err) {
        return { status: "error", error: err, detail: { op: TARGET.SET } };
    }
}

/**
 * `target.propGet` builtin.
 *
 * Reads one property from current target and optionally writes the value
 * into an unresolved destination expression target.
 *
 * Argument shapes:
 * - hash args: `{ prop, dst }` (also accepts `attr` alias)
 * - positional args: `[prop, dst]`
 * - compact positional: `"prop:dstExpr"` as first positional arg
 *
 * Source:
 * - `target` (VM-provided current target).
 *
 * Side effects:
 * - Writes value to buffer when available.
 * - Writes value to destination expression when `dst` is provided.
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {*} [params.args]
 * @param {Object} [params.buffer]
 * @param {Object} [params.ticket]
 * @param {Object} [params.job]
 * @param {*} [params.ctx]
 * @param {*} [params.expr]
 * @param {*} [params.target]
 * @param {*} [params.step]
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function targetPropGet({
    lib,
    args,
    buffer,
    ticket,
    job,
    ctx,
    expr,
    target,
    step,
} = {}) {
    try {
	const parsed = lib.args.parse(args, {}, { parms: "prop dst target reset", pop: true });
	const prop = lib.hash.getUntilNotEmpty(parsed, "prop attr key name");
	const dst  = lib.hash.getUntilNotEmpty(parsed, "dst to", null);
        const resolved = _resolveTargetFromParsed({ lib, ticket, job, target, parsed });
	const el = resolved.el;
        if (lib.utils.isEmpty(prop)) {
            return helpers.SR_error(new Error("target.propGet: missing prop"), {
                op: "target.propGet",
                step,
            });
        }
	if (!lib.dom.is(el)) {
            return helpers.SR_error(new Error("target.propGet: target is invalid"), {
                op: "target.propGet",
                step,
            });
        }
	
        const value = lib.dom.get(el, prop);
        if (!lib.utils.isEmpty(dst)) {
            _writeExprDestination({ lib, expr, job, ticket, ctx, dst, value });
        }else {
            buffer.set(value, { op: "target.propGet", prop });
        }


        return helpers.SR_ok({
            op: "target.propGet",
            prop,
            dst: lib.utils.isEmpty(dst) ? null : dst,
            reset: resolved.reset,
            value,
            step,
        });
    } catch (err) {
        return helpers.SR_error(err, { op: "target.propGet", step });
    }
}

/**
 * `target.propSet` builtin.
 *
 * Writes one property onto current target.
 *
 * Argument shapes:
 * - hash args: `{ prop, value }` (also accepts `attr` alias)
 * - positional args: `[prop, value]`
 *
 * Source:
 * - `target` (VM-provided current target).
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {*} [params.args]
 * @param {*} [params.target]
 * @param {*} [params.step]
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function targetPropSet({ lib, args, target, ticket, job, step } = {}) {
    try {
        const parsed = lib.args.parse(args, {}, { parms: "prop value target reset", pop: true });
        const prop = lib.hash.getUntilNotEmpty(parsed, "prop attr key name");
        const value = parsed.value;
        const resolved = _resolveTargetFromParsed({ lib, ticket, job, target, parsed });
        const el = resolved.el;

        if (!lib.dom.is(el)) {
            return helpers.SR_error(new Error("target.propSet: target is invalid"), {
                op: "target.propSet",
                step,
            });
        }

        if (lib.utils.isEmpty(prop)) {
            return helpers.SR_error(new Error("target.propSet: missing prop"), {
                op: "target.propSet",
                step,
            });
        }

        const nextValue = lib.dom.set(el, prop, value);

        return helpers.SR_ok({
            op: "target.propSet",
            prop,
            reset: resolved.reset,
            value: nextValue,
            step,
        });
    } catch (err) {
        return helpers.SR_error(err, { op: "target.propSet", step });
    }
}

/**
 * `target.classAdd` builtin.
 *
 * Adds one or more class names to the current target.
 *
 * Argument shapes:
 * - hash args: `{ className }` (aliases: `class`, `classes`, `cls`, `name`, `value`)
 * - positional args: `[className]`
 *
 * `className` may be:
 * - whitespace-delimited string
 * - comma-delimited string
 * - array of class names
 */
export async function targetClassAdd({ lib, args, ticket, target, step } = {}) {
    try {
        const resolved = _resolveClassArgs({ lib, args, op: "target.classAdd" });
        const classes = resolved.classes;
        const targetRef = resolved.targetRef;
        const el = _resolveTarget({ lib, ticket, target: targetRef || target });

        if (!el.classList || typeof el.classList.add !== "function") {
            return helpers.SR_error(new Error("target.classAdd: target has no classList"), {
                op: "target.classAdd",
                step,
            });
        }

        el.classList.add(...classes);

        return helpers.SR_ok({
            op: "target.classAdd",
            classes,
            step,
        });
    } catch (err) {
        return helpers.SR_error(err, { op: "target.classAdd", step });
    }
}

/**
 * `target.classRemove` builtin.
 *
 * Removes one or more class names from the current target.
 *
 * Argument shapes:
 * - hash args: `{ className }` (aliases: `class`, `classes`, `cls`, `name`, `value`)
 * - positional args: `[className]`
 *
 * `className` may be:
 * - whitespace-delimited string
 * - comma-delimited string
 * - array of class names
 */
export async function targetClassRemove({ lib, args, ticket, target, step } = {}) {
    try {
        const resolved = _resolveClassArgs({ lib, args, op: "target.classRemove" });
        const classes = resolved.classes;
        const targetRef = resolved.targetRef;
        const el = _resolveTarget({ lib, ticket, target: targetRef || target });

        if (!el.classList || typeof el.classList.remove !== "function") {
            return helpers.SR_error(new Error("target.classRemove: target has no classList"), {
                op: "target.classRemove",
                step,
            });
        }

        el.classList.remove(...classes);

        return helpers.SR_ok({
            op: "target.classRemove",
            classes,
            step,
        });
    } catch (err) {
        return helpers.SR_error(err, { op: "target.classRemove", step });
    }
}

/**
 * `target.classSet` builtin.
 *
 * Replaces the target class list with provided classes.
 *
 * Argument shapes:
 * - hash args: `{ className, target }` (class aliases: `class`, `classes`, `cls`)
 * - positional args: `[className]`
 */
export async function targetClassSet({ lib, args, ticket, target, step } = {}) {
    try {
        const resolved = _resolveClassArgs({ lib, args, op: "target.classSet" });
        const classes = resolved.classes;
        const targetRef = resolved.targetRef;
        const el = _resolveTarget({ lib, ticket, target: targetRef || target });
        const classText = classes.join(" ");

        if (typeof el.setAttribute === "function") {
            el.setAttribute("class", classText);
        } else {
            el.className = classText;
        }

        return helpers.SR_ok({
            op: "target.classSet",
            classes,
            step,
        });
    } catch (err) {
        return helpers.SR_error(err, { op: "target.classSet", step });
    }
}

/**
 * `target.classReset` builtin.
 *
 * Clears all classes from the target element.
 *
 * Argument shapes:
 * - hash args: `{ target }`
 * - positional args: `[target]` (via kv parser aliasing where provided)
 */
export async function targetClassReset({ lib, args, ticket, target, step } = {}) {
    try {
        const parsed = lib.args.parse(args, {}, { parms: "target", pop: true }) || {};
        const targetRef = lib.hash.getUntilNotEmpty(parsed, "target selector", null);
        const el = _resolveTarget({ lib, ticket, target: targetRef || target });

        if (typeof el.removeAttribute === "function") {
            el.removeAttribute("class");
        } else {
            el.className = "";
        }

        return helpers.SR_ok({
            op: "target.classReset",
            step,
        });
    } catch (err) {
        return helpers.SR_error(err, { op: "target.classReset", step });
    }
}

/**
 * `target.classToggle` builtin.
 *
 * Toggles class names on target.
 *
 * Args:
 * - `className` aliases: `class`, `classes`, `cls`
 * - optional `force` boolish
 * - optional `target`
 */
export async function targetClassToggle({ lib, args, ticket, target, step } = {}) {
    try {
        const resolved = _resolveClassArgs({ lib, args, op: "target.classToggle" });
        const classes = resolved.classes;
        const targetRef = resolved.targetRef;
        const force = resolved.force;
        const el = _resolveTarget({ lib, ticket, target: targetRef || target });

        if (!el.classList || typeof el.classList.toggle !== "function") {
            return helpers.SR_error(new Error("target.classToggle: target has no classList"), {
                op: "target.classToggle",
                step,
            });
        }

        const toggled = {};
        for (const className of classes) {
            toggled[className] = force == null
                ? el.classList.toggle(className)
                : el.classList.toggle(className, force);
        }

        return helpers.SR_ok({
            op: "target.classToggle",
            classes,
            force,
            toggled,
            step,
        });
    } catch (err) {
        return helpers.SR_error(err, { op: "target.classToggle", step });
    }
}

/**
 * `target.fromBuffer` builtin.
 *
 * Loads `ticket.target` from `buffer.get()`.
 * The loaded value must resolve to a DOM element.
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {Object} params.ticket
 * @param {Object} params.buffer
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function targetFromBuffer({ lib, ticket, buffer } = {}) {
    try {
        const next = buffer.get();
        lib.dom.attempt(next, true);
        ticket.target = next;
        return { status: "ok", detail: { op: TARGET.FROMBUF } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: TARGET.FROMBUF } };
    }
}

/**
 * `target.toBuffer` builtin.
 *
 * Writes the current working target into `buffer`.
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {Object} params.ticket
 * @param {Object} params.buffer
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function targetToBuffer({ lib, ticket, buffer } = {}) {
    try {
        const cur = _cur({ lib, ticket });
        buffer.set(cur);
        return { status: "ok", detail: { op: TARGET.TOBUF } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: TARGET.TOBUF } };
    }
}

/**
 * `target.closest` builtin.
 *
 * Moves `ticket.target` to `currentTarget.closest(selector)`.
 *
 * Argument shapes:
 * - hash args: `{ selector }`
 * - positional args: `[selector]`
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {*} [params.args]
 * @param {Object} params.ticket
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function targetClosest({ lib, args, ticket, job } = {}) {
    try {
        const resolved = _resolveTraversal({ lib, ticket, job, args, parms: "selector reset target" });
        const selector = lib.hash.getUntilNotEmpty(resolved.parsed, "selector query sel", null);
        if (lib.utils.isEmpty(selector)) {
            return {
                status: "error",
                error: new Error("target.closest: missing selector"),
                detail: { op: TARGET.CLOSEST },
            };
        }
        const next = resolved.base.closest(selector);
        lib.dom.attempt(next, true);
        ticket.target = next;
        return { status: "ok", detail: { op: TARGET.CLOSEST, selector, reset: resolved.reset } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: TARGET.CLOSEST } };
    }
}

/**
 * `target.find` builtin.
 *
 * Moves `ticket.target` to `currentTarget.querySelector(selector)`.
 *
 * Argument shapes:
 * - hash args: `{ selector }`
 * - positional args: `[selector]`
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {*} [params.args]
 * @param {Object} params.ticket
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function targetFind({ lib, args, ticket, job } = {}) {
    try {
        const resolved = _resolveTraversal({ lib, ticket, job, args, parms: "selector reset target" });
	const selector = lib.hash.getUntilNotEmpty(resolved.parsed, "selector query sel", null);
        if (lib.utils.isEmpty(selector)) {
            return {
                status: "error",
                error: new Error("target.find: missing selector"),
                detail: { op: TARGET.FIND },
            };
        }
        const next = resolved.base.querySelector(selector);
        lib.dom.attempt(next, true);
        ticket.target = next;
        return { status: "ok", detail: { op: TARGET.FIND, selector, reset: resolved.reset } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: TARGET.FIND } };
    }
}

/**
 * `target.parent` builtin.
 *
 * Moves `ticket.target` to:
 * - `currentTarget.parentElement` when no selector is provided, or
 * - `currentTarget.closest(selector)?.parentElement` when selector is provided.
 *
 * Argument shapes:
 * - hash args: `{ selector }`
 * - positional args: `[selector]`
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {*} [params.args]
 * @param {Object} params.ticket
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function targetParent({ lib, args, ticket, job } = {}) {
    try {
        const resolved = _resolveTraversal({ lib, ticket, job, args, parms: "selector reset target" });
        const selector = lib.hash.getUntilNotEmpty(resolved.parsed, "selector query sel", null);
        const next = selector
            ? resolved.base.closest(selector)?.parentElement
            : resolved.base.parentElement;
        lib.dom.attempt(next, true);
        ticket.target = next;

        return {
            status: "ok",
            detail: { op: TARGET.PARENT, selector: selector || null, reset: resolved.reset },
        };
    } catch (err) {
        return { status: "error", error: err, detail: { op: TARGET.PARENT } };
    }
}

/**
 * `target.child` builtin.
 *
 * Moves `ticket.target` to `currentTarget.children[index]`.
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
 * @param {*} [params.args]
 * @param {Object} params.ticket
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export async function targetChild({ lib, args, ticket, job } = {}) {
    try {
        const resolved = _resolveTraversal({ lib, ticket, job, args, parms: "index reset target" });
        const rawIndex = lib.hash.getUntilNotEmpty(resolved.parsed, "index idx i", 0);
        const index = lib.number.toInt(rawIndex, 0);
        const next = resolved.base.children[index];
        lib.dom.attempt(next, true);
        ticket.target = next;
        return { status: "ok", detail: { op: TARGET.CHILD, index, reset: resolved.reset } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: TARGET.CHILD } };
    }
}

export default {
    [TARGET.PATCH]:   targetPatch,
    [TARGET.RESET]:   targetReset,
    [TARGET.SET]:     targetSet,
    [TARGET.PROP_GET]:targetPropGet,
    [TARGET.PROP_SET]:targetPropSet,
    [TARGET.CLASS_ADD]:targetClassAdd,
    [TARGET.CLASS_REMOVE]:targetClassRemove,
    [TARGET.CLASS_SET]:targetClassSet,
    [TARGET.CLASS_RESET]:targetClassReset,
    [TARGET.CLASS_TOGGLE]:targetClassToggle,
    [TARGET.FROMBUF]: targetFromBuffer,
    [TARGET.TOBUF]:   targetToBuffer,
    [TARGET.CLOSEST]: targetClosest,
    [TARGET.FIND]:    targetFind,
    [TARGET.PARENT]:  targetParent,
    [TARGET.CHILD]:   targetChild,
};

export { TARGET };
