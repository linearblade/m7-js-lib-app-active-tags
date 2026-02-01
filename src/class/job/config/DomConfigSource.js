/**
 * DomConfigSource
 * ---------------
 * Boundary adapter that extracts ActiveTags job inputs from a DOM element.
 *
 * Purpose:
 * - Read DOM attributes and data-* fields relevant to ActiveTags.
 * - Resolve configuration bindings (e.g. data-config-at / config targets) into a
 *   normalized config object suitable for schema compilation.
 * - Return a single, structured snapshot of "what the DOM says" without mutating
 *   Job or Scheduler state.
 *
 * Design posture:
 * - This is a *source* (reader + resolver), not a validator and not a runtime.
 * - Coercion is preferred over rejection; invalid/unknown values degrade safely
 *   and may be reported through a caller-provided Report.
 * - Heavy semantics (pipeline parsing, request execution, scheduling) are out of scope.
 *
 * Typical usage:
 * - Job.configure() (or ActiveTags.register()) calls:
 *     const src = new DomConfigSource({ lib, env, expr });
 *     const snap = src.read(e, { report, hot: { // optional overrides  } });
 *     // then: merge snap.config + snap.dataset + other overlays -> Master.compile(...)
 *
 * Output snapshot (high level):
 * - `snapshot` is JSON-safe and stable. It may include:
 *     - element metadata (tagName/id/name)
 *     - attrs snapshot (action/method/enctype/etc.)
 *     - dataset raw + inflated (data-* → ds)
 *     - config binding reference(s) (normalized "config-at")
 *     - resolved config object (merged/selected config entry)
 *
 * Notes:
 * - This class intentionally does not own merge policy beyond config binding
 *   resolution. Job/Master decide final precedence layering.
 * - This class should remain small and predictable; if it grows, extract
 *   sub-services (DatasetSource, AttrSource, ConfigResolver) behind it.
 */
import Report from './Report.js';
// leave all constants presently as local, have to decide where to organize them later. (there are 2 constants files at moment.
import { ARR_TO_OPTS, DOM_ATTRS_RUNTIME_INPUTS, DOM_CONFIG_AT, MERGE_OPTS_V1 } from '../../../constants.js';

export default class DomConfigSource {
    /**
     * @param {Object} args
     * @param {Object} args.lib
     *     Required m7 lib instance.
     * @param {Object} [args.env]
     *     Optional runtime environment/context (document hooks, feature flags).
     * @param {Object} [args.expr]
     *     Optional expression/target resolver used to resolve config-at targets.
     *     (Injected to avoid circular dependencies with Job/ActiveTags.)
     */
    constructor({ lib, env = {}, expr = null,strict = false } = {}) {
        if (!lib) throw new Error("DomConfigSource: missing lib");
	if (!expr) throw new Error("DomConfigSource: missing expr");
        this.lib = lib;
        this.env = env;
        this.expr = expr;
	this.strict = lib.utils.isEmpty(strict) ? false : strict;
    }
    static emptyReadShape(report){
	report = (report)?report.export() :  Report.emptyExportShape();
	return { report, dataSet:{}, attrs: {}, at : [], config: {}, output: {} };
    }
    read(source,{config_at = DOM_CONFIG_AT, defaultConfig = {}} = {}){
	const lib = this.lib;
	const report = new Report({lib});
	//will assume for now that report will set ok=false  if errors.
	if (!this._assertElement({report, source}) )
	    return this.constructor.emptyReadShape(report);
        const dataSet = this._readDataset({report, source});
        const attrs   = this._readAttrs({report,source});
	const at      = this._getConfigAt({report, ds:dataSet, list:config_at});
	const config  = this._resolveConfig({report, list:at,source});
	// attrs are runtime inputs, not config; intentionally not merged
	const output  = lib.hash.mergeMany([defaultConfig, config, dataSet],MERGE_OPTS_V1);
	return { report: report.export(), dataSet, attrs, at, config, output };
    }


    /**
     * Read and normalize `data-*` attributes from a DOM element.
     *
     * Semantics:
     * - Extracts all `data-*` attributes into a plain hash.
     * - Removes the `data-` prefix (per lib.dom.filterAttributes behavior).
     * - Inflates dashed keys into nested objects (delim: "-").
     *
     * @param {Object} [args]
     * @param {Object} [args.report]
     *     Optional report sink (currently unused here; reserved for future warnings).
     * @param {Element} args.source
     *     DOM element to read from.
     *
     * @returns {Object}
     *     Inflated dataset hash (plain object).
     */
    _readDataset({ report, source } = {}) {
	const lib = this.lib;

	const rawData = lib.dom.filterAttributes(source, /^data-/, 1) || {};
	return lib.hash.to(lib.hash.inflate(rawData, { delim: "-" }));
    }
    
    /**
     * Capture raw element attributes/properties used as runtime inputs.
     *
     * Notes:
     * - These are NOT treated as config.
     * - They are lightweight snapshots and may be re-read at runtime.
     *
     * @param {Object} args
     * @param {Object} [args.report]
     * @param {Element} args.source
     * @param {string|Array} [args.list]
     * @returns {Object}
     */
    _readAttrs({ report, source, list = DOM_ATTRS_RUNTIME_INPUTS } = {}) {
	const lib = this.lib;

	list = lib.array.to(list, ARR_TO_OPTS);

	const out = {};
	for (const item of list) {
            out[item] = lib.dom.get(source, item);
	}

	return out;
    }
    
    /**
     * Extract one or more ActiveTag / config references from a dataset object.
     *
     * Purpose:
     * - Collect ALL config reference hits from a dataset (`ds`) using one or more
     *   lookup keys (`list`).
     * - Normalize the result into a flat, ordered array of reference strings.
     * - Designed to support composable configuration sources (multiple attrs,
     *   multiple refs per attr).
     *
     * Behavior:
     * - Always returns an Array.
     * - Order is preserved:
     *     - `list` order determines lookup precedence.
     *     - Within each dataset entry, split order is preserved.
     * - Empty / missing / non-string values are ignored silently.
     *
     * Accepted inputs:
     * - ds:
     *     Any value. Coerced via `lib.hash.to(ds)`.
     *     Typically a DOM `dataset` object or equivalent hash.
     *
     * - list:
     *     String | Array | falsy.
     *     Coerced via `lib.array.to(list, ARR_TO_OPTS)`.
     *     Each entry represents a lookup key into `ds`.
     *
     * Lookup semantics:
     * - For each `loc` in `list`:
     *     - Read `ds[loc]`
     *     - Coerce to string, trim
     *     - Split into zero or more refs via `lib.array.to(value, ARR_TO_OPTS)`
     *     - Append all refs to the result array
     *
     * Examples:
     * - ds = { config: "jobA jobB", at: "jobC" }
     *   list = ["config", "at"]
     *   → ["jobA", "jobB", "jobC"]
     *
     * - ds = { config: "" }
     *   list = "config"
     *   → []
     *
     * Notes:
     * - This function intentionally returns ALL matches.
     *   First-hit or priority-based behavior should be handled by callers.
     * - No validation is performed on reference values.
     *   Resolution and validation occur at later stages.
     *
     * @param {Object} [args]
     * @param {*} [args.ds]
     *     Dataset / attribute hash to read from (e.g. element.dataset).
     * @param {*} [args.list]
     *     One or more dataset keys to inspect for config references.
     *
     * @returns {Array<string>}
     *     Flat array of extracted config reference strings.
     */
    _getConfigAt({ ds, list } = {}) {
	const lib = this.lib;
	ds = lib.hash.to(ds);

	let at = [];
	list = lib.array.to(list, ARR_TO_OPTS);

	for (const loc of list) {
            const s = lib.str.to(lib.hash.get(ds, loc, ''), true).trim();
            if (!s) continue;

            const items = lib.array.to(s, ARR_TO_OPTS);
            if (items.length) at.push(...items);
	}

	return at;
    }
    /**
     * Resolve a config reference list into a single merged config snapshot.
     *
     * Policy:
     * - No list / empty list → {}.
     * - Each ref is resolved via `_resolveConfigTarget({ ref, source })`.
     * - If a ref fails to resolve to a hash:
     *     - record an error to `report`
     *     - throw only if `this.strict` is enabled (via `_error(report, ...)`)
     *     - otherwise skip that ref and continue
     * - Multiple refs are merged in order (left-to-right); later refs override earlier.
     *
     * @param {Object} [args]
     * @param {Object} [args.report]
     *     Report sink for diagnostics.
     * @param {*} [args.list]
     *     List (or list-like) of config reference strings.
     * @param {Element} [args.source]
     *     DOM element used as the interpolation / resolution context.
     *
     * @returns {Object}
     *     Merged config hash snapshot.
     */
    _resolveConfig({ report, list, source } = {}) {
	const lib = this.lib;

	// 1) Nothing to resolve
	if (!lib.array.len(list)) return {};

	list = lib.array.to(list, ARR_TO_OPTS);

	let merged = {};

	for (let i = 0; i < list.length; i++) {
            const ref = lib.str.to(list[i], true).trim();
            if (!ref) continue;

            const conf = this._resolveConfigTarget({ report, ref, source });

            if (!lib.hash.is(conf)) {
		this._error(
                    report,
                    "configure",
                    "CONFIG_RESOLVE_FAILED",
                    `Config reference '${ref}' did not resolve to an object(hash)`,
                    { ref }
		);
		continue;
            }

            merged = lib.hash.merge(merged, conf, MERGE_OPTS_V1);
	}

	return merged;
    }
    /**
     * Resolve a single config reference into a config hash.
     *
     * v1.0 policy:
     * - No eval / no executable expressions.
     * - DOM payloads must be JSON text (e.g. <script type="application/json">,
     *   <template>, or any element whose textContent contains JSON).
     *
     * Soft/strict behavior:
     * - On any failure:
     *     - record error via `_error(report, ...)`
     *     - return {} (so non-strict mode can continue safely)
     * - If `this.strict` is enabled, `_error` will throw and the return path is moot.
     *
     * @param {Object} args
     * @param {Object} args.report
     *     Report sink for diagnostics.
     * @param {string} args.ref
     *     Config reference string (may include interpolation tokens).
     * @param {Element} args.source
     *     DOM element used as the interpolation and target-resolution context.
     *     This is the `e` passed into expr (`{ e: source }`).
     *
     * @returns {Object}
     *     Resolved config hash (plain object), or {} on error (non-strict).
     */
    _resolveConfigTarget({ report, ref, source } = {}) {
	const lib = this.lib;

	ref = lib.str.to(ref, true).trim();
	if (!ref) {
            this._error(report, "configure", "CONFIG_REF_EMPTY", "Empty config reference");
            return {};
	}

	// Interpolate reference
	const scheme = this.expr.interpScheme({ e: source }, undefined);
	ref = lib.str.interp(ref, scheme);

	// Parse the target expression
	let info;
	try {
            info = this.expr.parseTarget({ e: source }, ref);
	} catch (err) {
            this._error(
		report,
		"configure",
		"CONFIG_PARSE_TARGET_FAILED",
		`Failed to parse config reference '${ref}'`,
		{ error: err, ref }
            );
            return {};
	}

	// Evaluate into a value
	let val = info;

	if (!(lib.utils.isScalar(info) || lib.dom.is(info))) {
            if (lib.hash.is(info) && info.src && info.prop) {
		val = lib.hash.get(info.src, info.prop);
            } else {
		val = info;
            }
	}

	// DOM source => parse JSON from text
	if (lib.dom.is(val)) {
            const text =
		  lib.str.to(val.text, true) ||
		  lib.str.to(val.textContent, true) ||
		  lib.str.to(val.innerText, true) ||
		  "";

            if (!text.trim()) {
		this._error(
                    report,
                    "configure",
                    "CONFIG_DOM_EMPTY",
                    `Config DOM source for '${ref}' had no text`,
                    { ref }
		);
		return {};
            }

            try {
		val = JSON.parse(text);
            } catch (err) {
		this._error(
                    report,
                    "configure",
                    "CONFIG_JSON_PARSE_FAILED",
                    `Invalid JSON in config payload for '${ref}'`,
                    { error: err, ref }
		);
		return {};
            }
	}

	// Must resolve to an object/hash
	if (!lib.hash.is(val)) {
            this._error(
		report,
		"configure",
		"CONFIG_NOT_OBJECT",
		`Config reference '${ref}' did not resolve to an object(hash)`,
		{ ref }
            );
            return {};
	}

	return val;
    }

    /**
     * Create a structured Error with standard metadata.
     *
     * Notes:
     * - Does not throw; caller decides throw policy.
     * - Keeps DomConfigSource stateless (no job pointer).
     *
     * @param {string} stage
     * @param {string} code
     * @param {string} message
     * @param {Object} [meta]
     * @returns {Error}
     */
    _makeError(stage, code, message, meta = {}) {
	const err = new Error(message);
	err.stage = stage;
	err.code = code;
	err.meta = meta;
	return err;
    }
    /**
     * Record an error in the report, and optionally throw (strict mode).
     *
     * Contract:
     * - Always records the error into `report` when available.
     * - Throws only when `this.strict` is truthy.
     *
     * @param {Object} report
     *     Report instance (may be null/undefined).
     *
     * @param {string} stage
     *     Logical stage name (e.g. "read", "configure", "resolve").
     *
     * @param {string} code
     *     Stable error code (e.g. "CONFIG_RESOLVE_FAILED").
     *
     * @param {string} message
     *     Human-readable message.
     *
     * @param {Object} [meta]
     *     Optional metadata for debugging.
     *
     * @returns {Error}
     *     The constructed error object (thrown if strict).
     *
     * @throws {Error}
     *     Only when `this.strict` is enabled.
     */
    _error(report, stage, code, message, meta = {}) {
	const err = this._makeError(stage, code, message, meta);

	if (report && typeof report.error === "function") {
            // path is optional; if you don’t have it, pass stage or code as the locator
            report.error(code, stage, message, meta);
	}

	if (this.strict) throw err;
	return err;
    }    

    /**
     * Assert that `source` is a valid DOM element.
     *
     * Contract:
     * - Records an error if `source` is missing or not DOM-like.
     * - Throws only if `this.strict` is enabled.
     * - Callers should treat failure as fatal for this read.
     *
     * @param {Object} args
     * @param {Object} args.report
     *     Report instance used for diagnostics.
     * @param {*} args.source
     *     Candidate DOM element.
     *
     * @throws {Error}
     *     When `this.strict` is true.
     */
    _assertElement({ report, source }) {
	const lib = this.lib;

	if (!source) {
            this._error(
		report,
		"read",
		"NO_ELEMENT",
		"Missing DOM source element"
            );
            return false;
	}

	if (!lib.dom.is(source)) {
            this._error(
		report,
		"read",
		"NOT_DOM",
		"Source is not a DOM element"
            );
            return false;
	}

	return true;
    }
}
