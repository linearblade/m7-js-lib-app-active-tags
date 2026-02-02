// -----------------------------------------------------------------------------
// PipelineRunner (deterministic stepping of a single ticket) — v1 (pipelineKey)
// -----------------------------------------------------------------------------
import helpers from './helpers.js';
export class PipelineRunner {
    constructor({ lib, builtins } = {}) {
	if(!lib)   throw new Error("PASS lib :) ");
	this.lib = lib ;
	this.builtins = builtins || {}; //this is unnecessary but the AI bitches when I lint, b/c it seems to have trouble reading my libs.
    }

    /**
     * Resolve the pipeline definition by key from the job.
     *
     * Supported shapes (v1 target):
     *   job.pipelines = { default:{run:[...], onError:[...]}, initial:{...} }
     *
     * Back-compat (legacy-ish / transitional):
     *   job.pipeline = { run:[...] }  -> treated as default
     *   job.pipelineDefs = { main:[...] } -> treated as { run:[...]} arrays
     */
    _getPipelineDef(job, pipelineKey) {
	if (!job) return null;
	const lib = this.lib;
	const key = String(pipelineKey || "default");

	const pipeRef =  lib.hash.get(job, `config.schema.pipelines.${key}`,null);
	//consider nomralizing if not already done.
	return pipeRef;
    }

    _opLabel(op) {
    // Prefer stable human-readable labels for logs/hooks.
    if (typeof op === "string") return op;

    if (typeof op === "function") {
        return op.name && op.name.length ? op.name : "(anonymous fn)";
    }

    if (op && typeof op === "object") {
        // Constructor name if meaningful
        const ctor = op.constructor && op.constructor.name;
        if (ctor && ctor !== "Object") return ctor;
        // Fallback
        return "(object op)";
    }

    if (op === null) return "(null op)";
    return `(${typeof op} op)`;
}
    
    //all this is doing is extracting the relevent phase from the pipeline rec.
    _getSteps(pipelineDef, phase) {
	if (!pipelineDef) return null;

	const lib = this.lib;
	const allowed = lib.utils.clamp(["run", "onError"], phase, null);
	if (!allowed) return null;

	// `allowed` is "run" or "onError"
	return lib.hash.get(pipelineDef, allowed, null);
    }
    //leaving this 'raw', b/c I havent decided if I will make tickets an class entity rather than a raw hash.
    _ensureTicketRuntime(ticket) {
	// Minimal runtime fields for the runner.
	if (!ticket.cursor || typeof ticket.cursor !== "object") ticket.cursor = {};
	if (typeof ticket.cursor.stage !== "number") ticket.cursor.stage = 0;

	// phase: "run" or "onError"
	if (!ticket.phase) ticket.phase = "run";

	// keep original error when transitioning into onError
	if (!ticket.errorInfo) ticket.errorInfo = null;
    }

    //back up groom in case we didnt properly groom it in normalization of records during ingestion.
    _resolveStage(step) {
	// step can be:
	// - "request.submit"
	// - { op:"request.submit", ... }
	let rec = this.lib.hash.to(step, "op");
	return { op: rec.op || null, args: rec.args || null, raw: step };
    }
    _getFn(fn){
	const builtin = this.lib.hash.get(this.builtins,fn,null);
	if(builtin) return builtin;
	return this.lib.func.get(fn);
    }

    _validateStep({ job, ticket }) {
	const pipelineKey = String(ticket.pipelineKey || "default");

	const pipelineDef = this._getPipelineDef(job, pipelineKey);
	if (!pipelineDef) {
	    return {
		err: helpers.SR_error(new Error(`Missing pipeline '${pipelineKey}'`), { pipelineKey }),
		pipelineKey,
	    };
	}

	const steps = this._getSteps(pipelineDef, ticket.phase);
	if (!steps) {
	    return {
		err: helpers.SR_error(new Error(`Invalid pipeline '${pipelineKey}' definition`), {
		    pipelineKey,
		    phase: ticket.phase,
		}),
		pipelineKey,
		pipelineDef,
	    };
	}

	const stepRec = steps[ticket.cursor.stage];
	//console.log(`stage is ${ticket.cursor.stage}`);
	// End-of-phase
	if (!stepRec) {
	    // If we've exhausted the onError track, we treat this as a *handled* completion.
	    if (ticket.phase === "onError") {
		return {
		    done: true,
		    complete: true,
		    res: helpers.SR_complete({
			pipelineKey,
			phase: "onError",
			handled: true,
			original: ticket.errorInfo || null,
		    }),
		    pipelineKey,
		    pipelineDef,
		    steps,
		};
	    }

	    // Normal run end-of-line: clean completion.
	    return {
		done: true,
		complete: true,
		res: helpers.SR_complete({
		    pipelineKey,
		    phase: ticket.phase,
		    handled: false,
		}),
		pipelineKey,
		pipelineDef,
		steps,
	    };
	}
	const { op, args } = this._resolveStage(stepRec);
	if (!op) {
	    return {
		err: helpers.SR_error(new Error("Invalid pipeline step (missing op)"), { pipelineKey, step: stepRec }),
		pipelineKey,
		pipelineDef,
		steps,
		stepRec,
	    };
	}

	const fn = this._getFn(op);
	if (!fn) {
	    return {
		err: helpers.SR_error(new Error(`Unknown op '${op}'`), { pipelineKey, op, step: stepRec }),
		pipelineKey,
		pipelineDef,
		steps,
		stepRec,
		op,
	    };
	}

	return {
	    err: null,
	    pipelineKey,
	    pipelineDef,
	    steps,
	    stepRec,
	    op,
	    args,
	    fn,
	};
    }

    normalizeReturn(res, { pipelineKey, op } = {}) {

	// Already a StageResult
	if (res && typeof res === "object" && res.status) {
	    return res;
	}

	// ---- Legacy / implied semantics ----
	// v098 rules (formalized):
	// - falsy        -> ERROR
	// - true / 1     -> OK
	// - truthy other -> WAIT

	// Falsy => ERROR
	if (!res) {
	    return helpers.SR_error(
		new Error("Stage returned falsy"),
		{ pipelineKey, op, legacy: true }
	    );
	}

	// Explicit success
	if (res === true || res === 1) {
	    return helpers.SR_ok({ pipelineKey, op, legacy: true });
	}

	// Any other truthy value => WAIT
	return helpers.SR_wait({
	    pipelineKey,
	    op,
	    legacy: true,
	    value: res
	});
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
    _responseError({ ticket, v, res }) {
    // If the error handler itself fails (we are already in onError),
    // do NOT re-enter onError. Surface handler failure and preserve original.
    if (ticket.phase === "onError") {
        const detail = Object.assign({}, res?.detail || {});
        if (!detail.original) detail.original = ticket.errorInfo || null;
        detail.onErrorFailed = true;
        detail.onErrorOp = v?.op;
        detail.onErrorStep = v?.stepRec;
        return helpers.SR_error(res?.error, detail);
    }

    const hasOnError = Array.isArray(v.pipelineDef.onError) && v.pipelineDef.onError.length > 0;
    if (hasOnError) {
        const from = {
            pipelineKey: v.pipelineKey,
            phase: ticket.phase,
            stageIndex: ticket.cursor?.stage ?? 0,
            op: v.op,
            opLabel: this._opLabel ? this._opLabel(v.op) : (typeof v.op === "string" ? v.op : "(op)"),
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
    ddd_responseError({ ticket, v, res }) {
	//if (ticket.phase === "onError") return res;
	// If the error handler itself fails, do NOT lose the original triggering error.
	// Keep ticket.errorInfo as the original root cause, but attach it to the emitted result.

	const hasOnError = Array.isArray(v.pipelineDef.onError) && v.pipelineDef.onError.length > 0;
	if (hasOnError) {
	    // Snapshot the failing stage identity BEFORE mutating the ticket.
	    const from = {
		pipelineKey: v.pipelineKey,
		phase: ticket.phase,                         // should be "run" here
		stageIndex: ticket.cursor?.stage ?? 0,
		op: v.op,
		opLabel: this._opLabel ? this._opLabel(v.op) : (typeof v.op === "string" ? v.op : "(op)"),
		step: v.stepRec,
	    };

	    // Preserve the original error (root cause) including where it happened.
	    ticket.errorInfo = {
		error: res.error || new Error("Stage error"),
		detail: res.detail || null,
		...from,
	    };

	    // Transition to error track
	    ticket.phase = "onError";
	    ticket.cursor.stage = 0;

	    // Return OK to continue ticking, but include transition + source failure info
	    return helpers.SR_ok({
		pipelineKey: v.pipelineKey,
		reason: "enter onError",
		from,                               // <-- failing stage identity
		original: ticket.errorInfo || null, // <-- full root cause snapshot
	    });
	}
	
	if (ticket.phase === "onError") {
	    const detail = Object.assign({}, res?.detail || {});
	    if (!detail.original) detail.original = ticket.errorInfo || null;
	    detail.onErrorFailed = true;
	    detail.onErrorOp = v?.op;
	    detail.onErrorStep = v?.stepRec;

	    // Return a new SR_error so downstream sees the handler error + the original cause.
	    return helpers.SR_error(res?.error, detail);
	}
	/*
	  //trying to clean up response shapes
	const hasOnError = Array.isArray(v.pipelineDef.onError) && v.pipelineDef.onError.length > 0;
	if (hasOnError) {
	    ticket.errorInfo = {
		error: res.error || new Error("Stage error"),
		detail: res.detail || null,
		op: v.op,
		step: v.stepRec,
	    };
	    ticket.phase = "onError";
	    ticket.cursor.stage = 0;
	    return helpers.SR_ok({ pipelineKey: v.pipelineKey, reason: "enter onError" });
	} */

	return res;
    }
    _responseUnknown({ v, res }) {
	return helpers.SR_error(new Error(`Unknown stage status '${res?.status}'`), {
	    pipelineKey: v?.pipelineKey,
	    op: v?.op,
	});
    }
    

    /**
     * Run exactly ONE stage step for this ticket.
     * Returns StageResult-like: status ok|wait|error|complete
     */
    async step({ job, ticket, ctx }) {
	this._ensureTicketRuntime(ticket);

	const v = this._validateStep({ job, ticket });

	//console.log(v.stepRec,v);
	//
	//if (v.err) return v.err;
	//if (v.done) return v.res || v.err;
	// If we return from validation (no stage executed), tag it so Tick can report correctly.

	const tagNoStage = (sr) => {
	    if (!sr || typeof sr !== "object") return sr;
	    if (!sr.detail || typeof sr.detail !== "object") sr.detail = {};
	    sr.detail.noStage = true;
	    return sr;
	};

	if (v.err) return tagNoStage(v.err);
	if (v.done) return tagNoStage(v.res || v.err);

	//$CLEANING Snapshot stage identity BEFORE execution/handlers mutate ticket (e.g., run -> onError).
	const exec = {
	    phase: ticket.phase,                 // "run" | "onError"
	    stageIndex: ticket.cursor?.stage ?? 0,
	    pipelineKey: v.pipelineKey,
	    op: v.op,                            // may be string, function, etc
	    opLabel: this._opLabel(v.op),
	    step: v.stepRec,                     // raw step record (string/object)
	};
	//END $CLEANING
	
	let res;
	try {
	    res = await v.fn({
		job,
		ticket,
		inputs: ticket.inputs,
		ctx,
		step: v.args || v.stepRec,
	    });
	} catch (err) {
	    res = helpers.SR_error(err, { pipelineKey: v.pipelineKey, op: v.op, step: v.stepRec });
	}

	
	res = this.normalizeReturn(res, { pipelineKey: v.pipelineKey, op: v.op });
	const return_status = res.status;
	// $CLEANING Stamp stable stage identity into the result for hooks/logging.
	if (!res.detail || typeof res.detail !== "object") res.detail = {};
	res.detail.phase = exec.phase;
	res.detail.stageIndex = exec.stageIndex;
	res.detail.pipelineKey = exec.pipelineKey;

	// Preserve the original op value AND a label.
	res.detail.op = exec.op;               // raw
	res.detail.opLabel = exec.opLabel;     // safe string label
	// Keep the raw step too (super useful for debugging DSL strings)
	res.detail.step = exec.step;
	// END CLEANING

	const env = { job, ticket, ctx, v, res }; // <-- EVERYTHING

	const disp = {
	    [helpers.STAGE_STATUS.OK]: this._responseOk,
	    [helpers.STAGE_STATUS.WAIT]: this._responseWait,
	    [helpers.STAGE_STATUS.ERROR]: this._responseError,
	    [helpers.STAGE_STATUS.COMPLETE]: this._responseComplete,
	};

	const handler = disp[res.status] || this._responseUnknown;
	const rv =  handler.call(this, env);
	rv.return_status = return_status;
	return rv;
    }
}


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
