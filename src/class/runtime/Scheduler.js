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



