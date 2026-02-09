// class/schema/Master.js
/**
 * Master (Schema Compiler Workspace)
 * ---------------------------------
 * Schema compiler for ActiveTags configuration.
 *
 * Purpose:
 * - Accept an arbitrary "raw" ActiveTags config object (often derived from JSON,
 *   data-* attributes, and external merges).
 * - Coerce and normalize it into a groomed, runtime-ready schema.
 * - Emit a structured compilation report (warnings/errors) without throwing for
 *   user config mistakes.
 *
 * Public API:
 * - `compile(input) -> { report, schema }`
 *     - `report` is a JSON-safe object: `{ ok:boolean, errors:Array, warnings:Array }`
 *     - `schema` is the groomed runtime schema (safe for consumers to read and store).
 *
 * Design posture:
 * - Master is a *compiler workspace*, not a long-lived state container.
 * - Internal normalization may freely create intermediate artifacts on the
 *   local workspace object, but the exported schema is groomed and stable.
 * - Coercion is preferred over rejection: invalid/unknown values are normalized
 *   to safe defaults and recorded as warnings where appropriate.
 *
 * Normalization strategy (v1):
 * - Basics: `name`, `require`, `enable`, `confirm`, `env`
 * - Buckets: normalize 3 "block" families using a shared procedure:
 *     - Requests:  `request` + `requests` + `request_shape`  -> `requests` bucket
 *     - Intervals: `interval` + `intervals` + `interval_shape` -> `intervals` bucket
 *     - Pipelines: `pipeline` + `pipelines` + `pipeline_shape` -> `pipelines` bucket
 * - Each bucket item is produced as: `effectiveItem = merge(shape, item)` and then
 *   passed through an item normalizer.
 *
 * LLM integration notes (reset-proofing):
 * - Do NOT read or depend on internal workspace artifacts (e.g. `_effective*`)
 *   outside of this module. Only the returned `{ schema, report }` is stable.
 * - Diagnostics must be written to the provided Report instance; do not throw
 *   for user-config errors except for missing `lib` (programmer error).
 * - All coercion helpers are lib-native:
 *     - `lib.hash.to`, `lib.hash.merge`, `lib.hash.keys`
 *     - `lib.array.to`, `lib.bool.yes/no`, `lib.utils.baseType/isEmpty`
 *
 * Versioning:
 * - This module defines Schema Compiler behavior for ActiveTags v1.
 */

import CONSTANTS from './constants.js';
import Report    from '../Report.js';
import DSL       from './DSL.js';
export default class Master {
    /**
     * Create a Master schema compiler workspace.
     *
     * Notes:
     * - This constructor does NOT compile or normalize anything.
     * - Master instances are lightweight and intended to be short-lived.
     * - All meaningful work happens in `compile(input)`.
     *
     * @param {Object} args
     *     Construction arguments.
     *
     * @param {Object} args.lib
     *     Required m7 lib instance providing hash/array/bool/utils helpers.
     *     Absence of `lib` is considered a programmer error.
     *
     * @param {Object} [args.env]
     *     Optional runtime environment/context.
     *     Reserved for future use (feature flags, document hooks, runtime bridges).
     *     Not currently used during normalization.
     *
     * @throws {Error}
     *     If `args.lib` is not provided.
     */
    constructor({ lib,  expr, env = {} }) {
	if (!lib) throw new Error("Master: missing lib");
	if(!expr) throw new Error("Master: missing expr");
	this.lib = lib;
	this.env = env;
	this.expr = expr;
	this.DSL = new DSL({lib,expr});
    }

    // ---------- public API ----------
    /**
     * Compile a raw ActiveTags configuration into a normalized runtime schema.
     *
     * Contract:
     * - This is the primary public entry point of the Master compiler.
     * - The function NEVER throws for user configuration errors.
     * - All diagnostics are recorded in the returned report object.
     *
     * Semantics:
     * - Input is coerced to a hash before processing.
     * - Normalization proceeds in deterministic phases:
     *     1) Basics (name, require, enable, confirm, env)
     *     2) Block normalization (requests, intervals, pipelines)
     * - All intermediate artifacts remain internal and are not exposed.
     *
     * @param {*} input
     *     Raw user configuration.
     *     Typically derived from JSON, data-* attributes, or merged sources.
     *
     * @returns {Object}
     *     Compilation result.
     *
     * @returns {Object} return.report
     *     Exported compilation report:
     *     `{ ok:boolean, errors:Array, warnings:Array }`
     *
     * @returns {Object} return.schema
     *     Normalized, groomed runtime schema.
     *     Safe for consumers to read, store, and pass to runtime systems.
     *
     * Notes:
     * - Consumers MUST treat the returned schema as read-only.
     * - Validation beyond basic normalization may occur in later phases.
     */
    compile(input){
        const output = this.lib.hash.to(input);
	const report = new Report({ lib: this.lib });
        this._normalizeBasics(report, output);    // name, selector, require, enable.autorun, confirm, etc.
        this._normalizeBlock(report, output, CONSTANTS.BLOCK_NORMALIZERS.REQUEST);
	this._normalizeBlock(report, output, CONSTANTS.BLOCK_NORMALIZERS.INTERVAL);
	this._normalizeBlock(report, output, CONSTANTS.BLOCK_NORMALIZERS.PIPELINE);
	this._normalizeBlock(report, output, CONSTANTS.BLOCK_NORMALIZERS.EVENT);

	//work on the final shape rather than futz with artifacts
	const normalized =  this._exportShape(output);

	this.DSL._compilePipelineDSL(report, normalized);
        const rv =  {report:report.export(), schema: normalized };
	console.log(rv);
	return rv;
	
    }

    /**
     * Produce the final exported runtime schema.
     *
     * Internal:
     * - This method selects and grooms only consumer-relevant fields from the
     *   internal normalization workspace.
     * - All intermediate and construction-only artifacts (raw input, shapes,
     *   temporary buckets, reports, etc.) are intentionally excluded.
     *
     * Semantics:
     * - Buckets (`requests`, `intervals`, `pipelines`) are taken from their
     *   `_effective*` counterparts produced during normalization.
     * - Missing buckets are normalized to empty hashes.
     * - Returned object is considered the canonical runtime schema.
     *
     * Invariants:
     * - The returned schema is structurally stable and JSON-safe.
     * - Consumers must treat the schema as read-only.
     *
     * @param {Object} s
     *     Internal normalization workspace object.
     *
     * @returns {Object}
     *     Groomed runtime schema.
     *
     * @private
     */
    _exportShape(s) {
        const lib = this.lib;

        const out = {
            name      : s.name,
            require   : s.require,

            enabled   : s.enabled,
	    autorun   : s.autorun,
            //confirm   : s.confirm,
            env       : s.env,

            requests  : s._effectiveRequests  || {},
            intervals : s._effectiveIntervals || {},
	    pipelines : s._effectivePipelines || {},
	    events    : s._effectiveEvents || {}
        };

	return out;
    }

    
    // ---------- phase 1: normalize ----------
    /**
     * Normalize top-level, non-bucket schema fields.
     *
     * Internal:
     * - Handles scalar and small structural fields that do not participate
     *   in block/bucket normalization.
     * - Performs coercion-first normalization with warning-based diagnostics.
     * - Never throws for user configuration errors.
     *
     * Fields normalized here:
     * - `require`  : string|array → array of tokens (split + trimmed)
     * - `name`     : coerced string (convenience identifier only)
     * - `enable`   : object(hash) with defaults applied
     *   - `enable.enabled` : defaults to true unless explicit "no" intent
     *   - `enable.autorun` : canonical autorun selector list
     * - `confirm`  : canonical confirm descriptor
     * - `env`      : object(hash) reserved for runtime user-space
     *
     * Diagnostics:
     * - Invalid types are coerced to safe defaults.
     * - Non-fatal issues are recorded as warnings on the provided Report.
     *
     * Invariants after normalization:
     * - `s.require` is always an array
     * - `s.enable` is always a hash
     * - `s.enable.enabled` is boolean
     * - `s.enable.autorun` is an array
     * - `s.confirm` is a canonical confirm object
     * - `s.env` is always a hash
     *
     * @param {Report} report
     *     Compilation report used to record warnings.
     *
     * @param {Object} s
     *     Internal normalization workspace object (mutated in place).
     *
     * @private
     */
    _normalizeBasics(report, s) {
        const lib = this.lib;

        // require: string|array -> array (split+trim)
        if (!lib.utils.baseType(s.require, "string array") && !lib.utils.isEmpty(s.require)) {
            report.warn("W101_REQUIRE_INVALID", "require", "require should be string|array");
        }
        s.require = lib.utils.baseType(s.require, "string array")
            ? lib.array.to(s.require, { split: /\s+/, trim: true })
            : [];

        // name: string coercion
        s.name = lib.str.to(s.name, true);
        // enable: hash coercion
	if (!lib.bool.ish(s.enabled)  && !lib.utils.isEmpty(s.enabled)) {
            report.warn("W102_ENABLE_INVALID", "enabled", "enabled should be boolish or undefined");
        }
	s.enabled = lib.bool.no(s.enabled) ? false:true;
	s.autorun = this._normalizeAutorunSelector(report, s.autorun);
	/*
        if (!lib.hash.is(s.enable) && !lib.utils.isEmpty(s.enable)) {
            report.warn("W102_ENABLE_INVALID", "enable", "enable should be object(hash)");
        }
        s.enable = lib.hash.to(s.enable);
	*/
	
        // enable.enabled: default true unless explicit "no" intent
        //s.enable.enabled = lib.bool.no(s.enable.enabled) ? false : true;

        // enable.autorun: canonical selector list
        //s.enable.autorun = this._normalizeAutorunSelector(report, s.enable.autorun);

        // confirm: canonical confirm shape
        //s.confirm = this._normalizeConfirm(report,s.confirm);

        // env: hash coercion
        if (!lib.hash.is(s.env) && !lib.utils.isEmpty(s.env)) {
            report.warn("W103_ENV_INVALID", "env", "env should be object(hash)");
        }
        s.env = lib.hash.to(s.env);
    }
    
    /**
     * Normalize a confirm descriptor into canonical form.
     *
     * Internal:
     * - Confirms are treated as a *policy hint*, not a strict validation target.
     * - Most inputs originate from inline attributes and are therefore strings.
     * - Coercion is preferred over rejection; invalid values degrade safely.
     *
     * Normalization rules:
     * - `null`, `undefined`, empty values → `{ mode: 'none' }`
     * - Boolean intent (including string intent):
     *     - yes  → `{ mode: 'default' }`
     *     - no   → `{ mode: 'none' }`
     * - Non-empty string → `{ mode: 'text', message: <string> }`
     * - Hash/object → merged with default confirm shape
     *
     * Diagnostics:
     * - Unsupported types are coerced to `{ mode: 'none' }`
     *   and recorded as a warning.
     *
     * Invariants after normalization:
     * - Always returns an object
     * - Returned object always has a `mode` field
     * - `message` is present only for text/advanced modes
     *
     * @param {Report} report
     *     Compilation report used to record warnings.
     *
     * @param {*} val
     *     Raw confirm value supplied by the user.
     *
     * @param {string} [code="W301_CONFIRM_INVALID"]
     *     Warning code used when the value is invalid.
     *
     * @param {string} [path="confirm"]
     *     Schema path associated with the confirm value.
     *
     * @returns {Object}
     *     Canonical confirm descriptor.
     *
     * @private
     */
    _normalizeConfirm(report, val, code = "W301_CONFIRM_INVALID", path = "confirm") {
        const lib = this.lib;

        // null, undefined, empty, or whitespace-only strings → no confirm
        if (lib.utils.isEmpty(val) || (lib.str.is(val) && !val.trim()))
            return { mode: 'none' };

        // boolean intent (strings included)
        if (lib.bool.no(val))  return { mode: 'none' };
        if (lib.bool.yes(val)) return { mode: 'default' };

        // non-empty string → literal confirm message (unadulterated)
        if (lib.str.is(val)) {
            return { mode: "text", message: val };
        }

        // advanced / future form
        if (lib.hash.is(val))
            return lib.hash.merge({ mode: 'none', message: 'default message' }, val);

        report.warn(code, path, "confirm should be boolean|string|object(hash)");
        return { mode: 'none' };
    }

    /**
     * Normalize an autorun selector into canonical list form.
     *
     * Internal:
     * - Autorun selectors control which pipelines/stacks are triggered automatically.
     * - Inputs commonly originate from inline attributes and are therefore strings.
     * - Coercion is preferred over rejection; invalid values degrade safely.
     *
     * Normalization rules:
     * - Explicit "no" intent, `null`, empty, or whitespace-only strings → `[]` (no autorun)
     * - Explicit "yes" intent or `undefined` → `["__DEFAULT__"]`
     * - String or array → split (if string), trim, and filter into a token list
     * - Empty token list → `[]`
     *
     * Diagnostics:
     * - Unsupported types are coerced to default autorun behavior
     *   and recorded as a warning.
     *
     * Invariants after normalization:
     * - Always returns an array
     * - Returned array contains only non-empty strings
     *
     * @param {Report} report
     *     Compilation report used to record warnings.
     *
     * @param {*} v
     *     Raw autorun selector value supplied by the user.
     *
     * @param {string} [path="enable.autorun"]
     *     Schema path associated with the autorun selector.
     *
     * @returns {Array<string>}
     *     Canonical autorun selector list.
     *
     * @private
     */
    _normalizeAutorunSelector(report, v, path = "autorun") {
        const lib = this.lib;

        // none
        if (lib.bool.no(v) || v === null || (lib.str.is(v) && !v.trim()))
            return [];

        // default set
        if (lib.bool.yes(v) || v === undefined)
            return ["__DEFAULT__"];

        // string|array -> list
        if (lib.utils.baseType(v, "string array")) {
            v = lib.array.to(v, { split: /\s+/, trim: true });
            v = v.filter(Boolean);
            if (v.length) return v;

            // empty result counts as none
            return [];
        }

        // invalid type -> warn + default
        report.warn("W201_AUTORUN_INVALID", path, "autorun should be boolean|string|array");
        return ["__DEFAULT__"];
    }

    /**
     * Normalize a block family (single + plural + shape) into an effective bucket.
     *
     * Purpose:
     * - Provide a single, reusable normalization procedure for all “bucket blocks”:
     *   requests, intervals, pipelines (and future block families).
     * - Resolve three layers into a canonical effective map:
     *   1) engine default shape (`default_shape`)
     *   2) consumer overlay shape (`user_shape`)
     *   3) per-entry user values (`single` and `plural` entries)
     *
     * Inputs:
     * - `s[single]`:
     *     Optional “lazy button” entry used to create `effective.default` only.
     *     If present and coercible, produces:
     *       effective.default = merge(blockShape, one, MERGE_OPTS_V1)
     *
     * - `s[plural]`:
     *     Optional hash of named entries.
     *     Each coercible entry produces:
     *       effective[name] = merge(blockShape, item, MERGE_OPTS_V1)
     *
     * - `default_shape`:
     *     Engine baseline contract for items in this block family.
     *     Must be a hash.
     *
     * - `user_shape`:
     *     Either:
     *       - a hash (used directly), OR
     *       - a string key to look up on `s` (e.g. "request_shape")
     *     If present, blockShape becomes:
     *       blockShape = merge(default_shape, user_shape, MERGE_OPTS_V1)
     *
     * - `hotkey`:
     *     Optional `lib.hash.to(x, hotkey)` hotkey for coercing scalar values
     *     into hashes (e.g. request url shorthand via hotkey "url").
     *
     * - `handler`:
     *     Optional item normalizer applied after merge.
     *     Resolved via `lib.func.get(handler, { root: this })` and called as:
     *       handler(mergedItem, ctx) -> normalizedItem
     *
     * Output:
     * - Writes `s[outKey]` as the canonical effective bucket map.
     *   Example keys:
     *     `_effectiveRequests`, `_effectiveIntervals`, `_effectivePipelines`
     *
     * Merge semantics:
     * - Uses `lib.hash.merge(left, right, CONSTANTS.MERGE_OPTS_V1)`.
     * - Merge is non-destructive (deep copies inputs).
     * - MERGE_OPTS_V1 overrides array behavior to replace (not concat).
     *
     * Context (`ctx`) passed to handlers:
     * - A stable context object is created for each item with:
     *     - `ctx.name`   : "default" or the named entry key
     *     - `ctx.kind`   : "default" | "named"
     *     - `ctx.key`    : `single` for default entries, `plural` for named entries
     *     - `ctx.single` / `ctx.plural` / `ctx.hotkey` / `ctx.outKey`
     *     - `ctx.report` : Report instance for warnings
     *
     * Notes:
     * - This function is intentionally coercive; it is not a strict validator.
     * - Empty hashes are allowed as valid items.
     * - Empty-ish strings (common from data-*) are treated as absent.
     * - Policy decisions about inheritance (e.g. whether named entries inherit the
     *   single/default entry) are made by the caller via shapes, not by this function.
     *
     * Side effects:
     * - Mutates `s` by writing `s[outKey]`.
     *
     * @param {Report} report
     *     Compilation report used to record warnings (threaded into ctx).
     *
     * @param {Object} s
     *     Internal normalization workspace object (mutated in place).
     *
     * @param {Object} spec
     *     Block normalization specification.
     *
     * @param {string} spec.single
     *     Name of the “lazy button” single entry key on `s` (e.g. "request").
     *
     * @param {string} spec.plural
     *     Name of the named-entry map key on `s` (e.g. "requests").
     *
     * @param {Object} spec.default_shape
     *     Engine default item shape for this block family.
     *
     * @param {Object|string} [spec.user_shape]
     *     User overlay shape, or a string key on `s` pointing to it.
     *
     * @param {string|null} [spec.hotkey]
     *     Optional hotkey for `lib.hash.to` coercion of scalar entries.
     *
     * @param {Function|string|null} [spec.handler]
     *     Optional item normalizer function (or method name on this instance).
     *
     * @param {string} spec.outKey
     *     Target key on `s` where the effective bucket will be stored.
     *
     * @returns {void}
     *
     * @private
     */
    /**
     * Maintenance Notes / Invariants
     * ------------------------------
     * This function implements a generic, coercive normalization pattern used by
     * multiple block families (requests, intervals, pipelines).
     *
     * Design intent:
     * - This is NOT a validator. It normalizes shape and structure only.
     * - Coercion is preferred over rejection; invalid or empty-ish inputs are
     *   silently dropped unless a handler emits warnings.
     *
     * Key invariants (do not change lightly):
     * - `default_shape` is always the base layer for all effective items.
     * - `user_shape` may be:
     *     - a hash (used directly), or
     *     - a string key referencing a hash on the schema object.
     * - Empty hashes `{}` are valid and meaningful override values.
     *   Do NOT treat them as “trash” or auto-remove them.
     * - Empty-ish scalars (undefined, null, "", false) are treated as absent.
     *
     * Merge behavior:
     * - Uses `lib.hash.merge(left, right, CONSTANTS.MERGE_OPTS_V1)`.
     * - Merge is non-destructive (deep-copies inputs).
     * - Array semantics are overridden to REPLACE (not concat/push).
     *
     * Handler contract:
     * - If provided, `handler` is resolved via `lib.func.get`.
     * - Handler is invoked AFTER merge and may further normalize the item.
     * - Handler receives a stable `ctx` object including `report` for diagnostics.
     *
     * Warning / diagnostics policy:
     * - This function itself does not emit warnings.
     * - All diagnostics must be emitted by handlers or downstream normalizers.
     *
     * IMPORTANT:
     * - Block-specific policies (e.g. inheritance rules, validation requirements)
     *   belong in the block’s item normalizer or constants, NOT here.
     */

    

    _normalizeBlock(report, s, { single, plural, default_shape, user_shape, hotkey, handler, outKey }) {
        const lib = this.lib;

	const userShapeRef = lib.hash.is(user_shape)?user_shape : lib.hash.get(s,user_shape);
        const blockShape = lib.hash.is(userShapeRef)
              ? lib.hash.merge(default_shape, userShapeRef, CONSTANTS.MERGE_OPTS_V1)
              : default_shape;

	handler = lib.func.get(handler, {root:this});
        // single: lazy-button default only
        const one = lib.utils.baseType(s[single], hotkey ? "string object" : "object") && !lib.utils.isEmpty(s[single])
              ? lib.hash.to(s[single], hotkey)
              : null;

        const names = lib.hash.keys(s[plural]);

	const makeCtx = ({ name, kind, key }) => ({
	    name,
	    kind,
	    key,
	    single,
	    plural,
	    hotkey,
	    outKey,
	    report
	});
	
        const effective = {};

        // effective.default = shape + single
        if (lib.hash.is(one)) {
	    const ctx = makeCtx( { name: "default", kind: "default", key: single } );

            let v = lib.hash.merge(blockShape, one, CONSTANTS.MERGE_OPTS_V1);
            if (handler) v = handler.call(this, v, ctx);
            effective.default = v;
        }

        // effective[name] = shape + plural[name]
        for (let i = 0; i < names.length; i++) {
            const name = names[i];
            const raw = s[plural][name];

            const item = lib.utils.baseType(raw, hotkey ? "string object" : "object") && !lib.utils.isEmpty(raw)
                  ? lib.hash.to(raw, hotkey)
                  : null;

            if (!lib.hash.is(item)) continue;

	    const ctx = makeCtx( { name, kind: "named",key: plural } );
            let v = lib.hash.merge(blockShape, item, CONSTANTS.MERGE_OPTS_V1);
            if (handler) v = handler.call(this, v, ctx);
            effective[name] = v;
        }

        s[outKey] = effective;
    }


    /**
     * Normalize a single interval definition.
     *
     * Internal:
     * - Intervals describe scheduled or repeating execution behavior.
     * - This phase performs structural normalization and intent coercion only.
     * - Scheduling semantics (timers, overlap behavior, lifecycle) are handled
     *   later by the scheduler/runtime.
     *
     * Responsibilities:
     * - Coerce the interval definition into hash form.
     * - Apply defaults and normalize boolean intent fields.
     * - Normalize autorun selectors using canonical rules.
     * - Clamp error-handling policy to a supported range.
     *
     * Normalization rules:
     * - Input is coerced via `lib.hash.to(interval)`.
     * - `enabled` defaults to true unless explicit "no" intent.
     * - `autorun` is normalized via `_normalizeAutorunSelector`.
     * - `onError` is lowercased and clamped to
     *   `CONSTANTS.INTERVAL.RANGE_ERROR`, defaulting to
     *   `CONSTANTS.INTERVAL.RANGE_DEFAULT`.
     * - `allowOverlap` is true only on explicit "yes" intent.
     *
     * Diagnostics:
     * - Invalid autorun values are recorded as warnings via Report.
     * - Invalid `onError` values degrade silently to defaults.
     *
     * Invariants after normalization:
     * - Returned value is always a hash.
     * - `enabled` and `allowOverlap` are booleans.
     * - `autorun` is always an array.
     * - `onError` is a valid, lowercased policy string.
     *
     * @param {Object} interval
     *     Raw interval definition.
     *
     * @param {Object} ctx
     *     Normalization context supplied by `_normalizeBlock`.
     *     Includes:
     *     - `ctx.report` : Report instance
     *     - `ctx.name`   : interval name
     *     - `ctx.key`    : schema key path (e.g. "intervals")
     *
     * @returns {Object}
     *     Normalized interval definition.
     *
     * @private
     */
    _normalizeIntervalItem(interval,ctx) {
        const lib = this.lib;

        interval = lib.hash.to(interval);

	//default to true, but ignore legacy.
        interval.enabled = !lib.bool.no(interval.enabled);

	interval.autorun = this._normalizeAutorunSelector( ctx.report, interval.autorun, `${ctx.key}.${ctx.name}.autorun`);
	/*
	interval.onError = lib.utils.clamp(
	    CONSTANTS.INTERVAL.RANGE_ERROR,
	    lib.str.to(interval.onError, true).trim().toLowerCase(),
	    CONSTANTS.INTERVAL.RANGE_DEFAULT
	).toLowerCase();
	*/
        interval.allowOverlap =lib.bool.yes(interval.allowOverlap) ;
	interval.repeat = lib.number.clamp ( lib.number.toInt(interval.repeat),0,null);
        return interval;
    }


    /**
     * Normalize a single request definition.
     *
     * Internal:
     * - Requests describe outbound I/O intent (HTTP or transport-like).
     * - This phase performs structural normalization and light coercion only.
     * - Transport semantics, body serialization, and execution behavior are
     *   handled later by the runtime/request layer.
     *
     * Responsibilities:
     * - Coerce the request into hash form using the configured hotkey.
     * - Normalize and clamp the HTTP method to an allowed set.
     * - Apply safe defaults for common request options.
     * - Coerce bag-style fields (`headers`, `flags`) into hashes.
     *
     * Normalization rules:
     * - Input is coerced via `lib.hash.to(req, ctx.hotkey)`.
     * - `method` is uppercased and clamped to `CONSTANTS.REQUEST.METHODS`;
     *   invalid values fall back to `METHOD_DEFAULT`.
     * - `credentials` defaults to false unless explicit "yes" intent.
     * - `timeoutMs` is coerced to a number (or defaulted).
     * - `headers` and `flags` are always hashes.
     *
     * Diagnostics:
     * - No hard validation is performed here.
     * - Invalid values degrade to safe defaults without warnings
     *   (method clamping is intentional and silent).
     *
     * Invariants after normalization:
     * - Returned value is always a hash.
     * - `method` is always an upper-case string.
     * - `credentials` is boolean.
     * - `headers` and `flags` are hashes.
     *
     * @param {Object} req
     *     Raw request definition.
     *
     * @param {Object} ctx
     *     Normalization context supplied by `_normalizeBlock`.
     *     Includes:
     *     - `ctx.hotkey` : key used to coerce scalar request definitions
     *     - `ctx.name`   : request name
     *     - `ctx.key`    : schema key path (e.g. "requests")
     *
     * @returns {Object}
     *     Normalized request definition.
     *
     * @private
     */
    _normalizeRequestItem(req,ctx) {
        const lib = this.lib;

        req = lib.hash.to(req, ctx.hotkey);

	// normalize + clamp HTTP method
	req.method = lib.utils.clamp(
	    CONSTANTS.REQUEST.METHODS,
	    lib.str.to(req.method, true).trim().toUpperCase(),
	    CONSTANTS.REQUEST.METHOD_DEFAULT
	).toUpperCase();

        // encoding/transport are free-form for now (future transports)
        // credentials: default false unless yes-intent
        req.credentials = lib.bool.yes(req.credentials);

        // timeoutMs: keep numeric if provided, else undefined
        req.timeoutMs = lib.utils.toNumber(req.timeoutMs,CONSTANTS.REQUEST.TIMEOUT_DEFAULT);

        // headers/flags/env-ish bags: coerce to hash
        req.headers = lib.hash.to(req.headers);
        req.flags = lib.hash.to(req.flags);

        return req;
    }


    /**
     * Normalize a single pipeline definition.
     *
     * Internal:
     * - Pipelines represent ordered execution chains.
     * - This phase performs only *structural normalization*, not semantic validation.
     * - Detailed parsing and execution semantics are handled in later phases.
     *
     * Responsibilities:
     * - Normalize pipeline-level `confirm` using canonical confirm rules.
     * - Ensure presence of `run` and `onError` keys.
     * - Leave operation contents untouched for phase2 parsing.
     *
     * Normalization rules:
     * - `confirm` is coerced into canonical confirm shape.
     * - Missing `run` → empty array.
     * - Missing `onError` → empty array.
     *
     * Diagnostics:
     * - Invalid `confirm` values are recorded as warnings via Report.
     *
     * Invariants after normalization:
     * - Returned object is always a hash.
     * - `run` and `onError` keys always exist.
     * - No validation or mutation of individual operations occurs here.
     *
     * @param {Object} p
     *     Raw pipeline definition.
     *
     * @param {Object} ctx
     *     Normalization context supplied by `_normalizeBlock`.
     *     Includes:
     *     - `ctx.report` : Report instance
     *     - `ctx.name`   : pipeline name
     *     - `ctx.key`    : schema key path (e.g. "pipelines")
     *
     * @returns {Object}
     *     Normalized pipeline definition.
     *
     * @private
     */
    _normalizePipelineItem(p, ctx) {
        const lib = this.lib;

        p = lib.hash.to(p);
	//console.log(lib.utils.deepCopy(p) );
        // confirm canonical (pipeline-level)
	/*
	  //confirms are currently relegated to pipeline  builtins
        p.confirm = this._normalizeConfirm(
            ctx.report,
            p.confirm,
            "W302_PIPELINE_CONFIRM_INVALID",
            `${ctx.key}.${ctx.name}.confirm`
        );
	*/
        // run/onError: leave as-is for phase2 parsing, but ensure keys exist
	//p.run = lib.array.to(p.run, CONSTANTS.ARR_TO_OPTS);
	//console.log(p.run);
	//p.onError = lib.array.to(p.onError, CONSTANTS.ARR_TO_OPTS);
	//console.log(lib.utils.deepCopy(p));
        if (!('run' in p)) p.run = [];
        if (!('error' in p)) p.error = [];
	if (!lib.bool.ish(p.enabled)  && !lib.utils.isEmpty(p.enabled)) {
            ctx.report.warn("W102_ENABLE_INVALID", "enabled", `enabled should be boolish or undefined for ${ctx.name} (default true)`);
        }
        p.enabled = lib.bool.no(p.enabled) ? false:true;
	/*
	if (!lib.bool.ish(p.confirm)  && !lib.utils.isEmpty(p.confirm)) {
            ctx.report.warn("W302_ENABLE_INVALID", "confirm", `confirm should be boolish or undefined for ${ctx.name} (default false)`);
        }
	p.confirm = lib.bool.yes(p.confirm) ;
	*/
        return p;
    }


    _normalizeEventItem(ev, ctx) {
	const lib = this.lib;

	ev = lib.hash.to(ev);

	// default to enabled=true unless explicit "no"
	ev.enabled = !lib.bool.no(ev.enabled);

	// event type: required-ish, canonical lower-case string
	ev.event = lib.str.to(ev.event, true).trim().toLowerCase();

	// pipeline: required-ish
	ev.pipeline = lib.str.to(ev.pipeline, true).trim();

	// selector: keep as string; empty -> default (runtime can treat as self)
	// For now we keep this very light, because selector semantics are runtime-defined.
	ev.selector = lib.str.to(ev.selector, true).trim();
	if (!ev.selector) ev.selector = "__SELF__"; // sentinel; NOT CSS (AT runtime interprets)

	// options: addEventListener-ish bag
	ev.options = lib.hash.to(ev.options);
	ev.options.capture = lib.bool.yes(ev.options.capture);
	ev.options.passive = lib.bool.yes(ev.options.passive);
	ev.options.once    = lib.bool.yes(ev.options.once);

	return ev;
    }
    
    // ---------- phase 2: validate ----------
    // unimplimented at this time. may not be necessary.
}


/**
 * @typedef {Object} CompileResult
 * @property {Object} report
 *     Exported compilation report.
 *     Shape: `{ ok:boolean, errors:Array, warnings:Array }`
 *
 * @property {Object} schema
 *     Normalized, groomed runtime schema.
 *     Safe for consumers to read, store, and pass to runtime systems.
 */


/**
 * @typedef {Object} BlockNormalizerSpec
 *
 * Specification object passed to `_normalizeBlock`.
 *
 * @property {string} single
 *     Key on the schema object representing the “lazy button” single entry
 *     (e.g. `"request"`, `"interval"`, `"pipeline"`).
 *
 * @property {string} plural
 *     Key on the schema object representing the named-entry map
 *     (e.g. `"requests"`, `"intervals"`, `"pipelines"`).
 *
 * @property {Object} default_shape
 *     Engine baseline shape for items in this block family.
 *
 * @property {Object|string} [user_shape]
 *     Optional user-provided shape overlay.
 *     Either:
 *       - a hash, or
 *       - a string key referencing a hash on the schema object.
 *
 * @property {string|null} [hotkey]
 *     Optional hotkey used by `lib.hash.to(value, hotkey)` to coerce
 *     scalar entries into hashes.
 *
 * @property {Function|string|null} [handler]
 *     Optional item normalizer applied after merge.
 *     May be a function reference or the name of a method on `Master`.
 *
 * @property {string} outKey
 *     Target key on the schema object where the effective bucket
 *     will be written (e.g. `"_effectiveRequests"`).
 */


/**
 * @typedef {Object} BlockItemContext
 *
 * Context object passed to block item normalizers.
 *
 * @property {string} name
 *     Item name.
 *     `"default"` for single-entry items, or the key name for named entries.
 *
 * @property {"default"|"named"} kind
 *     Indicates whether the item originated from the single or plural source.
 *
 * @property {string} key
 *     Schema key associated with this item (`single` or `plural`).
 *
 * @property {string} single
 *     Name of the single-entry key for this block family.
 *
 * @property {string} plural
 *     Name of the plural-entry key for this block family.
 *
 * @property {string|null} hotkey
 *     Hotkey used for scalar coercion, if any.
 *
 * @property {string} outKey
 *     Name of the effective bucket key being produced.
 *
 * @property {Report} report
 *     Compilation report instance used for warnings and diagnostics.
 */
