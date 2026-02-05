

# --- begin: ActiveTags.js ---


import applyMixins from './helpers/applyMixins.js';
//import requireLibs from './helpers/requireLibs.js';
import trait_job  from './traits/job.js';
import trait_load  from './traits/load.js';
import trait_sweep  from './traits/sweep.js';
import trait_muta  from './traits/mutationObserver.js';
//import trait_diag  from './traits/diagnostics.js';
import trait_exp   from './traits/expressions.js';
import trait_cst   from './traits/constructor.js';
import JobRegistry   from './class/job/Registry.js';
import CONSTANTS   from './constants.js';
import ExpressionResolver from './class/ExpressionResolver.js';
import Engine from './class/engine/Engine.js';
import testHooks from './class/engine/testHooks.js';

class ActiveTags {
    constructor(lib, conf = {}) {
	if (!lib) {
            throw new Error('[activeTags] constructor requires lib as first argument');
	}

	// allow helpers to assume this.lib exists
	this.lib = lib;
	
	// minimal require so we can normalize config
	lib.require.all(CONSTANTS.LIB_HASH, { mod: '[activeTags]' });

	// canonical config coercion
	conf = lib.hash.to(conf);

	lib.require.all(CONSTANTS.CORE_DEPS ,                    { mod: '[activeTags]' } );
	const svc = lib.require.service(CONSTANTS.CORE_SERVICES, { mod: '[activeTags]', returnMap: true } );
	// external managers (injected, non-owning)
	
	// now you can tie them to semantic slots safely
	this.delegator       = svc[CONSTANTS.SERVICE_DELEGATOR] || null;
	this.intervalManager = svc[CONSTANTS.SERVICE_INTERVAL] || null;
	this.logManager      = svc[CONSTANTS.SERVICE_LOG] || null;
	this.domObserver     = svc[CONSTANTS.SERVICE_OBSERVER] || null;

	this.expr = new ExpressionResolver({
	    lib: this.lib,
	    toJob: (x) => this.toJob(x),
	    logger: this.logger,
	    env: { window, document }
	});

	

	// runtime state
	this.jobCounter = 0;
	this.jobsLegacy = {};

	// workspace + scheduler
	this.ws = new lib.primitive.workspace.WorkSpace();
	this.jobs = new JobRegistry({ lib , prefix: 'at' });

	// options (delegated)
	this.opts = this.getOpts(conf);
	this.conf = this.opts;
	//this.engine = new Engine({lib,jobRegistry: this.jobs});
	console.log('jamming test hooks', testHooks);
	this.engine = new Engine({
	    lib,
	    jobRegistry: this.jobs,
	    hooks:testHooks,
	});

	const doc = lib.hash.get(lib, '_env.root.document');
	if (doc && doc.body) {
	    this.load();
	    this.startObserver();
	}
	
    }

    
    
    //cycles the jobs. if one is found with a status ready to start runs it. otherwise skips
    //at this point, the job can be set to inflight and ignored. controller will be set to job on startup, and it cna notify it on completion
    start(){ /*still undefined*/   }
    
    //employed by interval manager to periodically pickup new jobs automatically. may alternately utilize a dom observer to notice changes.
    sniffer(){
	/*
	//still undefined
	this.bootSweep() // runs on interval.
	*/
    }
}

applyMixins(ActiveTags, trait_job, trait_load, trait_sweep,  trait_muta, trait_exp,trait_cst);
export { ActiveTags };
export default ActiveTags;


# --- end: ActiveTags.js ---



# --- begin: auto.js ---

import ActiveTags from './ActiveTags.js';

const MOD = '[activeTags]';

const lib = (typeof window !== 'undefined' && window.lib) ? window.lib : null;
if (!lib) throw new Error(`${MOD} requires window.lib (browser environment).`);

if (typeof lib?.hash?.set !== 'function') {
  throw new Error(`${MOD} requires lib.hash.set (m7-lib not installed or incomplete).`);
}

// Normalize lib.site.delagator typo for older libs
if (!lib.site?.delegator && lib.site?.delagator) {
  lib.site.delegator = lib.site.delagator;
}

// Register
lib.hash.set(lib, 'site.activeTags', ActiveTags);

export { ActiveTags };
export default ActiveTags;


# --- end: auto.js ---



# --- begin: class/engine/Engine.js ---

// -----------------------------------------------------------------------------
// Engine (top-level façade)
//  - state   : owns authoritative runtime state + invariants (EngineState)
//  - tick    : owns execution/stepping (Tick)
//  - manager : owns management/policy API (EngineManager)
// -----------------------------------------------------------------------------

import EngineState from './EngineState.js';
import EngineManager from './EngineManager.js';

import { Scheduler } from './Scheduler.js';
import { PipelineRunner } from './PipelineRunner.js';
import { Tick } from './Tick.js';

export class Engine {
    constructor({ lib, jobRegistry, runner, scheduler, hooks = {}, builtins } = {}) {
	if (!lib) throw new Error("Engine requires lib");
	this.lib = lib;

	// external registry (jobLike -> job)
	this.jobRegistry = jobRegistry || null;

	// subsystems
	this.state = new EngineState({ lib });
	this.scheduler = scheduler || new Scheduler({ lib });
	this.runner = runner || new PipelineRunner({ lib, builtins });

	// hooks (optional)
	this.hooks = {
	    onEnqueue: hooks.onEnqueue || null,
	    onDequeue: hooks.onDequeue || null,
	    onStage: hooks.onStage || null,
	    onTicketDone: hooks.onTicketDone || null,
	    onComplete: hooks.onComplete || null,
	    onError: hooks.onError || null,
	};
	console.log('got hooks', this.hooks);
	// manager (policy + coordination)
	this.manager = new EngineManager({ lib, engine: this });

	// executor (stepping)
	this._tick = new Tick({ lib, engine: this });
    }

    // ---------------------------------------------------------------------------
    // Public execution façade
    // ---------------------------------------------------------------------------

    tick({ ctx = {} } = {}) {
	return this._tick.tick({ ctx });
    }

    // ---------------------------------------------------------------------------
    // Job resolution (shared helper used by manager/tick)
    // ---------------------------------------------------------------------------

    _resolveJob(jobLike) {
	const jr = this.jobRegistry;
	if (!jr || typeof jr.resolve !== "function") {
	    throw new Error("Engine requires jobRegistry.resolve(jobLike)");
	}
	return jr.resolve(jobLike);
    }

    // ---------------------------------------------------------------------------
    // Management façade (delegate to EngineManager)
    // ---------------------------------------------------------------------------

    enqueue(jobLike, key = "default", opts = undefined) {
	return this.manager.enqueue(jobLike, key, opts);
    }

    lockTicket(ticketId, lock = undefined) {
	return this.manager.lockTicket(ticketId, lock);
    }

    lock(jobLike, key = "default", lock = undefined) {
	return this.manager.lock(jobLike, key, lock);
    }

    unlockTicket(ticketId, token = undefined) {
	return this.manager.unlockTicket(ticketId, token);
    }

    unlock(jobLike, key = "default", token = undefined) {
	return this.manager.unlock(jobLike, key, token);
    }

    cancel(jobLike, key = "default") {
	return this.manager.cancel(jobLike, key);
    }

    cancelTicket(ticketId) {
	return this.manager.cancelTicket(ticketId);
    }
}

export default Engine;


# --- end: class/engine/Engine.js ---



# --- begin: class/engine/EngineManager.js ---

// -----------------------------------------------------------------------------
// EngineManager (management arm)
// - Owns policy + coordination (enqueue/cancel/lock/unlock)
// - Does NOT own state maps (engine.state owns jobs/tickets/alias)
// - Does NOT own execution (Tick owns stepping)
// -----------------------------------------------------------------------------

import helpers from './helpers.js';

export class EngineManager {
    constructor({ lib, engine } = {}) {
	this.lib = lib || null;
	this.engine = engine;
	if (!this.engine) throw new Error("EngineManager requires { engine }");
    }

    // ---------------------------------------------------------------------------
    // Resolution helpers (delegates to engine)
    // ---------------------------------------------------------------------------

    _resolveJob(jobLike) {
	return this.engine._resolveJob(jobLike);
    }

    _resolveTicketId(jobLike, key = "default") {
	const job = this._resolveJob(jobLike);
	if (!job || !job.id) return null;
	const pipelineKey = String(key || "default");
	return this.engine.state.aliasGet(job.id, pipelineKey);
    }

    // ---------------------------------------------------------------------------
    // Management API (mirrors prior Engine methods)
    // ---------------------------------------------------------------------------

    /**
     * Enqueue a ticket for (job + pipelineKey), deduping by alias.
     * Returns the existing ticket if already enqueued for that alias.
     */
    enqueue(jobLike, key = "default", { inputs, priority = 0, meta = {} } = {}) {
	const job = this._resolveJob(jobLike);
	if (!job || !job.id) throw new Error("EngineManager.enqueue requires a resolved job with id");

	const jobId = job.id;
	const pipelineKey = String(key || "default");

	const st = this.engine.state.jobState(jobId);

	// Dedupe via alias: (jobId + pipelineKey) -> ticketId
	const existingId = st.alias.get(pipelineKey);
	if (existingId) {
	    const existing = this.engine.state.getTicket(existingId);
	    if (existing) return existing;
	    st.alias.delete(pipelineKey); // stale alias
	}

	const ticket = helpers.makeRunTicket({ jobId, pipelineKey, inputs, priority, meta });

	this.engine.state.indexTicket(jobId, ticket);
	this.engine.state.aliasSet(jobId, pipelineKey, ticket.id);

	st.queue.push(ticket);

	// Mark runnable if not currently running and not locked
	if (!st.active && !this.engine.state.isLockedJobId(jobId)) {
	    this.engine.scheduler.markRunnable(jobId);
	}

	if (this.engine.hooks.onEnqueue) this.engine.hooks.onEnqueue({ job, ticket });
	return ticket;
    }

    // --- locking (tickets are the unique runner)

    lockTicket(ticketId, lock) {
	const rec = this.engine.state.getTicketRec(ticketId);
	if (!rec) return 0;

	rec.ticket.lock = lock || { type: "ticket", token: `ltk_${Date.now()}` };
	return 1;
    }

    lock(jobLike, key = "default", lock) {
	const ticketId = this._resolveTicketId(jobLike, key);
	if (!ticketId) return 0;

	return this.lockTicket(ticketId, lock || { type: "jobKey", token: `ljk_${Date.now()}` });
    }

    unlockTicket(ticketId, token) {
	const rec = this.engine.state.getTicketRec(ticketId);
	if (!rec) return 0;

	const t = rec.ticket;
	if (!t.lock) return 1;

	// token optional; if provided, must match
	if (token && t.lock.token && token !== t.lock.token) return 0;

	t.lock = null;

	// if this job has work, allow scheduler to pick it up again
	const st = this.engine.state.jobs.get(rec.jobId);
	if (st && (st.active || st.queue.length)) this.engine.scheduler.markRunnable(rec.jobId);

	return 1;
    }

    unlock(jobLike, key = "default", token) {
	const ticketId = this._resolveTicketId(jobLike, key);
	if (!ticketId) return 0;

	return this.unlockTicket(ticketId, token);
    }

    // --- cancel

    cancel(jobLike, key = "default") {
	const ticketId = this._resolveTicketId(jobLike, key);
	if (!ticketId) return 0;

	return this.cancelTicket(ticketId);
    }

    cancelTicket(ticketId) {
	const rec = this.engine.state.getTicketRec(ticketId);
	if (!rec) return 0;

	const { jobId, ticket } = rec;
	const st = this.engine.state.jobs.get(jobId);

	// Always clear global ticket index
	this.engine.state.deleteTicket(ticketId);

	if (!st) return 1;

	// Active
	if (st.active && st.active.id === ticketId) {
	    if (st.active.pipelineKey) {
		this.engine.state.aliasDeleteIfPointsTo(jobId, st.active.pipelineKey, ticketId);
	    }

	    st.active.state = "error";
	    st.active = null;

	    if (st.queue.length && !this.engine.state.isLockedJobId(jobId)) {
		this.engine.scheduler.markRunnable(jobId);
	    }
	    return 1;
	}

	// Queued
	const before = st.queue.length;
	st.queue = st.queue.filter(x => x.id !== ticketId);

	if (st.queue.length !== before) {
	    if (ticket && ticket.pipelineKey) {
		this.engine.state.aliasDeleteIfPointsTo(jobId, ticket.pipelineKey, ticketId);
	    }
	    return 1;
	}

	// If it wasn't in active/queue, index was stale; alias cleanup if possible
	if (ticket && ticket.pipelineKey) {
	    this.engine.state.aliasDeleteIfPointsTo(jobId, ticket.pipelineKey, ticketId);
	}
	return 1;
    }
}

export default EngineManager;


# --- end: class/engine/EngineManager.js ---



# --- begin: class/engine/EngineState.js ---

// -----------------------------------------------------------------------------
// EngineState (authoritative runtime state: jobs, tickets, alias, lock helpers)
// -----------------------------------------------------------------------------
export class EngineState {
  constructor({ lib } = {}) {
    this.lib = lib || null;

    // jobId -> { queue[], active, stats, alias: Map<pipelineKey,ticketId> }
    this.jobs = new Map();

    // ticketId -> { jobId, ticket }
    this.tickets = new Map();
  }

  // --- core job state record

  jobState(jobId) {
    let st = this.jobs.get(jobId);
    if (!st) {
      st = {
        queue: [],
        active: null,
        stats: { runs: 0, errors: 0, lastRunAt: 0 },
        alias: new Map(),
      };
      this.jobs.set(jobId, st);
    }
    return st;
  }

  // --- ticket index

  getTicketRec(ticketId) {
    return this.tickets.get(ticketId) || null;
  }

  getTicket(ticketId) {
    const rec = this.tickets.get(ticketId);
    return rec ? rec.ticket : null;
  }

  indexTicket(jobId, ticket) {
    this.tickets.set(ticket.id, { jobId, ticket });
    return ticket;
  }

  deleteTicket(ticketId) {
    this.tickets.delete(ticketId);
  }

  // --- alias helpers

  aliasGet(jobId, pipelineKey) {
    const st = this.jobs.get(jobId);
    if (!st) return null;
    return st.alias.get(pipelineKey) || null;
  }

  aliasSet(jobId, pipelineKey, ticketId) {
    const st = this.jobState(jobId);
    st.alias.set(pipelineKey, ticketId);
  }

  aliasDeleteIfPointsTo(jobId, pipelineKey, ticketId) {
    const st = this.jobs.get(jobId);
    if (!st) return;
    if (st.alias.get(pipelineKey) === ticketId) st.alias.delete(pipelineKey);
  }

  // --- lock helpers

  isExpired(lock) {
    return !!(lock && lock.until && Date.now() > lock.until);
  }

  /**
   * Checks whether a job is blocked from running, based solely on ACTIVE ticket lock.
   * Tickets are the unique runners.
   */
  isLockedJobId(jobId) {
    const st = this.jobs.get(jobId);
    if (!st || !st.active) return false;

    const t = st.active;
    if (!t.lock) return false;

    if (this.isExpired(t.lock)) {
      t.lock = null;
      return false;
    }

    return true;
  }
}

export default EngineState;


# --- end: class/engine/EngineState.js ---



# --- begin: class/engine/helpers.js ---

// -----------------------------------------------------------------------------
// StageResult helpers
// -----------------------------------------------------------------------------

export const STAGE_STATUS = Object.freeze({
    OK: "ok",
    WAIT: "wait",
    ERROR: "error",
    COMPLETE: "complete",
});


export function SR_ok(detail) {
    return { status: STAGE_STATUS.OK, detail };
}
export function SR_wait(awaitInfo, detail) {
    return { status: STAGE_STATUS.WAIT, await: awaitInfo || null, detail };
}
export function SR_error(error, detail) {
    return { status: STAGE_STATUS.ERROR, error: error || new Error("Stage error"), detail };
}
export function SR_complete(detail) {
    return { status: STAGE_STATUS.COMPLETE, detail };
}

// -----------------------------------------------------------------------------
// RunTicket (one execution request for a job)
// -----------------------------------------------------------------------------

let _ticketCounter = 0;

export function makeRunTicket({ jobId, stackPlan, inputs, priority = 0, meta = {} } = {}) {
    return {
	id: `rt_${++_ticketCounter}`,
	jobId,
	createdAt: Date.now(),
	priority,

	// what to run
	stackPlan: Array.isArray(stackPlan) ? stackPlan.slice() : ["main"],

	// cursor: where we are in stackPlan and within the current pipeline
	cursor: { stack: 0, stage: 0 },

	// always-mutable run inputs
	inputs: inputs || {},

	// runtime state
	state: "ready", // ready|running|wait|error|complete
	last: null,
	await: null,

	meta: meta || {},
    };
}


export default {
    STAGE_STATUS,
    SR_ok,
    SR_wait,
    SR_error,
    SR_complete,
    makeRunTicket,
};


# --- end: class/engine/helpers.js ---



# --- begin: class/engine/PipelineRunner.js ---

// -----------------------------------------------------------------------------
// PipelineRunner (deterministic stepping of a single ticket) — v1 (pipelineKey)
// -----------------------------------------------------------------------------
import helpers from './helpers.js';
export class PipelineRunner {
    constructor({ lib, builtins } = {}) {
	if(!lib)   throw new Error("PASS lib :) ");
	this.lib = lib ;
	this.builtins = builtins || {}; //this is unnecessary but the AI bitches when I lint, b/c it seems to have trouble reading my libs.
    }

    /**
     * Resolve the pipeline definition by key from the job.
     *
     * Supported shapes (v1 target):
     *   job.pipelines = { default:{run:[...], onError:[...]}, initial:{...} }
     *
     * Back-compat (legacy-ish / transitional):
     *   job.pipeline = { run:[...] }  -> treated as default
     *   job.pipelineDefs = { main:[...] } -> treated as { run:[...]} arrays
     */
    _getPipelineDef(job, pipelineKey) {
	if (!job) return null;
	const lib = this.lib;
	const key = String(pipelineKey || "default");

	const pipeRef =  lib.hash.get(job, `config.schema.pipelines.${key}`,null);
	//consider nomralizing if not already done.
	return pipeRef;
    }

    _opLabel(op) {
    // Prefer stable human-readable labels for logs/hooks.
    if (typeof op === "string") return op;

    if (typeof op === "function") {
        return op.name && op.name.length ? op.name : "(anonymous fn)";
    }

    if (op && typeof op === "object") {
        // Constructor name if meaningful
        const ctor = op.constructor && op.constructor.name;
        if (ctor && ctor !== "Object") return ctor;
        // Fallback
        return "(object op)";
    }

    if (op === null) return "(null op)";
    return `(${typeof op} op)`;
}
    
    //all this is doing is extracting the relevent phase from the pipeline rec.
    _getSteps(pipelineDef, phase) {
	if (!pipelineDef) return null;

	const lib = this.lib;
	const allowed = lib.utils.clamp(["run", "onError"], phase, null);
	if (!allowed) return null;

	// `allowed` is "run" or "onError"
	return lib.hash.get(pipelineDef, allowed, null);
    }
    //leaving this 'raw', b/c I havent decided if I will make tickets an class entity rather than a raw hash.
    _ensureTicketRuntime(ticket) {
	// Minimal runtime fields for the runner.
	if (!ticket.cursor || typeof ticket.cursor !== "object") ticket.cursor = {};
	if (typeof ticket.cursor.stage !== "number") ticket.cursor.stage = 0;

	// phase: "run" or "onError"
	if (!ticket.phase) ticket.phase = "run";

	// keep original error when transitioning into onError
	if (!ticket.errorInfo) ticket.errorInfo = null;
    }

    //back up groom in case we didnt properly groom it in normalization of records during ingestion.
    _resolveStage(step) {
	// step can be:
	// - "request.submit"
	// - { op:"request.submit", ... }
	let rec = this.lib.hash.to(step, "op");
	return { op: rec.op || null, args: rec.args || null, raw: step };
    }
    _getFn(fn){
	const builtin = this.lib.hash.get(this.builtins,fn,null);
	if(builtin) return builtin;
	return this.lib.func.get(fn);
    }

    _validateStep({ job, ticket }) {
	const pipelineKey = String(ticket.pipelineKey || "default");

	const pipelineDef = this._getPipelineDef(job, pipelineKey);
	if (!pipelineDef) {
	    return {
		err: helpers.SR_error(new Error(`Missing pipeline '${pipelineKey}'`), { pipelineKey }),
		pipelineKey,
	    };
	}

	const steps = this._getSteps(pipelineDef, ticket.phase);
	if (!steps) {
	    return {
		err: helpers.SR_error(new Error(`Invalid pipeline '${pipelineKey}' definition`), {
		    pipelineKey,
		    phase: ticket.phase,
		}),
		pipelineKey,
		pipelineDef,
	    };
	}

	const stepRec = steps[ticket.cursor.stage];
	//console.log(`stage is ${ticket.cursor.stage}`);
	// End-of-phase
	if (!stepRec) {
	    // If we've exhausted the onError track, we treat this as a *handled* completion.
	    if (ticket.phase === "onError") {
		return {
		    done: true,
		    complete: true,
		    res: helpers.SR_complete({
			pipelineKey,
			phase: "onError",
			handled: true,
			original: ticket.errorInfo || null,
		    }),
		    pipelineKey,
		    pipelineDef,
		    steps,
		};
	    }

	    // Normal run end-of-line: clean completion.
	    return {
		done: true,
		complete: true,
		res: helpers.SR_complete({
		    pipelineKey,
		    phase: ticket.phase,
		    handled: false,
		}),
		pipelineKey,
		pipelineDef,
		steps,
	    };
	}
	const { op, args } = this._resolveStage(stepRec);
	if (!op) {
	    return {
		err: helpers.SR_error(new Error("Invalid pipeline step (missing op)"), { pipelineKey, step: stepRec }),
		pipelineKey,
		pipelineDef,
		steps,
		stepRec,
	    };
	}

	const fn = this._getFn(op);
	if (!fn) {
	    return {
		err: helpers.SR_error(new Error(`Unknown op '${op}'`), { pipelineKey, op, step: stepRec }),
		pipelineKey,
		pipelineDef,
		steps,
		stepRec,
		op,
	    };
	}

	return {
	    err: null,
	    pipelineKey,
	    pipelineDef,
	    steps,
	    stepRec,
	    op,
	    args,
	    fn,
	};
    }

    normalizeReturn(res, { pipelineKey, op } = {}) {

	// Already a StageResult
	if (res && typeof res === "object" && res.status) {
	    return res;
	}

	// ---- Legacy / implied semantics ----
	// v098 rules (formalized):
	// - falsy        -> ERROR
	// - true / 1     -> OK
	// - truthy other -> WAIT

	// Falsy => ERROR
	if (!res) {
	    return helpers.SR_error(
		new Error("Stage returned falsy"),
		{ pipelineKey, op, legacy: true }
	    );
	}

	// Explicit success
	if (res === true || res === 1) {
	    return helpers.SR_ok({ pipelineKey, op, legacy: true });
	}

	// Any other truthy value => WAIT
	return helpers.SR_wait({
	    pipelineKey,
	    op,
	    legacy: true,
	    value: res
	});
    }


    _responseOk({ ticket, res }) {
	ticket.cursor.stage += 1;
	return res;
    }
    
    _responseWait({ res }) {
	return res;
    }

    _responseComplete({ v }) {
	return helpers.SR_complete({ pipelineKey: v.pipelineKey, op: v.op, early: true });
    }
    _responseError({ ticket, v, res }) {
    // If the error handler itself fails (we are already in onError),
    // do NOT re-enter onError. Surface handler failure and preserve original.
    if (ticket.phase === "onError") {
        const detail = Object.assign({}, res?.detail || {});
        if (!detail.original) detail.original = ticket.errorInfo || null;
        detail.onErrorFailed = true;
        detail.onErrorOp = v?.op;
        detail.onErrorStep = v?.stepRec;
        return helpers.SR_error(res?.error, detail);
    }

    const hasOnError = Array.isArray(v.pipelineDef.onError) && v.pipelineDef.onError.length > 0;
    if (hasOnError) {
        const from = {
            pipelineKey: v.pipelineKey,
            phase: ticket.phase,
            stageIndex: ticket.cursor?.stage ?? 0,
            op: v.op,
            opLabel: this._opLabel ? this._opLabel(v.op) : (typeof v.op === "string" ? v.op : "(op)"),
            step: v.stepRec,
        };

        ticket.errorInfo = {
            error: res.error || new Error("Stage error"),
            detail: res.detail || null,
            ...from,
        };

        ticket.phase = "onError";
        ticket.cursor.stage = 0;

        return helpers.SR_ok({
            pipelineKey: v.pipelineKey,
            reason: "enter onError",
            from,
            original: ticket.errorInfo || null,
        });
    }

    return res;
}
    ddd_responseError({ ticket, v, res }) {
	//if (ticket.phase === "onError") return res;
	// If the error handler itself fails, do NOT lose the original triggering error.
	// Keep ticket.errorInfo as the original root cause, but attach it to the emitted result.

	const hasOnError = Array.isArray(v.pipelineDef.onError) && v.pipelineDef.onError.length > 0;
	if (hasOnError) {
	    // Snapshot the failing stage identity BEFORE mutating the ticket.
	    const from = {
		pipelineKey: v.pipelineKey,
		phase: ticket.phase,                         // should be "run" here
		stageIndex: ticket.cursor?.stage ?? 0,
		op: v.op,
		opLabel: this._opLabel ? this._opLabel(v.op) : (typeof v.op === "string" ? v.op : "(op)"),
		step: v.stepRec,
	    };

	    // Preserve the original error (root cause) including where it happened.
	    ticket.errorInfo = {
		error: res.error || new Error("Stage error"),
		detail: res.detail || null,
		...from,
	    };

	    // Transition to error track
	    ticket.phase = "onError";
	    ticket.cursor.stage = 0;

	    // Return OK to continue ticking, but include transition + source failure info
	    return helpers.SR_ok({
		pipelineKey: v.pipelineKey,
		reason: "enter onError",
		from,                               // <-- failing stage identity
		original: ticket.errorInfo || null, // <-- full root cause snapshot
	    });
	}
	
	if (ticket.phase === "onError") {
	    const detail = Object.assign({}, res?.detail || {});
	    if (!detail.original) detail.original = ticket.errorInfo || null;
	    detail.onErrorFailed = true;
	    detail.onErrorOp = v?.op;
	    detail.onErrorStep = v?.stepRec;

	    // Return a new SR_error so downstream sees the handler error + the original cause.
	    return helpers.SR_error(res?.error, detail);
	}

	return res;
    }
    _responseUnknown({ v, res }) {
	return helpers.SR_error(new Error(`Unknown stage status '${res?.status}'`), {
	    pipelineKey: v?.pipelineKey,
	    op: v?.op,
	});
    }
    

    /**
     * Run exactly ONE stage step for this ticket.
     * Returns StageResult-like: status ok|wait|error|complete
     */
    async step({ job, ticket, ctx }) {
	this._ensureTicketRuntime(ticket);

	const v = this._validateStep({ job, ticket });

	const tagNoStage = (sr) => {
	    if (!sr || typeof sr !== "object") return sr;
	    if (!sr.detail || typeof sr.detail !== "object") sr.detail = {};
	    sr.detail.noStage = true;
	    return sr;
	};

	if (v.err) return tagNoStage(v.err);
	if (v.done) return tagNoStage(v.res || v.err);

	//$CLEANING Snapshot stage identity BEFORE execution/handlers mutate ticket (e.g., run -> onError).
	const exec = {
	    phase: ticket.phase,                 // "run" | "onError"
	    stageIndex: ticket.cursor?.stage ?? 0,
	    pipelineKey: v.pipelineKey,
	    op: v.op,                            // may be string, function, etc
	    opLabel: this._opLabel(v.op),
	    step: v.stepRec,                     // raw step record (string/object)
	};
	//END $CLEANING
	
	let res;
	try {
	    res = await v.fn({
		job,
		ticket,
		inputs: ticket.inputs,
		ctx,
		step: v.args || v.stepRec,
	    });
	} catch (err) {
	    res = helpers.SR_error(err, { pipelineKey: v.pipelineKey, op: v.op, step: v.stepRec });
	}

	
	res = this.normalizeReturn(res, { pipelineKey: v.pipelineKey, op: v.op });
	const return_status = res.status;
	// $CLEANING Stamp stable stage identity into the result for hooks/logging.
	if (!res.detail || typeof res.detail !== "object") res.detail = {};
	res.detail.phase = exec.phase;
	res.detail.stageIndex = exec.stageIndex;
	res.detail.pipelineKey = exec.pipelineKey;

	// Preserve the original op value AND a label.
	res.detail.op = exec.op;               // raw
	res.detail.opLabel = exec.opLabel;     // safe string label
	// Keep the raw step too (super useful for debugging DSL strings)
	res.detail.step = exec.step;
	// END CLEANING

	const env = { job, ticket, ctx, v, res }; // <-- EVERYTHING

	const disp = {
	    [helpers.STAGE_STATUS.OK]: this._responseOk,
	    [helpers.STAGE_STATUS.WAIT]: this._responseWait,
	    [helpers.STAGE_STATUS.ERROR]: this._responseError,
	    [helpers.STAGE_STATUS.COMPLETE]: this._responseComplete,
	};

	const handler = disp[res.status] || this._responseUnknown;
	const rv =  handler.call(this, env);
	rv.return_status = return_status;
	return rv;
    }
}


/**
{
  // identity
  jobId,
  ticketId,
  pipelineKey,

  // execution context (if a stage was involved)
  stage: {
    phase,        // "run" | "onError"
    stageIndex,   // number | null
    op,           // raw op (string | fn | object | null)
    opLabel,      // string (always safe)
    step,         // raw step record (debug)
  } | null,

  // result of the step / transition
  result: {
    status,       // "ok" | "wait" | "error" | "complete"
    detail,       // StageResult.detail (augmented)
    error,        // Error | null
  },

  // terminal summary (ONLY when terminal === true)
  summary: {
    state,        // "complete" | "error"
    handled,      // boolean
    phase,        // terminal phase
    originalError,// snapshot | null
  } | null,

  // control flags
  didWork,        // boolean (engine did something)
  terminal,       // boolean (ticket ended)
}
 */


# --- end: class/engine/PipelineRunner.js ---



# --- begin: class/engine/Scheduler.js ---

/*
 * ActiveTags v1 — Engine Skeleton (Job-first, Pipeline-second)
 * -----------------------------------------------------------
 * This is a minimal, testable engine core that:
 *  - Orders work by JOB first (fairness + locking)
 *  - Runs PIPELINES second (deterministic stage stepping)
 *
 * Notes:
 *  - No DOM observer / delegator wiring here.
 *  - No transport implementation here (stages may return WAIT with await tokens).
 *  - Designed to plug into compiled Job artifacts:
 *      job.pipelineDefs / job.stackDefs (your compiler will own those)
 *
 * Usage sketch:
 *   const engine = new Engine({ lib, jobRegistry: at.jobs, stageRegistry });
 *   engine.enqueue(job, { stackPlan:["main"], inputs:{ event, vars } });
 *   engine.drain({ maxSteps: 1000 });
 */


// -----------------------------------------------------------------------------
// Scheduler (fairness: which job runs next)
// -----------------------------------------------------------------------------

export class Scheduler {
  constructor({ lib } = {}) {
    this.lib = lib || null;
    this._ready = [];      // FIFO queue of jobIds
    this._present = new Set(); // prevent duplicates in _ready
  }

  markRunnable(jobId) {
    if (!jobId) return;
    if (this._present.has(jobId)) return;
    this._present.add(jobId);
    this._ready.push(jobId);
  }

  nextRunnable() {
    while (this._ready.length) {
      const jobId = this._ready.shift();
      this._present.delete(jobId);
      if (jobId) return jobId;
    }
    return null;
  }

  clear(jobId) {
    // cheap clear: let it drain naturally; remove presence so it can be re-enqueued
    if (jobId) this._present.delete(jobId);
  }
}





# --- end: class/engine/Scheduler.js ---



# --- begin: class/engine/testHooks.js ---

//hooks for testing. Use these for hooking in other sub systems or error tracing. 
export const hooks = {
    /**
     * Fires after enqueue (useful to confirm ticket creation).
     */
    onEnqueue: ({ job, ticket }) => {
	console.log("[AT][enqueue]", {
	    jobId: job?.id,
	    ticketId: ticket?.id,
	    pipelineKey: ticket?.pipelineKey,
	    phase: ticket?.phase,
	});
    },

    /**
     * Fires for every executed stage (only when a stage actually ran).
     * Great for verifying ordering: foo -> bar -> ...
     */
    onStage: (t) => {
	console.log("[AT][stage]", {
	    jobId: t.jobId,
	    ticketId: t.ticketId,
	    phase: t.stage?.phase,
	    pipelineKey: t.pipelineKey,
	    op: t.stage?.opLabel ?? t.stage?.op,
	    stageIndex: t.stage?.stageIndex,
	    status: t.res?.status,
	    reason: t.res?.detail?.reason ?? t.reason ?? null,
	});
    },

    /**
     * Terminal success only.
     * NOTE: This only fires if you added Engine.hooks.onComplete + Tick wiring.
     */
    onComplete: ({ job, ticket, summary }) => {
	console.log("[AT][complete]", {
	    jobId: job?.id,
	    ticketId: ticket?.id,
	    handled: !!summary?.handled,
	    phase: summary?.phase,
	    pipelineKey: summary?.pipelineKey,
	    originalError: summary?.originalError || null,
	});
    },

    /**
     * Terminal error only.
     */
    donError: ({ job, ticket, error, res }) => {
	console.error("[AT][error]", {
	    jobId: job?.id,
	    ticketId: ticket?.id,
	    phase: ticket?.phase,
	    pipelineKey: res?.detail?.pipelineKey || ticket?.pipelineKey || "default",
	    op: res?.detail?.op,
	    error,
	    detail: res?.detail,
	    original: ticket?.errorInfo || null,
	});
    },
    onError: ({ job, ticket, summary }) => {
	console.error("[AT][error]", {
	    jobId: job?.id,
	    ticketId: ticket?.id,
	    phase: summary?.phase,                 // "run" or "onError"
	    pipelineKey: summary?.pipelineKey,
	    error: summary?.error,
	    originalError: summary?.originalError || null,
	    // If onError failed, summary.error is the handler error,
	    // and summary.originalError carries the root cause.
	});
    },

    /**
     * ALWAYS fires once per ticket finalization (this is your "done" / "finally").
     * This is the hook to guarantee cleanup/logging is never missed.
     */
    onTicketDone: ({ job, ticket, summary }) => {
	// "done" == bird cooked: we are terminal now.
	const done = summary?.state === "complete" || summary?.state === "error";

	console.log("[AT][done]", {
	    done,
	    state: summary?.state,         // "complete" | "error"
	    handled: !!summary?.handled,   // true only when recovered via onError
	    phase: summary?.phase,
	    pipelineKey: summary?.pipelineKey,
	    jobId: job?.id,
	    ticketId: ticket?.id,
	});

	// Example cleanup place:
	// - release external locks
	// - clear UI busy indicators
	// - finalize logs/metrics
    },
};

export default hooks;


# --- end: class/engine/testHooks.js ---



# --- begin: class/engine/Tick.js ---

import helpers from './helpers.js';
import TickResponse from './TickResponse.js';

export class Tick {
    constructor({ lib, engine }) {
        this.lib = lib;
        this.engine = engine;
	this.response = new TickResponse({lib});
    }
    
    /**
     * Advance the engine by ONE stage step globally.
     * Picks the next runnable job from the scheduler, advances that job's ACTIVE ticket by one step.
     *
     * Returns a small trace object for debugging/tests.
     */
    async tick({ ctx = {} } = {}) {
        const v = this._validateTick({ ctx });
        if (v.done) return v.res;

        const finalize = this._makeFinalize(v);

        let res;
        try {
            res = await this.engine.runner.step({ job: v.job, ticket: v.ticket, ctx: v.ctx });
        } catch (err) {
	    res = helpers.SR_error(err, { pipelineKey: v.ticket?.pipelineKey || null });
            //res = { status: helpers.STAGE_STATUS.ERROR, error: err };
        }

	v.ticket.last = { at: Date.now(), res };
	// build a non-terminal trace for stage events (even if it's a transition OK)
	this._emitOnStage({v,res});
        const env = { ...v, res, finalize };

        const disp = {
            [helpers.STAGE_STATUS.OK]: this._responseOk,
            [helpers.STAGE_STATUS.WAIT]: this._responseWait,
            [helpers.STAGE_STATUS.ERROR]: this._responseError,
            [helpers.STAGE_STATUS.COMPLETE]: this._responseComplete,
        };

        const handler = disp[res?.status] || this._responseUnknown;
        return handler.call(this, env);
    }

    _emitHook(name, trace) {
	const fn = this.engine?.hooks?.[name];
	if (typeof fn === "function") fn(trace);
    }
    
    _emitOnStage({v,res}){
	const stageTrace = this.response._makeTickTrace({
	    jobId: v.jobId,
	    job: v.job,
	    ticket: v.ticket,
	    res,
	    summary: null,
	    flags: {
		didWork: true,
		ok: res?.status === helpers.STAGE_STATUS.OK,
		waiting: res?.status === helpers.STAGE_STATUS.WAIT,
		error: res?.status === helpers.STAGE_STATUS.ERROR,
		complete: res?.status === helpers.STAGE_STATUS.COMPLETE,
	    }
	});

	this._emitHook("onStage", stageTrace);

    }
    
    _makeFinalize(env) {
        const { jobId, st, ticket } = env;

        return (finalState) => {
            ticket.state = finalState;
            // drop active
            st.active = null;

            // clear ticket index
            this.engine.state.deleteTicket(ticket.id);

            // clear alias mapping for this pipelineKey IF it points to this ticket
            if (ticket.pipelineKey) {
                this.engine.state.aliasDeleteIfPointsTo(jobId, ticket.pipelineKey, ticket.id);
            }

            st.stats.lastRunAt = Date.now();

            // if more queued work exists, keep job runnable
            if (st.queue.length && !this.engine.state.isLockedJobId(jobId)) {
                this.engine.scheduler.markRunnable(jobId);
            }
        };
    }

    _validateTick({ ctx = {} } = {}) {
        const jobId = this.engine.scheduler.nextRunnable();
        if (!jobId)
	    return { done: true, res: this.response._makeTickTrace({ flags: { didWork: false, reason: "noRunnable" } }) };
	
	//return { done: true, res: { didWork: false } };

        // If active ticket is locked, do not run this job now
        if (this.engine.state.isLockedJobId(jobId)) {
	    return { done: true, res: this.response._makeTickTrace({ jobId, flags: { didWork: false, locked: true, reason: "jobLocked" } }) };
            //return { done: true, res: { didWork: false, jobId, locked: true } };
        }

        // Resolve job (jobId is the stringified identity)
        let job = null;
        try {
            job = this.engine._resolveJob(jobId);
        } catch (e1) {
            // optional fallback: some registries might want {id}
            try {
                job = this.engine._resolveJob({ id: jobId });
            } catch (e2) {
                job = null;
            }
        }

        if (!job || !job.id) {
	    return { done: true, res: this.response._makeTickTrace({ jobId, flags: { didWork: false, missingJob: true, reason: "missingJob" } }) };
            //return { done: true, res: { didWork: false, jobId, missingJob: true } };
        }

        const st = this.engine.state.jobState(jobId);

	// Ensure there is an active ticket (one active per job)
	if (!st.active) {
	    st.active = st.queue.shift() || null;

	    if (st.active) {
		// Ticket just transitioned from queue to active
		const t = this.response._makeTickTrace({
		    jobId,
		    job,
		    ticket: st.active,
		    flags: { didWork: false, reason: "dequeue" }
		});
		this._emitHook("onDequeue", t);
	    }
	}
        const ticket = st.active;
        if (!ticket) {
	    return { done: true, res: this.response._makeTickTrace({ jobId, job, flags: { didWork: false, empty: true, reason: "empty" } }) };
            //return { done: true, res: { didWork: false, jobId, empty: true } };
        }

        // If ticket is locked, do not run
        if (ticket.lock) {
            if (this.engine.state.isExpired(ticket.lock)) ticket.lock = null;
            else return { done: true, res: this.response._makeTickTrace({ jobId, job, ticket, flags: { didWork: false, locked: true, reason: "ticketLocked" } }) };
	    //return { done: true, res: { didWork: false, jobId, ticketId: ticket.id, locked: true } };
        }

        ticket.state = "running";
	// no need to tick trace b/c done = false means we continue. done = true means. 'were done'
        return { done: false, jobId, job, st, ticket, ctx };
    }


    _responseOk(env) {
	const { jobId, job, ticket, res } = env;
	this.engine.scheduler.markRunnable(jobId);

	return this.response._makeTickTrace({
            jobId, job, ticket, res,
            flags: { didWork: true, ok: true }
	});
    }

    _responseWait(env) {
	const { jobId, job, ticket, res } = env;
	ticket.state = "wait";
	ticket.lock = res.lock || res.await || { type: "wait", token: `aw_${Date.now()}` };

	return this.response._makeTickTrace({
            jobId, job, ticket, res,
            flags: { didWork: true, waiting: true }
	});
    }

    _responseError(env) {
	const { jobId, job, ticket, res, st, finalize } = env;
	st.stats.errors += 1;
	finalize("error");

	const summary = this.response._makeTerminalSummary({ job, ticket, res, state: "error" });

	const trace = this.response._makeTickTrace({
            jobId, job, ticket, res, summary,
            flags: { didWork: true, terminal: true, error: true }
	});

	// uniform terminal hooks (same payload)
	this._emitHook("onError", trace);
	this._emitHook("onTicketDone", trace);

	return trace;
    }

    _responseComplete(env) {
	const { jobId, job, ticket, res, st, finalize } = env;

	st.stats.runs += 1;
	finalize("complete");

	const summary = this.response._makeTerminalSummary({ job, ticket, res, state: "complete" });

	const trace = this.response._makeTickTrace({
            jobId, job, ticket, res, summary,
            flags: { didWork: true, terminal: true, complete: true }
	});

	// uniform terminal hooks (same payload)
	this._emitHook("onComplete", trace);
	this._emitHook("onTicketDone", trace);

	return trace;
    }

    _responseUnknown(env) {
	const { jobId, job, ticket, res, st, finalize } = env;

	const err = new Error(`Unknown stage status '${res?.status}'`);
	const sr = helpers.SR_error(err, {
            pipelineKey: res?.detail?.pipelineKey || ticket?.pipelineKey || null,
            phase: ticket?.phase || null,
            unknownStatus: res?.status,
            original: ticket?.errorInfo || null,
	});
	st.stats.errors += 1;
	//always hard fail on things that should exist but dont
	finalize("error");



	const summary = this.response._makeTerminalSummary({ job, ticket, res: sr, state: "error" });

	const trace = this.response._makeTickTrace({
            jobId,
            job,
            ticket,
            res: sr,
            summary,
            flags: { didWork: true, terminal: true, error: true, reason: "unknownStatus" },
	});

	// Uniform terminal hooks
	this._emitHook("onError", trace);
	this._emitHook("onTicketDone", trace);

	return trace;
    }
}

export default Tick;


# --- end: class/engine/Tick.js ---



# --- begin: class/engine/TickResponse.js ---


export class TickResponse {
    constructor({lib}) {
	this.lib = lib;
    }

    _extractStage(res, ticket) {
	const d = res?.detail || null;
	if (!d) return null;

	// Transition result "enter onError" carries `from`
	const src = d.from || d;

	return {
            phase: src.phase || ticket?.phase || null,
            stageIndex: (typeof src.stageIndex === "number") ? src.stageIndex : null,
            op: (src.op !== undefined) ? src.op : null,
            opLabel: (src.opLabel !== undefined) ? src.opLabel : null,
            step: (src.step !== undefined) ? src.step : null,
	};
    }
    
    _makeTickTrace({ jobId = null, job = null, ticket = null, res = null, summary = null, flags = null } = {}) {
	const d = res?.detail || null;

	const pipelineKey =
              d?.pipelineKey ||
              ticket?.pipelineKey ||
              summary?.pipelineKey ||
              null;

	const stage = this._extractStage(res, ticket);

	const trace = {
            // core
            didWork: !!(flags?.didWork),
            jobId: jobId || job?.id || null,
            ticketId: ticket?.id || null,
            pipelineKey,
	    
	    //the normalized return code from the function call.
	    return_status: res?.return_status || null,

            // stage + result
            stage,        // may be null
            res: res || null,      // canonical name
            result: res || null,   // back-compat alias

            // terminal
            terminal: !!(flags?.terminal),
            summary: summary || null,

            // convenience flags (uniform)
            ok: !!(flags?.ok),
            waiting: !!(flags?.waiting),
            complete: !!(flags?.complete),
            error: !!(flags?.error),

            // meta reasons (uniform)
            reason: flags?.reason || null,
            locked: !!(flags?.locked),
            missingJob: !!(flags?.missingJob),
            empty: !!(flags?.empty),
	};

	return trace;
    }


    _makeTerminalSummary({ job, ticket, res, state }) {
        const detail = (res && typeof res === "object") ? (res.detail || {}) : {};
        const phase = ticket?.phase || detail.phase || "run";
        const pipelineKey =
              ticket?.pipelineKey ||
              detail.pipelineKey ||
              null;

        const handled =
              state === "complete" &&
              (detail.handled === true || phase === "onError");

        return {
            state,                 // "complete" | "error"
            phase,                 // "run" | "onError"
            handled,               // true if recovered via onError
            pipelineKey,           // best effort
            originalError: ticket?.errorInfo || null,
            error: state === "error" ? (res?.error || null) : null,
            res,
        };
    }
    
}
export default TickResponse;


# --- end: class/engine/TickResponse.js ---



# --- begin: class/ExpressionResolver.js ---

/**
 * Expressions / Interpolation Trait
 * --------------------------------
 *
 * This trait implements Active Tags’ **expression resolution and interpolation
 * system**. It provides the machinery that allows symbolic string expressions
 * (e.g. `ws:user.id`, `ds:request.method`, `find:.title`) to be resolved into
 * live runtime values bound to a Job.
 *
 * Core responsibilities:
 * - Parse "target expressions" of the form `type:locator`
 * - Resolve those expressions against a Job’s runtime context
 *   (DOM element, dataset, workspace, request/response, etc.)
 * - Provide interpolation hooks compatible with `lib.str.interp()`
 * - Centralize all dynamic value lookup logic in one place
 *
 * What this trait does NOT do:
 * - It does NOT execute jobs or pipelines
 * - It does NOT schedule or time execution
 * - It does NOT mutate job state (except via controlled getters)
 * - It does NOT own or manage data lifecycles
 *
 * Architectural role:
 * - Serves as the symbolic “glue” between declarative markup/configuration
 *   and imperative runtime state
 * - Enables late binding: values are resolved at the moment they are needed,
 *   not when configuration is parsed
 * - Provides a single, extensible target-resolution system used by:
 *     - config interpolation (`data-config`)
 *     - request construction
 *     - response mapping
 *     - DOM binding
 *
 * Design notes:
 * - Target expressions are parsed into references first, then evaluated
 * - Evaluation is intentionally separated from parsing
 * - Custom target resolvers may be injected per call
 * - Some target types (e.g. DOM-based `eval`) are powerful and should only
 *   be used with trusted content
 *
 * This trait should remain:
 * - Pure in intent (resolution, not execution)
 * - Job-scoped (never global)
 * - Centralized (no ad-hoc expression parsing elsewhere)
 */


// -----------------------------------------------------------------------------
// DEPENDENCIES / ASSUMPTIONS (to be satisfied by host ActiveTags class)
// -----------------------------------------------------------------------------
// This trait assumes the following exist on `this`:
//
// REQUIRED:
// - this.toJob(job)              // normalize job-like inputs into a Job
// - this.warn(message, job?)     // optional warning/logger hook (used on lookup failures)
//
// EXPECTED JOB SHAPE:
// - job.e        : DOM Element bound to the job
// - job.ds       : Dataset object (from load trait)
// - job.ws       : Job workspace object
// - job.buffer   : Optional job buffer
// - job.r        : Optional request/response object
//
// OPTIONAL / LEGACY SUPPORT:
// - job may arrive wrapped in legacy `{ item, obj }` form (handled internally)
//
// ENVIRONMENT:
// - Browser DOM (document, window, Element)
//
// NOTE:
// - This trait performs expression parsing and value resolution ONLY.
// - It does NOT execute jobs, mutate state, or manage lifecycles.
// - Evaluation semantics are intentionally split between parseTarget / evalParse.
// -----------------------------------------------------------------------------
/**
this.expr = new ExpressionResolver({
  lib: this.lib,
  toJob: (x) => this.toJob(x),
  logger: this.logger,
  env: { window, document }
});
 */
import CONSTANTS from '../constants.js';
export class ExpressionResolver {


    constructor(opts = {}) {
	const lib = opts.lib;
	if (!lib) throw new Error("[ExpressionResolver] lib is required");

	this.lib = lib;
	this.toJob = opts.toJob || null;
	this.logger = opts.logger || null;

	// Prefer explicit env injection, fallback to lib._env.root
	const env = opts.env || {};

	const root = env.root || lib.hash.get(lib, "_env.root") || null;

	// Keep env around for callers that want it
	this.env = env;

	// Prefer injected window/document if provided, else derive from root
	this.window = env.window || root || null;
	this.document = env.document || (root && root.document ? root.document : null);
    }
    
    warn(msg, ctx) {
	//this should be our logging object, but for the time being we'll roll this , in the event its not yet setup properly.
	if (this.logger && typeof this.logger.warn === "function") {
	    this.logger.warn(msg, ctx);
	}
	
	//if(this.lib.utils.baseType(this.logger, "object") )
        //this.logger.warn(msg, ctx);
    }

    /**
     * Normalize job input (for debugging + uniform access).
     * If no toJob is provided, we accept {e, ds, ws} shape directly.
     */
    _asJob(job) {
	if(this.lib.utils.baseType(this.toJob, "function") )
            return this.toJob(job);
        return job;
    }


    /**
     * Build an interpolation scheme function for `lib.str.interp()`.
     *
     * This returns a resolver function that can be passed to `lib.str.interp()`
     * to replace tokens with live runtime values from the given Job context.
     *
     * The returned function accepts a single `target` expression (typically of the
     * form `type:locator`, e.g. `ws:user.id`, `ds:request.url`, `find:.title`) and:
     * - Resolves it via `parseTarget(job, target, custom)`
     * - If the resolved value is a scalar, returns it directly
     * - If the resolved value is a `{ src, prop }` reference, returns
     *   `lib.hash.get(src, prop)`
     * - Otherwise returns `undefined` (unresolvable / non-scalar)
     *
     * Compatibility note:
     * - Contains a legacy shim that accepts older "workspace wrapper" objects
     *   shaped like `{ item, obj }` and unwraps them to `job.item`.
     *
     * @param {Job|Object} job
     *        Job (or job-like) context used for resolution. The host is expected
     *        to provide `toJob()` to normalize job-like inputs.
     *
     * @param {Object} [custom={}]
     *        Optional custom resolver map keyed by target type. If present and a
     *        matching type exists, it overrides the built-in resolution behavior.
     *        (See `parseTarget()` for details.)
     *
     * @returns {(target: string) => (string|number|boolean|null|undefined)}
     *          A function compatible with `lib.str.interp()` that resolves a single
     *          interpolation token to a scalar value (or `undefined` if not resolvable).
     */



    interpScheme(job,custom={}){
	const lib = this.lib;
	//$fixup workspace to job compatibility hack
	if (lib.hash.is(job) && ('item' in job) && ('obj' in job)){
	    //console.log('legacy hack!');
	    job = job.item;
	}else job=this._asJob(job);

	let obj = this;
	//console.log('PREPARINGINTERP SCHEME',custom);
	return function(target){
	    let info = obj.parseTarget(job,target,custom);
	    //console.log('INSIDE SCHEME',info,lib.hash.is(info));
	    //$$fixup
	    //console.log(info);
	    if(lib.utils.isScalar(info))return info;
	    return (lib.hash.is(info) && info.src && info.prop)?
		lib.hash.get(info.src, info.prop):
		undefined;
	}
    }
    
    

    /**
     * Parse a target expression into a resolvable reference or value.
     *
     * `parseTarget` is the core expression-resolution function. It takes a symbolic
     * target string (typically of the form `type:locator`) and resolves it against
     * a Job’s runtime context.
     *
     * The result of this function is intentionally *not always a final value*.
     * Instead, it returns one of:
     * - A reference object: `{ src, prop }` (to be evaluated later)
     * - A DOM element
     * - A scalar value
     * - `undefined` if the target cannot be resolved
     *
     * Target expression format:
     * - `type:locator`
     *   - `type` selects a resolution strategy
     *   - `locator` identifies a property, path, or selector
     *
     * Built-in target types include:
     * - `inline`  : Job element innerHTML
     * - `request` : Request/response object (`job.r`)
     * - `window`  : Global `window` object
     * - `this`    : Job element (`job.e`)
     * - `ws`      : Job workspace (`job.ws`)
     * - `buffer`  : Job buffer (`job.buffer`)
     * - `ds`      : Job dataset (`job.ds`)
     * - `find`    : `job.e.querySelector(locator)` (fallbacks to `job.e`)
     * - `doc`     : `document.querySelector(locator)`
     * - `closest` : `job.e.closest(locator)`
     * - `form`    : Form field value collected from `job.e`
     *
     * Resolution behavior:
     * - If the target resolves to a reference `{ src, prop }`, it is returned as-is
     *   for later evaluation.
     * - If the target resolves to a DOM element or scalar, it is returned directly.
     * - Unknown or invalid target types default to `inline`.
     *
     * Custom resolution:
     * - If a `custom` resolver map is provided and contains a matching `type`,
     *   that resolver is used instead of the built-in behavior.
     *
     * @param {Job|Object} job
     *        Job (or job-like object) used as the resolution context. The host
     *        is expected to provide `toJob()` to normalize job-like inputs.
     *
     * @param {string} target
     *        Target expression string to resolve (e.g. `ws:user.id`).
     *
     * @param {Object} [custom={}]
     *        Optional custom resolver map keyed by target type.
     *        Custom resolvers receive the `locator` string and should return a
     *        value or reference compatible with this method’s return contract.
     *
     * @returns {Object|Element|string|number|boolean|undefined}
     *          A reference object, DOM element, scalar value, or `undefined`
     *          if the target cannot be resolved.
     *
     * @notes
     * - This method does not evaluate references; it only parses and resolves them.
     * - Final value extraction is handled by `evalParse()` or by the interpolation
     *   scheme returned from `interpScheme()`.
     * - Warnings may be emitted if selectors fail to resolve.
     */
    parseTarget(job,target,custom={}){
	job = this._asJob(job);
	const lib = this.lib;
	if(!target)return undefined;
	let splitter = function (str, exp=/\s+/,count=0){
	    str = lib.utils.toString(str,1);
	    let pos = str.indexOf(':');
	    return [str.substr(0,pos),pos>-1?str.substr(pos+1):undefined];

	};

	const thisWindow = this.window;
	const thisDocument = this.document;
	let data;
	//let [type,loc] = target.split(/:/,2);
	let [type,loc] = splitter(target);
	if (!type) return undefined;
	type = (type+"").toLowerCase();
	let disp = {
	    "inline": () =>{
		return {
		    src: job.e,
		    prop: "innerHTML",
		    special: loc
		}
	    },
	    "request": ()=>{
		return {
		    src: job.r,
		    prop: loc
		}
	    },
	    "window": () =>{
		return {
		    src: thisWindow,
		    prop: loc
		}
	    },
	    "this":  () =>{
		return {
		    src: job.e,
		    prop: loc
		}
	    },
	    "ws":  () =>{
		//console.log(`>>ws.${loc}=`+lib.hash.get(job.ws,loc));
		
		return {
		    src: job.ws,
		    prop: loc
		}
	    },
	    "buffer": () =>{
		return{
		    src:job.buffer,
		    prop:loc
		};
	    },
	    "ds":() =>{
		return {
		    src:job.ds,
		    prop: loc
		}
	    },
	    "find": () =>{
		let result = undefined;
		//console.log('running find on ',job.e,loc);
		try{
		    result = job.e.querySelector(loc);
		    //console.log("found " , result);
		    if(!result && job.e.matches(loc))result = job.e;

		}catch{
		    result = undefined;
		    this.warn(`couldnt find element with querySelector('${loc}')`,job);
		}
		if(!result)this.warn(`couldnt find element with e.querySelector('${loc}')`);
		return result;
	    },
	    "doc": () =>{
		let result = undefined;
		try{
		    result = thisDocument.querySelector(loc);
		}catch{
		    result = undefined;
		    this.warn(`error with  querySelector(selector '${loc}')`);
		}
		if(!result)this.warn(`couldnt find element with document.querySelector('${loc}')`);
		return result;
	    },
	    "closest": ()=>{
		let result = undefined;
		try{
		    result = job.e.closest(loc);
		}catch{
		    result = undefined;
		    this.warn(`couldnt find element with closest(selector '${loc}' )`);
		}
		return result;

	    },
	    "form": ()=>{
		let form = lib.dom.form.collect(job.e);
		if(!form) return undefined;
		for (let row of form.parms){
		    if (row[0] == loc)return row[1];
		}
		return undefined;
	    },
	    "default": () =>{
		return undefined;
	    }
	};

	if (lib.hash.is(custom) && type in custom){
	    return custom[type](loc);
	}else {
	    if (!(type in disp))type="inline";
	    return disp[type]();
	}
    }

    /**
     * Resolve and evaluate a target expression to its final value.
     *
     * `evalTarget` is a convenience wrapper that combines:
     * - `parseTarget()` to resolve a symbolic target expression, and
     * - `evalParse()` to extract the concrete value from the resolved reference.
     *
     * This method is useful when a one-off value lookup is needed and there is
     * no need to separate parsing from evaluation.
     *
     * @param {Job|Object} job
     *        Job (or job-like object) used as the resolution context.
     *
     * @param {string} target
     *        Target expression string to resolve and evaluate
     *        (e.g. `ws:user.id`, `ds:request.method`).
     *
     * @param {Object} [custom]
     *        Optional custom resolver map passed through to `parseTarget()`.
     *
     * @returns {*}
     *          The resolved value of the target expression, or `undefined`
     *          if the target cannot be resolved or evaluated.
     *
     * @notes
     * - This method eagerly evaluates the target and returns a concrete value.
     * - For finer control (e.g. deferred evaluation), use `parseTarget()` directly.
     */
    evalTarget(job, target,custom){
	let parse = this.parseTarget(...arguments);
	return this.evalParse(parse);
    }


    /**
     * Evaluate a parsed target reference into a concrete value.
     *
     * `evalParse` takes the output of `parseTarget()` and resolves it to its final
     * runtime value.
     *
     * Evaluation rules:
     * - If the input is a reference object of the form `{ src, prop }`:
     *     - If `src` is a DOM element, resolves via `lib.dom.get(src, prop)`
     *     - Otherwise, resolves via `lib.hash.get(src, prop)`
     * - If the input is not a reference object, it is returned unchanged
     *
     * @param {*} parse
     *        Parsed target returned from `parseTarget()`. May be a reference
     *        object, DOM element, scalar value, or `undefined`.
     *
     * @returns {*}
     *          The resolved runtime value, or the original input if no evaluation
     *          is required.
     *
     * @notes
     * - This function performs no parsing or validation.
     * - It assumes reference objects are well-formed.
     * - This method is intentionally small and deterministic.
     */
    evalParse(parse){
	const lib = this.lib;
	//console.log('EP',parse);
	if(lib.utils.baseType(parse,'object') && parse.src && parse.prop) {
	    return lib.dom.is(parse.src)?lib.dom.get(parse.src, parse.prop):lib.hash.get(parse.src,parse.prop);
	}
	return parse;
    }


     //v098 parser
    //basic string parsing is supported, but generally speaking if you want more complex handling, use json configs
    //not currently implemented into the previous functions, used for v1 bridging.
    // e:.config
    // foo:1,2,3
    //err is not yet implemented. malformed data will be truncated.
    parseList(input,err){
        const lib = this.lib;
        input = lib.utils.deepCopy(input);
        input = lib.array.to(input,CONSTANTS.ARR_TO_OPTS);
        const output = [];
        for (let i =0; i < input.length; i++){
            const item = input[i];
            console.log('item' , item);
            if(lib.hash.is(item)){
                output.push(item);
                continue;
            }

            if (lib.str.is(item) ){

                const comp = {raw:item};
                const idx= item.indexOf(':');
                if (idx === -1){
                    comp.op = item;
                    comp.args = [];
                    comp.raw = item;
                }else {
                    comp.op = item.substr(0,idx);
                    const rem = item.substr(idx+1);
                    const arr = lib.array.to(rem, {split:/\,/,trim:true} );
                    comp.args = arr;
                    comp.raw = item;
                }
                output.push(comp);
                continue;
            }
            if(lib.func.get(err) ){

            }
        }
        return output;
    }
    
}

export default ExpressionResolver;


# --- end: class/ExpressionResolver.js ---



# --- begin: class/job/config/DomConfigSource.js ---

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


# --- end: class/job/config/DomConfigSource.js ---



# --- begin: class/job/config/JobConfig.js ---

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
	
	const lib = opts.lib;
	this.job = opts.job;
	
	// core deps (config needs these)
	this.lib  = lib;
	this.expr = opts.expr;

	// DOM binding (config source root)
	this.e = opts.e;

	// persistent per-job workspace root (config/runtime shared)
	this.ws = lib.hash.to(opts.ws);

	// ---- configuration artifacts (kept tight) ----

	// snapshots from DOM/config resolution
	this.inputs = DomConfigSource.emptyReadShape();

	// compiled schema artifacts
	this.schemaReport = null; // exported Report
	this.schema       = null; // exported groomed schema

	// runner-facing buckets (mirrors schema.*)
	this.requests  = {};
	this.intervals = {};
	this.pipelines = {};

	// legacy compatibility (keep for now; can delete once runner is finalized)
	this.stack = {};
	this.artifacts = null;
	this.artifactsBuilt = false;
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
    build(opts = {}){
	//---- read dom ----
	const domService = new DomConfigSource({lib:this.lib,expr:this.expr});
	const resp = domService.read(this.e);
	this.inputs = resp;
	if(!resp.report.ok) 
	    return this.status = JOB_CONFIG_STATUS.ERROR_DOM;

	// --- coerce a schema from it ----
	const schemaService = new Schema({lib:this.lib,expr:this.expr});
	const schemaResp = schemaService.compile(resp.output);
	this.schemaReport = schemaResp.report;
	this.schema   = schemaResp.schema;

	if (!this.schemaReport.ok) 
	    return  this.status   = JOB_CONFIG_STATUS.ERROR_SCHEMA;

	// ---- finalize ----
	this.name     =  this.lib.utils.isEmpty(this.schema.name) ? 'unnamed job' : this.schema.name;
	this._deriveArtifacts(opts);

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


# --- end: class/job/config/JobConfig.js ---



# --- begin: class/job/config/Report.js ---

// class/schema/Report.js

/**
 * Report
 * ------
 * Structured compilation/normalization diagnostics for the ActiveTags schema compiler.
 *
 * Design intent:
 * - Small, explicit diagnostic object with a stable contract.
 * - Keeps Master/SchemeService clean: no "report is a random hash" leaking everywhere.
 * - Designed to be deep-copy/exportable and safe to attach to jobs.
 *
 * Contract:
 * - `errors` and `warnings` are append-only arrays of entries.
 * - `ok` is derived by default (errors.length === 0), but can be materialized via finalize().
 * - Never throws for consumer data issues; only for programmer misuse (missing lib).
 *
 * Entry shape:
 * { code: string, path: string, message: string, meta?: object }
 *
 * LLM integration notes:
 * - This class exists to stop the drift of ad-hoc report hashes.
 * - Keep the entry format stable (code/path/message/meta) so tools can parse it.
 * - Prefer coercion at the edges; Report should accept garbage-ish path/message and normalize.
 */

export default class Report {
    /**
     * @param {Object} args
     * @param {Object} args.lib - m7 lib instance
     */
    constructor({ lib }) {
        if (!lib) throw new Error("Report: missing lib");
        this.lib = lib;

        this.errors = [];
        this.warnings = [];

        // Optional materialized ok flag; if unset, ok() computes from errors.
        this._ok = null;
    }

    /**
     * Add an error entry.
     *
     * @param {string} code
     * @param {string} path
     * @param {string} message
     * @param {Object} [meta]
     * @returns {Report} this
     */
    error(code, path, message, meta) {
        this.errors.push(this._entry(code, path, message, meta));
        this._ok = null; // invalidate materialized ok
        return this;
    }

    /**
     * Add a warning entry.
     *
     * @param {string} code
     * @param {string} path
     * @param {string} message
     * @param {Object} [meta]
     * @returns {Report} this
     */
    warn(code, path, message, meta) {
        this.warnings.push(this._entry(code, path, message, meta));
        return this;
    }

    /**
     * True if there are no errors.
     * If finalize() has been called, returns the materialized value.
     *
     * @returns {boolean}
     */
    ok() {
        if (this._ok !== null) return this._ok;
        return this.errors.length === 0;
    }

    /**
     * Materialize ok flag and return it.
     * Useful if you want report.ok as a plain boolean snapshot.
     *
     * @returns {boolean}
     */
    finalize() {
        this._ok = (this.errors.length === 0);
        return this._ok;
    }

    /**
     * Merge another report into this one (append).
     *
     * Notes:
     * - Does not deep-copy entries by default; caller can export() if isolation is needed.
     *
     * @param {Report|Object} other
     * @returns {Report} this
     */
    merge(other) {
        const lib = this.lib;
        if (!other) return this;

        // Accept either a Report instance or a plain hash with errors/warnings.
        const o = (other instanceof Report) ? other : lib.hash.to(other);

        const errs = (o instanceof Report) ? o.errors : (lib.array.is(o.errors) ? o.errors : []);
        const warns = (o instanceof Report) ? o.warnings : (lib.array.is(o.warnings) ? o.warnings : []);

        for (let i = 0; i < errs.length; i++) this.errors.push(errs[i]);
        for (let i = 0; i < warns.length; i++) this.warnings.push(warns[i]);

        this._ok = null;
        return this;
    }

    /**
     * Export a plain JSON-safe report object.
     * Consumers can safely mutate the returned object.
     *
     * @returns {{ok:boolean, errors:Array, warnings:Array}}
     */
    export() {
        const lib = this.lib;

        // snapshot ok at export-time
        const out = {
            ok: this.ok(),
            errors: this.errors,
            warnings: this.warnings
        };

        return lib.utils.deepCopy(out);
    }
    static emptyExportShape(){
	return {
            ok       : null,
            errors   : [],
            warnings : []
	}
    }
    /**
     * Internal: normalize an entry into the stable shape.
     */
    _entry(code, path, message, meta) {
        const lib = this.lib;

        // Keep coercion simple and lib-native; don't over-validate.
        code = lib.str.to(code, true);
        path = lib.str.to(path, true);
        message = lib.str.to(message, true);

        const e = { code, path, message };

        if (lib.hash.is(meta)) e.meta = meta;
        return e;
    }
}


# --- end: class/job/config/Report.js ---



# --- begin: class/job/config/schema/constants.js ---

//arr_to_opts duplicated from the main constants...
export const ARR_TO_OPTS = {split:/\s+/,trim:true};

//request defaults.
export const INTERVAL = {
    RANGE_ERROR   : ['stop', 'continue'],
    RANGE_DEFAULT : "stop"
};
export const REQUEST = {
    TIMEOUT_DEFAULT : 10,
    METHODS         : ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'], 
    METHOD_DEFAULT  : "GET"
};
// Arrays are replaced (NOT concatenated), and array+scalar overwrites (NOT push).
export const MERGE_OPTS_V1 = {
    disp: {
	aa: function (l, r) { return r; }, // array + array  => replace
	as: function (l, r) { return r; }  // array + scalar => overwrite
	// hh recursion already uses merge(l,r,opts) per your fixed implementation
    }
};

export const DEFAULT_REQUEST_SHAPE = {
    url: undefined,          // filled from form.action if missing
    method: REQUEST.METHOD_DEFAULT,          // typical submit default (element may override)

    encoding: "urlencoded",  // typical form default (element.enctype may override)
    body: undefined,         // produced from form fields at submit-time

    headers: {},             // serializer may set Content-Type if needed
    credentials: undefined,

    timeoutMs: undefined,
    transport: undefined,
    
    flags: {
        json: undefined,
        urlencoded: true
    }
};

export const DEFAULT_INTERVAL_SHAPE = {
    // master switch for the interval definition
    enabled: true,

    // which pipelines to run on interval autorun (same selector semantics as enable.autorun)
    autorun: ["__DEFAULT__"],

    // scheduler config
    repeat: 0,          // ms; 0 means "not runnable until configured"
    max: 0,             // 0 means infinite
    pipeline: "initial",// default pipeline name (resolved/validated later)

    // runtime behavior
    onError: "stop",    // "stop" | "continue"
    allowOverlap: false // allow a new run while the previous is still running
};

export const DEFAULT_PIPELINE_SHAPE = {
    confirm: { mode: "none" }, // normalized confirm object
    run: [],                   // ops list (string|array coerced later)
    onError: []                // ops list (string|array coerced later)
};


export const BLOCK_NORMALIZERS = {
    REQUEST: {
        single: "request",
        plural: "requests",
        default_shape: DEFAULT_REQUEST_SHAPE,
        hotkey: "url",
	user_shape: "request_shape",
        handler: "_normalizeRequestItem",
        outKey: "_effectiveRequests"
    },

    INTERVAL: {
        single: "interval",
        plural: "intervals",
        default_shape: DEFAULT_INTERVAL_SHAPE,
        hotkey: null,
	user_shape: "interval_shape",
        handler: "_normalizeIntervalItem",
        outKey: "_effectiveIntervals"
    },

    PIPELINE: {
        single: "pipeline",
        plural: "pipelines",
        default_shape: DEFAULT_PIPELINE_SHAPE,
        hotkey: null,
	user_shape: "pipeline_shape",
        handler: "_normalizePipelineItem",
        outKey: "_effectivePipelines"
    }
};

export default {
    REQUEST, INTERVAL,
    MERGE_OPTS_V1,
    DEFAULT_REQUEST_SHAPE,
    DEFAULT_PIPELINE_SHAPE,
    DEFAULT_INTERVAL_SHAPE,
    BLOCK_NORMALIZERS,
    ARR_TO_OPTS
};


# --- end: class/job/config/schema/constants.js ---



# --- begin: class/job/config/schema/DSL.js ---

import CONSTANTS from './constants.js';

export class DSL {

    constructor({lib,expr}) {
	this.lib  = lib;
	this.expr = expr;
    }
    
    /**
     * Phase 2: Compile/validate pipeline DSL (strings → parsed descriptors).
     *
     * Wrapper: iterates `output.pipelines` and compiles each pipeline item.
     * - Expects Phase 1 normalization already ran (_normalizeBlock PIPELINE),
     *   so `output.pipelines` should be a hash of pipelineName → pipelineObject.
     * - Mutates `output` in-place (adds compiled fields on each pipeline item).
     */
    _compilePipelineDSL(report, output) {
	const lib = this.lib;
	console.log('here', lib.utils.deepCopy(output) );
	output = lib.hash.to(output);

	const pipelines = lib.hash.get(output, "pipelines");
	if (!lib.hash.is(pipelines)) return output;
	const keys = lib.hash.keys(pipelines);
	//console.log(keys);
	for (const key of keys) {

            const p = pipelines[key];
            if (!lib.hash.is(p)) continue;

            // Ensure pipeline item knows its own name (helps diagnostics)
            p.name = key;
            pipelines[key] = this._compilePipelineDSLItem(report, p, { key });
	}

	// Write back (in case output.pipelines was not the same reference)
	lib.hash.set(output, "pipelines", pipelines);

	return output;
    }

    /**
     * Compile one pipeline item.
     *
     * Stub for now:
     * - In a later pass, this will parse `p.run` / `p.onError` entries from raw
     *   strings into executable descriptors (AST), validate syntax (quotes closed,
     *   etc.), and optionally validate callable names.
     *
     * Expected future behavior:
     * - p.runAst     = Array<Descriptor>
     * - p.onErrorAst = Array<Descriptor>
     * - keep p.run/p.onError as raw tokens for debugging/round-tripping
     */
    _compilePipelineDSLItem(report, p, ctx = {}) {
	const lib = this.lib;

	p = lib.hash.to(p);
	ctx = lib.hash.to(ctx);

	console.log(`scrubbing pipeline ${ctx.key}`);
	
	p.run     = this.expr.parseList(p.run);
	p.onError = this.expr.parseList(p.onError);

	return p;
    }

}

export default DSL;


# --- end: class/job/config/schema/DSL.js ---



# --- begin: class/job/config/schema/Master.js ---

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

            enable    : s.enable,
            confirm   : s.confirm,
            env       : s.env,

            requests  : s._effectiveRequests  || {},
            intervals : s._effectiveIntervals || {},
	    pipelines : s._effectivePipelines || {}
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
        if (!lib.hash.is(s.enable) && !lib.utils.isEmpty(s.enable)) {
            report.warn("W102_ENABLE_INVALID", "enable", "enable should be object(hash)");
        }
        s.enable = lib.hash.to(s.enable);

        // enable.enabled: default true unless explicit "no" intent
        s.enable.enabled = lib.bool.no(s.enable.enabled) ? false : true;

        // enable.autorun: canonical selector list
        s.enable.autorun = this._normalizeAutorunSelector(report, s.enable.autorun);

        // confirm: canonical confirm shape
        s.confirm = this._normalizeConfirm(report,s.confirm);

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
    _normalizeAutorunSelector(report, v, path = "enable.autorun") {
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
	interval.onError = lib.utils.clamp(
	    CONSTANTS.INTERVAL.RANGE_ERROR,
	    lib.str.to(interval.onError, true).trim().toLowerCase(),
	    CONSTANTS.INTERVAL.RANGE_DEFAULT
	).toLowerCase();

        interval.allowOverlap =lib.bool.yes(interval.allowOverlap) ;

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
        p.confirm = this._normalizeConfirm(
            ctx.report,
            p.confirm,
            "W302_PIPELINE_CONFIRM_INVALID",
            `${ctx.key}.${ctx.name}.confirm`
        );

        // run/onError: leave as-is for phase2 parsing, but ensure keys exist
	//p.run = lib.array.to(p.run, CONSTANTS.ARR_TO_OPTS);
	//console.log(p.run);
	//p.onError = lib.array.to(p.onError, CONSTANTS.ARR_TO_OPTS);
	//console.log(lib.utils.deepCopy(p));
        if (!('run' in p)) p.run = [];
        if (!('onError' in p)) p.onError = [];

        return p;
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


# --- end: class/job/config/schema/Master.js ---



# --- begin: class/job/Job.js ---

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


# --- end: class/job/Job.js ---



# --- begin: class/job/Registry.js ---

/**
 * Job Registry
 *
 * Central registry and identity manager for Jobs.
 *
 * Responsibilities:
 * - Owns job identity (id, createdAt) and guarantees uniqueness within a runtime.
 * - Maintains canonical indexes for resolving jobs by:
 *   - id
 *   - DOM element
 *   - logical name (non-unique, convenience only)
 * - Acts as the single source of truth for "which jobs exist right now".
 *
 * Explicit non-responsibilities:
 * - Does NOT execute jobs.
 * - Does NOT run pipelines, stacks, or intervals.
 * - Does NOT mutate job configuration.
 * - Does NOT interpret schemas or DOM config.
 *
 * Conceptual model:
 * - Scheduler is a *directory*, not a runner.
 * - Jobs may exist before or after registration.
 * - Registration binds identity and enables resolution.
 * - Resolution is tolerant and ergonomic (id | name | element | job-like).
 *
 * Identity rules:
 * - `id` is the true identity (stable, unique, scheduler-owned).
 * - `name` is a convenience alias (optional, non-unique).
 * - DOM element (`job.e`) is the physical anchor for registration.
 *
 * Indexes:
 * - byId   : Map<id, Job>
 * - byEl   : WeakMap<Element, id>
 * - byName : Map<name, Set<id>>
 *
 * Lifecycle integration:
 * - Scheduler is responsible for invoking `job.shutdown()` during unregister.
 * - Shutdown metadata is recorded for diagnostics (bounded FIFO log).
 *
 * Design notes:
 * - Resolution prefers correctness over convenience:
 *     id → element → name → job-like object
 * - Name collisions are allowed but surfaced via warnings.
 * - WeakMap is used for DOM binding to avoid memory leaks.
 *
 * This class is intentionally small and strict.
 * Execution, orchestration, and timing belong to runtime/Runner.
 */

import { SCHED_STATUS } from '../../constants.js';


export default class Registry {
    /**
     * Create a new Scheduler instance.
     *
     * The Scheduler is a registry and identity authority for Jobs.
     * It assigns unique identifiers, maintains resolution indexes,
     * and tracks lifecycle metadata, but does not execute jobs.
     *
     * @param {Object} [opts]
     * @param {string} [opts.prefix="at"]
     *     Prefix used when generating job ids.
     *     The final id format is implementation-defined but guaranteed
     *     unique within this Scheduler instance.
     *
     * @param {number} [opts.shutdownLogMax=200]
     *     Maximum number of shutdown records to retain in `shutdownLog`.
     *     Older entries are discarded in FIFO order.
     *
     * Internal state initialized:
     * - `byId`        : Map<string, Job>
     *     Primary identity index.
     *
     * - `byEl`        : WeakMap<Element, string>
     *     DOM element → job id binding.
     *     WeakMap is used to avoid leaking detached DOM nodes.
     *
     * - `byName`      : Map<string, Set<string>>
     *     Optional secondary index for logical job names.
     *     Names are not guaranteed unique.
     *
     * - `createdAt`   : Map<string, number>
     *     Job creation timestamps indexed by id.
     *     Redundant with `job.createdAt`, but retained for fast lookup
     *     and decoupled lifecycle tracking.
     *
     * - `shutdownLog` : Array<Object>
     *     Bounded log of job shutdown events for diagnostics.
     *
     * Notes:
     * - All identity and index state is local to this Scheduler instance.
     * - Multiple Schedulers may coexist without coordination.
     */
    constructor(opts = {}) {
	this.lib = opts.lib;
	this.prefix = opts.prefix || "at";
	this.counter = 0;

	// Primary indexes
	this.byId = new Map();      // id -> job
	this.byEl = new WeakMap();  // element -> id

	// Optional secondary indexes
	this.byName = new Map();    // name -> Set(ids)

	// Metadata
	this.createdAt = new Map(); // id -> timestamp (redundant if job carries it)

	this.shutdownLog = [];          // array of entries (bounded)
	this.shutdownLogMax = opts.shutdownLogMax || 200;
    }

    /**
     * Resolve a job reference into a Job instance.
     *
     * Thin public wrapper around the internal `_resolve` method.
     * Accepts ids, DOM elements, or job-like objects depending on resolver rules.
     *
     * @param {*} x
     *     Job reference (id, element, Job instance, or job-like object).
     *
     * @returns {Job|null}
     *     Resolved Job instance, or null if not found.
     */
    resolve(x) {
	return this._resolve(x);
    }
    /**
     * Generate the next unique job id.
     *
     * Ids are unique within this Scheduler instance and are generated
     * sequentially using the configured prefix.
     *
     * @returns {string}
     *     Newly generated job id.
     */ 
    nextId() {
	this.counter += 1;
	return `${this.prefix}-${this.counter}`;
    }
    /**
     * Check whether a DOM element is already registered.
     *
     * @param {Element} el
     *     DOM element to test.
     *
     * @returns {boolean}
     *     True if the element is already bound to a job.
     */
    hasElement(el) {
	return this.byEl.has(el);
    }
    /**
     * Get the job id associated with a DOM element.
     *
     * @param {Element} el
     *     DOM element bound to a job.
     *
     * @returns {string|null}
     *     Job id if found, otherwise null.
     */
    getIdByElement(el) {
	return this.byEl.get(el) || null;
    }
    /**
     * Get a Job by its id.
     *
     * @param {string} id
     *     Job identifier.
     *
     * @returns {Job|null}
     *     Job instance if found, otherwise null.
     */
    getById(id) {
	return this.byId.get(id) || null;
    }

    /**
     * Get a Job bound to a specific DOM element.
     *
     * @param {Element} el
     *     DOM element bound to a job.
     *
     * @returns {Job|null}
     *     Job instance if found, otherwise null.
     */
    getByElement(el) {
	const id = this.getIdByElement(el);
	return id ? this.getById(id) : null;
    }

    /**
     * Get a Job by its logical name.
     *
     * Behavior:
     * - If exactly one job is registered under the given name, it is returned.
     * - If multiple jobs share the same name:
     *   - A warning is emitted.
     *   - `null` is returned to avoid ambiguous resolution.
     * - If no jobs match, returns null.
     *
     * Notes:
     * - Job names are NOT required to be unique.
     * - This method is a convenience lookup, not a guaranteed resolver.
     * - Callers that expect multiple jobs should use `listByName(name)` instead.
     *
     * @param {string} name
     *     Logical job name.
     *
     * @returns {Job|null}
     *     The resolved Job if unique, otherwise null.
     */
    getByName(name) {
	const list = this.listByName(name);

	if (list.length === 1) return list[0];
	if (list.length > 1) {
            this._warn?.(
		"W101_AMBIGUOUS_NAME",
		name,
		`multiple jobs found for name "${name}"`
            );
	}
	return null;
    }

    /**
     * List all registered jobs.
     *
     * @returns {Job[]}
     *     Array of all jobs currently registered with the Scheduler.
     */
    list() {
	return Array.from(this.byId.values());
    }
    /**
     * List all jobs matching a given status.
     *
     * Notes:
     * - Status comparison is strict equality (`===`).
     * - No validation is performed on the status value.
     *
     * @param {string} status
     *     Job status to match (e.g. JOB_STATUS.READY, RUNNING, ERROR).
     *
     * @returns {Job[]}
     *     Array of jobs whose `job.status` matches the provided status.
     */
    listByStatus(status) {
	const out = [];
	for (const job of this.byId.values()) {
	    if (job.status === status) out.push(job);
	}
	return out;
    }

    /**
     * List all jobs registered under a given logical name.
     *
     * Notes:
     * - Job names are NOT required to be unique.
     * - This method always returns an array.
     * - If no jobs match, an empty array is returned.
     *
     * @param {string} name
     *     Logical job name.
     *
     * @returns {Job[]}
     *     Array of jobs matching the given name.
     */
    
    listByName(name) {
	if (!name) return [];

	const ids = this.byName.get(name);
	if (!ids || !ids.size) return [];

	const out = [];
	for (const id of ids) {
            const job = this.byId.get(id);
            if (job) out.push(job);
	}
	return out;
    }


    /**
     * Register a Job with the Scheduler.
     *
     * Responsibilities:
     * - Assigns a stable job identity (`id`, `createdAt`) if not already present.
     * - Indexes the job by:
     *   - id        → job
     *   - element   → id
     *   - name      → id (optional, non-unique)
     * - Ensures a single Job instance is associated with a given DOM element.
     *
     * Registration semantics:
     * - Idempotent by element:
     *   If a job is already registered for `job.e`, the existing job is returned.
     *
     * - Identity ownership:
     *   The Scheduler is the authority for job identity.
     *   If a job arrives with a pre-seeded `id`, it is respected *only if unused*.
     *
     * - Collision policy (v1.0):
     *   - HARD FAIL on id collision.
     *   - If `job.id` is already registered to a different job, an Error is thrown.
     *   - This prevents silent overwrites and ambiguous identity graphs.
     *
     * Name indexing:
     * - `job.name` is optional and NOT guaranteed unique.
     * - Names are indexed into a secondary map (`name → Set<id>`).
     * - Ambiguity is tolerated; resolution is handled at lookup time.
     *
     * Side effects:
     * - Mutates `job` via `job.setIdentity({ id, createdAt })`.
     * - Mutates internal scheduler indexes.
     *
     * @param {Job} job
     *     Job instance to register.
     *     Must have a bound DOM element (`job.e`).
     *
     * @returns {Job}
     *     The registered Job instance (either the existing one or the newly registered one).
     *
     * @throws {Error}
     *     If `job` or `job.e` is missing.
     *     If an id collision is detected with an existing job.
     */
    register(job) {
	if (!job || !job.e) throw new Error("[Scheduler] register(job) requires job.e");

	// Already registered element => return existing job
	const existing = this.getByElement(job.e);
	if (existing) return existing;

	// Respect pre-seeded identity if present; otherwise assign
	let id = job.id || this.nextId();

	// ---- guard against overwrites (id collisions) ----
	// If the id is already in use by a different job, do NOT overwrite.
	// Policy: allocate a fresh id if caller provided a colliding id.
	// (If you prefer hard-fail instead, replace the while-loop with a throw.)
	const taken = this.byId.get(id);
	/*
	//soft - leave in the event I change my midn
	if (taken && taken !== job) {
        // If caller seeded an id and it's taken, roll forward until free
        do { id = this.nextId(); }
        while (this.byId.has(id));
	}
	*/
	//hard
	if (taken && taken !== job) {
	    throw new Error(`[Scheduler] register(): id collision "${id}"`);
	}

	
	const createdAt = (job.createdAt != null) ? job.createdAt : Date.now();

	job.setIdentity({ id, createdAt });

	this.byId.set(job.id, job);
	this.byEl.set(job.e, job.id);

	// Metadata index (redundant if job carries it, but you use it in unregister)
	this.createdAt.set(job.id, createdAt);

	// Optional name index (probably wont be set yet. use setName later)
	if (job.name) this._indexName(job.name, job.id);

	return job;
    }

    /**
     * Unregister a Job from the Scheduler.
     *
     * Responsibilities:
     * - Resolves the target job from an id, DOM element, or Job instance.
     * - Initiates a graceful shutdown of the job.
     * - Removes all scheduler indexes and metadata associated with the job.
     *
     * Resolution semantics:
     * - `jobOrIdOrEl` may be:
     *   - a Job instance
     *   - a job id (string)
     *   - a DOM element bound to a job
     * - If the target cannot be resolved, this method is a no-op and returns false.
     *
     * Shutdown semantics:
     * - `job.shutdown()` is invoked BEFORE index removal.
     *   This allows the job to:
     *   - cancel intervals
     *   - abort in-flight work
     *   - perform cleanup while scheduler context is still available
     *
     * Metadata handling:
     * - Shutdown metadata is recorded via `_recordShutdown`.
     * - The shutdown log is bounded to prevent unbounded memory growth.
     *
     * Side effects:
     * - Mutates scheduler indexes:
     *   - removes job from `byId`, `byEl`, `byName`, and `createdAt`
     * - Mutates job state via `job.shutdown()`
     *
     * Idempotency:
     * - Safe to call multiple times.
     * - Calling `unregister` on an already-unregistered job returns false.
     *
     * @param {Job|string|Element} jobOrIdOrEl
     *     Job reference, job id, or DOM element bound to the job.
     *
     * @param {Object} [opts]
     * @param {string} [opts.reason]
     *     Optional human-readable reason for shutdown (used for logging/diagnostics).
     *
     * @returns {boolean}
     *     `true` if a job was resolved and unregistered.
     *     `false` if no matching job was found.
     */
    unregister(jobOrIdOrEl, opts = {}) {
	const job = this._resolve(jobOrIdOrEl);
	if (!job) return false;

	// shutdown first (so job can still access scheduler-related context if needed)
	job.shutdown({ reason: opts.reason || "scheduler.unregister" });

	// record shutdown metadata (bounded)
	this._recordShutdown(job, { reason: opts.reason || "scheduler.unregister" });

	// remove from indexes
	this.byId.delete(job.id);
	this.createdAt.delete(job.id);
	this.byEl.delete(job.e);
	if (job.name) this._unindexName(job.name, job.id);

	return true;
    }

    /**
     * Assign or update the logical name of a Job and maintain name indexes.
     *
     * Purpose:
     * - Provides the Scheduler-controlled pathway for setting a job’s name.
     * - Ensures secondary indexes (`byName`) stay consistent when names change.
     *
     * Semantics:
     * - Job names are **convenience identifiers**, not unique identifiers.
     * - Multiple jobs may share the same name.
     * - Internally, names map to a `Set` of job ids.
     *
     * Behavior:
     * - If the job already has a name, it is first removed from the old name index.
     * - The new name is assigned via `job.setName(name)`.
     * - The job id is then indexed under the new name.
     *
     * Safety:
     * - If `job` is missing or does not yet have an id, this method is a no-op.
     *   (Jobs must be registered before they can be indexed by name.)
     *
     * @param {Job} job
     *     Job instance whose name should be updated.
     *
     * @param {string|null} name
     *     Logical name to assign to the job.
     *     Passing a falsy value effectively clears the job’s name.
     *
     * @returns {void}
     */
    setName(job, name) {
	if (!job || !job.id) return;
	if (job.name) this._unindexName(job.name, job.id);
	job.setName(name);
	this._indexName(name, job.id);
    }


    // ---- INTERNAL METHODS ----

    /**
     * Add a job id to the name index.
     *
     * Internal helper used to maintain the `byName` secondary index.
     *
     * Semantics:
     * - Multiple job ids may be associated with the same name.
     * - Names map to `Set<id>` to support efficient add/remove.
     *
     * Safety:
     * - Falsy names are ignored.
     * - Idempotent for the same (name, id) pair.
     *
     * @param {string} name
     *     Logical job name.
     *
     * @param {string|number} id
     *     Job id to associate with the name.
     *
     * @returns {void}
     */
    _indexName(name, id) {
	if (!name) return;
	if (!this.byName.has(name)) this.byName.set(name, new Set());
	this.byName.get(name).add(id);
    }

    /**
     * Remove a job id from the name index.
     *
     * Internal helper used to keep `byName` consistent when:
     * - a job is renamed
     * - a job is unregistered
     *
     * Behavior:
     * - If the resulting id set becomes empty, the name entry is removed entirely.
     *
     * Safety:
     * - No-op if the name is not indexed.
     *
     * @param {string} name
     *     Logical job name.
     *
     * @param {string|number} id
     *     Job id to remove from the name mapping.
     *
     * @returns {void}
     */
    _unindexName(name, id) {
	const set = this.byName.get(name);
	if (!set) return;
	set.delete(id);
	if (set.size === 0) this.byName.delete(name);
    }


    /**
     * Resolve a job reference into a Job instance.
     *
     * This is the Scheduler’s internal resolution primitive and is used by
     * public-facing methods such as `resolve`, `unregister`, etc.
     *
     * Resolution order & semantics:
     * - `null` / falsy → `null`
     *
     * - string:
     *   1) Treated as a job id first.
     *   2) If no id match is found, treated as a job name.
     *      - If multiple jobs share the name, `getByName` will warn and return null.
     *
     * - DOM element:
     *   - Resolves via element-to-job binding.
     *
     * - job-like object:
     *   - If the object has both `id` and `e`, it is assumed to already be a Job
     *     (or a compatible job-like structure) and is returned as-is.
     *
     * - object with `e` property:
     *   - Treated as a wrapper and resolved via its bound element.
     *
     * Failure behavior:
     * - If the reference cannot be resolved, returns `null`.
     * - This method never throws.
     *
     * @param {*} x
     *     Job reference. May be:
     *     - job id (string)
     *     - job name (string)
     *     - DOM element
     *     - Job instance
     *     - object containing `{ e: Element }`
     *
     * @returns {Job|null}
     *     Resolved Job instance, or `null` if no match is found.
     */
    
    _resolve(x) {
	if (!x) return null;

	// string: id first, then name
	if (typeof x === "string") {
            const byId = this.getById(x);
            if (byId) return byId;

            // fallback to name
            return this.getByName(x);
	}

	// element
	if (x.nodeType === 1) return this.getByElement(x);

	// job-like (already a job)
	if (x.id && x.e) return x;

	// object containing element
	if (x.e) return this.getByElement(x.e);

	return null;
    }


    /**
     * Record a shutdown event for a job.
     *
     * Purpose:
     * - Maintain a bounded, in-memory audit log of job shutdowns.
     * - Useful for debugging lifecycle issues, scheduler behavior,
     *   and post-mortem inspection during development.
     *
     * Behavior:
     * - Captures a lightweight snapshot of the job identity and context
     *   at the moment of shutdown.
     * - Appends the entry to `this.shutdownLog`.
     * - Enforces a FIFO bound using `this.shutdownLogMax`.
     *
     * Captured fields:
     * - at      : timestamp (ms since epoch)
     * - id      : job id (if available)
     * - name    : job name (if available)
     * - reason  : shutdown reason (if provided)
     * - tag     : DOM tag name (lowercased) of the bound element
     * - elId    : DOM element id (if present)
     *
     * Notes:
     * - This function never throws.
     * - Logging is best-effort and intentionally shallow.
     * - This is NOT intended to be a durable audit trail.
     *
     * @param {Job} job
     *     Job instance being shut down.
     *
     * @param {Object} [info]
     * @param {string} [info.reason]
     *     Optional human-readable shutdown reason.
     *
     * @returns {void}
     */
    _recordShutdown(job, info = {}) {
	const entry = {
            at: Date.now(),
            id: job.id || null,
            name: job.name || null,
            reason: info.reason || null,
            tag: job.e && job.e.tagName ? String(job.e.tagName).toLowerCase() : null,
            elId: job.e && job.e.id ? String(job.e.id) : null,
	};

	this.shutdownLog.push(entry);

	// Bound the log (FIFO)
	const max = this.shutdownLogMax;
	if (max > 0 && this.shutdownLog.length > max) {
            this.shutdownLog.splice(0, this.shutdownLog.length - max);
	}
    }
}


# --- end: class/job/Registry.js ---



# --- begin: constants.js ---

// src/constants.js

/**
 * ActiveTags constants.
 *
 * POLICY:
 * - No imports
 * - No runtime logic
 * - No side effects
 * - Pure data only
 *
 * These values are version-stable and define
 * structural and dependency expectations.
 */

// ─────────────────────────────────────────
// Selectors
// ─────────────────────────────────────────

export const DEFAULT_SELECTOR = '[data-activetag]';
export const DEFAULT_ATTRIBUTE_SELECTOR = 'data-activetag';

// ─────────────────────────────────────────
// Core library dependencies
// ─────────────────────────────────────────

export const LIB_HASH = 'hash';

export const CORE_DEPS = [
    'primitive.workspace',
    'dom',
    'str.interp'
];

// ─────────────────────────────────────────
// Core services
// ─────────────────────────────────────────

export const SERVICE_DELEGATOR = 'primitive.dom.eventdelegator';
export const SERVICE_LOG       = "primitive.log";
export const SERVICE_INTERVAL  = "primitive.interval";
export const SERVICE_OBSERVER  = "primitive.dom.changeobserver";
export const CORE_SERVICES = [    SERVICE_DELEGATOR, SERVICE_LOG, SERVICE_INTERVAL, SERVICE_OBSERVER ];


// ------------------------------------------
// Job related
// ------------------------------------------
export const JOB_CONFIG_STATUS = {
    INIT         : "init",
    ERROR_DOM    : "error_dom",
    ERROR_SCHEMA : "error_schema",
    READY        : "ready"
    
};
export const JOB_STATUS = Object.freeze({
    READY: "ready",
    RUNNING: "running",
    WAIT: "wait",
    ERROR: "error",
    COMPLETE: "complete",
    DETACHED: "detached",
});

export const JOB_TYPE = Object.freeze({
    LOAD: "load",
    SUBMIT: "submit",
    MANUAL: "manual",
});

// ─────────────────────────────────────────
// helpers
// ─────────────────────────────────────────

export const ARR_TO_OPTS = {split:/\s+/,trim:true};

export const DOM_ATTRS_RUNTIME_INPUTS = [
    "id",
    "name",
    "action",
    "method",
    "enctype",
    "tagName"
];
export const DOM_CONFIG_AT = "config-at at";
// Arrays are replaced (NOT concatenated), and array+scalar overwrites (NOT push).
export const MERGE_OPTS_V1 = {
    disp: {
        aa: function (l, r) { return r; }, // array + array  => replace
        as: function (l, r) { return r; }  // array + scalar => overwrite
        // hh recursion already uses merge(l,r,opts) per your fixed implementation
    }
};


// ─────────────────────────────────────────
// runtime
// ─────────────────────────────────────────

export const SCHED_STATUS = Object.freeze({
    READY: "ready",
    RUNNING: "running",
    WAIT: "wait",
    ERROR: "error",
    COMPLETE: "complete",
    DETACHED: "detached",
});


// ─────────────────────────────────────────
// Default export (convenience / introspection)
// ─────────────────────────────────────────




export default {
    DEFAULT_SELECTOR,
    DEFAULT_ATTRIBUTE_SELECTOR,
    LIB_HASH,
    CORE_DEPS,
    SERVICE_DELEGATOR,
    SERVICE_INTERVAL,
    SERVICE_OBSERVER,
    SERVICE_LOG,
    CORE_SERVICES,
    JOB_CONFIG_STATUS,JOB_STATUS, JOB_TYPE,
    ARR_TO_OPTS, DOM_ATTRS_RUNTIME_INPUTS, DOM_CONFIG_AT, MERGE_OPTS_V1,
    SCHED_STATUS
};


# --- end: constants.js ---



# --- begin: helpers/applyMixins.js ---

//only handles instance methods for now.

export function applyMixins(targetClass, ...mixins) {
    for (const mixin of mixins) {
        Object.assign(targetClass.prototype, mixin);
    }
}

export default applyMixins;

/*
// instance methods , getters/setters ... work on statics too later.
export function applyMixins(targetClass, ...mixins) {
  for (const mixin of mixins) {
    Object.defineProperties(
      targetClass.prototype,
      Object.getOwnPropertyDescriptors(mixin)
    );
  }
}

export default applyMixins;
*/


# --- end: helpers/applyMixins.js ---



# --- begin: helpers/freezeDeep.js ---

/**
 * Deep-freeze an object graph.
 *
 * Purpose:
 * - Prevent mutation of creation-time / configuration artifacts.
 * - Intended for "build once, read many" structures.
 *
 * Semantics:
 * - Recursively freezes all own enumerable properties.
 * - Handles arrays and plain objects.
 * - Scalars and non-objects are returned unchanged.
 *
 * Notes:
 * - This mutates the input object by freezing it.
 * - Callers should deep-copy first if mutation is undesirable.
 *
 * @param {*} value
 * @returns {*} The same value, deeply frozen if applicable.
 */
function freezeDeep(value) {
    if (!value || typeof value !== "object") return value;

    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            freezeDeep(value[i]);
        }
        return Object.freeze(value);
    }

    for (const key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        freezeDeep(value[key]);
    }

    return Object.freeze(value);
}

export { freezeDeep };
export default freezeDeep;


# --- end: helpers/freezeDeep.js ---



# --- begin: helpers/requireLibs.js ---


/**
 * requireLibs(root, targets, opts?)
 *
 * Standalone dependency validator for nested paths.
 * Does NOT rely on m7 lib utilities (array/hash), so it can run during bootstrap.
 *
 * @param {object} root - root object to validate against (e.g. window.lib)
 * @param {string|string[]} targets - space-delimited string or array of dot-paths
 * @param {object} [opts]
 * @param {string} [opts.mod='[requireLibs]'] - label for error messages
 * @param {boolean} [opts.returnMap=false] - return {path:value} instead of array
 * @param {boolean} [opts.allowFalsy=true] - if false, falsy values fail (rare)
 * @returns {any[]|Record<string, any>} resolved values
 * @throws Error if any target is missing
 */

export function requireLibs(root, targets, opts = {}) {
    opts = lib.hash.to(opts, "mod");
    const mod       = lib.hash.get(opts, "mod", "[requireLibs]");
    const returnMap = !!lib.hash.get(opts, "returnMap", false);
    const die       = lib.hash.get(opts, "die", true);

    // default policy: must exist, and resolved value must NOT be nullish
    const truthy = !!lib.hash.get(opts, "truthy", false);

    if (!lib.utils.baseType(root, "object")) {
	throw new Error(`${mod} invalid root (expected object)`);
    }

    const list = lib.array.to(targets, /\s+/);

    const outArr = [];
    const outMap = {};
    const missing = [];

    for (const path of list) {
	// structural existence check first (fast + pinpoints missing paths)
	if (!lib.hash.exists(root, path)) {
	    missing.push(path);
	    continue;
	}

	const val = lib.hash.get(root, path);

	// default: disallow null/undefined
	const ok = truthy ? !!val : (val !== null && val !== undefined);

	if (!ok) {
	    missing.push(path);
	    continue;
	}

	outArr.push(val);
	outMap[path] = val;
    }

    if (missing.length && die) {
	throw new Error(`${mod} missing required targets: ${missing.join(", ")}`);
    }

    return returnMap ? outMap : outArr;
}

export default requireLibs;


# --- end: helpers/requireLibs.js ---



# --- begin: traits/constructor.js ---

import requireLibs from '../helpers/requireLibs.js';

export const trait_constructor = {

    getOpts(conf) {
	const lib = this.lib;

	// clone via hash.to so we don't mutate caller
	const confObj = lib.hash.to(conf);
	delete confObj.intervalManager;
	delete confObj.logManager;

	return lib.hash.merge(
            {
		debug: false,
		log: { enable: false },
		observe: {
                    selectors: this.constructor.DEFAULT_SELECTOR,
                    debounceMs: 25,
                    observeAttributes: false
		}
            },
            confObj
	);
    },

    normalizeDelegator(lib) {
	if (!lib?.site) return;
	if (!lib.site.delegator && lib.site.delagator) {
            lib.site.delegator = lib.site.delagator;
	}
    },
    requireCoreDeps(lib) {
	requireLibs(lib, [
            'primitive.workspace',
            'dom',
            'site.delegator',
            'str.interp'
	], { mod: '[activeTags]' });
    }

};

export default trait_constructor;


# --- end: traits/constructor.js ---



# --- begin: traits/expressions.js ---

/**
 * Expressions / Interpolation Trait
 * --------------------------------
 *
 * This trait implements Active Tags’ **expression resolution and interpolation
 * system**. It provides the machinery that allows symbolic string expressions
 * (e.g. `ws:user.id`, `ds:request.method`, `find:.title`) to be resolved into
 * live runtime values bound to a Job.
 *
 * Core responsibilities:
 * - Parse "target expressions" of the form `type:locator`
 * - Resolve those expressions against a Job’s runtime context
 *   (DOM element, dataset, workspace, request/response, etc.)
 * - Provide interpolation hooks compatible with `lib.str.interp()`
 * - Centralize all dynamic value lookup logic in one place
 *
 * What this trait does NOT do:
 * - It does NOT execute jobs or pipelines
 * - It does NOT schedule or time execution
 * - It does NOT mutate job state (except via controlled getters)
 * - It does NOT own or manage data lifecycles
 *
 * Architectural role:
 * - Serves as the symbolic “glue” between declarative markup/configuration
 *   and imperative runtime state
 * - Enables late binding: values are resolved at the moment they are needed,
 *   not when configuration is parsed
 * - Provides a single, extensible target-resolution system used by:
 *     - config interpolation (`data-config`)
 *     - request construction
 *     - response mapping
 *     - DOM binding
 *
 * Design notes:
 * - Target expressions are parsed into references first, then evaluated
 * - Evaluation is intentionally separated from parsing
 * - Custom target resolvers may be injected per call
 * - Some target types (e.g. DOM-based `eval`) are powerful and should only
 *   be used with trusted content
 *
 * This trait should remain:
 * - Pure in intent (resolution, not execution)
 * - Job-scoped (never global)
 * - Centralized (no ad-hoc expression parsing elsewhere)
 */


// -----------------------------------------------------------------------------
// DEPENDENCIES / ASSUMPTIONS (to be satisfied by host ActiveTags class)
// -----------------------------------------------------------------------------
// This trait assumes the following exist on `this`:
//
// REQUIRED:
// - this.toJob(job)              // normalize job-like inputs into a Job
// - this.warn(message, job?)     // optional warning/logger hook (used on lookup failures)
//
// EXPECTED JOB SHAPE:
// - job.e        : DOM Element bound to the job
// - job.ds       : Dataset object (from load trait)
// - job.ws       : Job workspace object
// - job.buffer   : Optional job buffer
// - job.r        : Optional request/response object
//
// OPTIONAL / LEGACY SUPPORT:
// - job may arrive wrapped in legacy `{ item, obj }` form (handled internally)
//
// ENVIRONMENT:
// - Browser DOM (document, window, Element)
//
// NOTE:
// - This trait performs expression parsing and value resolution ONLY.
// - It does NOT execute jobs, mutate state, or manage lifecycles.
// - Evaluation semantics are intentionally split between parseTarget / evalParse.
// -----------------------------------------------------------------------------


export const expressionsTrait = {



    /**
     * Build an interpolation scheme function for `lib.str.interp()`.
     *
     * This returns a resolver function that can be passed to `lib.str.interp()`
     * to replace tokens with live runtime values from the given Job context.
     *
     * The returned function accepts a single `target` expression (typically of the
     * form `type:locator`, e.g. `ws:user.id`, `ds:request.url`, `find:.title`) and:
     * - Resolves it via `parseTarget(job, target, custom)`
     * - If the resolved value is a scalar, returns it directly
     * - If the resolved value is a `{ src, prop }` reference, returns
     *   `lib.hash.get(src, prop)`
     * - Otherwise returns `undefined` (unresolvable / non-scalar)
     *
     * Compatibility note:
     * - Contains a legacy shim that accepts older "workspace wrapper" objects
     *   shaped like `{ item, obj }` and unwraps them to `job.item`.
     *
     * @param {Job|Object} job
     *        Job (or job-like) context used for resolution. The host is expected
     *        to provide `toJob()` to normalize job-like inputs.
     *
     * @param {Object} [custom={}]
     *        Optional custom resolver map keyed by target type. If present and a
     *        matching type exists, it overrides the built-in resolution behavior.
     *        (See `parseTarget()` for details.)
     *
     * @returns {(target: string) => (string|number|boolean|null|undefined)}
     *          A function compatible with `lib.str.interp()` that resolves a single
     *          interpolation token to a scalar value (or `undefined` if not resolvable).
     */



    interpScheme(job,custom={}){
	//$fixup workspace to job compatibility hack
	if (lib.hash.is(job) && ('item' in job) && ('obj' in job)){
	    //console.log('legacy hack!');
	    job = job.item;
	}else job=this.toJob(job);

	let obj = this;
	//console.log('PREPARINGINTERP SCHEME',custom);
	return function(target){
	    let info = obj.parseTarget(job,target,custom);
	    //console.log('INSIDE SCHEME',info,lib.hash.is(info));
	    //$$fixup
	    //console.log(info);
	    if(lib.utils.isScalar(info))return info;
	    return (lib.hash.is(info) && info.src && info.prop)?
		lib.hash.get(info.src, info.prop):
		undefined;
	}
    },
    
    

    /**
     * Parse a target expression into a resolvable reference or value.
     *
     * `parseTarget` is the core expression-resolution function. It takes a symbolic
     * target string (typically of the form `type:locator`) and resolves it against
     * a Job’s runtime context.
     *
     * The result of this function is intentionally *not always a final value*.
     * Instead, it returns one of:
     * - A reference object: `{ src, prop }` (to be evaluated later)
     * - A DOM element
     * - A scalar value
     * - `undefined` if the target cannot be resolved
     *
     * Target expression format:
     * - `type:locator`
     *   - `type` selects a resolution strategy
     *   - `locator` identifies a property, path, or selector
     *
     * Built-in target types include:
     * - `inline`  : Job element innerHTML
     * - `request` : Request/response object (`job.r`)
     * - `window`  : Global `window` object
     * - `this`    : Job element (`job.e`)
     * - `ws`      : Job workspace (`job.ws`)
     * - `buffer`  : Job buffer (`job.buffer`)
     * - `ds`      : Job dataset (`job.ds`)
     * - `find`    : `job.e.querySelector(locator)` (fallbacks to `job.e`)
     * - `doc`     : `document.querySelector(locator)`
     * - `closest` : `job.e.closest(locator)`
     * - `form`    : Form field value collected from `job.e`
     *
     * Resolution behavior:
     * - If the target resolves to a reference `{ src, prop }`, it is returned as-is
     *   for later evaluation.
     * - If the target resolves to a DOM element or scalar, it is returned directly.
     * - Unknown or invalid target types default to `inline`.
     *
     * Custom resolution:
     * - If a `custom` resolver map is provided and contains a matching `type`,
     *   that resolver is used instead of the built-in behavior.
     *
     * @param {Job|Object} job
     *        Job (or job-like object) used as the resolution context. The host
     *        is expected to provide `toJob()` to normalize job-like inputs.
     *
     * @param {string} target
     *        Target expression string to resolve (e.g. `ws:user.id`).
     *
     * @param {Object} [custom={}]
     *        Optional custom resolver map keyed by target type.
     *        Custom resolvers receive the `locator` string and should return a
     *        value or reference compatible with this method’s return contract.
     *
     * @returns {Object|Element|string|number|boolean|undefined}
     *          A reference object, DOM element, scalar value, or `undefined`
     *          if the target cannot be resolved.
     *
     * @notes
     * - This method does not evaluate references; it only parses and resolves them.
     * - Final value extraction is handled by `evalParse()` or by the interpolation
     *   scheme returned from `interpScheme()`.
     * - Warnings may be emitted if selectors fail to resolve.
     */
    parseTarget(job,target,custom={}){
	job = this.toJob(job);
	if(!target)return undefined;
	let splitter = function (str, exp=/\s+/,count=0){
	    str = lib.utils.toString(str,1);
	    let pos = str.indexOf(':');
	    return [str.substr(0,pos),pos>-1?str.substr(pos+1):undefined];

	};

	
	let data;
	//let [type,loc] = target.split(/:/,2);
	let [type,loc] = splitter(target);
	if (!type) return undefined;
	type = (type+"").toLowerCase();
	let disp = {
	    "inline": () =>{
		return {
		    src: job.e,
		    prop: "innerHTML",
		    special: loc
		}
	    },
	    "request": ()=>{
		return {
		    src: job.r,
		    prop: loc
		}
	    },
	    "window": () =>{
		return {
		    src: window,
		    prop: loc
		}
	    },
	    "this":  () =>{
		return {
		    src: job.e,
		    prop: loc
		}
	    },
	    "ws":  () =>{
		//console.log(`>>ws.${loc}=`+lib.hash.get(job.ws,loc));
		
		return {
		    src: job.ws,
		    prop: loc
		}
	    },
	    "buffer": () =>{
		return{
		    src:job.buffer,
		    prop:loc
		};
	    },
	    "ds":() =>{
		return {
		    src:job.ds,
		    prop: loc
		}
	    },
	    "find": () =>{
		let result = undefined;
		//console.log('running find on ',job.e,loc);
		try{
		    result = job.e.querySelector(loc);
		    if(!result && job.e.matches(loc))result = job.e;

		}catch{
		    result = undefined;
		    this.warn(`couldnt find element with querySelector('${loc}')`,job);
		}
		if(!result)this.warn(`couldnt find element with e.querySelector('${loc}')`);
		return result;
	    },
	    "doc": () =>{
		let result = undefined;
		try{
		    result = document.querySelector(loc);
		}catch{
		    result = undefined;
		    this.warn(`error with  querySelector(selector '${loc}')`);
		}
		if(!result)this.warn(`couldnt find element with document.querySelector('${loc}')`);
		return result;
	    },
	    "closest": ()=>{
		let result = undefined;
		try{
		    result = job.e.closest(loc);
		}catch{
		    result = undefined;
		    this.warn(`couldnt find element with closest(selector '${loc}' )`);
		}
		return result;

	    },
	    "form": ()=>{
		let form = lib.dom.form.collect(job.e);
		if(!form) return undefined;
		for (let row of form.parms){
		    if (row[0] == loc)return row[1];
		}
		return undefined;
	    },
	    "default": () =>{
		return undefined;
	    }
	};

	if (lib.hash.is(custom) && type in custom){
	    return custom[type](loc);
	}else {
	    if (!(type in disp))type="inline";
	    return disp[type]();
	}
    },

    /**
     * Resolve and evaluate a target expression to its final value.
     *
     * `evalTarget` is a convenience wrapper that combines:
     * - `parseTarget()` to resolve a symbolic target expression, and
     * - `evalParse()` to extract the concrete value from the resolved reference.
     *
     * This method is useful when a one-off value lookup is needed and there is
     * no need to separate parsing from evaluation.
     *
     * @param {Job|Object} job
     *        Job (or job-like object) used as the resolution context.
     *
     * @param {string} target
     *        Target expression string to resolve and evaluate
     *        (e.g. `ws:user.id`, `ds:request.method`).
     *
     * @param {Object} [custom]
     *        Optional custom resolver map passed through to `parseTarget()`.
     *
     * @returns {*}
     *          The resolved value of the target expression, or `undefined`
     *          if the target cannot be resolved or evaluated.
     *
     * @notes
     * - This method eagerly evaluates the target and returns a concrete value.
     * - For finer control (e.g. deferred evaluation), use `parseTarget()` directly.
     */
    evalTarget(job, target,custom){
	let parse = this.parseTarget(...arguments);
	return this.evalParse(parse);
    },


    /**
     * Evaluate a parsed target reference into a concrete value.
     *
     * `evalParse` takes the output of `parseTarget()` and resolves it to its final
     * runtime value.
     *
     * Evaluation rules:
     * - If the input is a reference object of the form `{ src, prop }`:
     *     - If `src` is a DOM element, resolves via `lib.dom.get(src, prop)`
     *     - Otherwise, resolves via `lib.hash.get(src, prop)`
     * - If the input is not a reference object, it is returned unchanged
     *
     * @param {*} parse
     *        Parsed target returned from `parseTarget()`. May be a reference
     *        object, DOM element, scalar value, or `undefined`.
     *
     * @returns {*}
     *          The resolved runtime value, or the original input if no evaluation
     *          is required.
     *
     * @notes
     * - This function performs no parsing or validation.
     * - It assumes reference objects are well-formed.
     * - This method is intentionally small and deterministic.
     */
    evalParse(parse){
	//console.log('EP',parse);
	if(lib.utils.baseType(parse,'object') && parse.src && parse.prop) {
	    return lib.dom.is(parse.src)?lib.dom.get(parse.src, parse.prop):lib.hash.get(parse.src,parse.prop);
	}
	return parse;
    },


    
    
};

export default expressionsTrait;


# --- end: traits/expressions.js ---



# --- begin: traits/job.js ---

export const trait_job = {
    toJob(ref) {
	return this.jobs.resolve(ref) || undefined;
    }
}

export default trait_job;


# --- end: traits/job.js ---



# --- begin: traits/load.js ---

import Job from '../class/job/Job.js';
import CONSTANTS from '../constants.js';
//REQUIRES STACK CONSTRUCTION AND INTERVAL STAGING STILL.
//RUNNER == requires a reset job.

/**
 * Load / Discovery Trait
 * ---------------------
 *
 * This trait defines the **DOM discovery and job registration layer** for
 * Active Tags. It is responsible for finding candidate DOM elements,
 * extracting configuration, and creating persistent `Job` instances
 * bound to those elements.
 *
 * Scope and responsibilities:
 * - Discover DOM elements via selectors or direct references
 * - Normalize and de-duplicate discovery results
 * - Extract and hydrate configuration from:
 *   - `data-*` attributes
 *   - External config sources (`data-config`)
 * - Preserve backward compatibility via legacy remapping hooks
 * - Instantiate and register `Job` objects in an idempotent way
 *
 * Explicit non-responsibilities:
 * - Does NOT execute, schedule, or run jobs
 * - Does NOT manage intervals or timers
 * - Does NOT perform DOM mutation
 * - Does NOT handle async flow or pipeline execution
 *
 * Architectural role:
 * - Acts as the "front door" of the Active Tags runtime
 * - Serves both initial page load and dynamic DOM discovery
 *   (e.g. MutationObserver-driven attachment)
 * - Provides a clean separation between:
 *     discovery  →  registration  →  execution
 *
 * Key methods:
 * - `load()`          : Public entry point for discovery + registration
 * - `bootSweep()`     : Pure DOM discovery (returns elements only)
 * - `registerJobs()`  : Job instantiation and registry (idempotent)
 * - `getDataset()`    : Dataset hydration (data-* + config)
 * - `getTagConfig()`  : External configuration resolution
 * - `remapLegacy()`   : Backward compatibility hook (no-op by default)
 *
 * Design notes:
 * - All methods in this trait are safe to call repeatedly.
 * - Job identity is bound to DOM elements.
 * - Execution is intentionally decoupled and handled by other traits
 *   (runner / scheduler / pipeline).
 *
 * This trait should remain:
 * - Deterministic
 * - Side-effect limited (registration only)
 * - Free of execution semantics
 */

// -----------------------------------------------------------------------------
// DEPENDENCIES / ASSUMPTIONS (to be satisfied by host ActiveTags class)
// -----------------------------------------------------------------------------
// This trait assumes the following exist on `this`:
//
// REQUIRED:
// - this.jobs
//     - .register(job)           // store job + assign id
//     - .getByElement(element)   // (optional but recommended for idempotency)
// - this.configureJob(job)       // minimal job shaping (no execution)
//
// REQUIRED (config / parsing):
// - this.interpScheme(ctx, ...)  // interpolation scheme for data-config
// - this.parseTarget(ctx, str)   // resolves data-config targets
//
// ENVIRONMENT:
// - Browser DOM (document, Element)
//
// NOTE:
// - This trait performs discovery + registration ONLY.
// - It does NOT run, schedule, or detach jobs.
// - Execution, lifecycle, and cleanup are handled elsewhere.
// -----------------------------------------------------------------------------



export const trait_load = {

enqueueAll() {
  const jobs = this.jobs.list();

  for (const job of jobs) {
    // enabled gate (matches your schema shape shown)
    const enabled = job?.config?.schema?.enable?.enabled;
    if (enabled === false) continue;

    // autorun list lives here in your example
    let autorun = job?.config?.schema?.enable?.autorun;

    // policy: if autorun is missing/null, do nothing (explicit only)
    if (!Array.isArray(autorun) || autorun.length === 0) continue;

    for (let key of autorun) {
      if (!key) continue;

      // "__DEFAULT__" -> "default"
      if (key === "__DEFAULT__") key = "default";

      this.engine.enqueue(job, key, {
        inputs: { reason: "boot" },
        meta: { source: "enqueueAll" },
      });
    }
  }
},

    
    /**
     * Discover and register Active Tags jobs from the DOM.
     *
     * This is the primary public entry point for turning DOM elements into
     * registered `Job` instances. It performs **discovery + registration only**;
     * it does NOT execute, schedule, or run any jobs.
     *
     * Behavior:
     * - Delegates DOM discovery to `bootSweep()`
     * - Delegates job creation / deduplication to `registerJobs()`
     * - Idempotent: elements already associated with a Job will not create duplicates
     *
     * Accepted inputs:
     * - `null` / `undefined` → uses `ActiveTags.DEFAULT_SELECTOR`
     * - CSS selector string → `document.querySelectorAll(selector)`
     * - DOM Element → treated as a single candidate
     * - Array / array-like → mix of selectors and/or DOM elements
     *
     * Typical usage:
     * - Initial page load
     * - Manual re-scan of a subtree
     * - Observer-driven discovery (MutationObserver output)
     *
     * @param {string|Element|Array<string|Element>|null} [sel=null]
     *        Selector(s) or DOM element(s) to scan for Active Tags candidates.
     *
     * @returns {Job[]}
     *          Array of registered `Job` instances (new or existing).
     *
     * @sideEffects
     * - May create and register new Job instances
     * - Does NOT start, run, or schedule jobs
     *
     * @notes
     * - This method is safe to call repeatedly.
     * - Execution is intentionally decoupled and handled elsewhere (runner/pump).
     */
    
    load(sel=null,opts={}){
	const list = this.sweep(sel);
	if (!list) return;
	console.log(`found ${list.length} candidates`);
	const reg = this.registerJobs(list,opts);
	console.log(`registered ${this.lib.array.len(reg)} new jobs`);
    },




    /**
     * Create and register `Job` instances for discovered DOM elements.
     *
     * `registerJobs` is responsible for **job instantiation and registration only**.
     * It converts a list of candidate DOM elements into persistent `Job` objects
     * and stores them in the runtime job registry.
     *
     * This method:
     * - Is **idempotent** per DOM element
     * - Will NOT create duplicate jobs for the same element
     * - Will NOT execute, schedule, or start jobs
     * - Performs minimal, safe job configuration only
     *
     * Typical callers:
     * - `load()` after a DOM sweep
     * - MutationObserver change handlers
     * - Manual or programmatic attachment flows
     *
     * @param {Array<Element>|ArrayLike<Element>} list
     *        List of DOM elements returned from `bootSweep()` or similar discovery logic.
     *
     * @returns {Job[]}
     *          Array of registered `Job` instances.
     *          Existing jobs are returned as-is; new jobs are created and registered.
     *
     * @sideEffects
     * - Creates new `Job` instances when no existing job is associated with an element
     * - Registers jobs into the runtime job registry (`this.jobs`)
     *
     * @notes
     * - Job execution is intentionally decoupled and handled elsewhere.
     * - Job identity is bound to the DOM element (`job.e`).
     * - Initial job state is `{ status: 'ready' }`.
     */

    registerJobs(list,opts={}) {
	const lib = this.lib;
	const jobs = [];
	opts = lib.hash.to(opts,'ignoreExisting');
	list = lib.array.to(list);

	for (let i = 0; i < list.length; i++) {
            const tag = list[i];
            if (!lib.dom.is(tag)) continue;

            const existing = this.jobs.getByElement ? this.jobs.getByElement(tag) : null;
            if (existing) {
		if(!lib.bool.byIntent(opts.ignoreExisting) )
		    jobs.push(existing);
		continue;
            }

            const job = new Job({ lib: this.lib, expr: this.expr, e: tag, ws: {} });

            const registered = this.jobs.register(job);
            jobs.push(registered);

            registered.configure();
	    //console.log('setting name for',registered, registered.name);
	    this.jobs.setName(registered, registered.name);
	}

	return jobs;
    },
    


    /**
     * Rewrite legacy `data-*` attributes into modern dataset shape.
     *
     * This hook exists to preserve backward compatibility with older
     * Active Tags markup and configuration conventions.
     *
     * It receives the raw dataset extracted from the DOM and may:
     * - Rename legacy keys
     * - Alias deprecated attributes
     * - Normalize values into modern formats
     * - Remove obsolete entries
     *
     * This method should be:
     * - Pure (no side effects)
     * - Deterministic
     * - Safe to call repeatedly
     *
     * @param {Object} filtered
     *        Raw key/value map produced by `lib.dom.filterAttributes()`.
     *
     * @returns {Object}
     *          Transformed dataset compatible with the current engine.
     *
     * @notes
     * - Default implementation is a no-op.
     * - Override or extend to support legacy markup versions.
     */
    remapLegacy(filtered) {
	return filtered;
    },

    /**
     * Build the hydrated dataset for a DOM element.
     *
     * `getDataset` is responsible for constructing the final configuration object
     * (`ds`) that drives a Job’s pipeline and execution behavior.
     *
     * It performs a multi-step normalization process:
     * 1. Extracts all `data-*` attributes from the element
     * 2. Applies legacy remapping (`remapLegacy`) for backward compatibility
     * 3. Merges in external configuration referenced by `data-config`
     * 4. Inflates dashed keys into nested object form
     *
     * Merge precedence:
     * - `data-*` attributes on the element override external config values
     *
     * This method:
     * - Does NOT create or register jobs
     * - Does NOT execute or schedule anything
     * - Is safe to call repeatedly
     *
     * @param {Element} tag
     *        DOM element from which configuration is extracted.
     *
     * @returns {Object}
     *          Hydrated dataset object used by the Job.
     *
     * @notes
     * - External config returned by `getTagConfig()` is expected to be in flat
     *   `data-*` form (pre-inflation).
     * - Nested runtime configuration is produced only after the merge step.
     * - Legacy compatibility should be handled exclusively via `remapLegacy()`.
     */
    
    getDataset(tag){
        let filtered = lib.dom.filterAttributes(tag, /^data-/,1);
        filtered = this.remapLegacy(filtered);
        let exConf = this.getTagConfig(tag) || {};
        let ds = Object.assign(exConf, filtered);
        //console.log(exConf,filtered,ds);
        ds = lib.hash.inflate(ds,"delim=-");

        return ds;
    },

    /**
     * Resolve and merge external configuration referenced by a tag's `data-config`.
     *
     * `data-config` may contain one or more whitespace-delimited "targets" that
     * resolve to configuration sources (e.g. DOM nodes, hashes, scalars). Each
     * target is interpreted, resolved, and merged into a single config object.
     *
     * Processing steps:
     * 1) Read `data-config` attribute value
     * 2) Interpolate it via `lib.str.interp()` using an interpolation scheme
     * 3) Split into targets (whitespace-delimited)
     * 4) For each target:
     *    - Resolve via `parseTarget({e:tag}, target)`
     *    - If target resolves to a DOM node:
     *        - Use `node.text` as the payload
     *        - If `node.type` contains "eval" → `eval(text)` to produce config
     *        - Else parse as JSON via `lib.json.parse(text)`
     *    - Merge each resolved config into an accumulator via `lib.hash.merge()`
     *
     * Return value is intended to be a plain object that can be merged with the
     * tag's `data-*` attributes before inflation in `getDataset()`.
     *
     * @param {Element} tag
     *        DOM element whose `data-config` attribute specifies external config sources.
     *
     * @returns {Object|undefined}
     *          Merged external configuration object, or `undefined` if `data-config`
     *          is empty / not provided.
     *
     * @sideEffects
     * - May evaluate arbitrary JavaScript if a DOM config source is marked with a
     *   type containing "eval" (e.g. `type="eval"`). This is powerful but unsafe
     *   for untrusted content.
     *
     * @notes
     * - This method does not read `data-*` attributes other than `data-config`.
     * - Merge order follows the order of targets in `data-config`.
     * - Values from the element's own `data-*` attributes override this output in
     *   `getDataset()` (via `Object.assign(exConf, filtered)`).
     */

    getTagConfig(tag){
	let target = tag.getAttribute('data-config');

	let scheme = this.interpScheme({e:tag},undefined);
        target = lib.str.interp(target, scheme);


	let element = undefined;
	if(lib.utils.isEmpty(target))return undefined;

	let list = lib.array.to(target, /\s+/);
	let data = {};
	for (let item of list){
	    let info =this.parseTarget({e:tag},item);
	    let val = lib.utils.isScalar(info) || lib.dom.is(info)?info:(lib.hash.is(info) && info.src && info.prop)?lib.hash.get(info.src,info.prop):info;
	    //console.log(`>>getconfig (${item})`,val);
	    let newData = undefined;
	    if (lib.dom.is(val)){
		let text = val.text;

		if ( (val.type+"").match('eval')){
		    //try to eval it
		    newData= eval(text);
		}else {
		    newData= lib.json.parse(text);
		    
		}
	    }
	    data = lib.hash.merge(data, lib.hash.to(newData));
	    
	}

	return data;
    }



    
};



export default trait_load;


# --- end: traits/load.js ---



# --- begin: traits/mutationObserver.js ---

import CONSTANTS         from '../constants.js';

export const trait_mutation_observer = {
    startObserver() {
	if (!this.lib) return;

	const obs = this.domObserver;

	if (!obs) {
            throw new Error("[ActiveTags] DomChangeObserver service not found: primitive.dom.changeobserver");
	}

	
	const lib = this.lib;
	const observe = lib.hash.get(this,'opts.observe',{});
	const selectors = lib.array.filterStrings( lib.hash.getUntilNotEmpty(observe, "selectors selector", CONSTANTS.DEFAULT_SELECTOR) );

	if (!lib.array.len(selectors)) {
            throw new Error("[ActiveTags] empty selector list on observer");
	}

	const attributeFilter = lib.array.to(CONSTANTS.DEFAULT_ATTRIBUTE_SELECTOR, /\s+/);
	if (!lib.array.len(attributeFilter)) {
            throw new Error("[ActiveTags] empty attribute filter list on observer");
	}


	// Selector-mode config only. No root. No global onChange.
	const selectorSpecs = selectors.map((selector) => ({
            selector,
            includeSubtreeMatches: true,
            observeAttributes: true,
            attributeFilter,

            // Per-selector event handler (multi-consumer safe)
            onEvent: (batch) => this._onDomChanges(batch)
	}));

	obs.setSelectors(selectorSpecs);

	// Ensure observer is running (should be idempotent correct?)
	obs.start();

    },
    
    old2startObserver() {
	if (!this.lib) return;
	if (this.domObserver) return;

	const lib = this.lib;
	const observe = (this.opts && this.opts.observe) ? this.opts.observe : {};

	const selectors = lib.array.filterStrings(
            observe.selectors ??
		observe.selector ??
		CONSTANTS.DEFAULT_SELECTOR
	);

	if (!lib.array.len(selectors)) {
            throw new Error("[ActiveTags] empty selector list on observer");
	}

	const root =
              observe.root ||
              lib.hash.get(lib, "_env.root.document.body");

	if (!root) {
            throw new Error("[ActiveTags] Cannot start observer: no document.body");
	}

	const attributeFilter = lib.array.to(CONSTANTS.DEFAULT_ATTRIBUTE_SELECTOR, /\s+/);
	if (!lib.array.len(attributeFilter)) {
            throw new Error("[ActiveTags] empty attribute filter list on observer");
	}

	const obs = lib.service.get("primitive.dom.changeobserver");
	if (!obs) {
            throw new Error("[ActiveTags] DomChangeObserver service not found: primitive.dom.changeobserver");
	}

	// keep a local ref (so your other methods can use this.domObserver if they do)
	this.domObserver = obs;

	// Apply configuration (service instance is shared; be explicit)
	// Root is frozen SOT but changeable via setRoot()
	obs.setRoot(root);

	// debounce + onChange live on opts (not per-selector)
	obs.opts.debounceMs = observe.debounceMs || 0;
	obs.opts.onChange = (batch) => this._onDomChanges(batch);

	// Selector specs: make per-selector options explicit and stable
	const selectorSpecs = selectors.map((selector) => ({
            selector,
            includeSubtreeMatches: true,
            observeAttributes: true,
            attributeFilter,
            // onEvent: optional per-selector event handler if you ever want it
	}));

	obs.setSelectors(selectorSpecs);

	// Start observing
	obs.start();
    },
    oldstartObserver() {
	if (!this.lib) return;
	if (this.domObserver) return;

	const lib = this.lib;
	const observe = (this.opts && this.opts.observe) ? this.opts.observe : {};

	const selectors = lib.array.filterStrings(
            observe.selectors ??
		observe.selector ??
		CONSTANTS.DEFAULT_SELECTOR
	);

	if (!lib.array.len(selectors)) {
            throw new Error("[ActiveTags] empty selector list on observer");
	}

	const root =
              observe.root ||
              lib.hash.get(lib, "_env.root.document.body");

	if (!root) {
            throw new Error("[ActiveTags] Cannot start observer: no document.body");
	}

	const attributeFilter = lib.array.to(CONSTANTS.DEFAULT_ATTRIBUTE_SELECTOR, /\s+/);
	if (!lib.array.len(attributeFilter)) {
            throw new Error("[ActiveTags] empty attribute filter list on observer");
	}
	
	this.domObserver = new DomChangeObserver({
            root,
            selectors,
            includeSubtreeMatches: true,
            observeAttributes: true,
            attributeFilter,
            debounceMs: observe.debounceMs || 0,
            onChange: (batch) => this._onDomChanges(batch),
	});

	this.domObserver.start();
    },

    /**
     * Collect matching elements (roots + descendants) from a DomChangeObserver record list.
     *
     * Records are expected to be objects shaped like: { el: HTMLElement, selectors: string[] }
     *
     * @param {Array} records
     * @param {string} selector Comma-separated selector list for matches/querySelectorAll
     * @returns {HTMLElement[]}
     */
    _collectMatchingNodes(records, selector) {
	const out = [];
	const seen = new Set();

	const push = (n) => {
            if (!n || n.nodeType !== 1) return;
            if (seen.has(n)) return;
            seen.add(n);
            out.push(n);
	};

	records = this.lib.array.to(records);

	for (let i = 0; i < records.length; i++) {
            const rec = records[i];
            const root = rec && rec.el ? rec.el : null;
            if (!root || root.nodeType !== 1) continue;

            if (root.matches && root.matches(selector)) push(root);

            if (root.querySelectorAll) {
		const found = root.querySelectorAll(selector);
		for (let j = 0; j < (found ? found.length : 0); j++) push(found[j]);
            }
	}

	return out;
    },

    _onDomChanges(batch) {
	const lib = this.lib;

	console.log("got a batch", batch);

	const parts = lib.hash.expand(batch || {}, "added changed removed changeAway");
	const added = parts[0] || [];
	const changed = parts[1] || [];
	const removed = parts[2] || [];
	const changeAway = parts[3] || [];

	const rawSelectors =
              lib.hash.get(this, "domObserver.opts.selectors") ||
              CONSTANTS.DEFAULT_SELECTOR;

	const selectors = lib.array.filterStrings(rawSelectors, { splitter: /\s+/ });
	if (!lib.array.len(selectors)) return;

	const selector = selectors.join(",");

	// add + changed => ensure jobs exist
	if (lib.array.len(added)) {
            const out = this._collectMatchingNodes(added, selector);
            if (out.length) this.registerJobs(out);
	}

	if (lib.array.len(changed)) {
            const out = this._collectMatchingNodes(changed, selector);
            if (out.length) this.registerJobs(out);
	}

	// removed + changeAway => unregister jobs
	if (lib.array.len(removed)) {
            for (let i = 0; i < removed.length; i++) {
		const el = removed[i] && removed[i].el ? removed[i].el : null;
		if (el) this.jobs.unregister(el);
            }
	}

	if (lib.array.len(changeAway)) {
            for (let i = 0; i < changeAway.length; i++) {
		const el = changeAway[i] && changeAway[i].el ? changeAway[i].el : null;
		if (el) this.jobs.unregister(el);
            }
	}

	return {
            addedCount: added.length,
            changedCount: changed.length,
            removedCount: removed.length,
            changeAwayCount: changeAway.length,
	};
    },
    stopObserver() {
	if (!this.domObserver) return;
	this.domObserver.stop();
	this.domObserver = null; // allow clean restart + GC
    },
    setObserverSelectors(selectors) {
	if (!this.domObserver) return;
	this.domObserver.setSelectors(selectors);
    }
};

export default trait_mutation_observer;


# --- end: traits/mutationObserver.js ---



# --- begin: traits/sweep.js ---

import CONSTANTS from '../constants.js';
export const trait_sweep = {

    /**
     * Discover candidate DOM elements for Active Tags jobs.
     *
     * `bootSweep` is a **pure discovery utility**. It inspects the DOM based on the
     * provided input and returns a de-duplicated list of DOM elements that *may*
     * be eligible to become Jobs.
     *
     * This method:
     * - Accepts selectors and/or DOM elements
     * - Normalizes all inputs into a flat list
     * - De-duplicates results
     * - Does NOT create Jobs
     * - Does NOT mutate runtime state
     * - Does NOT schedule or execute anything
     *
     * It is intentionally "dumb" and side-effect free so it can be safely reused by:
     * - `load()` (initial scan)
     * - MutationObserver handlers (subtree discovery)
     * - Manual or programmatic re-scans
     *
     * Accepted inputs:
     * - `null` / `undefined` → uses `ActiveTags.DEFAULT_SELECTOR`
     * - CSS selector string
     * - DOM Element
     * - Array / array-like of selectors and/or DOM elements
     *
     * @param {string|Element|Array<string|Element>|null} [sel=null]
     *        Selector(s) or DOM element(s) used to discover candidate nodes.
     *
     * @returns {Element[]}
     *          De-duplicated array of DOM elements discovered by the sweep.
     *          Returns an empty array if no candidates are found.
     *
     * @notes
     * - Returned elements are *candidates only*; eligibility and job creation
     *   are handled by `registerJobs()`.
     * - This method is safe to call repeatedly and on arbitrary subtrees.
     */
    
    sweep(sel = null) {
	const input = sel ?? CONSTANTS.DEFAULT_SELECTOR;

	const targets = lib.dom.is(input)
	      ? [input]
	      : lib.array.to(input);

	const out = [];
	const seen = new Set();

	const push = (node) => {
	    if (!node || !lib.dom.is(node) || seen.has(node)) return;
	    seen.add(node);
	    out.push(node);
	};

	for (const t of targets) {
	    // direct DOM element
	    if (lib.dom.is(t)) {
		push(t);
		continue;
	    }

	    // treat as selector
	    const selector = String(t ?? '').trim();
	    if (!selector) continue;

	    const nodes = document.querySelectorAll(selector);
	    for (const n of nodes) push(n);
	}

	if (out.length === 0) return [];
	return out;
    },

};

export default trait_sweep;


# --- end: traits/sweep.js ---

