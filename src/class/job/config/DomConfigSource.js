/**
 * DomConfigSource
 * ---------------
 *
 * Boundary adapter that extracts ActiveTags Job inputs from a DOM element.
 *
 * PURPOSE
 * -------
 * Reads DOM-provided configuration signals and produces a structured,
 * JSON-safe snapshot suitable for schema compilation.
 *
 * Responsibilities:
 *   - Capture selected element attributes.
 *   - Extract prefixed attributes (commonly data-*) into nested objects.
 *   - Resolve config bindings (e.g. data-config-at) into a concrete
 *     configuration object.
 *   - Merge DOM config with a provided defaultConfig overlay.
 *
 * This class does not validate schema correctness.
 * This class does not execute pipelines.
 * This class does not mutate Job or runtime state.
 *
 *
 * POSITION IN PIPELINE
 * --------------------
 * DomConfigSource is an input adapter used before Master.compile().
 *
 * Typical flow:
 *   1) Job.configure() calls:
 *        const src = new DomConfigSource({ lib, env, conf });
 *        const snap = await src.read(element, { defaultConfig });
 *   2) snap.output is passed into Master.compile().
 *
 *
 * READ CONTRACT
 * -------------
 * async read(source, { config_at, defaultConfig })
 *
 * - source
 *     DOM element to inspect.
 *
 * - config_at (optional)
 *     Attribute name used to locate configuration bindings.
 *     Defaults to conf.config.at.
 *
 * - defaultConfig (optional)
 *     Baseline configuration object layered beneath DOM-derived config.
 *
 * Returns:
 *   {
 *     report,     // exported Report shape
 *     dataSet,    // inflated prefixed attributes
 *     attrs,      // selected attribute snapshot
 *     at,         // normalized config binding reference(s)
 *     config,     // resolved config object (from DOM target)
 *     output      // merged { defaultConfig <- config <- dataSet }
 *   }
 *
 * The returned object is stable and JSON-safe.
 *
 *
 * CONFIG RESOLUTION
 * -----------------
 * Configuration bindings may resolve to:
 *   - Inline JSON payloads in DOM nodes
 *   - Script nodes (optionally gated eval)
 *   - Imported modules (optionally gated and allow-listed)
 *
 * All dynamic behavior is controlled by conf.config flags.
 * If disabled, resolution degrades safely and reports warnings.
 *
 *
 * SECURITY MODEL
 * --------------
 * - JSON parsing is the default resolution mechanism.
 * - Script evaluation is opt-in via conf.config.evalEnabled and
 *   restricted by allowed script types.
 * - Module imports are opt-in via conf.config.importEnabled and
 *   constrained by an allow-list path policy.
 * - Disallowed resource schemes are rejected.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * Must remain a pure input adapter.
 * Must not depend on Engine, Scheduler, or runtime execution state.
 * Must report issues via Report instead of throwing for user mistakes.
 *
 *
 * NON-RESPONSIBILITIES
 * --------------------
 * Does not compile pipelines.
 * Does not normalize schema blocks.
 * Does not perform final merge precedence beyond producing `output`.
 */

import Report from './Report.js';
// leave all constants presently as local, have to decide where to organize them later. (there are 2 constants files at moment.
import { ARR_TO_OPTS,  MERGE_OPTS_V1 } from '../../../constants.js';
const DEFAULT_EVAL_TYPE = "text/at-eval";
export default class DomConfigSource {
    /**
     * Create a new DomConfigSource instance.
     *
     * CONTRACT
     * --------
     * DomConfigSource requires an m7 lib instance, an ExpressionResolver,
     * and a configuration policy object. The instance is used to read DOM
     * attributes and resolve DOM-bound configuration targets into a
     * JSON-safe snapshot for schema compilation.
     *
     * This constructor performs dependency wiring and policy compilation only.
     * It does not read from the DOM.
     * It does not resolve config targets.
     * It does not mutate Job state.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     *
     * @param {Object} args.lib
     *   Required m7 lib instance.
     *
     * @param {Object} [args.env={}]
     *   Optional runtime environment context.
     *
     * @param {ExpressionResolver} args.expr
     *   Required expression and target resolver used to resolve config-at targets.
     *   This resolver is typically constructed by ActiveTags and injected here
     *   to avoid circular dependencies.
     *
     * @param {Object} args.conf
     *   Required configuration policy object controlling config resolution.
     *   Expected to include conf.config flags:
     *     evalEnabled, evalType
     *     importEnabled, importPath
     *
     * @param {boolean} [args.strict=false]
     *   Strict mode flag.
     *   When true, some invalid inputs may be treated as hard errors.
     *   When false, invalid inputs degrade safely and are reported via Report.
     *
     * @param {Job} [args.job]
     *   Optional Job reference used for diagnostics context only.
     *
     *
     * POLICY COMPILATION
     * ------------------
     * The constructor compiles resolution policy gates from conf.config:
     *   allowEvalConfig   enable or disable script evaluation
     *   allowEvalTypes    allowed script mime types for evaluation
     *   allowImportConfig enable or disable module import resolution
     *   allowImportPath   allow-list of permitted import path prefixes
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if lib is missing.
     * Throws if expr is missing.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate conf shape beyond required access.
     * Does not perform any DOM reads or config resolution.
     */
    constructor({ lib, env = {}, expr = null,strict = false,job,conf} = {}) {
        if (!lib) throw new Error("DomConfigSource: missing lib");
	if (!expr) throw new Error("DomConfigSource: missing expr");
        this.lib = lib;
	this.conf = conf;
        this.env = env;
        this.expr = expr;
	this.strict = lib.utils.isEmpty(strict) ? false : strict;
	this.job = job;

	this.allowEvalConfig = lib.bool.yes(conf.config.evalEnabled);
	this.allowEvalTypes  = lib.bool.no(conf.config.evalType) ? false : lib.array.to(conf.config.evalType);
	this.allowImportConfig = lib.bool.yes(conf.config.importEnabled) ;
	this.allowImportPath   = lib.array.to(conf.config.importPath);
    }

    /**
     * Produce an empty read() result shape.
     *
     * CONTRACT
     * --------
     * Returns a structurally valid snapshot object matching the shape
     * produced by read(), but containing no DOM-derived data.
     *
     * This helper ensures callers can rely on a consistent return contract
     * even when read() fails early or is short-circuited.
     *
     *
     * INPUT
     * -----
     * @param {Report} [report]
     *   Optional Report instance.
     *   If provided, its exported shape is included.
     *   If omitted, an empty Report export shape is used.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   {
     *     report,   // exported report shape
     *     dataSet,  // empty object
     *     attrs,    // empty object
     *     at,       // empty array of config bindings
     *     config,   // empty resolved config object
     *     output    // empty merged output object
     *   }
     *
     *
     * DESIGN CONSTRAINTS
     * ------------------
     * Must remain JSON-safe.
     * Must not perform DOM reads.
     * Must not mutate the provided Report instance.
     */
    static emptyReadShape(report){
	report = (report)?report.export() :  Report.emptyExportShape();
	return { report, dataSet:{}, attrs: {}, at : [], config: {}, output: {} };
    }

    /**
     * Read ActiveTags configuration inputs from a DOM element.
     *
     * CONTRACT
     * --------
     * read() extracts DOM-provided configuration signals and produces a
     * JSON-safe snapshot suitable for schema compilation.
     *
     * It captures:
     *   - prefixed attribute data (commonly data-*) inflated into nested objects
     *   - selected runtime attributes
     *   - config binding references (config-at)
     *   - resolved configuration object (from bound targets)
     *   - merged output object for schema compilation
     *
     * This method does not compile schema.
     * This method does not enqueue or execute pipelines.
     * This method does not mutate Job or runtime state.
     *
     *
     * INPUT
     * -----
     * @param {Element} source
     *   DOM element to inspect.
     *
     * @param {Object} [opts]
     *
     * @param {string|Array<string>} [opts.config_at=this.conf.config.at]
     *   Attribute name(s) used to locate configuration bindings.
     *   Values are read from the inflated dataset under these keys.
     *
     * @param {Object} [opts.defaultConfig={}]
     *   Baseline configuration layered beneath DOM-derived config.
     *   Used as the first merge layer for output.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Creates a new Report instance for diagnostics.
     * 2. Validates the source element.
     *    If invalid, returns emptyReadShape(report).
     * 3. Reads and inflates prefixed attributes into dataSet.
     * 4. Captures selected runtime attributes into attrs.
     * 5. Resolves config-at binding references into a normalized list (at).
     * 6. Resolves the bound configuration target(s) into a config object.
     * 7. Produces output by merging:
     *      defaultConfig <- config <- dataSet
     *    attrs are intentionally not merged into output.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Promise<Object>}
     *   A JSON-safe snapshot with the shape:
     *     {
     *       report,   // exported report shape
     *       dataSet,  // inflated prefixed attributes
     *       attrs,    // selected runtime attributes
     *       at,       // normalized config binding reference list
     *       config,   // resolved config object
     *       output    // merged { defaultConfig <- config <- dataSet }
     *     }
     *
     *
     * ERROR HANDLING
     * --------------
     * Diagnostics are recorded into Report.
     * User configuration errors should not throw and instead degrade safely.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate schema correctness.
     * Does not apply final precedence layering beyond output merge.
     * Does not execute any runtime behavior.
     */
    async read(source,{config_at = this.conf.config.at, defaultConfig = {}} = {}){
	const lib = this.lib;
	const report = new Report({lib});

	//will assume for now that report will set ok=false  if errors.
	if (!this._assertElement({report, source}) )
	    return this.constructor.emptyReadShape(report);
        const dataSet = this._readDataset({report, source});
        const attrs   = this._readAttrs({report,source});
	const at      = this._getConfigAt({report, ds:dataSet, list:config_at});
	const config  = await this._resolveConfig({report, list:at,source});
	// attrs are runtime inputs, not config; intentionally not merged
	const output  = lib.hash.mergeMany([defaultConfig, config, dataSet],MERGE_OPTS_V1);
	return { report: report.export(), dataSet, attrs, at, config, output };
    }


    /**
     * Read and inflate prefixed attributes from a DOM element.
     *
     * CONTRACT
     * --------
     * _readDataset() extracts attributes whose names begin with configured
     * prefix strings and produces a nested, JSON-safe object.
     *
     * This method reads DOM attributes, not element.dataset.
     * It is commonly used for data-* style inputs, but the prefixes are
     * fully configurable.
     *
     *
     * PREFIX SEMANTICS
     * ----------------
     * - Iterates over conf.config.attrPrefixes in declared order.
     * - For each prefix:
     *     Selects attributes whose names start with the prefix.
     *     Strips the prefix from the attribute key.
     *     Inflates dashed keys into nested objects using "-" as delimiter.
     * - Results are merged in prefix order.
     *   Later prefixes override earlier prefixes on conflict.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     * @param {Report} [args.report]
     *   Optional diagnostics sink.
     *   Currently reserved for future warnings and is not required.
     *
     * @param {Element} args.source
     *   DOM element to read attributes from.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   Nested object produced from prefixed attributes.
     *   Always returns a plain object.
     *
     *
     * SIDE EFFECTS
     * ------------
     * None.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not resolve config targets.
     * Does not validate schema correctness.
     * Does not interpret or coerce values beyond key normalization.
     */
    _readDataset({ report, source } = {}) {
	const lib = this.lib;

	const prefixes = lib.array.to(
            this.conf.config.attrPrefixes,
            ARR_TO_OPTS
	).filter(v => typeof v === "string");

	let out = {};

	for (let i = 0; i < prefixes.length; i++) {
            const prefix = prefixes[i];
            if (!prefix) continue;
            const re = new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
            const raw = lib.dom.filterAttributes(source, re, prefix.length) || {};

            const inflated = lib.hash.inflate(raw, { delim: "-" });
            const normalized = lib.hash.to(inflated);

            // merge in declared order (later prefixes override earlier ones)
            out = lib.hash.merge(out, normalized, MERGE_OPTS_V1);
	}

	return out;
    }
    
    
    /**
     * Capture selected element fields as runtime attributes.
     *
     * CONTRACT
     * --------
     * _readAttrs() captures a lightweight snapshot of selected fields from a
     * DOM element. These values are treated as runtime inputs and are not
     * merged into configuration output.
     *
     * Captured values may be re-read at runtime by other subsystems.
     * This method provides an initial snapshot for convenience and diagnostics.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     * @param {Report} [args.report]
     *   Optional diagnostics sink.
     *   Currently reserved for future warnings and is not required.
     *
     * @param {Element} args.source
     *   DOM element to read from.
     *
     * @param {string|Array<string>} [args.list=this.conf.config.capture_attrs]
     *   Field list describing which properties or attributes to capture.
     *   Each entry is passed to lib.dom.get(source, key).
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   Plain object mapping each requested key to its captured value.
     *
     *
     * SIDE EFFECTS
     * ------------
     * None.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not perform schema compilation.
     * Does not resolve config bindings.
     * Does not apply merge precedence.
     */
    _readAttrs({ report, source, list = this.conf.config.capture_attrs } = {}) {
	const lib = this.lib;

	list = lib.array.to(list, ARR_TO_OPTS);

	const out = {};
	for (const item of list) {
            out[item] = lib.dom.get(source, item);
	}

	return out;
    }
    
    /**
     * Extract configuration binding references from an inflated dataset object.
     *
     * CONTRACT
     * --------
     * _getConfigAt() reads one or more dataset keys and returns a flat list of
     * configuration reference strings.
     *
     * It always returns an array.
     * It does not resolve references.
     * It does not validate references.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     *
     * @param {*} [args.ds]
     *   Dataset-like object to read from.
     *   Coerced to an object via lib.hash.to().
     *
     * @param {*} [args.list]
     *   One or more dataset keys used to locate config references.
     *   Coerced to an array via lib.array.to(list, ARR_TO_OPTS).
     *
     *
     * BEHAVIOR
     * --------
     * - Iterates list in declared order.
     * - For each key:
     *     Reads ds[key]
     *     Coerces to string and trims
     *     Splits into tokens using lib.array.to(value, ARR_TO_OPTS)
     *     Appends all tokens to the result array
     *
     * Empty, missing, or non-string-coercible values are ignored.
     *
     * Ordering is preserved:
     *   list order determines lookup order
     *   split order is preserved within each value
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Array<string>}
     *   Flat array of extracted reference strings.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not apply priority or first-hit semantics.
     * Does not verify that extracted references exist.
     * Resolution occurs in _resolveConfig().
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
     * Resolve config references into a single merged configuration object.
     *
     * CONTRACT
     * --------
     * _resolveConfig() resolves a list of configuration reference strings into
     * concrete configuration objects and merges them into a single snapshot.
     *
     * Resolution is performed sequentially and is order-sensitive.
     * Later references override earlier references on merge conflicts.
     *
     * This method may perform asynchronous resolution (imports, async loaders).
     * It does not compile schema.
     * It does not mutate Job or runtime state.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     *
     * @param {Report} args.report
     *   Diagnostics sink used to record resolution failures.
     *
     * @param {*} [args.list]
     *   List of configuration reference strings.
     *   Coerced to an array via lib.array.to(list, ARR_TO_OPTS).
     *
     * @param {Element} [args.source]
     *   DOM element used as interpolation or resolution context.
     *   Passed through to target resolution routines.
     *
     *
     * RESOLUTION POLICY
     * -----------------
     * - If list is empty or falsy, returns an empty object.
     * - Each non-empty ref is resolved via _resolveConfigTarget({ report, ref, source }).
     * - If a ref resolves to a non-object value:
     *     A diagnostic error is recorded to report.
     *     In strict mode, _error() may throw.
     *     In non-strict mode, the ref is skipped and resolution continues.
     *
     *
     * MERGE POLICY
     * ------------
     * Resolved objects are merged left-to-right:
     *   merged = merge(merged, resolvedRef, MERGE_OPTS_V1)
     *
     * Later refs override earlier refs.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Promise<Object>}
     *   Merged configuration object.
     *   Returns {} when no references are provided or none resolve successfully.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate schema correctness.
     * Does not apply final precedence layering beyond ordered ref merge.
     * Does not interpret reference semantics beyond target resolution.
     */
    async _resolveConfig({ report, list, source } = {}) {
	const lib = this.lib;

	// 1) Nothing to resolve
	if (!lib.array.len(list)) return {};

	list = lib.array.to(list, ARR_TO_OPTS);

	let merged = {};

	for (let i = 0; i < list.length; i++) {
            const ref = lib.str.to(list[i], true).trim();
            if (!ref) continue;

            const conf = await this._resolveConfigTarget({ report, ref, source });
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
     * Resolve a single config reference into a configuration object.
     *
     * CONTRACT
     * --------
     * _resolveConfigTarget() resolves one config reference string into a plain
     * object suitable for merging into configuration.
     *
     * The reference may resolve to:
     *   - A plain object value
     *   - A DOM node containing an inline payload
     *   - A DOM node pointing to an external payload via data-src or src
     *   - An imported module reference (when enabled)
     *
     * If resolution fails, a diagnostic is recorded and {} is returned in
     * non-strict mode.
     * In strict mode, _error() may throw and the return path is not guaranteed.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     *
     * @param {Report} args.report
     *   Diagnostics sink for resolution failures.
     *
     * @param {string} args.ref
     *   Config reference string.
     *   May be a target expression or an import reference.
     *
     * @param {Element} args.source
     *   DOM element used as resolution context for expression evaluation and
     *   interpolation.
     *
     *
     * RESOLUTION FLOW
     * ---------------
     * 1. Normalize and validate ref.
     *    Empty refs produce an error and return {}.
     *
     * 2. Determine resolution strategy.
     *    - If the ref matches an import form, resolution is routed through
     *      _importConfig() subject to import policy.
     *    - Otherwise ref is evaluated through ExpressionResolver.
     *
     * 3. Reduce expression results.
     *    If the result is an { src, prop } pair, reads src[prop].
     *
     * 4. DOM payload handling.
     *    If the resolved value is a DOM element:
     *      - Prefer inline payload from textContent or innerText.
     *      - If inline payload is empty, optionally fetch external payload from
     *        data-src or src.
     *      - Parse the payload via _resolveDomConfigNode(), which applies the
     *        configured security policy (JSON, optional eval, etc).
     *
     * 5. Type enforcement.
     *    The final resolved value must be an object hash.
     *    Non-object values produce an error and return {}.
     *
     *
     * SECURITY AND POLICY
     * -------------------
     * - Import resolution is opt-in and constrained by allowImportConfig and
     *   allowImportPath policy.
     * - Script evaluation of DOM payloads is opt-in and constrained by
     *   allowEvalConfig and allowEvalTypes policy.
     * - Disallowed resource schemes and unsafe locations must be rejected by
     *   _maybeImport() and _resolveDomConfigNode().
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Promise<Object>}
     *   Resolved configuration object.
     *   Returns {} on failure in non-strict mode.
     *
     *
     * ERROR HANDLING
     * --------------
     * Records report errors for:
     *   - empty refs
     *   - import failures
     *   - expression evaluation failures
     *   - DOM payload empty or parse failures
     *   - resolved value not being an object
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not compile schema.
     * Does not merge multiple refs.
     * Does not execute runtime behavior.
     */
    async _resolveConfigTarget({ report, ref, source } = {}) {
	const lib = this.lib;

	ref = lib.str.to(ref, true).trim();
	if (!ref) {
            this._error(report, "configure", "CONFIG_REF_EMPTY", "Empty config reference");
            return {};
	}

	// Interpolate reference


	//console.log('ref' , ref);
	//const scheme = this.expr.interpScheme({ e: source }, undefined);
	//ref = lib.str.interp(ref, scheme);
	//console.log('after', ref);
	// Parse the target expression
	let info;
	//console.warn(ref);
	let imp = null;

	try {
	    imp = this._maybeImport(ref);

	    if (imp) {
		info = await this._importConfig(imp);
	    } else {
		info = this.expr.eval({ job: this.job }, ref);
	    }
	} catch (err) {
	    if (imp) {
		// import path failed
		this._error(
		    report,
		    "configure",
		    "CONFIG_IMPORT_FAILED",
		    `Failed to import config reference '${ref}'`,
		    { error: err, ref, imp }
		);
	    } else {
		// expression / local reference failed
		this._error(
		    report,
		    "configure",
		    "CONFIG_PARSE_TARGET_FAILED",
		    `Failed to parse config reference '${ref}'`,
		    { error: err, ref }
		);
	    }

	    return {};
	}
	//console.warn(info);
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

	    let text = "";

	    // Prefer inline JSON if present
	    const inline =
		  lib.str.to(val.textContent, true).trim() ||
		  lib.str.to(val.innerText, true).trim();
	    text = inline;
	    
	    // If inline is empty, try external source
	    if (lib.utils.isEmpty(inline)) {
		const src = val.getAttribute("data-src") || val.src;
		if (src) {
		    text = await fetch(src).then(r => r.text());
		}
	    } else {
		text = inline;
	    }
	    

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
		//$FIXUP
		val = this._resolveDomConfigNode(val, text, { source, ref });
		//console.warn(val);
		//val = JSON.parse(text);
            } catch (err) {
		const msg = (err && err.message) ? String(err.message) : "Config parse failed";

		this._error(
		    report,
		    "configure",
		    "CONFIG_PAYLOAD_PARSE_FAILED",
		    `Config payload failed for '${ref}': ${msg}`,
		    { error: err, ref, type: val?.type, tagName: val?.tagName }
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
     * Import a configuration module reference and return its exported value.
     *
     * CONTRACT
     * --------
     * _importConfig() resolves an import descriptor into a module export value.
     * Results are memoized so repeated imports of the same URL and export name
     * share a single in-flight Promise and cached resolution.
     *
     * Import base resolution is document-scoped.
     * Relative URLs are resolved against the owning document baseURI rather than
     * the current JavaScript module file location.
     *
     *
     * INPUT
     * -----
     * @param {Object} imp
     *   Import descriptor produced by _maybeImport().
     *   Expected fields:
     *     url        module URL (absolute or relative)
     *     exportName optional named export to read
     *
     *
     * BEHAVIOR
     * --------
     * 1. Initializes a per-instance import cache.
     * 2. Determines a document base URL using:
     *      this.importBaseUrl (if provided)
     *      job element ownerDocument.baseURI
     *      global document.baseURI (if available)
     * 3. Resolves imp.url against the document base when possible.
     * 4. Builds a stable cache key using resolvedUrl and exportName.
     * 5. If cached, returns the cached Promise.
     * 6. Otherwise performs a dynamic import of the resolved URL and returns:
     *      mod[exportName] when exportName is provided
     *      otherwise mod.default if present, else the module namespace object
     * 7. Stores the Promise in the cache and returns it.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Promise<*>}
     *   Promise resolving to the imported export value.
     *
     *
     * SECURITY AND POLICY
     * -------------------
     * This method assumes import eligibility and path allow-list validation
     * have already been enforced by _maybeImport() and the caller.
     * It does not perform allow-list checks itself.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate the imported value type.
     * Does not coerce the imported export into an object.
     * Type enforcement occurs in _resolveConfigTarget().
     */
    async _importConfig(imp) {
	this._importCache ||= new Map();

	// Resolve relative imports against the DOCUMENT, not the module file.
	const docBase =
              this.importBaseUrl ||
              this.job?.e?.ownerDocument?.baseURI ||
              (typeof document !== "undefined" ? document.baseURI : "");

	const resolvedUrl = docBase
              ? new URL(imp.url, docBase).href
              : imp.url;

	const key = `${resolvedUrl}#${imp.exportName || ""}`;
	if (this._importCache.has(key)) return this._importCache.get(key);

	const p = (async () => {
            const mod = await import(/* @vite-ignore */ resolvedUrl);
            return imp.exportName ? mod[imp.exportName] : (mod.default ?? mod);
	})();

	this._importCache.set(key, p);
	return p;
    }
    

    /**
     * Parse and validate an import-style config reference.
     *
     * CONTRACT
     * --------
     * _maybeImport() recognizes import references of the form:
     *   "import:<url>[#<exportName>]"
     *
     * If the reference does not match the import form, returns null.
     * If the reference matches the import form, returns an import descriptor:
     *   { url, exportName }
     *
     * Import references are privileged.
     * When imports are disabled or blocked by policy, this method throws with
     * a structured error containing a stable code field.
     *
     *
     * INPUT
     * -----
     * @param {*} ref
     *   Candidate reference value.
     *   Non-string values return null.
     *
     *
     * IMPORT GRAMMAR
     * --------------
     * - Matches case-insensitively:
     *     import : <specifier>
     * - The specifier supports optional named export selection:
     *     <url>#<exportName>
     *
     * Examples:
     *   "import:/assets/config.js"
     *   "import:/assets/config.js#myExport"
     *
     *
     * POLICY GATES
     * ------------
     * 1. Global import enablement
     *    If allowImportConfig is false, throws CONFIG_IMPORT_DISABLED.
     *
     * 2. Scheme blocking
     *    URLs classified as resource schemes (data:, blob:, file:, extension schemes)
     *    are rejected with CONFIG_IMPORT_RESOURCE_BLOCKED.
     *
     * 3. Allow-list enforcement
     *    allowImportPath controls which external URLs may be imported.
     *
     *    - If allowImportPath is empty:
     *        Local-only mode.
     *        Only pathAbs and pathRel are allowed.
     *        External URLs are rejected with CONFIG_IMPORT_PATH_BLOCKED.
     *
     *    - If allowImportPath is non-empty:
     *        Local paths are always allowed.
     *        External URLs must resolve successfully and the resolved pathname
     *        must begin with one of the allowImportPath prefixes.
     *        Otherwise rejected with CONFIG_IMPORT_PATH_BLOCKED.
     *
     *
     * ERROR MODEL
     * -----------
     * Throws structured errors with Error.code set for:
     *   CONFIG_IMPORT_DISABLED
     *   CONFIG_IMPORT_EMPTY
     *   CONFIG_IMPORT_RESOURCE_BLOCKED
     *   CONFIG_IMPORT_URL_INVALID
     *   CONFIG_IMPORT_PATH_BLOCKED
     *
     * Callers are expected to catch and report these errors via Report.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object|null}
     *   null when ref is not an import reference.
     *   { url, exportName } when ref is a valid import reference.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not perform the dynamic import.
     * Does not validate imported value type.
     * Import execution is handled by _importConfig() and type enforcement
     * occurs in _resolveConfigTarget().
     */
    _maybeImport(ref) {
	const lib = this.lib;

	// Gate: imports are privileged.
	if (!this.allowImportConfig) {
            throw Object.assign(
		new Error(`Import config disabled for '${ref}'`),
		{ code: "CONFIG_IMPORT_DISABLED" }
            );
	}

	if (typeof ref !== "string") return null;

	const m = ref.match(/^\s*import\s*:\s*(.+?)\s*$/i);
	if (!m) return null;

	const spec = m[1];
	const [rawUrl, rawExport] = spec.split("#", 2);

	const url = (rawUrl || "").trim();
	const exportName = rawExport ? rawExport.trim() : null;

	if (!url) {
            throw Object.assign(
		new Error(`Empty import specifier in '${ref}'`),
		{ code: "CONFIG_IMPORT_EMPTY" }
            );
	}

	// Classify URL-ish type
	const t = lib.utils.linkType(url); // "pathAbs" | "pathRel" | "urlAbs" | "urlNet" | "resource" | ...

	// Block special schemes by default (data:, blob:, file:, chrome-extension:, etc.)
	if (t === "resource") {
            throw Object.assign(
		new Error(`Import blocked (resource scheme): '${url}'`),
		{ code: "CONFIG_IMPORT_RESOURCE_BLOCKED", url, linkType: t }
            );
	}

	// Normalize allow list (pathname prefixes)
	const allowList = (lib.array.filterStrings
			   ? lib.array.filterStrings(this.allowImportPath)
			   : lib.array.to(this.allowImportPath).filter(s => typeof s === "string" && s.trim())
			  ).map(s => String(s).trim()).filter(Boolean);

	// No allow list => local-only (pathAbs/pathRel only)
	if (!allowList.length) {
            const isLocal = (t === "pathAbs" || t === "pathRel");
            if (!isLocal) {
		throw Object.assign(
                    new Error(`Import blocked (local-only mode): '${url}'`),
                    { code: "CONFIG_IMPORT_PATH_BLOCKED", url, linkType: t }
		);
            }
            return { url, exportName };
	}

	// Allow local always
	if (t === "pathAbs" || t === "pathRel") {
            return { url, exportName };
	}

	// External (urlAbs/urlNet): require allowList pathname prefix match
	const base = this.env?.baseURI || this.env?.document?.baseURI || "";

	let resolved;
	try {
            resolved = new URL(url, base || undefined);
	} catch (err) {
            throw Object.assign(
		new Error(`Invalid import URL '${url}' in '${ref}'`),
		{ code: "CONFIG_IMPORT_URL_INVALID", url, error: err }
            );
	}

	if (!allowList.some(prefix => resolved.pathname.startsWith(prefix))) {
            throw Object.assign(
		new Error(`Import blocked by importPath: '${resolved.pathname}'`),
		{
                    code: "CONFIG_IMPORT_PATH_BLOCKED",
                    url,
                    pathname: resolved.pathname,
                    allowImportPath: allowList.slice(),
                    linkType: t,
		}
            );
	}

	return { url, exportName };
    }
    
    
    /**
     * Parse a DOM config payload into a configuration object.
     *
     * CONTRACT
     * --------
     * _resolveDomConfigNode() converts text content sourced from a DOM node
     * into a plain object configuration value.
     *
     * JSON parsing is the default behavior.
     * Script evaluation is supported only when explicitly enabled and only
     * for trusted SCRIPT nodes with an allowed type.
     *
     *
     * INPUT
     * -----
     * @param {Element} val
     *   DOM node that provided the payload text.
     *   Used to gate evaluation behavior (SCRIPT-only).
     *
     * @param {string} text
     *   Payload text to parse or evaluate.
     *
     * @param {Object} [ctx]
     *   Optional context object used for evaluation scope.
     *   May include:
     *     source  originating element used for resolution
     *     ref     config reference string being resolved
     *
     *
     * BEHAVIOR
     * --------
     * Default path
     *   Parses text as JSON using lib.json.parse when available, otherwise JSON.parse.
     *
     * Eval gating
     *   Evaluation is permitted only when all of the following are true:
     *     this.allowEvalConfig is true
     *     this.allowEvalTypes is provided
     *     val.tagName is SCRIPT
     *     val.type is an exact match for an allowed type
     *
     * If any gate fails, the JSON parse path is used.
     *
     * Eval path
     *   When permitted, evaluates the payload via Function constructor using
     *   a strict-mode wrapper and returns the evaluated result.
     *
     *   The evaluated payload must return an object.
     *   Non-object results throw an error.
     *
     *
     * EVALUATION SCOPE
     * ----------------
     * The eval path provides a single scope object containing:
     *   lib, job, source, ref
     *
     * The payload is evaluated with access to this scope object only.
     *
     *
     * SECURITY NOTES
     * --------------
     * - The eval path requires CSP support for unsafe-eval.
     * - Evaluation is opt-in and must remain gated by explicit config flags.
     * - This method does not attempt to sanitize or sandbox arbitrary code.
     *   It is intended for trusted pages only.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   Parsed or evaluated configuration object.
     *
     *
     * FAILURE MODES
     * -------------
     * Throws on JSON parse failure.
     * Throws on eval execution failure.
     * Throws if eval returns a non-object.
     */
    _resolveDomConfigNode(val, text, ctx = {}) {
	const lib = this.lib;
	//console.warn(val,text,ctx);
	// Default: JSON only
	const parseJSON = () => lib.json
              ? lib.json.parse(text)
              : JSON.parse(text);

	// Eval disabled → JSON only
	if (!this.allowEvalConfig || !this.allowEvalTypes) {
            return parseJSON();
	}

	// SCRIPT-only eval
	if (!val || String(val.tagName).toUpperCase() !== "SCRIPT") {
            return parseJSON();
	}

	// Exact type match (no substring hacks)
	const allowedTypes =
              lib.array.len(this.allowEvalTypes) 
              ? this.allowEvalTypes
              : [DEFAULT_EVAL_TYPE];

	const type = lib.str.to(val.type ,true).trim();
	if (!allowedTypes.includes(type)) {
            return parseJSON();
	}

	// ---- EVAL PATH (explicit, gated, scoped) ----
	// NOTE: requires CSP 'unsafe-eval'
	const scope = {
            lib,
            job: this.job,
            source: ctx.source,
            ref: ctx.ref,
	};

	const fn = new Function(
            "scope",
            `"use strict"; return (${text});`
	);

	const out = fn(scope);

	if (!out || typeof out !== "object") {
            throw new Error("Eval config source must return an object");
	}

	return out;
    }
    

    /**
     * Create a structured Error with standard metadata.
     *
     * CONTRACT
     * --------
     * _makeError() constructs an Error instance and attaches normalized
     * metadata fields used by Report and strict-mode error propagation.
     *
     * This helper does not throw.
     * Callers decide whether to throw or record the error.
     *
     *
     * INPUT
     * -----
     * @param {string} stage
     *   Logical stage name for the error source (e.g. "configure").
     *
     * @param {string} code
     *   Stable machine-readable error code.
     *
     * @param {string} message
     *   Human-readable error message.
     *
     * @param {Object} [meta={}]
     *   Optional metadata payload for debugging and diagnostics.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Error}
     *   Error instance with attached fields:
     *     err.stage
     *     err.code
     *     err.meta
     *
     *
     * SIDE EFFECTS
     * ------------
     * None.
     */
    _makeError(stage, code, message, meta = {}) {
	const err = new Error(message);
	err.stage = stage;
	err.code = code;
	err.meta = meta;
	return err;
    }
    /**
     * Record an error to the Report and optionally throw in strict mode.
     *
     * CONTRACT
     * --------
     * _error() centralizes error reporting and strict-mode enforcement.
     *
     * Behavior:
     *   - Constructs a structured Error via _makeError().
     *   - Records the error into the provided Report instance when available.
     *   - Throws the Error only when this.strict is truthy.
     *   - Returns the Error instance when not thrown.
     *
     *
     * INPUT
     * -----
     * @param {Report} report
     *   Report instance used to collect diagnostics.
     *   May be null or undefined.
     *
     * @param {string} stage
     *   Logical stage identifier (e.g. "read", "configure", "resolve").
     *
     * @param {string} code
     *   Stable machine-readable error code.
     *
     * @param {string} message
     *   Human-readable description of the failure.
     *
     * @param {Object} [meta={}]
     *   Optional metadata payload for debugging and context.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Error}
     *   The constructed Error instance.
     *   In strict mode, this value is thrown instead of returned.
     *
     *
     * THROW POLICY
     * ------------
     * Throws only when this.strict is truthy.
     * In non-strict mode, execution continues and the error is reported.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not halt execution in non-strict mode.
     * Does not interpret error severity beyond strict-mode behavior.
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
     * Validate that the provided source is a DOM element.
     *
     * CONTRACT
     * --------
     * _assertElement() verifies that source is present and DOM-like.
     *
     * If validation fails:
     *   - Records an error to the provided Report.
     *   - Throws only when this.strict is enabled.
     *   - Returns false in non-strict mode.
     *
     * Callers should treat a false return value as a fatal read condition.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     *
     * @param {Report} args.report
     *   Report instance used for diagnostics.
     *
     * @param {*} args.source
     *   Candidate DOM element to validate.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {boolean}
     *   true  when source is a valid DOM element.
     *   false when validation fails (non-strict mode).
     *
     *
     * THROW POLICY
     * ------------
     * Throws only when this.strict is truthy.
     * In non-strict mode, execution continues and the error is reported.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not perform schema validation.
     * Does not mutate state.
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
