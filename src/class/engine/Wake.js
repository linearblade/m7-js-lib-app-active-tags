import helpers from './helpers.js';

export class Wake {
    constructor({ lib, engine } = {}) {
	this.lib = lib || null;
	this.engine = engine;

	if (!lib || !engine) {
	    throw new Error("Wake requires lib and engine");
	}

	this._wakeTimer = null;
	this._wakeDelay = null;
    }

    refresh({
	max,
	ticket,
	requireJob,
	ctx,
	cascade = true,
	cascadeCtx = false,
	seedJobId = undefined,
    } = {}) {
	const delay = this.nextWaitDelay();
	if (delay == null) {
	    this.cancel();
	    return;
	}

	if (this._wakeTimer && this._wakeDelay <= delay) {
	    return;
	}

	if (this._wakeTimer) {
	    clearTimeout(this._wakeTimer);
	}

	this._wakeDelay = delay;
	this._wakeTimer = setTimeout(() => {
	    this._run({ max, ticket, requireJob, ctx, cascade, cascadeCtx, seedJobId });
	}, Math.max(0, delay));
    }

    cancel() {
	if (this._wakeTimer) {
	    clearTimeout(this._wakeTimer);
	    this._wakeTimer = null;
	    this._wakeDelay = null;
	}
    }

    async _run({
	max,
	ticket,
	requireJob,
	ctx,
	cascade = true,
	cascadeCtx = false,
	seedJobId = undefined,
    } = {}) {
	this._wakeTimer = null;
	this._wakeDelay = null;

	try {
	    this.requeueReadyWaiting();
	    await this.engine.drain({ max, ticket, requireJob, ctx, cascade, cascadeCtx, seedJobId });
	} catch (err) {
	    console.error("wake run failed", err);
	} finally {
	    this.refresh({ max, ticket, requireJob, ctx, cascade, cascadeCtx, seedJobId });
	}
    }

    /**
       Experimental.
       unlocks waiting tickets that are ready to be requeued.
       returns number of tickets unlocked.
     */
    requeueReadyWaiting(){
        let counter = 0;
        for (const [ticketId, rec] of this.engine.state.tickets) {
            //console.log(key, value);
            const {jobId, ticket} = rec;
            if(ticket.state !== helpers.TICKET_STATE.WAIT)
                continue;
            if (this.engine._tick._isTicketBlocked({ticket}) )
                continue;
            //const success = this.unlockTicket(ticket.id);
            this.engine.scheduler.markRunnable(jobId);
            counter ++;
        }
        return counter;
    }

        /**
       Experimental.
       get the next time a waiting ticket can run. if none are waiting to be run, or have no timer, null is returned.
    */
    nextWaitDelay() {
        const now = Date.now();
        let minTime = Infinity;

        for (const [ticketId, rec] of this.engine.state.tickets) {
            const { jobId, ticket } = rec;

            if (ticket.state !== helpers.TICKET_STATE.WAIT) continue;

            if (!this.engine._tick._isTicketBlocked({ ticket }))
                return now;


            const next = ticket?.lock?.until;
            if (typeof next === 'number' && next < minTime) {
                minTime = next;
            }
        }

        if (minTime === Infinity) return null;
        return Math.max(0, minTime - now);
    }
    
}

export default Wake;
