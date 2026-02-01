import helpers from './helpers.js';

export class Tick {
    constructor({ lib, engine }) {
        this.lib = lib;
        this.engine = engine;
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
            res = { status: helpers.STAGE_STATUS.ERROR, error: err };
        }

        v.ticket.last = { at: Date.now(), res };
        if (this.engine.hooks.onStage) this.engine.hooks.onStage({ job: v.job, ticket: v.ticket, res });

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
        if (!jobId) return { done: true, res: { didWork: false } };

        // If active ticket is locked, do not run this job now
        if (this.engine.state.isLockedJobId(jobId)) {
            return { done: true, res: { didWork: false, jobId, locked: true } };
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
            return { done: true, res: { didWork: false, jobId, missingJob: true } };
        }

        const st = this.engine.state.jobState(jobId);

        // Ensure there is an active ticket (one active per job)
        if (!st.active) {
            st.active = st.queue.shift() || null;
            if (st.active && this.engine.hooks.onDequeue) {
                this.engine.hooks.onDequeue({ job, ticket: st.active });
            }
        }

        const ticket = st.active;
        if (!ticket) {
            return { done: true, res: { didWork: false, jobId, empty: true } };
        }

        // If ticket is locked, do not run
        if (ticket.lock) {
            if (this.engine.state.isExpired(ticket.lock)) ticket.lock = null;
            else return { done: true, res: { didWork: false, jobId, ticketId: ticket.id, locked: true } };
        }

        ticket.state = "running";

        return { done: false, jobId, job, st, ticket, ctx };
    }

    _responseOk(env) {
        const { jobId, ticket, res } = env;
        this.engine.scheduler.markRunnable(jobId);
        return { didWork: true, jobId, ticketId: ticket.id, result: res };
    }

    _responseWait(env) {
        const { jobId, ticket, res } = env;
        ticket.state = "wait";
        ticket.lock = res.lock || res.await || { type: "wait", token: `aw_${Date.now()}` };
        return { didWork: true, jobId, ticketId: ticket.id, result: res, waiting: true };
    }

    _responseError(env) {
        const { jobId, job, ticket, res, st, finalize } = env;

        st.stats.errors += 1;
        if (this.engine.hooks.onError) {
            this.engine.hooks.onError({ job, ticket, error: res?.error, res });
        }

        finalize("error");
        if (this.engine.hooks.onTicketDone) {
            this.engine.hooks.onTicketDone({ job, ticket, state: "error" });
        }

        return { didWork: true, jobId, ticketId: ticket.id, result: res, error: true };
    }

    _responseComplete(env) {
        const { jobId, job, ticket, res, st, finalize } = env;

        st.stats.runs += 1;

        finalize("complete");
        if (this.engine.hooks.onTicketDone) {
            this.engine.hooks.onTicketDone({ job, ticket, state: "complete" });
        }

        return { didWork: true, jobId, ticketId: ticket.id, result: res, complete: true };
    }

    _responseUnknown(env) {
        const { jobId, job, ticket, res, st, finalize } = env;
        const err = new Error(`Unknown stage status '${res?.status}'`);

        st.stats.errors += 1;
        if (this.engine.hooks.onError) {
            this.engine.hooks.onError({ job, ticket, error: err, res });
        }

        finalize("error");
        if (this.engine.hooks.onTicketDone) {
            this.engine.hooks.onTicketDone({ job, ticket, state: "error" });
        }

        return {
            didWork: true,
            jobId,
            ticketId: ticket.id,
            result: { status: helpers.STAGE_STATUS.ERROR, error: err },
            error: true,
        };
    }
}

export default Tick;
