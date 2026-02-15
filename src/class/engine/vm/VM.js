/**
 * VM (Virtual Machine)
 * ====================
 * Deterministic, single-step execution engine for a single ticket.
 *
 * Role
 * ----
 * - Executes exactly ONE pipeline stage transition per call.
 * - Applies validation, op execution, normalization, and phase routing.
 * - Produces a canonical StageResult object consumed by Tick.
 *
 * Architectural Position
 * ----------------------
 * Engine
 *   → Tick (scheduler + lifecycle control)
 *       → VM (pure stage execution)
 *           → Validate (pipeline + step resolution)
 *           → OP (return normalization + labeling)
 *
 * The VM does NOT:
 * - Schedule tickets
 * - Finalize tickets
 * - Emit hooks
 * - Mutate engine state outside the active ticket
 *
 * Execution Model
 * ---------------
 * `step({ job, ticket, ctx })` performs:
 *
 * 1) Runtime grooming
 *    - Ensures ticket has required runtime fields
 *      (cursor, phase, errorInfo).
 *
 * 2) Validation
 *    - Resolves pipeline definition by key.
 *    - Resolves current phase:  helpers.PIPELINE_PHASE_RUN ("run") | helpers.PIPELINE_PHASE_ERROR ("error")
 *    - Resolves current stage and operation.
 *    - Produces either:
 *        - `err`  → StageResult error
 *        - `done` → StageResult complete
 *        - or executable stage metadata
 *
 * 3) Stage execution (if applicable)
 *    - Materializes arguments via `expr`.
 *    - Invokes stage function.
 *    - Catches thrown errors and converts to `SR_error`.
 *    - Normalizes return value via OP._normalizeReturn().
 *
 * 4) Stage identity stamping
 *    - Snapshots pre-mutation execution identity:
 *        { phase, stageIndex, pipelineKey, op, step }
 *    - Injects stable metadata into `res.detail`
 *      to preserve stage identity across transitions.
 *
 * 5) Status dispatch
 *    - OK       → advance cursor
 *    - WAIT     → no cursor change
 *    - COMPLETE → emit early completion StageResult
 *    - ERROR    → apply error-phase routing semantics
 *    - Unknown  → converted to SR_error
 *
 * Phase Semantics
 * ---------------
 * - Phase is one of:
 *     helpers.PIPELINE_PHASE_RUN   ("run")
 *     helpers.PIPELINE_PHASE_ERROR ("error")
 *
 * - When a stage fails:
 *     - If an error-phase pipeline exists, transition into it.
 *     - Otherwise, return a terminal error StageResult.
 *
 * - If already in PIPELINE_PHASE_ERROR and a stage fails,
 *   the error is terminal and annotated as handler failure.
 *
 * Return Contract
 * ---------------
 * `step()` returns a normalized StageResult-like object:
 *
 *   {
 *     status: helpers.STAGE_STATUS.*,
 *     detail: { ...stable metadata... },
 *     error?: Error
 *   }
 *
 * Additionally:
 * - `return_status` is attached to the returned object
 *   and reflects the raw status BEFORE any transition
 *   (e.g., before entering error phase).
 *
 * Determinism Guarantees
 * ----------------------
 * - Executes at most one stage.
 * - Never throws outward.
 * - Always returns a StageResult-like object.
 * - Only mutates:
 *     - ticket.phase
 *     - ticket.cursor.stage
 *     - ticket.errorInfo
 *
 * This class is intentionally side-effect minimal and
 * scheduling-agnostic.
 */

import helpers from '../helpers.js';
import Validate from './Validate.js';
import OP       from './OP.js';

export class VM {
    /**
     * Create a VM instance.
     *
     * @param {Object} args
     * @param {Object} args.lib
     * Required utility library.
     * @param {Object} [args.builtins]
     * Optional builtin operation surface.
     * @param {Object} [args.expr]
     * Optional expression resolver/materializer.
     * @param {ActiveTags} [args.AT]
     * Optional owning ActiveTags runtime instance.
     * Stored on `this.AT` as runtime context anchor.
     */
    constructor({ lib, builtins,expr,AT } = {}) {
	if(!lib)       throw new Error("PASS lib :) ");
	this.AT = AT;
	this.lib       = lib ;
	this.builtins  = builtins || {}; //this is unnecessary but the AI bitches when I lint, b/c it seems to have trouble reading my libs.
	this.validator = new Validate({lib,builtins});
	this.op        = new OP({lib});
	this.expr      = expr;
    }


    /**
     * Execute exactly ONE pipeline stage transition for a ticket.
     *
     * This is the core execution primitive of the VM. It performs validation,
     * optional stage execution, normalization, and phase-aware dispatch — but
     * does NOT schedule, finalize, or emit hooks.
     *
     * Execution pipeline
     * ------------------
     * 1) Runtime grooming
     *    - Ensures required ticket runtime fields exist
     *      (cursor, phase, errorInfo).
     *
     * 2) Step validation
     *    - Resolves pipeline definition and current phase.
     *    - Resolves the current stage record and operation.
     *    - May produce:
     *        - `v.err`  → StageResult error
     *        - `v.done` → StageResult complete
     *        - executable stage metadata
     *
     *    Validation results are NOT early-returned; they flow through the
     *    same dispatch logic as normal stage execution.
     *
     * 3) Stage execution (when applicable)
     *    - Materializes arguments via `expr.materialize`.
     *    - Invokes the resolved stage function.
     *    - Current invocation payload shape is:
     *      `{ job, lib, args, buffer, inputs, trigger, ticket, ctx, AT, step }`.
     *    - `AT` runtime anchor is injected into VM (`this.AT`) by constructor.
     *      It is forwarded to each stage as top-level `AT`.
     *    - Catches thrown errors and converts them to `helpers.SR_error`.
     *    - Normalizes return value via `OP._normalizeReturn`.
     *
     * 4) Stage identity snapshot
     *    - Captures pre-mutation identity:
     *        { phase, stageIndex, pipelineKey, op, step }
     *    - Stamps stable metadata into `res.detail`.
     *
     * 5) Status dispatch
     *    - helpers.STAGE_STATUS.OK       → advance cursor
     *    - helpers.STAGE_STATUS.WAIT     → no cursor mutation
     *    - helpers.STAGE_STATUS.ERROR    → apply error-phase routing
     *    - helpers.STAGE_STATUS.COMPLETE → early completion result
     *    - Unknown                       → converted to SR_error
     *
     * Phase semantics
     * ---------------
     * - Phase is one of:
     *     helpers.PIPELINE_PHASE_RUN   ("run")
     *     helpers.PIPELINE_PHASE_ERROR ("error")
     *
     * - When a stage fails:
     *     - If an error-phase pipeline exists, execution transitions into
     *       PIPELINE_PHASE_ERROR.
     *     - Otherwise, the error remains terminal.
     *
     * Return semantics
     * ----------------
     * - Always returns a normalized StageResult-like object.
     * - Never throws.
     * - Adds `return_status` property to the returned object.
     *   This reflects the raw status BEFORE any handler-induced transition
     *   (e.g., before entering PIPELINE_PHASE_ERROR).
     *
     * Mutations
     * ---------
     * This method may mutate:
     *   - ticket.cursor.stage
     *   - ticket.phase
     *   - ticket.errorInfo
     *
     * It does NOT:
     *   - finalize tickets
     *   - emit engine hooks
     *   - schedule other tickets
     *
     * @param {Object} args
     * @param {Object} args.job
     *   Job definition containing pipeline configuration.
     *
     * @param {Object} args.ticket
     *   Active ticket being executed.
     *
     * @param {Object} args.ctx
     *   Execution context passed through to the stage function.
     *
     * @returns {Promise<Object>}
     *   A normalized StageResult-like object with:
     *     - `status`  (helpers.STAGE_STATUS.*)
     *     - `detail`  (augmented stage metadata)
     *     - optional `error`
     *     - `return_status` (raw pre-transition status)
     */
    async step({ job, ticket, ctx }) {
	const lib = this.lib;
	this.validator._ensureTicketRuntime(ticket);

	const v = this.validator._validateStep({ job, ticket });

	const tagNoStage = (sr) => {
	    if (!sr || typeof sr !== "object") return sr;
	    if (!sr.detail || typeof sr.detail !== "object") sr.detail = {};
	    sr.detail.noStage = true;
	    return sr;
	};

	// always compute trigger + snapshot (even for validate errors)
	const trigger =
	      lib.hash.get(ticket, "inputs.trigger") ||
	      lib.hash.get(job, "e") ||
	      null;

	const snapShot = this._snapShot({ v, ticket });

	let res;

	// ------------------------------------------------------------
	// 1) Validate-time outcomes become normal "res" values
	//    (NO early returns; must flow through handler dispatch)
	// ------------------------------------------------------------
	if (v.err) {
	    res = tagNoStage(v.err);
	} else if (v.done) {
	    res = tagNoStage(v.res || v.err);
	} else {
	    // ------------------------------------------------------------
	    // 2) Normal stage execution
	    // ------------------------------------------------------------
	    try {
		const args = this.expr.materialize({ticket,job},v.args);
		res = await v.fn({
		    job,
		    lib,
		    args: args,
		    buffer : ticket.buffer,
		    inputs: ticket.inputs,
		    trigger,
		    target :  ticket.target,
		    e : job.e,
		    ticket,
		    ctx,
		    AT:this.AT,

		    step: v.stepRec,
		});
	    } catch (err) {
		res = helpers.SR_error(err, { pipelineKey: v.pipelineKey, op: v.op, step: v.stepRec });
	    }

	    // normalize only for real op execution
	    res = this.op._normalizeReturn(res, { pipelineKey: v.pipelineKey, op: v.op });
	}

	if (!res || typeof res !== "object") {
	    return helpers.SR_error(new Error("VM produced non-object StageResult"), { pipelineKey: snapShot.pipelineKey });
	}
	
	// raw status MUST be captured BEFORE any handler transforms it (enter PIPELINE_PHASE_ERROR, etc.)
	const return_status = res.status ?? null;

	// finalizeResponse can attach stage metadata, etc. (keep as you have it)
	res = this._finalizeResponse(res, snapShot);

	const env = { job, ticket, ctx, v, res, return_status };

	const disp = {
	    [helpers.STAGE_STATUS.OK]:       this._responseOk,
	    [helpers.STAGE_STATUS.WAIT]:     this._responseWait,
	    [helpers.STAGE_STATUS.ERROR]:    this._responseError,   // <- critical: now runs for v.err too
	    [helpers.STAGE_STATUS.COMPLETE]: this._responseComplete,
	};

	const handler = disp[res?.status] || this._responseUnknown;
	const rv = handler.call(this, env);

	// preserve your rule: return_status is raw, unmodified by handler transitions
	rv.return_status = return_status;

	return rv;
    }
    
    /**
     * Handle an OK stage result.
     *
     * Advances the ticket cursor to the next stage within the
     * current pipeline phase and returns the original StageResult.
     *
     * Mutates:
     * - ticket.cursor.stage
     *
     * @param {Object} env
     * @param {Object} env.ticket
     * @param {Object} env.res
     * @returns {Object} StageResult
     */
    _responseOk({ ticket, res }) {
	ticket.cursor.stage += 1;
	return res;
    }

    /**
     * Handle a WAIT stage result.
     *
     * Leaves ticket execution state unchanged. The ticket remains
     * at the current stage and will be resumed by the scheduler.
     *
     * @param {Object} env
     * @param {Object} env.res
     * @returns {Object} StageResult
     */
    _responseWait({ res }) {
	return res;
    }

    /**
     * Handle a COMPLETE stage result.
     *
     * Produces a normalized early-completion StageResult.
     * Does not advance the cursor. Finalization and lifecycle
     * handling are performed by Tick.
     *
     * @param {Object} env
     * @param {Object} env.v
     *   Validated execution context for the current stage.
     *
     * @returns {Object} StageResult (helpers.SR_complete)
     */
    _responseComplete({ v }) {
	return helpers.SR_complete({ pipelineKey: v.pipelineKey, op: v.op, early: true });
    }


    /**
     * Handle a stage failure and apply error-phase routing semantics.
     *
     * This method determines whether a failing stage:
     *   1) Transitions execution into helpers.PIPELINE_PHASE_ERROR, or
     *   2) Remains a terminal error.
     *
     * Behavior
     * --------
     * 1) If the ticket is already in helpers.PIPELINE_PHASE_ERROR:
     *    - The error handler itself has failed.
     *    - A terminal helpers.SR_error is returned.
     *    - The original error context is preserved and annotated
     *      (`onErrorFailed`, `onErrorOp`, `onErrorStep`).
     *
     * 2) If the ticket is NOT in helpers.PIPELINE_PHASE_ERROR and the pipeline
     *    defines an error-phase track:
     *    - ticket.errorInfo is populated with the original failure context.
     *    - ticket.phase is set to helpers.PIPELINE_PHASE_ERROR.
     *    - ticket.cursor.stage is reset to 0.
     *    - An helpers.SR_ok result is returned to signal transition
     *      into the error phase.
     *
     * 3) If no error-phase pipeline exists:
     *    - The original StageResult is returned unchanged.
     *    - Tick will treat it as a terminal error.
     *
     * Mutations
     * ---------
     * When transitioning into helpers.PIPELINE_PHASE_ERROR,
     * this method mutates:
     *   - ticket.phase
     *   - ticket.cursor.stage
     *   - ticket.errorInfo
     *
     * It does NOT:
     *   - finalize tickets
     *   - emit hooks
     *   - schedule execution
     *
     * @param {Object} env
     * @param {Object} env.ticket
     *   Active ticket whose execution state is being evaluated.
     * @param {Object} env.v
     *   Validated execution context for the current stage
     *   (pipelineKey, pipelineDef, op, stepRec, etc.).
     * @param {Object} env.res
     *   Normalized StageResult representing the stage failure.
     *
     * @returns {Object}
     *   A StageResult:
     *     - helpers.SR_ok(...)    when entering helpers.PIPELINE_PHASE_ERROR
     *     - helpers.SR_error(...) when the error is terminal
     *     - or the original `res` if no error handler exists
     */
    _responseError({ ticket, v, res }) {

	// If the error handler itself fails (we are already in PIPELINE_PHASE_ERROR),
	// do NOT re-enter PIPELINE_PHASE_ERROR. Surface handler failure and preserve original.
	if (ticket.phase === helpers.PIPELINE_PHASE_ERROR) {
	    const detail = this.lib.hash.to(res.detail);

	    if (!detail.original) 
		detail.original = ticket.errorInfo || null;

	    detail.onErrorFailed = true;
	    detail.onErrorOp = v.op;
	    detail.onErrorStep = v.stepRec;

	    return helpers.SR_error(res.error, detail);
	}

	//array len checks arbitrary vals. no need to use defensively.
	//console.warn(v);
	
	const hasOnError = v.pipelineDef && this.lib.array.len(v.pipelineDef[helpers.PIPELINE_PHASE_ERROR]) > 0;
	if (hasOnError) {
            const from = {
		pipelineKey: v.pipelineKey,
		phase: ticket.phase,
		stageIndex: ticket.cursor?.stage ?? 0,
		op: v.op,
		opLabel: this.op._opLabel(v.op),
		step: v.stepRec,
            };

            ticket.errorInfo = {
		error: res.error || new Error("Stage error"),
		detail: res.detail || null,
		...from,
            };

            ticket.phase = helpers.PIPELINE_PHASE_ERROR;
            ticket.cursor.stage = 0;

            return helpers.SR_ok({
		pipelineKey: v.pipelineKey,
		reason: `enter ${helpers.PIPELINE_PHASE_ERROR}`,
		from,
		original: ticket.errorInfo || null,
            });
	}

	return res;
    }

    /**
     * Handle an unexpected or unsupported stage status.
     *
     * This is a defensive fallback invoked when `res.status`
     * does not match any known helpers.STAGE_STATUS value.
     *
     * Produces a terminal helpers.SR_error to prevent silent
     * continuation under undefined execution semantics.
     *
     * Does not mutate ticket state.
     *
     * @param {Object} env
     * @param {Object} env.v
     *   Validated execution context (pipelineKey, op, etc.).
     * @param {Object} env.res
     *   StageResult-like object with an unknown or missing status.
     *
     * @returns {Object}
     *   helpers.SR_error describing the invalid status.
     */
    _responseUnknown({ v, res }) {
	return helpers.SR_error(new Error(`Unknown stage status '${res?.status}'`), {
	    pipelineKey: v?.pipelineKey,
	    op: v?.op,
	});
    }

    /**
     * Capture stable stage identity BEFORE execution mutates ticket state.
     *
     * This snapshot preserves the execution context at the moment
     * the stage begins, prior to any handler-induced mutations
     * (e.g., transitioning from helpers.PIPELINE_PHASE_RUN to
     * helpers.PIPELINE_PHASE_ERROR).
     *
     * The returned object is later stamped into `res.detail`
     * to ensure trace/log metadata reflects the original
     * execution identity, not post-transition state.
     *
     * Does not mutate ticket.
     *
     * @param {Object} args
     * @param {Object} args.ticket
     *   Active ticket being executed.
     * @param {Object} args.v
     *   Validated execution context for the current stage.
     *
     * @returns {Object}
     *   Snapshot descriptor:
     *   {
     *     phase,
     *     stageIndex,
     *     pipelineKey,
     *     op,
     *     opLabel,
     *     step
     *   }
     */
    _snapShot({ticket,v}){
	const exec = {
	    phase: ticket.phase,                 // helpers.PIPELINE_PHASE_RUN ("run") | helpers.PIPELINE_PHASE_ERROR ("error")
	    stageIndex: ticket.cursor?.stage ?? 0,
	    pipelineKey: v.pipelineKey,
	    op: v.op,                            // may be string, function, etc
	    opLabel: this.op._opLabel(v.op),
	    step: v.stepRec,                     // raw step record (string/object)
	};
	return exec;
    }

    /**
     * Stamp stable stage metadata into a StageResult.
     *
     * This method injects the pre-execution snapshot identity
     * (captured by `_snapShot`) into `res.detail` to ensure that
     * trace and hook consumers see the original stage context,
     * even if ticket state has since mutated (e.g., phase change).
     *
     * Specifically attaches:
     *   - phase
     *   - stageIndex
     *   - pipelineKey
     *   - op (raw)
     *   - opLabel (safe string label)
     *   - step (raw stage record)
     *
     * Mutates:
     *   - res.detail (ensures it exists and stamps fields)
     *
     * Does NOT:
     *   - alter `res.status`
     *   - modify ticket state
     *   - perform lifecycle transitions
     *
     * @param {Object} res
     *   Normalized StageResult returned from execution or validation.
     *
     * @param {Object} snapShot
     *   Stage identity descriptor produced by `_snapShot`.
     *
     * @returns {Object}
     *   The same StageResult instance with augmented `detail`.
     */
    _finalizeResponse(res,snapShot){

	// $CLEANING Stamp stable stage identity into the result for hooks/logging.
	if (!res.detail || typeof res.detail !== "object") res.detail = {};
	res.detail.phase = snapShot.phase;
	res.detail.stageIndex = snapShot.stageIndex;
	res.detail.pipelineKey = snapShot.pipelineKey;
	
	// Preserve the original op value AND a label.
	res.detail.op = snapShot.op;               // raw
	res.detail.opLabel = snapShot.opLabel;     // safe string label
	// Keep the raw step too (super useful for debugging DSL strings)
	res.detail.step = snapShot.step;
	// END CLEANING
	return res;
    }
}

export default VM;

/**
 * NOTE: The structure below describes TickResponse payloads (Tick layer),
 * not VM return values.
 */

/**
   {
   // identity
   jobId,
   ticketId,
   pipelineKey,

   // execution context (if a stage was involved)
   stage: {
   phase,        // "run" | "PIPELINE_PHASE_ERROR"
   stageIndex,   // number | null
   op,           // raw op (string | fn | object | null)
   opLabel,      // string (always safe)
   step,         // raw step record (debug)
   } | null,

   // result of the step / transition
   result: {
   status,       // "ok" | "wait" | "error" | "complete"
   detail,       // StageResult.detail (augmented)
   error,        // Error | null
   },

   // terminal summary (ONLY when terminal === true)
   summary: {
   state,        // "complete" | "error"
   handled,      // boolean
   phase,        // terminal phase
   originalError,// snapshot | null
   } | null,

   // control flags
   didWork,        // boolean (engine did something)
   terminal,       // boolean (ticket ended)
   }
*/
