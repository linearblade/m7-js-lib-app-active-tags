// -----------------------------------------------------------------------------
// StageResult helpers
// -----------------------------------------------------------------------------

export const STAGE_STATUS = Object.freeze({
    OK: "ok",
    WAIT: "wait",
    ERROR: "error",
    COMPLETE: "complete",
});
export const PIPELINE_PHASE = Object.freeze(["run","onError"]);


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
export function makeRunTicket({ jobId, pipelineKey, inputs, priority = 0, meta = {} } = {}) {
    return {
        id: `rt_${++_ticketCounter}`,
        jobId,
        createdAt: Date.now(),
        priority,

        // what to run (VM expects this)
        pipelineKey: String(pipelineKey || "default"),

        // cursor: where we are in the pipeline
        cursor: { stage: 0 },

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
    PIPELINE_PHASE,
    SR_ok,
    SR_wait,
    SR_error,
    SR_complete,
    makeRunTicket,

};
