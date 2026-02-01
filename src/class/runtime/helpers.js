// -----------------------------------------------------------------------------
// StageResult helpers
// -----------------------------------------------------------------------------

export const StageStatus = Object.freeze({
  OK: "ok",
  WAIT: "wait",
  ERROR: "error",
  COMPLETE: "complete",
});


export function SR_ok(detail) {
  return { status: StageStatus.OK, detail };
}
export function SR_wait(awaitInfo, detail) {
  return { status: StageStatus.WAIT, await: awaitInfo || null, detail };
}
export function SR_error(error, detail) {
  return { status: StageStatus.ERROR, error: error || new Error("Stage error"), detail };
}
export function SR_complete(detail) {
  return { status: StageStatus.COMPLETE, detail };
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
