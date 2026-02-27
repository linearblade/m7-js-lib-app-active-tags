/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

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
import applyMixins                     from '../../../../helpers/applyMixins.js';
import Report                          from '../Report.js';
import trait_configResolver            from './traits/configResolver.js';
import trait_configTargetResolver      from './traits/configTargetResolver.js';
import trait_maybeImport               from './traits/maybeImport.js';
import trait_tagParser                 from './traits/tagParser.js';
import { ARR_TO_OPTS,  MERGE_OPTS_V1 } from '../../../../constants.js';
//move to last-line of defense file
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


applyMixins(DomConfigSource, trait_maybeImport,trait_configResolver, trait_configTargetResolver,trait_tagParser);
