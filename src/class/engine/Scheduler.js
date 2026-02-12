/**
 * Scheduler
 * =========
 *
 * Fairness and job-selection layer for the Engine.
 *
 * Role in the architecture
 * ------------------------
 * The Scheduler determines *which job runs next*.
 * It does NOT execute pipelines, mutate tickets, or interpret stages.
 * Execution is delegated to Tick / VM.
 *
 * Ordering model
 * --------------
 * - Primary ordering: JOB first (fairness across jobs)
 * - Secondary ordering: handled by EngineState (queue + active ticket)
 *
 * Internally maintains:
 * - `_ready`   : FIFO queue of runnable jobIds
 * - `_present` : Set used to prevent duplicate enqueues
 *
 * A job becomes runnable when:
 * - EngineManager enqueues a ticket
 * - The job is not locked
 * - The job has work (active ticket or queued ticket)
 *
 * Runnable gating
 * ----------------
 * Before returning a jobId from `nextRunnable()`, the Scheduler:
 *
 * 1) Resolves the job live via the JobRegistry
 *    - Jobs may be unloaded/detached at any time.
 *
 * 2) Ensures there is work:
 *    - Prefer `st.active`
 *    - Else peek at `st.queue[0]`
 *
 * 3) Enforces `ticket.require` dependencies
 *    - Each required job must resolve
 *    - Each required job must have `flags.hasRun === true`
 *
 * If gating fails, the job remains in the ready queue.
 *
 * Design constraints
 * ------------------
 * - Stateless with respect to ticket execution.
 * - No global dependency graph.
 * - No mutation of EngineState beyond removing ready entries.
 * - Cheap, predictable, FIFO fairness.
 *
 * Failure posture
 * ---------------
 * - Never throws during scheduling.
 * - Silently drops jobIds that no longer resolve.
 *
 * This class intentionally remains small.
 * Complex orchestration belongs in EngineManager or higher layers.
 */

// -----------------------------------------------------------------------------
// Scheduler (fairness: which job runs next)
// -----------------------------------------------------------------------------

export class Scheduler {
    /**
     * Create a Scheduler instance.
     *
     * The Scheduler is a lightweight fairness queue responsible for selecting
     * which jobId should run next. It does not execute tickets and does not
     * mutate engine state beyond readiness bookkeeping.
     *
     * @param {Object} [args]
     * @param {Object} args.lib
     *   Core utility library. Required.
     *
     * @param {Engine} args.engine
     *   Owning Engine instance. Required.
     *   Used to:
     *   - resolve jobs via the registry
     *   - inspect EngineState for runnable work
     *
     * Internal state initialized:
     * - `_ready`   : Array<string>
     *     FIFO queue of jobIds marked runnable.
     *
     * - `_present` : Set<string>
     *     Tracks which jobIds are already queued to prevent duplicates.
     *
     * @throws {Error}
     *   If `lib` or `engine` is missing.
     */
    constructor({ lib, engine } = {}) {
	this.lib = lib || null;
	this._ready = [];      // FIFO queue of jobIds
	this._present = new Set(); // prevent duplicates in _ready
	this.engine = engine;
	if(!lib || !engine) {
	    throw new Error("scheduler requires lib and engine");
	}
    }

    /**
     * Mark a job as runnable.
     *
     * Adds the given `jobId` to the internal FIFO ready queue
     * if it is not already present.
     *
     * Semantics:
     * - Idempotent: a jobId will only appear once in the ready queue.
     * - No validation is performed on job existence.
     * - Does not execute or inspect the job; it only schedules it
     *   for future selection by the scheduler.
     *
     * @param {string} jobId
     *   Identifier of the job to mark runnable.
     *
     * @returns {void}
     */
    markRunnable(jobId) {
	if (!jobId) return;
	if (this._present.has(jobId)) return;
	this._present.add(jobId);
	this._ready.push(jobId);
    }

    /**
     * Select the next runnable job id from the ready queue.
     *
     * This method implements the Scheduler’s gating logic and returns
     * a single `jobId` that is eligible for execution, or `null`
     * if no job can currently run.
     *
     * Selection algorithm:
     * - Iterates the internal FIFO `_ready` queue.
     * - Live-resolves each `jobId` via `engine.jobRegistry.resolve`.
     *   - If the job no longer exists, it is pruned from the queue.
     *
     * Ticket gating:
     * - For each job:
     *   - Prefer the `active` ticket (if present).
     *   - Otherwise, peek the head of the queued tickets.
     * - If no ticket exists, the job is removed from the ready queue.
     *
     * Require gate:
     * - If the selected ticket declares `require` dependencies,
     *   each dependency is resolved live via the registry.
     * - A dependency is considered satisfied only if:
     *     - the dependent job resolves successfully, and
     *     - `dep.flags.hasRun === true`.
     * - If any requirement is unmet, the job remains in `_ready`
     *   and evaluation continues with the next jobId.
     *
     * Success behavior:
     * - When a runnable job is found:
     *     - It is removed from `_ready`
     *     - Its presence marker is cleared from `_present`
     *     - The `jobId` is returned
     *
     * Failure behavior:
     * - If no runnable job is found, returns `null`.
     *
     * Notes:
     * - This method does not execute the job.
     * - It does not mutate ticket state beyond queue pruning.
     * - It performs live resolution to tolerate dynamic job unloads.
     *
     * @returns {string|null}
     *   The next runnable job id, or null if none are eligible.
     */
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

    /**
     * Legacy fallback implementation of `nextRunnable()`.
     *
     * Performs a simple FIFO dequeue without:
     * - live job resolution
     * - ticket inspection
     * - require/dependency gating
     *
     * Likely deprecated and retained only as a minimal
     * safety fallback or debugging aid.
     *
     * @returns {string|null}
     *   Next queued job id, or null if none.
     */
    //preserve incase the cock blocker fails to function
    basic_nextRunnable() {
	while (this._ready.length) {
	    const jobId = this._ready.shift();
	    this._present.delete(jobId);
	    if (jobId) return jobId;
	}
	return null;
    }

    /**
     * Clear scheduler presence for a specific job id.
     *
     * Semantics:
     * - Removes `jobId` from the internal `_present` set.
     * - Does NOT remove the job id from `_ready` directly.
     * - Allows the job to be re-marked runnable via `markRunnable()`.
     *
     * Design note:
     * - This is a lightweight reset mechanism.
     * - Queue entries are allowed to drain naturally through `nextRunnable()`.
     *
     * @param {string} jobId
     *   Job identifier to clear from scheduler presence tracking.
     *
     * @returns {void}
     */
    clear(jobId) {
	// cheap clear: let it drain naturally; remove presence so it can be re-enqueued
	if (jobId) this._present.delete(jobId);
    }
}



