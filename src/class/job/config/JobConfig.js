/**
 * JobConfig (v1.0) — Job-bound configuration compiler + artifact builder.
 *
 * Role in the system
 * - JobConfig is the *configuration nucleus* of a Job.
 * - It owns reading DOM inputs, resolving config references, compiling the normalized schema,
 *   and producing runtime-facing buckets/artifacts in a stable shape.
 *
 * High-level pipeline (build)
 * 1) Read DOM inputs (dataset/attrs + config-at references)
 *    - Delegates to DomConfigSource.read(source)
 *    - Produces a deterministic read-shape: { report, dataSet, attrs, at, config, output }
 *
 * 2) Compile normalized schema
 *    - Delegates to Schema(Master).compile(output)
 *    - Produces { report, schema } where `schema` is groomed and ready for runtime use.
 *
 * 3) Derive creation-only artifacts
 *    - Derives stack/interval/pipeline definitions from schema (or config) and deep-freezes them.
 *    - Artifacts are *creation-only* and may be rebuilt only when explicitly requested.
 *
 * What JobConfig stores (public, stable)
 * - this.inputs       : DOM/config read snapshot (DomConfigSource shape)
 * - this.schemaReport : exported schema compilation report (warnings/errors, ok flag)
 * - this.schema       : groomed schema used as the canonical config for runtime
 * - this.requests     : runtime request bucket (mirrors schema.requests; shaped/normalized)
 * - this.intervals    : runtime interval bucket (mirrors schema.intervals; shaped/normalized)
 * - this.pipelines    : runtime pipeline bucket (mirrors schema.pipelines; shaped/normalized)
 * - this.artifacts    : frozen creation-only derived artifacts (stackDefs/intervalDefs/pipelineDefs)
 * - this.status       : JOB_CONFIG_STATUS.* lifecycle for config readiness
 *
 * What JobConfig intentionally does NOT do
 * - No scheduling ("when to run") — Scheduler owns that.
 * - No execution ("how to run") — Runner owns that.
 * - No eval / executable expressions in config resolution (v1.0 policy).
 *
 * Coercion stance
 * - This layer is intentionally coercive (normalize into stable shapes),
 *   not a strict validator. Runtime resolution / runner phases may add strict checks later.
 *
 * Extensibility hooks
 * - build({ deriveStacks, deriveIntervals, derivePipelines })
 *   allows the engine (or consumers, if allowed) to inject derivation logic.
 * - Returned artifacts are deep-copied then frozen to avoid reference retention and mutation.
 *
 * Error / reporting model (current posture)
 * - Dom read failures and schema compile failures flip status to ERROR_* and stop build().
 * - Report objects are exported snapshots; downstream systems should not mutate them.
 *
 * Threading / lifecycle notes
 * - Safe to call build() repeatedly. Derived artifacts are cached unless opts.rebuild is true.
 * - JobConfig is job-bound: it assumes a stable `this.e` DOM binding and `this.expr` resolver.
 *
 * See also
 * - DomConfigSource: DOM/dataset/config-at resolution
 * - schema/Master (Schema compiler): normalization + grooming of configuration
 * - Report: diagnostics container used during compile/build
 */

import Schema          from './schema/Master.js';
import DomConfigSource from './DomConfigSource.js';
import freezeDeep      from '../../../helpers/freezeDeep.js';
import {JOB_CONFIG_STATUS} from '../../../constants.js';

export class JobConfig {

    /**
     * Create a JobConfig instance bound to a Job and a DOM source.
     *
     * JobConfig is a job-scoped configuration service. It is responsible for:
     * - reading configuration inputs from the DOM
     * - resolving config references
     * - compiling the normalized schema
     * - producing runtime-ready configuration buckets
     *
     * This constructor performs *no compilation* itself. It only establishes
     * the required dependencies and initializes stable containers.
     *
     * @param {Object} opts
     * @param {Object} opts.lib
     *     m7 core library instance. Required for all coercion, hashing,
     *     DOM utilities, and merge semantics.
     *
     * @param {Object} opts.expr
     *     ExpressionResolver instance used for interpolation and target parsing
     *     during config reference resolution.
     *
     * @param {Element} opts.e
     *     DOM element that serves as the configuration source root.
     *     All dataset, attribute, and config-at resolution is relative to this node.
     *
     * @param {Job} opts.job
     *     Owning Job instance. Used as the lifecycle anchor and for
     *     bidirectional coordination (but JobConfig does not execute jobs).
     *
     * @param {Object} [opts.ws]
     *     Optional shared workspace object.
     *     This workspace may be used by both configuration and runtime layers.
     *
     * @throws {Error}
     *     If any required dependency (lib, expr, e, job) is missing.
     *
     * @notes
     * - JobConfig is *job-bound*, not a static utility.
     * - All configuration state is isolated here to keep Job itself lean.
     * - Execution and scheduling are intentionally out of scope.
     */
    
    constructor(opts = {}) {
	if (!opts.lib)  throw new Error("[Job] missing required option (opts.lib)");
	if (!opts.e)    throw new Error("[Job] missing required option (opts.e)");
	if (!opts.expr) throw new Error("[Job] missing required option (opts.expr)");
	if (!opts.job)  throw new Error("[Job] missing required option (opts.job)");
	if (!opts.conf)  throw new Error("[Job] missing required option (opts.conf)");
	
	const lib = opts.lib;
	this.startupConf = opts.conf;
	this.job = opts.job;
	this.env = opts.env; //root , document etc
	// core deps (config needs these)
	this.lib  = lib;
	this.expr = opts.expr;

	// DOM binding (config source root)
	this.e = opts.e;

	// persistent per-job workspace root (config/runtime shared)
	//this.ws = lib.hash.to(opts.ws);
	//this.allowedEvalTypes = opts.allowedEvalTypes;
	//this.allowEvalConfig  = opts.allowEvalConfig;
	// ---- configuration artifacts (kept tight) ----

	// snapshots from DOM/config resolution
	this.inputs = DomConfigSource.emptyReadShape();

	// compiled schema artifacts
	this.schemaReport = null; // exported Report
	this.schema       = null; // exported groomed schema


	// legacy compatibility (keep for now; can delete once runner is finalized)
	//this.artifacts = null;
	//this.artifactsBuilt = false;
	this.error = null;
	this.status = JOB_CONFIG_STATUS.INIT;
    }

    /**
     * Build (or rebuild) this Job’s configuration from its bound DOM element.
     *
     * This method is the primary entry point for configuration lifecycle.
     * It performs a full, ordered configuration pass:
     *
     * 1) Read inputs from the DOM (`this.e`)
     *    - dataset, attributes, and config-at references
     *
     * 2) Resolve configuration
     *    - merge defaults + resolved config + dataset
     *
     * 3) Compile schema
     *    - normalize and groom configuration into a canonical schema
     *
     * 4) Derive creation-only artifacts
     *    - build and freeze runtime-facing definitions (pipelines, intervals, etc.)
     *
     * The operation is deterministic and safe to call multiple times.
     *
     * v1.0 Design Notes
     * - This is a deliberate successor to legacy ActiveTags configuration shaping.
     * - The conceptual model (read → normalize → merge → derive → freeze) is preserved,
     *   but implementation details are intentionally modernized and compartmentalized.
     * - This method does not execute jobs or schedule runs.
     *
     * Failure Policy
     * - DOM read failures set status to ERROR_DOM.
     * - Schema compilation failures set status to ERROR_SCHEMA.
     * - In either case, configuration halts and the Job is left non-runnable.
     *
     * @param {Object} [opts]
     *     Optional build controls.
     *
     * @param {boolean} [opts.readDom=true]
     *     Whether to re-read dataset/attributes from the bound DOM element.
     *     (Currently always true; included for forward compatibility.)
     *
     * @param {boolean} [opts.recompute=true]
     *     Whether to recompute the merged configuration from inputs.
     *     (Currently always true; included for forward compatibility.)
     *
     * @param {boolean} [opts.rebuild=false]
     *     Whether to force rebuilding derived artifacts even if they already exist.
     *
     * @returns {number}
     *     One of JOB_CONFIG_STATUS values indicating the resulting configuration state.
     *
     * @sideeffects
     * - Mutates:
     *   - this.inputs
     *   - this.schemaReport
     *   - this.schema
     *   - this.artifacts (via _deriveArtifacts)
     *   - this.status
     */    
    async build(opts = {}){
	//---- read dom ----
	opts = this.lib.hash.to(opts);

	const domService = new DomConfigSource(
	    {
		...opts, env:this.env, conf:this.startupConf,
		lib:this.lib,expr:this.expr,job:this.job,
	    });
	const resp = await domService.read(this.e);
	this.inputs = resp;
	//immediately try to acquire a name
	this.name = lib.hash.getUntilNotEmpty(resp, "output.name dataset.name");
	if(!resp.report.ok) {
	    this.error = resp.report;
	    //console.error(this.error.errors[0]);
	    return this.status = JOB_CONFIG_STATUS.ERROR_DOM;
	}



	// --- coerce a schema from it ----
	const schemaService = new Schema({lib:this.lib,expr:this.expr});
	const schemaResp = schemaService.compile(resp.output);
	this.schemaReport = schemaResp.report;
	this.schema   = schemaResp.schema;

	if (!this.schemaReport.ok) {
	    this.error = this.schemaReport;
	    //console.error(this.error.errors[0]);
	    return  this.status   = JOB_CONFIG_STATUS.ERROR_SCHEMA;
	}
	// ---- finalize ----
	this.name     =  this.lib.utils.isEmpty(this.schema.name) ? 'unnamed job' : this.schema.name;
	//this._deriveArtifacts(opts);

	return this.status   = JOB_CONFIG_STATUS.READY;	
    }

    /* ------------------------------------------------------------
     * Private section methods 
     * ------------------------------------------------------------ */
    /**
     * Derive and freeze creation-time runtime artifacts.
     *
     * This method produces *creation-only* artifacts derived from the
     * already-compiled Job configuration. These artifacts are intended
     * for runtime consumption and must not be mutated after creation.
     *
     * Current behavior (v1.0):
     * - Acts as a coordination point for artifact derivation.
     * - Invokes optional derivation hooks if present.
     * - Freezes the resulting artifact object to prevent mutation.
     *
     * Design intent:
     * - Artifacts are built once per configuration lifecycle.
     * - Rebuilding is explicit and opt-in via `opts.rebuild`.
     * - Sub-derivation methods are intentionally stubbed and will be
     *   implemented incrementally as the runtime matures.
     *
     * Policy:
     * - If artifacts already exist and `opts.rebuild !== true`,
     *   this method is a no-op.
     *
     * Inputs:
     * - Prefers `this.schema` (normalized, groomed configuration).
     * - Falls back to an empty object if schema is not yet available.
     *
     * Side effects:
     * - Writes `this.artifacts` as a frozen object:
     *     {
     *       stackDefs,
     *       intervalDefs,
     *       pipelineDefs
     *     }
     * - Sets `this.artifactsBuilt = true`.
     *
     * @param {Object} [opts]
     * @param {boolean} [opts.rebuild]
     *     Force rebuilding artifacts even if already built.
     *
     * @returns {void}
     */
    _deriveArtifacts(opts = {}) {
	const lib = this.lib;
	const rebuild = !!opts.rebuild;

	// If already built and not rebuilding, do nothing.
	if (!rebuild && this.artifactsBuilt) return;

	// Prefer schema (groomed), fall back to conf (raw merged)
	const src = lib.hash.is(this.schema) ? this.schema : {};

	// ---- Derive stack defs
	let stackDefs;
	if (typeof opts.deriveStacks === "function") {
            stackDefs = opts.deriveStacks(this, src, opts);
	} else if (typeof this._deriveStackDefs === "function") {
            stackDefs = this._deriveStackDefs(src, opts);
	} else {
            stackDefs = {};
	}

	// ---- Derive interval defs
	let intervalDefs;
	if (typeof opts.deriveIntervals === "function") {
            intervalDefs = opts.deriveIntervals(this, src, opts);
	} else if (typeof this._deriveIntervalDefs === "function") {
            intervalDefs = this._deriveIntervalDefs(src, opts);
	} else {
            intervalDefs = {};
	}

	// ---- Derive pipeline defs
	let pipelineDefs;
	if (typeof opts.derivePipelines === "function") {
            pipelineDefs = opts.derivePipelines(this, src, opts);
	} else if (typeof this._derivePipelineDefs === "function") {
            pipelineDefs = this._derivePipelineDefs(src, opts);
	} else {
            pipelineDefs = {};
	}

	// Snapshot + freeze (creation-only)
	const artifacts = {
            stackDefs: stackDefs || {},
            intervalDefs: intervalDefs || {},
            pipelineDefs: pipelineDefs || {}
	};

	// deepCopy ensures caller hooks can't retain references; freeze prevents later mutation
	this.artifacts = freezeDeep(lib.hash.deepCopy(artifacts));
	this.artifactsBuilt = true;
    }

    /* ------------------------------------------------------------
     * Private derivation hooks (intentionally strict stubs for now)
     * ------------------------------------------------------------ */

    _deriveStackDefs(conf, opts = {}) {
	// TODO: derive stack definitions from conf (job-type archetypes, stacks, triggers, etc.)
	return {};
    }

    _deriveIntervalDefs(conf, opts = {}) {
	// TODO: derive interval definitions from conf (interval policies, named intervals, etc.)
	return {};
    }

    _derivePipelineDefs(conf, opts = {}) {
	// TODO: derive pipeline definitions from conf (pre/post chains, transforms, etc.)
	return {};
    }

    
    
}

export default JobConfig;
