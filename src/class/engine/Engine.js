// -----------------------------------------------------------------------------
// Engine (top-level façade)
//  - state   : owns authoritative runtime state + invariants (EngineState)
//  - tick    : owns execution/stepping (Tick)
//  - manager : owns management/policy API (EngineManager)
// -----------------------------------------------------------------------------

import EngineState   from './EngineState.js';
import EngineManager from './EngineManager.js';

import { Scheduler } from './Scheduler.js';
import { VM }        from './vm/VM.js';
import { Tick }      from './Tick.js';

export class Engine {
    constructor({ lib, jobRegistry, vm, scheduler, conf = {},expr } = {}) {
	if (!lib) throw new Error("Engine requires lib");
	this.lib = lib;
	const hooks    = lib.hash.to(conf.hooks);
	const builtins = lib.hash.to(conf.builtins);
	// external registry (jobLike -> job)
	this.jobRegistry = jobRegistry || null;

	// subsystems
	this.state = new EngineState({ lib });
	this.scheduler = scheduler || new Scheduler({ lib,engine:this });
	this.vm = vm || new VM({ lib, builtins,expr });

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

    tick({ ctx = {},ticket=null } = {}) {
	return this._tick.tick({ ctx,ticket });
    }


    async drain({ max = 1000, ticket = undefined, ctx = {}} = {}) {
	let did = 0;

	while (did < max) {
            const res = await this._tick.tick({ ctx, ticket });
            if (!res?.didWork) break;
            did++;
	}

	return did;
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
