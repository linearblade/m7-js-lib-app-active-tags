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
    constructor({ lib, engine } = {}) {
	this.lib = lib || null;
	this._ready = [];      // FIFO queue of jobIds
	this._present = new Set(); // prevent duplicates in _ready
	this.engine = engine;
	if(!lib || !engine) {
	    throw new Error("scheduler requires lib and engine");
	}
    }

    markRunnable(jobId) {
	if (!jobId) return;
	if (this._present.has(jobId)) return;
	this._present.add(jobId);
	this._ready.push(jobId);
    }

    nextRunnable() {
	const engine = this.engine;
	const registry = engine.jobRegistry;

	for (let i = 0; i < this._ready.length; i++) {
            const jobId = this._ready[i];
            if (!jobId) continue;

            // live resolve (jobs may unload)
            const job = registry.resolve(jobId);
            if (!job) {
		// job no longer exists — remove from scheduler
		this._ready.splice(i, 1);
		this._present.delete(jobId);
		i--;
		continue;
            }

	    const st = engine.state.jobState(jobId);

	    // Ticket selection for gating:
	    // - prefer active (already running)
	    // - else peek head of queue (not yet activated)
	    const ticket = st.active || (st.queue && st.queue.length ? st.queue[0] : null);

	    if (!ticket) {
		// nothing to run; jobId should not be in scheduler
		this._ready.splice(i, 1);
		this._present.delete(jobId);
		i--;
		continue;
	    }
	    
            // REQUIRE GATE (live, no global registry)
            if (ticket.require && ticket.require.length) {
		let ok = true;

		for (const reqJobLike of ticket.require) {
                    const dep = registry.resolve(reqJobLike);
                    if (!dep || !dep.flags || dep.flags.hasRun !== true) {
			ok = false;
			break;
                    }
		}

		if (!ok) continue; // cock blocked (requirements not met)
            }

            // Runnable — remove from queue and return
            this._ready.splice(i, 1);
            this._present.delete(jobId);
            return jobId;
	}

	return null;
    }
    
    //preserve incase the cock blocker fails to function
    basic_nextRunnable() {
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



