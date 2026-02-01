/**
 * Job
 * ===
 *
 * Persistent runtime binding to a single DOM element, with stable identity and
 * delegated configuration.
 *
 * Core idea:
 * - A Job is an *identity + lifecycle container*:
 *     { e, id, createdAt, status, flags, ws, run }
 * - All configuration (DOM extraction, config resolution, schema compilation,
 *   derived artifacts) is delegated to `job.config` (JobConfig).
 *
 * Responsibilities (Job):
 * - Hold stable identity (id + createdAt) assigned by the Scheduler.
 * - Anchor to a DOM element (`e`) for lookups and lifecycle attachment.
 * - Track lifecycle state (status, attached/detached) and per-run state (`run`).
 * - Provide thin aliases to configuration (name/configure) without owning config logic.
 *
 * Non-responsibilities (Job):
 * - DOM/config/schema normalization and validation (handled by JobConfig + schema/Master).
 * - Scheduling policy (handled by Scheduler).
 * - Execution semantics (future Runner).
 *
 * Identity + naming:
 * - `id` is the true unique identity (Scheduler-owned).
 * - `name` is a convenience identifier (not guaranteed unique) and is sourced from config
 *   (via `job.config.name`) by default.
 *
 * Lifecycle:
 * - `detach()` marks the job as no longer runnable/attached (not destruction).
 * - `shutdown()` is the lifecycle choke point for teardown (currently wraps detach()).
 *
 * Run state:
 * - `beginRun()` creates an ephemeral run record (`job.run`) for in-flight/last-run context.
 * - `endRun()` finalizes run timestamps and transitions status.
 *
 * Invariants:
 * - `job.e` must be a DOM element for a Job to be schedulable.
 * - Scheduler may register a Job before config is fully built; config can be built later.
 *
 * @module Job
 */

import JobConfig from './config/JobConfig.js';
import { JOB_CONFIG_STATUS, JOB_STATUS, JOB_TYPE } from '../../constants.js';

export default class Job {
/**
 * Construct a new Job instance.
 *
 * Design intent:
 * - The Job constructor is intentionally *thin*.
 * - It establishes identity, core dependencies, and lifecycle state only.
 * - All configuration concerns (DOM reading, config resolution, schema compilation,
 *   artifact derivation) are fully delegated to `job.config` (JobConfig).
 *
 * This separation ensures:
 * - Jobs can be registered with the Scheduler before configuration is built.
 * - Configuration can be rebuilt independently of job identity or runtime state.
 * - Runtime execution can treat the Job as a stable container with mutable state,
 *   while config remains a structured, replaceable artifact.
 *
 * Required invariants:
 * - `opts.lib` must be a valid m7 lib instance.
 * - `opts.expr` must be a shared ExpressionResolver.
 * - `opts.e` must be a DOM element (identity anchor for the Job).
 *
 * Identity model:
 * - `id` is the true unique identifier (assigned by Scheduler).
 * - `name` is a convenience label (not guaranteed unique) and may be sourced
 *   from configuration after build-time.
 *
 * @param {Object} opts
 * @param {Object} opts.lib
 *     Core m7 utility library (required).
 *
 * @param {ExpressionResolver} opts.expr
 *     Expression resolver used for interpolation and target resolution (required).
 *
 * @param {HTMLElement} opts.e
 *     DOM element this Job is bound to (required).
 *
 * @param {string|null} [opts.id]
 *     Unique Job identifier assigned by Scheduler.
 *
 * @param {number} [opts.createdAt]
 *     Creation timestamp assigned by Scheduler (defaults to now).
 *
 * @param {string|null} [opts.name]
 *     Optional logical name for convenience (not guaranteed unique).
 *
 * @param {string} [opts.status]
 *     Initial job lifecycle status (defaults to `JOB_STATUS.READY`).
 *
 * @param {Object} [opts.ws]
 *     Persistent per-job workspace shared between config and runtime.
 *
 * @param {Object} [opts.flags]
 *     Optional initial lifecycle flags (merged onto defaults).
 */
    constructor(opts = {}) {
	if (!opts.lib)  throw new Error("[Job] missing required option (opts.lib)");
	if (!opts.e)    throw new Error("[Job] missing required option (opts.e)");
	if (!opts.expr) throw new Error("[Job] missing required option (opts.expr)");

	const lib = opts.lib;

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
            expr      : opts.expr,
            e         : opts.e,
            job       : this
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
 * Assign or update the scheduler-owned identity for this Job.
 *
 * This method exists to support the creation flow where a Job instance
 * is constructed *before* it is registered with the Scheduler.
 * The Scheduler is the source of truth for identity and timing metadata.
 *
 * Semantics:
 * - `id` is the canonical, globally unique job identifier.
 * - `createdAt` is the authoritative creation timestamp.
 * - Either field may be omitted to preserve the existing value.
 *
 * This method is safe to call exactly once in normal operation,
 * but is written defensively to allow re-assignment if needed
 * during testing or controlled re-registration.
 *
 * @param {Object} [args]
 * @param {string|number} [args.id]
 *     Unique identifier assigned by the Scheduler.
 *
 * @param {number} [args.createdAt]
 *     Creation timestamp (epoch ms) assigned by the Scheduler.
 *
 * @returns {Job}
 *     Returns `this` for chaining.
 */
    setIdentity({ id, createdAt } = {}) {
	if (id != null) this.id = id;
	if (createdAt != null) this.createdAt = createdAt;
	return this;
    }

    // ---- Begin Configuration Aliases ----

    /**
 * Logical name of this job.
 *
 * This is a convenience identifier intended for human reference,
 * debugging, and optional lookup — NOT a guaranteed-unique identity.
 *
 * Source of truth:
 * - Delegated to `this.config.name`, which is derived from schema/config.
 *
 * Notes:
 * - The Scheduler identity (`job.id`) is the authoritative identifier.
 * - Name may be null if not provided or derived.
 *
 * @returns {string|null}
 */
    get name() {
	return this.config.name;
    }
/**
 * Assign or override the logical name for this job.
 *
 * This is primarily a convenience mechanism used:
 * - during setup / bootstrapping
 * - when mass-instantiating jobs from templates
 * - for developer-facing diagnostics
 *
 * Important:
 * - This does NOT affect scheduler identity.
 * - This delegates to `JobConfig`, which may later enforce immutability
 *   or freezing once configuration is finalized.
 *
 * @param {string|null} name
 *     Human-readable job name.
 *
 * @returns {Job}
 *     Returns `this` for chaining.
 */
    setName(name) {
	this.config.name = name;
	return this;
    }

    /**
 * Build or rebuild this job's configuration.
 *
 * This is a thin delegation layer over `JobConfig.build()`.
 * It triggers:
 * - DOM extraction
 * - config resolution
 * - schema normalization
 * - artifact derivation (pipelines, intervals, etc.)
 *
 * Semantics:
 * - Safe to call multiple times.
 * - Mutates the job's configuration state.
 * - Job lifecycle state (`status`, `error`, etc.) may be updated as a result.
 *
 * This method does NOT execute the job.
 * Execution is the responsibility of the runtime / runner layer.
 *
 * @param {Object} [opts]
 *     Configuration options forwarded to `JobConfig.build()`.
 *
 * @returns {Job}
 *     Returns `this` for chaining.
 */
    configure(opts) {
	this.config.build(opts);
	return this;
    }
    // ---- End Configuration Aliases ----
    
    //leave for running. not related to config
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
    //leave for running. not related to config
    endRun(status = JOB_STATUS.COMPLETE) {
	if (this.run) this.run.endedAt = Date.now();
	this.flags.hasRun = true;
	this.status = status;
	return this;
    }

    /**
     * Detach this Job from its runtime host.
     *
     * Semantics:
     * - Marks the Job as no longer attached to its execution environment
     *   (e.g. DOM element, scheduler, observers).
     * - Transitions the Job into the `DETACHED` lifecycle state.
     *
     * Contract:
     * - Detachment is NOT an error condition.
     * - Detachment is NOT destruction.
     * - The Job object remains valid and inspectable.
     *
     * Effects:
     * - Sets `flags.attached = false`.
     * - Sets `status = JOB_STATUS.DETACHED`.
     * - Does NOT clear schema, config, workspace, or identity.
     *
     * Intended use cases:
     * - DOM element removal or replacement.
     * - SPA navigation / teardown.
     * - Scheduler rebuilds or hot-reload scenarios.
     * - Graceful lifecycle shutdown without data loss.
     *
     * Notes:
     * - Detached jobs should not be scheduled or executed.
     * - Reattachment (if supported) should be explicit and intentional.
     *
     * @returns {Job}
     *     Returns `this` for fluent chaining.
     */
    detach() {
	this.flags.attached = false;
	this.status = JOB_STATUS.DETACHED;
	return this;
    }

    /**
     * Shutdown this job.
     *
     * Semantically indicates that the job should no longer run.
     * For v1.0 this is a thin wrapper around `detach()`, but this
     * is the correct lifecycle choke point for future teardown:
     *
     * - cancel in-flight runs
     * - stop intervals
     * - release resources
     * - emit lifecycle events
     *
     * @param {Object} [opts]
     * @param {string} [opts.reason] Optional human-readable reason
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
