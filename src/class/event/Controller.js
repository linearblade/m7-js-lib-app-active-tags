/**
 * EventController
 * ---------------
 *
 * Responsible for managing the lifecycle of DOM event → pipeline bindings
 * for ActiveTags jobs, using the EventDelegator service.
 *
 * Separation of concerns (same model as IntervalController):
 *   - Registration:   discover event definitions from job schema
 *   - Enable/Disable: logical availability (may this event ever fire?)
 *   - On/Off:         runtime lifecycle (is the delegated handler installed?)
 *
 * Key principles:
 * 1) Registration does NOT start events.
 *    Calling `register()` or `registerAll()` only populates the internal registry.
 *    No delegated listeners are installed until explicitly turned on via `on()`.
 *
 * 2) Enabled ≠ On.
 *    An event may be enabled but still off. It must be explicitly `on()` to bind.
 *
 * 3) Disabled events will never bind.
 *    Calling `on(job)` will skip any event that is disabled.
 *
 * 4) Disabling implies off.
 *    Calling `disable()` will uninstall any running handler and mark it disabled.
 *
 * 5) Removing implies off + unregister.
 *    Calling `remove(job)` will uninstall handlers for that job, then remove the job
 *    from the registry entirely.
 *
 * 6) Registration is idempotent.
 *    `registerAll()` can be called repeatedly (e.g. after DOM mutations). It refreshes
 *    registry state without reinstalling handlers.
 *
 * Special casing:
 * `setupEventHandler()` exists as an explicit carveout for semantic normalization
 * (e.g. hover enter/leave filtering), so _onOne remains generic and clean.
 *
 * Based on the existing events trait wiring and semantics.  [oai_citation:0‡events.js](sediment://file_00000000e28c71fab48c010af3f5bd59)
 */
//use named import, default isnt iterable and doesnt play nice.
import { SPECIAL_EVENT_HANDLERS } from './specialHandlers.js';
import { normalizeEventType } from './typeNormalizers.js';

export class Controller {
    constructor({ AT, lib, toJob, selector } = {}) {
	if (!AT) throw new Error("EventController requires { AT }");
	if (!AT.engine) throw new Error("EventController requires AT.engine");
	if (!AT.svc || !AT.svc.delegator) throw new Error("EventController requires AT.svc.delegator");
	if (!lib) throw new Error("EventController requires { lib }");
	if (typeof toJob !== "function") throw new Error("EventController requires { toJob } function");

	// REQUIRED: root delegation selector (no default)
	let selectors = lib.array.to(selector);
	selectors = lib.array.filterStrings(selectors); // trims + removes non-strings

	const rootSelector = selectors.join(", ");
	if (!rootSelector) {
	    throw new Error("EventController requires { selector } (root delegation selector)");
	}

	this.selector = rootSelector;
	
	//selector = lib.str.to(selector, true).trim();
	//if (!selector) throw new Error("EventController requires { selector } (root delegation selector)");
	//this.selector  = selector;
	
	this.AT        = AT;
	this.engine    = AT.engine;
	this.delegator = AT.svc.delegator;
	this.lib       = lib;

	// resolver: normalize jobLike -> job
	this.toJob = toJob;

	// jobId -> Map(eventName -> state)
	this.registry = new Map();

	Object.freeze(this);
    }
    destroy() {
        this.off(); // uninstall everything (runtime)
        this.registry.clear();
    }

    registerAll() {
        const lib = this.lib;
        const AT = this.AT;

        const jobs = AT.jobs.list();
        if (!lib.array.len(jobs)) return 0;

        let count = 0;

        for (const job of jobs) {
            if (!job) continue;

            const enabled = lib.hash.get(job, "config.schema.enable.enabled");
            if (lib.bool.no(enabled)) continue;

            this.register(job);
            count++;
        }

        return count;
    }

    /**
     * Register all events for a job (registry-only).
     * Job-level operation.
     */
    register(jobLike) {
        const lib = this.lib;

        const job = this.toJob(jobLike);
        if (!job || !job.id) return 0;

        const events = lib.hash.get(job, "config.schema.events");
        if (!lib.hash.is(events)) return 0;

        let jobEntry = this.registry.get(job.id);
        if (!jobEntry) {
            jobEntry = new Map();
            this.registry.set(job.id, jobEntry);
        }

        let count = 0;

        for (const name in events) {
            const rec = lib.hash.get(events, name);
            if (!rec) continue;

            // keep disabled too (so enable/disable can flip later)
            const enabled = !lib.bool.no(lib.hash.get(rec, "enabled"));

            // minimal structural sanity: must have event type + pipeline
            const eventType = lib.str.to(lib.hash.get(rec, "event"), true).trim().toLowerCase();
            const pipeline = lib.str.to(lib.hash.get(rec, "pipeline"), true).trim();
            if (!eventType || !pipeline) continue;

            jobEntry.set(name, {
                jobId: job.id,
                name,
                enabled,
                on: false,
                def: rec,

                // runtime (filled by on/off)
                runtimeTag: null,
                offFn: null,
            });

            count++;
        }

        return count;
    }

    /**
     * Remove all events for a job.
     * Removing implies turning them off.
     */
    remove(jobLike) {
        const job = this.toJob(jobLike);
        if (!job || !job.id) return 0;

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return 0;

        const count = jobEntry.size;

        // runtime: uninstall any active handlers first
        this.off(job);

        // registry: remove entire job entry
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
            out[name] = { enabled: !!entry.enabled, on: !!entry.on };
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
            const jobName =
                  (job && (job.name || lib.hash.get(job, "config.schema.name"))) ||
                  null;

            out.push(jobName || jobId);
        }

        return out;
    }

    enable(jobLike, eventName) {
        const job = this.toJob(jobLike);
        if (!job || !job.id) return false;

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return false;

        // enable ALL events for this job
        if (!eventName) {
            let changed = false;
            for (const entry of jobEntry.values()) {
                if (!entry.enabled) {
                    entry.enabled = true;
                    changed = true;
                }
            }
            return changed;
        }

        const entry = jobEntry.get(eventName);
        if (!entry) return false;

        entry.enabled = true;
        return true;
    }

    disable(jobLike, eventName) {
        const job = this.toJob(jobLike);
        if (!job || !job.id) return false;

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return false;

        // disable ALL events for this job
        if (!eventName) {
            let changed = false;

            for (const [name, entry] of jobEntry.entries()) {
                if (entry.on) this._offOne(job, name);

                if (entry.enabled) {
                    entry.enabled = false;
                    changed = true;
                }
            }

            return changed;
        }

        const entry = jobEntry.get(eventName);
        if (!entry) return false;

        if (entry.on) this._offOne(job, eventName);

        const wasEnabled = !!entry.enabled;
        entry.enabled = false;
        return wasEnabled;
    }

    /**
     * Turn ON a specific event binding for a job.
     * If eventName is omitted, installs all enabled event bindings for the job.
     */
    on(jobLike, eventName) {
	const lib = this.lib;

	// GLOBAL: turn on all events for all jobs
	if (!jobLike) {
            let count = 0;
            for (const jobId of this.registry.keys()) {
		const job = this.toJob(jobId);
		if (!job || !job.id) continue;
		count += this.on(job, eventName);
            }
            return count;
	}

	const job = this.toJob(jobLike);
	if (!job || !job.id) return 0;

	const jobEntry = this.registry.get(job.id);
	if (!jobEntry) return 0;

	// single event
	if (lib.str.to(eventName, true).trim()) {
            return this._onOne(job, eventName);
	}

	// all events for this job
	let count = 0;
	for (const name of jobEntry.keys()) {
            count += this._onOne(job, name);
	}

	return count;
    }
    _onOne(job, eventName) {
        const lib = this.lib;

        if (!job || !job.id) return 0;

        eventName = lib.str.to(eventName, true).trim();
        if (!eventName) return 0;

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return 0;

        const entry = jobEntry.get(eventName);
        if (!entry) return 0;

        // logical gate
        if (lib.bool.no(entry.enabled)) return 0;

        // already on
        if (lib.bool.yes(entry.on)) return 0;

        const rec = entry.def || {};

        let eventType = lib.str.to(lib.hash.get(rec, "event"), true).trim().toLowerCase();
	eventType = normalizeEventType(eventType);
        const pipeline = lib.str.to(lib.hash.get(rec, "pipeline"), true).trim();
        if (!eventType || !pipeline) return 0;

        const options = lib.hash.to(lib.hash.get(rec, "options"));
        const policy = lib.hash.to(lib.hash.get(rec, "policy")) || { match: "closest" };

        // TEMP (portable): anchor delegation to ActiveTags elements.
        // Later: job-scoped selectors/subselectors.
        const selector = this.selector;

        // tag enables teardown via offTag() without needing handler refs
        const runtimeTag = `at:event:${job.id}:${eventName}`;

        const handler = this.setupEventHandler({
            job,
            eventName,
            eventType,
            pipeline,
            rec,
        });

        // install delegated handler
        const offFn = this.delegator.on({
            eventType,
            selector,
            options,
            policy,
            tag: runtimeTag,
            handler,
        });

        // mark runtime state
        entry.on = true;
        entry.runtimeTag = runtimeTag;
        entry.offFn = offFn;

        return 1;
    }



    /**
     * Returns a delegator-compatible handler(e)
     * where `this` is the matched ActiveTag element.
     */
    setupEventHandler({ job, eventName, eventType, pipeline, rec } = {}) {
	const engine = this.engine;
	const AT = this.AT;
	const lib = this.lib;


	// optional sub-selector (trigger filter)
	const subSelector = lib.str.to(lib.hash.get(rec, "selector"), true).trim();

	// capture controller for helpers without touching handler `this`
	const self = this;

	return function handler(e) {
            const el = this; // matched ActiveTag element (delegator contract)
            let trigger = el; // default trigger is the ActiveTag root

            // ensure correct job ownership
            if (job.e && el !== job.e) return;

            // sub-delegation gate (applies to ALL events)
            if (subSelector) {
		const t = e && e.target;
		if (!t || !el.contains(t)) return;

		const hit = t.closest ? t.closest(subSelector) : null;
		if (!hit || !el.contains(hit)) return;

		// semantic trigger is the matched sub-element
		trigger = hit;
            }

            // ---- special-case routing (keeps main handler clean) ----
            if (self._handleSpecialEvent({ el, e, eventType, subSelector })) {
		return; // special case consumed it
            }

            // ---- normal behavior ----
            const ticket = engine.enqueue(job, pipeline, {
		inputs: {
                    reason: "event",
                    eventName,
                    event: e,
		    trigger
		},
		meta: {
                    source: "delegator",
                    eventType,
                    eventName,
                    subSelector: subSelector || null,
		},
            });

            // pass trigger through ctx for ops/runtime use
            Promise.resolve().then(() =>
		AT.engine.drain({ ticket, ctx: { } })
            );
	};
    }

    _handleSpecialEvent(ctx) {
	for (const fn of SPECIAL_EVENT_HANDLERS) {
            if (fn(ctx)) return true;
	}
	return false;
    }
    
    
    /**
     * Turn OFF a specific event binding for a job.
     * If eventName is omitted, uninstalls all bound events for the job.
     */
    off(jobLike, eventName) {
        const lib = this.lib;

        // global off(): uninstall everything currently installed
        if (!jobLike) {
            let count = 0;
            for (const jobId of this.registry.keys()) {
                const job = this.toJob(jobId);
                if (!job || !job.id) continue;
                count += this.off(job);
            }
            return count;
        }

        const job = this.toJob(jobLike);
        if (!job || !job.id) return 0;

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return 0;

        if (lib.str.to(eventName, true).trim()) {
            return this._offOne(job, eventName);
        }

        let count = 0;
        for (const name of jobEntry.keys()) {
            count += this._offOne(job, name);
        }
        return count;
    }

    _offOne(job, eventName) {
        const lib = this.lib;

        if (!job || !job.id) return 0;

        eventName = lib.str.to(eventName, true).trim();
        if (!eventName) return 0;

        const jobEntry = this.registry.get(job.id);
        if (!jobEntry) return 0;

        const entry = jobEntry.get(eventName);
        if (!entry) return 0;

        // already off
        if (lib.bool.no(entry.on)) return 0;

        // teardown using the stored unsubscribe if present; also tag-teardown for safety
        if (typeof entry.offFn === "function") entry.offFn();
        if (entry.runtimeTag) this.delegator.offTag(entry.runtimeTag);

        entry.on = false;
        entry.runtimeTag = null;
        entry.offFn = null;

        return 1;
    }
}

export default Controller;
