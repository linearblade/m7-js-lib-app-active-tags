// -----------------------------------------------------------------------------
// VM (deterministic stepping of a single ticket) — v1 
// -----------------------------------------------------------------------------
import helpers from '../helpers.js';
import Validate from './Validate.js';
import OP       from './OP.js';

export class VM {
    constructor({ lib, builtins } = {}) {
	if(!lib)       throw new Error("PASS lib :) ");
	this.lib       = lib ;
	this.builtins  = builtins || {}; //this is unnecessary but the AI bitches when I lint, b/c it seems to have trouble reading my libs.
	this.validator = new Validate({lib,builtins});
	this.op        = new OP({lib});
    }

    /**
     * Run exactly ONE stage step for this ticket.
     * Returns StageResult-like: status ok|wait|error|complete
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

	if (v.err) return tagNoStage(v.err);
	if (v.done) return tagNoStage(v.res || v.err);

	const trigger = lib.hash.get(ticket, "inputs.trigger") || lib.hash.get(job, "e") || null;

	const snapShot = this._snapShot({v, ticket});
	//END $CLEANING
	
	let res;
	try {
	    res = await v.fn({
		job,
		lib,
		args: v.args,
		trigger,
		ticket,
		inputs: ticket.inputs,
		ctx,
		step: v.stepRec,
	    });
	} catch (err) {
	    res = helpers.SR_error(err, { pipelineKey: v.pipelineKey, op: v.op, step: v.stepRec });
	}

	
	res = this.op._normalizeReturn(res, { pipelineKey: v.pipelineKey, op: v.op });
	const return_status = res.status;
	//res.return_status = res.status;
	res = this._finalizeResponse(res,snapShot);
	const env = { job, ticket, ctx, v, res,return_status }; // <-- EVERYTHING

	const disp = {
	    [helpers.STAGE_STATUS.OK]       : this._responseOk,
	    [helpers.STAGE_STATUS.WAIT]     : this._responseWait,
	    [helpers.STAGE_STATUS.ERROR]    : this._responseError,
	    [helpers.STAGE_STATUS.COMPLETE] : this._responseComplete,
	};

	const handler = disp[res.status] || this._responseUnknown;
	const rv =  handler.call(this, env);

	//this is ugly. I dont like it, but deal with it until more important shit handled
	rv.return_status = return_status;
	return rv;
    }

    



    _responseOk({ ticket, res }) {
	ticket.cursor.stage += 1;
	return res;
    }
    
    _responseWait({ res }) {
	return res;
    }

    _responseComplete({ v }) {
	return helpers.SR_complete({ pipelineKey: v.pipelineKey, op: v.op, early: true });
    }


    /**
     * Handle a stage error and apply pipeline error-handling semantics.
     *
     * This method is responsible for deciding whether a stage error:
     *   1) Transitions execution into the `onError` pipeline, or
     *   2) Terminates execution with a final error.
     *
     * Behavior:
     * - If the current ticket is already in the `onError` phase, a failing
     *   stage is treated as a terminal error. The original error context is
     *   preserved and annotated to indicate error-handler failure.
     *
     * - If the ticket is not in `onError` and the pipeline defines an
     *   `onError` handler, execution transitions into the `onError` phase.
     *   The ticket cursor is reset and the original error context is stored
     *   on the ticket for later inspection.
     *
     * - If no `onError` handler exists, the original StageResult is returned
     *   unchanged and will be treated as a terminal error by the caller.
     *
     * Invariants:
     * - This method mutates ticket execution state (`phase`, `cursor`,
     *   `errorInfo`) when transitioning into `onError`.
     * - This method does NOT finalize tickets or manage scheduling.
     *
     * @param {Object} env
     * @param {Object} env.ticket
     *     Active ticket whose execution state is being evaluated.
     * @param {Object} env.v
     *     Validated execution context for the current stage
     *     (pipeline, step, op, cursor metadata).
     * @param {Object} env.res
     *     Normalized StageResult representing the stage failure.
     *
     * @returns {Object}
     *     A StageResult:
     *     - `SR_ok` when transitioning into `onError`
     *     - `SR_error` when the error is terminal
     *     - or the original `res` when no error handling is defined.
     */
    _responseError({ ticket, v, res }) {

	// If the error handler itself fails (we are already in onError),
	// do NOT re-enter onError. Surface handler failure and preserve original.
	if (ticket.phase === "onError") {
	    const detail = this.lib.hash.to(res.detail);

	    if (!detail.original) 
		detail.original = ticket.errorInfo || null;

	    detail.onErrorFailed = true;
	    detail.onErrorOp = v.op;
	    detail.onErrorStep = v.stepRec;

	    return helpers.SR_error(res.error, detail);
	}
	//const hasOnError = Array.isArray(v.pipelineDef.onError) && v.pipelineDef.onError.length > 0;
	//array len checks arbitrary vals. no need to use defensively.
	const hasOnError = this.lib.array.len(v.pipelineDef.onError) > 0;
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

            ticket.phase = "onError";
            ticket.cursor.stage = 0;

            return helpers.SR_ok({
		pipelineKey: v.pipelineKey,
		reason: "enter onError",
		from,
		original: ticket.errorInfo || null,
            });
	}

	return res;
    }

    _responseUnknown({ v, res }) {
	return helpers.SR_error(new Error(`Unknown stage status '${res?.status}'`), {
	    pipelineKey: v?.pipelineKey,
	    op: v?.op,
	});
    }

    //Snapshot stage identity BEFORE execution/handlers mutate ticket (e.g., run -> onError).
    _snapShot({ticket,v}){
	const exec = {
	    phase: ticket.phase,                 // "run" | "onError"
	    stageIndex: ticket.cursor?.stage ?? 0,
	    pipelineKey: v.pipelineKey,
	    op: v.op,                            // may be string, function, etc
	    opLabel: this.op._opLabel(v.op),
	    step: v.stepRec,                     // raw step record (string/object)
	};
	return exec;
    }
    
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
   {
   // identity
   jobId,
   ticketId,
   pipelineKey,

   // execution context (if a stage was involved)
   stage: {
   phase,        // "run" | "onError"
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
