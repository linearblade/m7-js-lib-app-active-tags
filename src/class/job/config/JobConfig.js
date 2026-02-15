/**
 * JobConfig (v1) — Job-bound configuration compiler.
 *
 * ROLE IN THE SYSTEM
 * ------------------
 * JobConfig is the configuration nucleus of a Job.
 * It owns reading DOM inputs, resolving configuration references,
 * and compiling the normalized schema used by runtime subsystems.
 *
 *
 * HIGH-LEVEL PIPELINE (build)
 * ---------------------------
 * 1) Read DOM inputs
 *    - Delegates to DomConfigSource.read(source)
 *    - Produces a deterministic snapshot:
 *        { report, dataSet, attrs, at, config, output }
 *
 * 2) Compile normalized schema
 *    - Delegates to Schema(Master).compile(output)
 *    - Produces:
 *        { report, schema }
 *    - `schema` is groomed and ready for runtime consumption.
 *
 * No runtime artifact derivation is performed at this stage.
 *
 *
 * WHAT JOBCONFIG STORES (PUBLIC, STABLE)
 * ---------------------------------------
 * - this.inputs       : DOM/config read snapshot (DomConfigSource shape)
 * - this.schemaReport : exported schema compilation report
 * - this.schema       : canonical compiled schema used by runtime
 * - this.status       : JOB_CONFIG_STATUS.* lifecycle state
 * - this.error        : last thrown error (when applicable)
 * - this.name         : resolved job name from compiled schema
 *
 *
 * WHAT JOBCONFIG INTENTIONALLY DOES NOT DO
 * ----------------------------------------
 * - No scheduling decisions — handled by runtime controllers.
 * - No pipeline execution — handled by Engine / VM.
 * - No event or interval registration.
 * - No direct runtime mutation.
 *
 *
 * COERCION STANCE
 * ---------------
 * This layer is intentionally coercive and normalization-focused.
 * It produces stable shapes suitable for runtime.
 * Strict execution validation belongs to later phases.
 *
 *
 * ERROR AND REPORTING MODEL
 * --------------------------
 * - DOM read failures or schema compile failures transition status to ERROR.
 * - Report objects are exported snapshots and should not be mutated downstream.
 *
 *
 * LIFECYCLE NOTES
 * ---------------
 * - Safe to call `build()` multiple times; each call regenerates inputs and schema.
 * - JobConfig is job-bound and assumes a stable DOM element and ExpressionResolver.
 *
 *
 * SEE ALSO
 * --------
 * - DomConfigSource      DOM attribute and config-at resolution
 * - schema/Master        schema normalization and grooming
 * - Report               diagnostics container used during build
 */

import Schema          from './schema/Master.js';
import DomConfigSource from './DomConfigSource.js';
import freezeDeep      from '../../../helpers/freezeDeep.js';
import {JOB_CONFIG_STATUS} from '../../../constants.js';

export class JobConfig {

    /**
     * Create a JobConfig instance bound to a Job and its DOM source element.
     *
     * CONTRACT
     * --------
     * JobConfig is a job-scoped configuration compiler.
     * It owns:
     *   - reading DOM inputs and config bindings
     *   - resolving referenced configuration targets
     *   - compiling the normalized schema used by runtime subsystems
     *
     * This constructor performs dependency wiring only.
     * It does not read from the DOM.
     * It does not resolve config targets.
     * It does not compile schema.
     *
     *
     * INPUT
     * -----
     * @param {Object} opts
     *
     * @param {Object} opts.lib
     *   Required m7 lib instance used for coercion, hashing, DOM utilities,
     *   and merge semantics.
     *
     * @param {ExpressionResolver} opts.expr
     *   Required ExpressionResolver used to resolve config references.
     *
     * @param {Element} opts.e
     *   Required DOM element used as the configuration source root.
     *   All DOM reads and config-at resolution are relative to this element.
     *
     * @param {Job} opts.job
     *   Required owning Job instance.
     *   Used as a lifecycle anchor and for diagnostics context.
     *
     * @param {Object} opts.conf
     *   Required startup configuration policy used by DomConfigSource and schema
     *   compilation layers.
     *
     * @param {Object} [opts.env]
     *   Optional environment context (document hooks, baseURI, feature flags).
     *
     * @param {Object} [opts.ws]
     *   Optional shared workspace root used across config and runtime layers.
     *
     *
     * INITIALIZED STATE
     * -----------------
     * - this.inputs       initialized to an empty DomConfigSource read shape
     * - this.schemaReport initialized to null
     * - this.schema       initialized to null
     * - this.status       initialized to JOB_CONFIG_STATUS.INIT
     * - this.error        initialized to null
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if any required dependency is missing:
     *   lib, expr, e, job, conf
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not execute pipelines.
     * Does not schedule work.
     * Does not derive stack or interval artifacts.
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


	// Reserved compatibility placeholders (not part of active v1 behavior).
	//this.artifacts = null;
	//this.artifactsBuilt = false;
	this.error = null;
	this.status = JOB_CONFIG_STATUS.INIT;
    }

    /**
     * Build or rebuild this Job configuration from its bound DOM element.
     *
     * CONTRACT
     * --------
     * build() is the primary configuration lifecycle entry point for a Job.
     * It performs a deterministic two-phase pass:
     *   1) Read DOM inputs and resolve config bindings into a merged output object
     *   2) Compile the merged output into a canonical schema
     *
     * Artifact derivation is intentionally out of scope for the current build path.
     *
     *
     * PIPELINE
     * --------
     * 1) Read inputs from the DOM (this.e)
     *    - Delegates to DomConfigSource.read()
     *    - Produces a stable snapshot:
     *        { report, dataSet, attrs, at, config, output }
     *
     * 2) Compile schema
     *    - Delegates to Schema.compile(output)
     *    - Produces:
     *        { report, schema }
     *
     * This method does not execute pipelines and does not schedule work.
     *
     *
     * FAILURE POLICY
     * --------------
     * - If DOM read report is not ok:
     *     status is set to JOB_CONFIG_STATUS.ERROR_DOM
     *     this.error is set to the exported read report
     *     build() returns ERROR_DOM
     *
     * - If schema compile report is not ok:
     *     status is set to JOB_CONFIG_STATUS.ERROR_SCHEMA
     *     this.error is set to the exported schema report
     *     build() returns ERROR_SCHEMA
     *
     * In either error state, the Job should be treated as not ready for execution.
     *
     *
     * INPUT
     * -----
     * @param {Object} [opts={}]
     *   Optional options forwarded to DomConfigSource construction.
     *   This method currently performs a full rebuild each time and does not
     *   implement partial rebuild flags.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Promise<number>}
     *   One of JOB_CONFIG_STATUS values indicating the resulting state:
     *     INIT, ERROR_DOM, ERROR_SCHEMA, READY
     *
     *
     * SIDE EFFECTS
     * ------------
     * Mutates:
     *   - this.inputs
     *   - this.schemaReport
     *   - this.schema
     *   - this.name
     *   - this.status
     *   - this.error
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not derive stack or interval artifacts.
     * Does not enqueue or execute pipelines.
     * Does not register events or intervals.
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
	this.name = this.lib.hash.getUntilNotEmpty(resp, "output.name dataset.name");
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

    /**
     * Build or rebuild this Job configuration directly from a provided object.
     *
     * CONTRACT
     * --------
     * buildFrom() is similar to build(), but it does NOT invoke DomConfigSource.
     * It compiles the provided input directly into a normalized schema.
     *
     * @param {Object} [opts={}]
     *   Raw configuration object to compile.
     *
     * @returns {Promise<number>}
     *   One of JOB_CONFIG_STATUS values.
     */
    async buildFrom(opts = {}) {
	opts = this.lib.hash.to(opts);

	// Synthetic/manual source: maintain the same inputs shape without DOM read.
	this.inputs = DomConfigSource.emptyReadShape();
	this.inputs.output = opts;

	this.name = this.lib.hash.getUntilNotEmpty(opts, "name");

	const schemaService = new Schema({ lib: this.lib, expr: this.expr });
	const schemaResp = schemaService.compile(opts);
	this.schemaReport = schemaResp.report;
	this.schema = schemaResp.schema;

	if (!this.schemaReport.ok) {
	    this.error = this.schemaReport;
	    return this.status = JOB_CONFIG_STATUS.ERROR_SCHEMA;
	}

	this.name = this.lib.utils.isEmpty(this.schema.name) ? 'unnamed job' : this.schema.name;
	return this.status = JOB_CONFIG_STATUS.READY;
    }


    
    
}

export default JobConfig;
