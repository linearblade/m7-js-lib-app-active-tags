// -----------------------------------------------------------------------------
// StageResult helpers
// -----------------------------------------------------------------------------
import Buffer from './Buffer.js';
export { ARR_TO_OPTS } from '../../constants.js';

export const STAGE_STATUS_RANGE = ['ok','wait','error','complete']; 
export const STAGE_STATUS = Object.freeze({
    OK: "ok",
    WAIT: "wait",
    ERROR: "error",
    COMPLETE: "complete",
});

/**
 * Canonical ticket lifecycle states.
 *
 * These represent the execution state of a single ticket
 * within the Engine runtime.
 *
 * State flow (typical):
 *   READY → RUNNING → (WAIT | COMPLETE | ERROR)
 *   WAIT  → RUNNING → (WAIT | COMPLETE | ERROR)
 *
 * Notes:
 * - READY     : Enqueued, not yet executing.
 * - RUNNING   : Currently executing a stage.
 * - WAIT      : Suspended awaiting async resolution.
 * - ERROR     : Execution failed (terminal).
 * - COMPLETE  : Execution finished successfully (terminal).
 */
export const TICKET_STATE = Object.freeze({
    READY: "ready",
    RUNNING: "running",
    WAIT: "wait",
    ERROR: "error",
    COMPLETE: "complete",
});

export const HOOKS = Object.freeze({
    ENQUEUE  : "onEnqueue",
    DEQUEUE  : "onDequeue",
    STAGE    : "onStage",
    COMPLETE : "onComplete",
    ERROR    : "onError",
    DONE     : "onTicketDone",
});

export const PIPELINE_KEY_DEFAULT  = "default";
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

/**
 * Create a new runtime ticket for executing a pipeline.
 *
 * A ticket represents a single execution instance of:
 *   (jobId + pipelineKey)
 *
 * Tickets are owned and indexed by EngineState and are stepped by the VM
 * via Tick. They are ephemeral runtime records and should not be persisted.
 *
 * Lifecycle:
 * - Initial state: TICKET_STATE.READY
 * - May transition through: running → wait → complete | error
 * - Cancel/lock operations mutate ticket.state or ticket.lock externally.
 *
 * Structural responsibilities:
 * - Identifies the job and pipeline to execute.
 * - Tracks execution cursor (stage pointer).
 * - Carries mutable runtime inputs.
 * - Stores per-run execution artifacts (buffer, last result, await handle).
 *
 * Deduplication:
 * - EngineManager ensures alias-level deduping before creating tickets.
 * - makeRunTicket assumes dedupe has already occurred.
 *
 * @param {Object} args
 * @param {Job} args.job
 *     Resolved Job instance. Must contain a valid `id` and `e`.
 *
 * @param {string} args.pipelineKey
 *     Logical pipeline key to execute.
 *
 * @param {Object} [args.inputs]
 *     Mutable runtime inputs passed into the VM.
 *     These persist for the lifetime of the ticket.
 *
 * @param {number} [args.priority=0]
 *     Scheduling priority. Higher values may be favored by the Scheduler.
 *
 * @param {Object} [args.meta]
 *     Opaque metadata attached to the ticket (diagnostics/hooks).
 *
 * @returns {Object} ticket
 *
 * Ticket shape (v1):
 * - id          : unique runtime ticket id
 * - jobId       : owning job id
 * - createdAt   : timestamp (ms)
 * - priority    : numeric scheduling priority
 * - buffer      : execution buffer (engine Buffer instance)
 * - target      : DOM anchor (job.e)
 * - pipelineKey : pipeline identifier
 * - require     : pipeline dependency list (from schema.require)
 * - cursor      : { stage: number } execution pointer
 * - inputs      : mutable runtime input object
 * - state       : TICKET_STATE.*
 * - last        : last stage result (or null)
 * - await       : wait handle / promise reference (or null)
 * - meta        : opaque metadata
 */

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
        state: TICKET_STATE.READY, 
        last: null,
        await: null,

        meta: meta || {},
    };
}

export default {
    STAGE_STATUS_RANGE,
    STAGE_STATUS,
    PIPELINE_KEY_DEFAULT,
    PIPELINE_PHASE,
    PIPELINE_PHASE_RUN,
    PIPELINE_PHASE_ERROR,
    SR_ok,
    SR_wait,
    SR_error,
    SR_complete,
    makeRunTicket,
    TICKET_STATE,
    HOOKS
};
