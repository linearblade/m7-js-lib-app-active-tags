/**
 * IntervalController
 * ------------------
 *
 * Responsible for managing the lifecycle of interval-based pipelines
 * for ActiveTags jobs.
 *
 * This controller deliberately separates concerns:
 *
 *   - Registration:   discovering interval definitions from job schema
 *   - Enable/Disable: logical availability (may this interval ever run?)
 *   - On/Off:         runtime lifecycle (is the interval currently running?)
 *
 * Key principles:
 *
 * 1) Registration does NOT start intervals.
 *    Calling `register()` or `registerAll()` only populates the internal
 *    registry. No timers are created and no pipelines are executed.
 *
 * 2) Enabled ≠ On.
 *    An interval may be enabled (allowed to run) but still off.
 *    Intervals only begin executing when explicitly turned on via `on()`.
 *
 * 3) Disabled intervals will never run.
 *    Calling `on(job)` will skip any interval that is disabled.
 *
 * 4) Disabling implies off.
 *    Calling `disable()` will stop (cancel) any running interval and
 *    mark it as disabled in the registry.
 *
 * 5) Removing implies off + unregister.
 *    Calling `remove(job)` will first stop all running intervals for
 *    that job, then remove the job from the registry entirely.
 *
 * 6) Registration is idempotent.
 *    `registerAll()` may be called repeatedly (e.g. after DOM mutations).
 *    It refreshes registry state without reinstalling or restarting timers.
 *
 * Typical lifecycle:
 *
 *   register / registerAll
 *        ↓
 *   enable / disable   (logical control)
 *        ↓
 *   on / off           (runtime control)
 *
 * This controller owns orchestration only.
 * Actual timing and execution are delegated to IntervalManager and Engine.
 */


export class Controller {
    constructor({ AT, lib, toJob } = {}) {
	if (!AT) throw new Error("IntervalController requires { AT }");
	if (!AT.engine) throw new Error("IntervalController requires AT.engine");
	if (!AT.svc || !AT.svc.interval) throw new Error("IntervalController requires AT.svc.interval");
	if (!lib) throw new Error("IntervalController requires { lib }");
	if (typeof toJob !== "function") throw new Error("IntervalController requires { toJob } function");

	this.AT = AT;
	this.engine = AT.engine;
	this.intervalManager = AT.svc.interval;
	this.lib = lib;

	// resolver: normalize jobLike -> job
	this.toJob = toJob;

	// internal registry
	// jobId -> Map(intervalName -> state)
	this.registry = new Map();
	Object.freeze(this);
    }
    destroy() {
	this.off();          // cancel all intervals
	this.registry.clear();
    }
    
    registerAll() {
	const lib = this.lib;
	const AT  = this.AT;

	const jobs = AT.jobs.list();
	if (!lib.array.len(jobs)) return 0;

	let count = 0;

	for (const job of jobs) {
            if (!job) continue;

            const enabled = lib.hash.get(job, "config.schema.enable.enabled");
            if (lib.bool.no(enabled)) continue;

            // register all intervals for this job
            this.register(job);
            count++;
	}

	return count;
    }    
    
    /**
     * Register all intervals for a job.
     * Job-level operation.
     */
    register(jobLike) {
	const lib = this.lib;

	const job = this.toJob(jobLike);
	if (!job || !job.id) return 0;

	const intervals = lib.hash.get(job, "config.schema.intervals");
	if (!lib.hash.is(intervals)) return 0;

	let jobEntry = this.registry.get(job.id);
	if (!jobEntry) {
            jobEntry = new Map();
            this.registry.set(job.id, jobEntry);
	}

	let count = 0;

	for (const name in intervals) {
            const rec = lib.hash.get(intervals, name);
            if (!rec) continue;

            // keep disabled intervals too (so enable/disable can flip later)
            const enabled = !lib.bool.no(lib.hash.get(rec, "enabled"));

            // minimal structural sanity (register even if disabled, but only if structurally usable)
            const repeat = Number(lib.hash.get(rec, "repeat") || 0);
            const pipeline = lib.str.to(lib.hash.get(rec, "pipeline"), true).trim();
            if (!Number.isFinite(repeat) || repeat <= 0) continue;
            if (!pipeline) continue;

            jobEntry.set(name, {
		jobId: job.id,
		name,
		enabled,
		on: false,
		def: rec
            });

            count++;
	}

	return count;
    }
    
    /**
     * Remove all intervals for a job.
     * Job-level operation.
     * Removing implies turning them off.
     */
    remove(jobLike) {
	const job = this.toJob(jobLike);
	if (!job || !job.id) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	const count = jobEntry.size;
	
	// runtime: cancel any active intervals first
	this.off(job);
	
	this.registry.delete(job.id);

	return count;
    }
    
    listJob(jobLike) {
	const job = this.toJob(jobLike);
	if (!job || !job.id) return {};

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return {};

	const out = {};

	for (const [name, entry] of jobEntry.entries()) {
            out[name] = {
		enabled: !!entry.enabled,
		on: !!entry.on,
            };
	}

	return out;
    }
    
    listJobs(name = true) {
	const lib = this.lib;
	const out = [];

	for (const jobId of this.registry.keys()) {
            if (!name) {
		out.push(jobId);
		continue;
            }

            const job = this.toJob(jobId);

            // Prefer configured job name; fall back to id.
            const jobName =
		  (job && (job.name || lib.hash.get(job, "config.schema.name"))) ||
		  null;

            out.push(jobName || jobId);
	}

	return out;
    }    
    
    /**
     * Turn ON a specific interval for a job.
     * If jobLike is omitted, turns on all enabled intervals for all registered jobs.
     */
    on(jobLike, intervalName) {
	const lib = this.lib;

	// GLOBAL: turn on all intervals for all jobs
	if (!jobLike) {
            let count = 0;
            for (const jobId of this.registry.keys()) {
		const job = this.toJob(jobId);
		if (!job || !job.id) continue;
		count += this.on(job, intervalName);
            }
            return count;
	}

	const job = this.toJob(jobLike);
	if (!job || !job.id) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	// single interval
	if (lib.str.to(intervalName, true).trim()) {
            return this._onOne(job, intervalName);
	}

	// all intervals for job (only ones that are enabled will actually turn on)
	let count = 0;
	for (const name of jobEntry.keys()) {
            count += this._onOne(job, name);
	}

	return count;
    }
    _onOne(job, intervalName) {
	const lib = this.lib;

	if (!job || !job.id) return 0;

	intervalName = lib.str.to(intervalName, true).trim();
	if (!intervalName) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	const entry = jobEntry.get(intervalName);
	if (!entry) return 0;

	// logical gate
	if (lib.bool.no(entry.enabled)) return 0;

	// already on
	if (lib.bool.yes(entry.on)) return 0;

	const rec = entry.def || {};

	const everyMs = Number(lib.hash.get(rec, "repeat") || 0);
	const maxRuns = Number(lib.hash.get(rec, "max") || 0) || 0;

	const pipeline = lib.str.to(lib.hash.get(rec, "pipeline"), true).trim();
	if (!pipeline) return 0;

	if (!Number.isFinite(everyMs) || everyMs <= 0) return 0;

	const allowOverlap = lib.bool.yes(lib.hash.get(rec, "allowOverlap"));
	const overlapPolicy = allowOverlap ? "queue" : "coalesce";

	const onError = lib.str.to(lib.hash.get(rec, "onError"), true).trim().toLowerCase();
	const errorPolicy = (onError === "stop") ? "pause" : "continue";

	// unique, stable runtime id for IntervalManager
	const runtimeName = `at:${job.id}:${intervalName}`;

	const engine = this.engine;
	const mgr = this.intervalManager;

	mgr.register({
            name: runtimeName,
            everyMs,
            maxRuns,
            overlapPolicy,
            errorPolicy,
            fn: (ctx) => {
		const ticket = engine.enqueue(job, pipeline, {
                    inputs: {
			reason: "interval",
			intervalName,
			interval: ctx,
                    },
                    meta: {
			source: "interval",
			intervalKey: intervalName,
			intervalName: runtimeName,
                    },
		});

		// scoped drain (only this ticket)
		engine.drain({ ticket });
            },
	});

	mgr.start(runtimeName);

	// mark runtime state
	entry.on = true;
	entry.runtimeName = runtimeName;

	return 1;
    }   

    /**
     * Turn OFF a specific interval for a job.
     * If jobLike is omitted, turns off all intervals for all registered jobs.
     */
    off(jobLike, intervalName) {
	const lib = this.lib;

	// GLOBAL: turn off all intervals for all jobs
	if (!jobLike) {
            let count = 0;
            for (const jobId of this.registry.keys()) {
		const job = this.toJob(jobId);
		if (!job || !job.id) continue;
		count += this.off(job, intervalName);
            }
            return count;
	}

	const job = this.toJob(jobLike);
	if (!job || !job.id) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	// single interval
	if (lib.str.to(intervalName, true).trim()) {
            return this._offOne(job, intervalName);
	}

	// all intervals for job
	let count = 0;
	for (const name of jobEntry.keys()) {
            count += this._offOne(job, name);
	}

	return count;
    }
    
    _offOne(job, intervalName) {
	const lib = this.lib;

	if (!job || !job.id) return 0;

	intervalName = lib.str.to(intervalName, true).trim();
	if (!intervalName) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	const entry = jobEntry.get(intervalName);
	if (!entry) return 0;

	// already off
	if (lib.bool.no(entry.on)) return 0;

	// stable runtime name (prefer stored)
	const runtimeName = entry.runtimeName || `at:${job.id}:${intervalName}`;

	// runtime effect: fully cancel (since on() registers)
	this.intervalManager.cancel(runtimeName);

	// registry update
	entry.on = false;
	entry.runtimeName = null;

	return 1;
    }    
    /**
     * Enable an interval definition (logical enable).
     * If disabled, interval must be turned off.
     */
    enable(jobLike, intervalName) {
	const job = this.toJob(jobLike);
	if (!job || !job.id) return false;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return false;

	// enable ALL intervals for this job
	if (!intervalName) {
            let changed = false;
            for (const entry of jobEntry.values()) {
		if (!entry.enabled) {
                    entry.enabled = true;
                    changed = true;
		}
            }
            return changed;
	}

	// enable single interval
	const entry = jobEntry.get(intervalName);
	if (!entry) return false;

	entry.enabled = true;
	return true;
    }    
    /**
     * Disable an interval definition (logical disable).
     * Disabling implies off.
     */
    disable(jobLike, intervalName) {
	const job = this.toJob(jobLike);
	if (!job || !job.id) return false;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return false;

	// disable ALL intervals for this job
	if (!intervalName) {
            let changed = false;

            for (const [name, entry] of jobEntry.entries()) {
		// runtime: if it's on, cancel it
		if (entry.on) this._offOne(job, name);

		// logical: disable
		if (entry.enabled) {
                    entry.enabled = false;
                    changed = true;
		} else if (entry.on) {
                    // (should already be false after _offOne, but counts as change)
                    changed = true;
		}
            }

            return changed;
	}

	// disable single interval
	const entry = jobEntry.get(intervalName);
	if (!entry) return false;

	// runtime: if it's on, cancel it
	if (entry.on) this._offOne(job, intervalName);

	// logical: disable
	const wasEnabled = !!entry.enabled;
	entry.enabled = false;

	return wasEnabled || entry.on;
    }
    
}


export default Controller;
