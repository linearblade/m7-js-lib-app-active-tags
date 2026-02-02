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
