/**
 * Job
 * ===
 *
 * Persistent runtime binding to a single DOM element, with stable identity
 * and delegated configuration.
 *
 *
 * CORE IDEA
 * ---------
 * A Job is an identity + lifecycle container.
 *
 * It owns:
 *   - Stable identity (id, createdAt)
 *   - DOM anchor (e)
 *   - Runtime lifecycle state (status, flags)
 *   - Ephemeral run state (run)
 *
 * It delegates all configuration logic to JobConfig.
 *
 *
 * RESPONSIBILITIES
 * ----------------
 * - Hold stable identity assigned at registration time.
 * - Anchor to a DOM element for lookup and lifecycle management.
 * - Manage runtime lifecycle state (attached/detached, status transitions).
 * - Provide a thin configuration entry point via configure().
 * - Expose convenience accessors (name) backed by compiled schema.
 *
 *
 * NON-RESPONSIBILITIES
 * --------------------
 * - DOM extraction and config resolution (handled by JobConfig).
 * - Schema normalization and grooming (handled by schema/Master).
 * - Scheduling policy (handled by Engine/registry layer).
 * - Execution semantics (handled by Engine / VM).
 *
 *
 * IDENTITY MODEL
 * --------------
 * - id is the true unique identifier.
 * - name is a convenience identifier derived from configuration.
 *   It is not guaranteed to be unique.
 *
 *
 * LIFECYCLE MODEL
 * ---------------
 * - detach() marks the job as no longer attached to its DOM element.
 * - shutdown() is the controlled teardown entry point.
 * - beginRun() and endRun() manage ephemeral per-run metadata.
 *
 *
 * INVARIANTS
 * ----------
 * - job.e must be a DOM element for the Job to be considered attachable.
 * - A Job may exist before configuration is successfully built.
 * - Configuration state is isolated within job.config.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * Job must remain thin.
 * Job must not duplicate configuration logic.
 * Job must not execute pipelines directly.
 */
import JobConfig from './config/JobConfig.js';
import { JOB_CONFIG_STATUS, JOB_STATUS, JOB_TYPE } from '../../constants.js';

export default class Job {

    /**
     * Construct a new Job instance.
     *
     * CONTRACT
     * --------
     * The Job constructor is intentionally thin.
     * It establishes identity, core dependencies, and lifecycle state only.
     * All configuration concerns are delegated to job.config (JobConfig).
     *
     * A Job is a stable runtime container bound to a DOM element.
     * Configuration may be built or rebuilt independently of Job identity.
     *
     *
     * REQUIRED INVARIANTS
     * -------------------
     * - opts.lib is required and must be a valid m7 lib instance.
     * - opts.expr is required and must be an ExpressionResolver instance.
     * - opts.e is required and must be a DOM element.
     * - opts.env is required and supplies the runtime environment context.
     * - opts.conf is required and supplies configuration policy defaults.
     *
     *
     * IDENTITY MODEL
     * --------------
     * - id is the true unique identifier.
     *   It may be assigned at registration time or later by the registry layer.
     * - name is a convenience label and is not guaranteed unique.
     *   The canonical name is typically derived from configuration after build.
     *
     *
     * INITIALIZED STATE
     * -----------------
     * - this.e        DOM binding (identity anchor)
     * - this.id       optional unique identifier
     * - this.createdAt creation timestamp (defaults to now)
     * - this.config   JobConfig instance (delegated configuration compiler)
     * - this.ws       per-job workspace hash
     * - this.status   initial lifecycle status
     * - this.error    last runtime error (null initially)
     * - this.run      per-run state record (null initially)
     * - this.flags    lifecycle flags (attached, hasRun, dirty)
     *
     *
     * INPUT
     * -----
     * @param {Object} opts
     *
     * @param {Object} opts.lib
     *   Required m7 utility library.
     *
     * @param {ExpressionResolver} opts.expr
     *   Required expression resolver used by configuration resolution.
     *
     * @param {Element} opts.e
     *   Required DOM element this Job is bound to.
     *
     * @param {Object} opts.env
     *   Required environment context (document, baseURI, hooks).
     *
     * @param {Object} opts.conf
     *   Required configuration policy object for JobConfig.
     *
     * @param {string|null} [opts.id]
     *   Optional unique Job identifier.
     *
     * @param {number} [opts.createdAt=Date.now()]
     *   Optional creation timestamp.
     *
     * @param {string|null} [opts.name]
     *   Optional logical name override.
     *
     * @param {string} [opts.status=JOB_STATUS.READY]
     *   Optional initial lifecycle status.
     *
     * @param {Object} [opts.ws]
     *   Optional per-job workspace object shared across subsystems.
     *
     * @param {Object} [opts.flags]
     *   Optional initial lifecycle flags merged onto defaults.
     *
     *
     * FAILURE MODES
     * -------------
     * Throws if any required dependency is missing:
     *   lib, expr, e, env, conf
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not read DOM inputs.
     * Does not resolve config references.
     * Does not compile schema.
     * Does not enqueue or execute pipelines.
     */
    constructor(opts = {}) {

	if (!opts?.lib) throw new Error("[Job] missing required option (opts.lib)");
	if (!opts.e)    throw new Error("[Job] missing required option (opts.e)");
	if (!opts.expr) throw new Error("[Job] missing required option (opts.expr)");
	if (!opts.env)  throw new Error("[Job] missing required option (opts.env)");
	if (!opts.conf) throw new Error("[Job] missing required option (opts.conf)");
	const lib = opts.lib;
	opts = lib.hash.to(opts);

	this.opts = opts;
	// ---- core dependencies ----
	this.lib  = lib;
	this.expr = opts.expr;

	// ---- DOM binding ----
	// The element this job is bound to (identity anchor for Scheduler)
	this.e = opts.e;

	// ---- identity (scheduler-owned, may be assigned later) ----
	this.id        = lib.hash.get(opts, "id", null);
	this.createdAt = lib.hash.get(opts, "createdAt", Date.now());


	// ---- configuration (fully delegated) ----
	this.config = new JobConfig({
            lib,
	    conf      : opts.conf,
            expr      : opts.expr,
            e         : opts.e,
            job       : this,
	    env       : opts.env
	});
	
	// ---- optional logical name (not guaranteed unique) ----
	this.setName( lib.hash.get(opts, "name", null) );

	// ---- persistent job workspace ----
	// Used by runtime, pipelines, and user extensions
	this.ws = lib.hash.to(opts.ws);

	// ---- lifecycle / execution state ----
	//current job status
	this.status = opts.status || JOB_STATUS.READY;
	//last error
	this.error  = null;
	//in flight + last run. 
	this.run    = null;


	// ---- runtime flags ----
	// These describe job lifecycle, not configuration
	this.flags = lib.hash.merge({
            attached : true,   // bound to DOM + scheduler
            hasRun   : false,  // has executed at least once
            dirty    : false   // marked for reconfigure/rebuild
	    
	}, lib.hash.to(opts.flags));

	
    }
    /**
     * Assign or update the registry-owned identity for this Job.
     *
     * CONTRACT
     * --------
     * setIdentity() assigns the canonical identity metadata for the Job.
     * Identity is controlled by the registry layer and not by configuration.
     *
     * This method supports flows where:
     *   - A Job is constructed before being registered.
     *   - Identity is injected after instantiation.
     *
     *
     * SEMANTICS
     * ---------
     * - id is the globally unique Job identifier.
     * - createdAt is the authoritative creation timestamp (epoch ms).
     * - Either field may be omitted to preserve the existing value.
     *
     * The method is idempotent and defensive.
     * It may be called more than once in controlled scenarios
     * (testing, re-registration), though normal flow sets identity once.
     *
     *
     * INPUT
     * -----
     * @param {Object} [args]
     *
     * @param {string|number} [args.id]
     *   Unique identifier assigned by the registry.
     *
     * @param {number} [args.createdAt]
     *   Creation timestamp in epoch milliseconds.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job}
     *   Returns this instance for chaining.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate uniqueness.
     * Does not interact with configuration.
     * Does not trigger lifecycle transitions.
     */
    setIdentity({ id, createdAt } = {}) {
	if (id != null) this.id = id;
	if (createdAt != null) this.createdAt = createdAt;
	return this;
    }

    // ---- Begin Configuration Aliases ----

    /**
     * Logical name of this Job.
     *
     * CONTRACT
     * --------
     * name is a human-facing identifier intended for debugging,
     * logging, and optional lookup. It is not guaranteed to be unique.
     *
     * SOURCE OF TRUTH
     * ---------------
     * The value is delegated to this.config.name and is derived from
     * compiled configuration schema.
     *
     * If configuration has not been built, or no name was defined,
     * this getter may return null.
     *
     *
     * IDENTITY DISTINCTION
     * --------------------
     * - job.id is the authoritative unique identifier.
     * - job.name is a convenience label only.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {string|null}
     *   Logical job name, or null if undefined.
     */
    get name() {
	return this.config.name;
    }

    /**
     * Assign or override the logical name for this Job.
     *
     * CONTRACT
     * --------
     * setName() updates the human-facing name associated with this Job.
     * The name is stored on this.config and may later be replaced by
     * compiled schema during configuration build.
     *
     *
     * SEMANTICS
     * ---------
     * - This does not affect job.id.
     * - This does not affect scheduler or registry identity.
     * - This is a convenience override and may be superseded by configuration.
     *
     *
     * TYPICAL USE CASES
     * -----------------
     * - Bootstrapping jobs before configuration build.
     * - Template-based instantiation.
     * - Developer-facing diagnostics or labeling.
     *
     *
     * INPUT
     * -----
     * @param {string|null} name
     *   Human-readable job name. May be null to clear.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job}
     *   Returns this instance for chaining.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate uniqueness.
     * Does not freeze configuration.
     * Does not trigger lifecycle changes.
     */
    setName(name) {
	this.config.name = name;
	return this;
    }

    /**
     * Build or rebuild this Job's configuration.
     *
     * CONTRACT
     * --------
     * configure() is a thin delegation wrapper over JobConfig.build().
     * It performs:
     *   - DOM input read
     *   - config reference resolution
     *   - schema compilation
     *
     * Artifact derivation is not performed in the current v1 posture.
     *
     *
     * SEMANTICS
     * ---------
     * - Safe to call multiple times.
     * - Mutates this.config internal state.
     * - May update this.status and this.error if configuration fails.
     * - Does not execute pipelines.
     *
     *
     * FAILURE POLICY
     * --------------
     * If JobConfig.build() does not return READY:
     *   - this.status is set to JOB_STATUS.ERROR
     *   - this.error is set to the returned status code
     *
     *
     * INPUT
     * -----
     * @param {Object} [opts]
     *   Optional configuration overrides merged with
     *   this.opts.conf.config before build().
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Promise<Job>}
     *   Resolves to this instance for chaining.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not schedule work.
     * Does not enqueue pipelines.
     * Does not alter registry state.
     */
    async configure(opts) {
	const lib = this.lib;
	const cOpts = lib.hash.merge(lib.hash.to(this.opts.conf.config) , lib.hash.to(opts) );
	const status = await this.config.build({...cOpts});
	if( status !== JOB_CONFIG_STATUS.READY){
	    this.status = JOB_STATUS.ERROR;
	    this.error  = status;
	}
	return this;
    }

    // ---- End Configuration Aliases ----
    

    /**
     * Begin a new execution run for this Job.
     *
     * CONTRACT
     * --------
     * beginRun() initializes ephemeral per-run state and transitions the Job
     * into RUNNING status.
     *
     * This method is intended to be called by the runtime layer immediately
     * before pipeline execution begins.
     *
     *
     * SEMANTICS
     * ---------
     * - Creates a new this.run record.
     * - Resets this.error to null.
     * - Sets this.status to JOB_STATUS.RUNNING.
     * - Does not validate configuration readiness.
     *
     * If job.id is not yet assigned, a temporary identifier is used in the
     * run id string for diagnostic purposes.
     *
     *
     * RUN RECORD SHAPE
     * ----------------
     * this.run = {
     *   id:        string,   // unique run identifier
     *   startedAt: number,   // epoch ms
     *   meta:      Object,   // runtime-provided metadata
     *   buffer:    any,      // optional scratch space
     *   request:   any,      // optional request reference
     *   response:  any       // optional response reference
     * }
     *
     *
     * INPUT
     * -----
     * @param {Object} [meta={}]
     *   Optional runtime metadata associated with this execution.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   The newly created run record.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not enqueue pipelines.
     * Does not perform execution.
     * Does not validate schema state.
     */
    beginRun(meta = {}) {
	// require an id once we're actually executing (optional but helps catch wiring mistakes)
	// if (this.id == null) throw new Error("[Job] beginRun called before Scheduler assigned job.id");

	this.run = {
	    id: `${this.id ?? "unregistered"}:run:${Date.now()}`,
	    startedAt: Date.now(),
	    meta,
	    buffer: undefined,
	    request: null,
	    response: null,
	};
	this.status = JOB_STATUS.RUNNING;
	this.error = null;
	return this.run;
    }

    /**
     * Finalize the current execution run for this Job.
     *
     * CONTRACT
     * --------
     * endRun() closes the active run record (if present) and transitions
     * the Job to a terminal or post-run status.
     *
     * This method is intended to be called by the runtime layer after
     * pipeline execution completes or fails.
     *
     *
     * SEMANTICS
     * ---------
     * - If this.run exists, sets run.endedAt to the current timestamp.
     * - Marks this.flags.hasRun = true.
     * - Sets this.status to the provided status value.
     * - Does not clear this.run (historical context is retained).
     *
     *
     * INPUT
     * -----
     * @param {string} [status=JOB_STATUS.COMPLETE]
     *   Lifecycle status to apply after run completion.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job}
     *   Returns this instance for chaining.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not execute pipelines.
     * Does not reset configuration.
     * Does not modify registry state.
     */
    endRun(status = JOB_STATUS.COMPLETE) {
	if (this.run) this.run.endedAt = Date.now();
	this.flags.hasRun = true;
	this.status = status;
	return this;
    }

    /**
     * Detach this Job from its runtime host.
     *
     * CONTRACT
     * --------
     * detach() transitions the Job into a non-attached state.
     * The Job remains valid but should no longer be scheduled or executed.
     *
     *
     * SEMANTICS
     * ---------
     * - Sets this.flags.attached = false.
     * - Sets this.status = JOB_STATUS.DETACHED.
     * - Does not modify configuration, identity, or workspace.
     *
     *
     * LIFECYCLE MODEL
     * ---------------
     * - Detachment is not an error condition.
     * - Detachment is not destruction.
     * - The Job instance remains inspectable and reusable.
     *
     *
     * TYPICAL USE CASES
     * -----------------
     * - DOM element removal.
     * - SPA navigation teardown.
     * - Registry rebuilds.
     * - Graceful shutdown flows.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job}
     *   Returns this instance for chaining.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not unregister the Job.
     * Does not clear schema or runtime state.
     * Does not destroy the instance.
     */
    detach() {
	this.flags.attached = false;
	this.status = JOB_STATUS.DETACHED;
	return this;
    }


    /**
     * Shutdown this Job.
     *
     * CONTRACT
     * --------
     * shutdown() is the lifecycle choke point indicating that the Job should
     * no longer run. In v1 it is effectively a thin wrapper around detach(),
     * but it exists as the stable entry point for future teardown behavior.
     *
     *
     * SEMANTICS
     * ---------
     * - Idempotent: if the Job is already detached, this is a no-op.
     * - Transitions the Job into a detached, non-runnable state.
     * - Optionally records a shutdown reason for diagnostics.
     *
     *
     * FUTURE EXTENSION POINT
     * ----------------------
     * This method is the intended place to add teardown actions such as:
     * - cancel in-flight runs
     * - stop intervals and event handlers
     * - abort requests
     * - release resources
     * - emit lifecycle events
     *
     *
     * INPUT
     * -----
     * @param {Object} [opts={}]
     *
     * @param {string} [opts.reason]
     *   Optional human-readable reason for the shutdown.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Job}
     *   Returns this instance for chaining.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not unregister the Job from a registry.
     * Does not clear configuration artifacts.
     * Does not guarantee cancellation of in-flight work in v1.
     */
    shutdown(opts = {}) {
	// Idempotent: shutting down an already-detached job is a no-op
	if (this.flags && this.flags.attached === false) return this;

	// Mark as detached / inactive
	if (typeof this.detach === "function") {
            this.detach();
	} else {
            // fallback safety (should not happen)
            this.flags.attached = false;
            this.status = JOB_STATUS.DETACHED;
	}

	// Optional bookkeeping
	if (opts.reason) {
            this.shutdownReason = opts.reason;
	}

	// Future:
	// - cancel intervals
	// - abort requests
	// - clear run state

	return this;
    }
    


}
