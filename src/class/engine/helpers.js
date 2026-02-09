// -----------------------------------------------------------------------------
// StageResult helpers
// -----------------------------------------------------------------------------
import Buffer from './Buffer.js';
export const STAGE_STATUS_RANGE = ['ok','wait','error','complete']; 
export const STAGE_STATUS = Object.freeze({
    OK: "ok",
    WAIT: "wait",
    ERROR: "error",
    COMPLETE: "complete",
});

export const PIPELINE_PHASE_RUN    = "run";
export const PIPELINE_PHASE_ERROR  = "error";
export const PIPELINE_PHASE        = Object.freeze([PIPELINE_PHASE_RUN,PIPELINE_PHASE_ERROR]);

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
export function makeRunTicket({ job, pipelineKey, inputs, priority = 0, meta = {} } = {}) {
    const require = job.lib.hash.get(job, "config.schema.require",[]);
    return {
        id: `rt_${++_ticketCounter}`,
        jobId: job.id,
        createdAt: Date.now(),
        priority,
	buffer : new Buffer(),
	target : job.e,
        // what to run (VM expects this)
        pipelineKey: String(pipelineKey || "default"),
	require ,
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
    STAGE_STATUS_RANGE,
    STAGE_STATUS,
    PIPELINE_PHASE,
    PIPELINE_PHASE_RUN,
    PIPELINE_PHASE_ERROR,
    SR_ok,
    SR_wait,
    SR_error,
    SR_complete,
    makeRunTicket,

};
