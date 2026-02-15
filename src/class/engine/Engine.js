/**
 * Engine (Top-Level Runtime Façade)
 * ==================================
 *
 * Public execution entry point for the ActiveTags runtime.
 *
 * The Engine coordinates ticket lifecycle and execution while delegating
 * concrete responsibilities to specialized subsystems:
 *
 * Subsystems
 * ----------
 * @property {EngineState} state
 *   Owns authoritative runtime state and invariants.
 *   Responsible for ticket storage, queues, locks, and lifecycle tracking.
 *
 * @property {Tick} tick
 *   Owns deterministic execution/stepping logic.
 *   Selects the next runnable ticket and advances it one stage via the VM.
 *
 * @property {EngineManager} manager
 *   Owns management and policy APIs.
 *   Responsible for enqueue, cancel, resolution, locking, and queue policy.
 *
 * @property {VM} vm
 *   Executes a single validated pipeline step and returns a StageResult.
 *
 * Design Principles
 * -----------------
 * 1. Thin façade.
 *    Engine exposes the public API surface but does not implement
 *    execution or policy logic directly.
 *
 * 2. Strict separation of concerns.
 *    - EngineState is the single source of truth for runtime data.
 *    - Tick controls deterministic progression.
 *    - EngineManager controls mutation and policy.
 *
 * 3. Ticket-based runtime.
 *    All execution flows through tickets:
 *    `{ job, pipelineKey, inputs, meta, stageState, status }`.
 *
 * 4. Deterministic stepping.
 *    - `tick()` performs at most one unit of work.
 *    - `drain()` repeatedly invokes `tick()` until no runnable work remains
 *      or limits are reached.
 *
 * 5. Observable lifecycle.
 *    Hook surfaces allow instrumentation (enqueue, dequeue, stage,
 *    completion, error) without mutating engine logic.
 *
 * Non-Responsibilities
 * --------------------
 * - Does NOT manage job registration (Registry).
 * - Does NOT perform DOM discovery or configuration (JobConfig).
 * - Does NOT define schema compilation (schema/Master).
 * - Does NOT own higher-level scheduling semantics beyond ticket runtime.
 *
 * Lifecycle Overview
 * ------------------
 * enqueue()  → ticket created + queued
 * tick()     → selects next runnable ticket → VM.step()
 * drain()    → repeated tick() until idle or limit
 * cancel()   → remove ticket(s)
 * lock()     → concurrency gate control
 *
 * The Engine is strictly runtime-oriented. Configuration and identity
 * management are handled by other subsystems.
 *
 * @module Engine
 */

import EngineState   from './EngineState.js';
import EngineManager from './EngineManager.js';

import { Scheduler } from './Scheduler.js';
import { VM }        from './vm/VM.js';
import { Tick }      from './Tick.js';

export class Engine {

    /**
     * Create a new Engine instance.
     *
     * The constructor wires together all runtime subsystems but does not
     * execute any work. The Engine becomes operational once tickets are
     * enqueued and `tick()` / `drain()` are invoked.
     *
     * Dependency Injection Model
     * ---------------------------
     * All major subsystems are injectable to allow:
     * - testing with mocks/fakes
     * - custom schedulers
     * - alternate VM implementations
     * - hook instrumentation
     *
     * If not provided, sane defaults are constructed.
     *
     * @param {Object} args
     *
     * @param {Object} args.lib
     * Required core utility library. Used for hashing, coercion,
     * defensive guards, and internal helpers.
     *
     * @param {ActiveTags} [args.AT]
     * Optional owning ActiveTags instance.
     * When provided, it is forwarded to VM constructor as runtime context anchor.
     *
     * @param {JobRegistry} [args.jobRegistry]
     * Optional external job registry used to resolve job-like references
     * into canonical Job instances.
     *
     * @param {VM} [args.vm]
     * Optional VM instance. If omitted, a default VM is constructed.
     *
     * @param {Scheduler} [args.scheduler]
     * Optional runtime scheduler instance. If omitted, a default Scheduler
     * is created and bound to this Engine.
     *
     * @param {ExpressionResolver} [args.expr]
     * Optional expression resolver injected into the default VM.
     *
     * @param {Object} [args.conf]
     * Optional configuration object.
     *
     * @param {Object} [args.conf.hooks]
     * Lifecycle hook callbacks. All hooks are optional.
     *
     * @param {Function} [args.conf.hooks.onEnqueue]
     * Invoked after a ticket is successfully enqueued.
     *
     * @param {Function} [args.conf.hooks.onDequeue]
     * Invoked when a ticket is selected for execution.
     *
     * @param {Function} [args.conf.hooks.onStage]
     * Invoked after a VM stage step completes.
     *
     * @param {Function} [args.conf.hooks.onTicketDone]
     * Invoked when a ticket reaches a terminal state.
     *
     * @param {Function} [args.conf.hooks.onComplete]
     * Invoked when the engine becomes idle after draining.
     *
     * @param {Function} [args.conf.hooks.onError]
     * Invoked when a stage or ticket error occurs.
     *
     * @param {Object} [args.conf.builtins]
     * Optional builtin operation map injected into the default VM.
     *
     * Constructed Subsystems
     * ----------------------
     * @property {EngineState} state
     * Authoritative runtime state container.
     *
     * @property {Scheduler} scheduler
     * Runtime scheduler responsible for queue coordination.
     *
     * @property {VM} vm
     * Pipeline execution virtual machine.
     * Receives optional `AT` runtime anchor via constructor injection.
     *
     * @property {EngineManager} manager
     * Policy + coordination layer (enqueue, cancel, locks, etc.).
     *
     * @property {Tick} _tick
     * Deterministic stepping executor.
     *
     * @property {Object} hooks
     * Normalized hook registry (all hooks default to null).
     *
     * @throws {Error}
     * If `lib` is not provided.
     */

    constructor({ lib, jobRegistry, vm, scheduler, conf = {},expr,AT } = {}) {
	if (!lib) throw new Error("Engine requires lib");
	this.lib = lib;
	const hooks    = lib.hash.to(conf.hooks);
	const builtins = lib.hash.to(conf.builtins);
	// external registry (jobLike -> job)
	this.jobRegistry = jobRegistry || null;

	// subsystems
	this.state = new EngineState({ lib });
	this.scheduler = scheduler || new Scheduler({ lib,engine:this });
	this.vm = vm || new VM({ lib, builtins,expr,AT });

	// hooks (optional)
	this.hooks = {
	    onEnqueue: hooks.onEnqueue || null,
	    onDequeue: hooks.onDequeue || null,
	    onStage: hooks.onStage || null,
	    onTicketDone: hooks.onTicketDone || null,
	    onComplete: hooks.onComplete || null,
	    onError: hooks.onError || null,
	};
	//console.log('got hooks', this.hooks);
	// manager (policy + coordination)
	this.manager = new EngineManager({ lib, engine: this });

	// executor (stepping)
	this._tick = new Tick({ lib, engine: this });
    }

    // ---------------------------------------------------------------------------
    // Public execution façade
    // ---------------------------------------------------------------------------

    tick({ ctx = {}, ticket = null, requireJob = undefined } = {}) {
	return this._tick.tick({ ctx, ticket, requireJob });
    }


    async drain({ max = 1000, ticket = undefined, requireJob = undefined, ctx = {}} = {}) {
	let did = 0;
	const requireFilter = ticket ? undefined : requireJob;

	while (did < max) {
            const res = await this._tick.tick({ ctx, ticket, requireJob: requireFilter });
            if (!res?.didWork) break;
            did++;
	}

	return did;
    }
    // ---------------------------------------------------------------------------
    // Job resolution (shared helper used by manager/tick)
    // ---------------------------------------------------------------------------
    /**
     * Resolve a job-like reference into a registered Job instance.
     *
     * This is a thin delegation to the injected JobRegistry resolver.
     * Engine does not define or extend resolution semantics.
     *
     * Contract
     * --------
     * - Returns the resolved Job when the reference is recognized.
     * - Returns null when the reference cannot be resolved.
     * - Throws only when the Engine is misconfigured (missing jobRegistry.resolve).
     *
     * Accepted reference forms are defined by the JobRegistry implementation and
     * commonly include:
     * - job id (string)
     * - DOM element
     * - Job instance or job-like object
     *
     * @param {*} jobLike
     *   Reference to resolve.
     *
     * @returns {Job|null}
     *   Resolved Job, or null if not found.
     *
     */
    _resolveJob(jobLike) {
	const jr = this.jobRegistry;
	return jr.resolve(jobLike);
    }

    // ---------------------------------------------------------------------------
    // Management façade (delegates to EngineManager)
    // ---------------------------------------------------------------------------
    //
    // This section intentionally exposes a thin, stable public API surface on
    // Engine while delegating all policy and mutation semantics to EngineManager.
    //
    // These methods do not implement behavior themselves. They forward arguments
    // directly to EngineManager so that:
    // - the Engine façade stays small and readable
    // - policy remains centralized in one subsystem
    // - documentation can live with the true implementation
    //
    // See EngineManager for full contracts and detailed semantics:
    // - getTicketByJob
    // - enqueue
    // - lockTicket / unlockTicket
    // - lock / unlock
    // - cancel / cancelTicket
    // ---------------------------------------------------------------------------
    getTicketByJob(jobLike, key) {
	return this.manager.getTicketByJob(jobLike, key);
    }
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
