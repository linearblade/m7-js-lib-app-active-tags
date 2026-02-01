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

    validateStep({ job, ticket }) {
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

	// End-of-phase
	if (!stepRec) {
	    if (ticket.phase === "onError") {
		const e = ticket.errorInfo?.error || new Error("Pipeline error");
		return {
		    done: true,
		    err: helpers.SR_error(e, { pipelineKey, phase: "onError", original: ticket.errorInfo }),
		    pipelineKey,
		    pipelineDef,
		    steps,
		};
	    }

	    return {
		done: true,
		complete: true,
		res: helpers.SR_complete({ pipelineKey, phase: ticket.phase }),
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
	if (ticket.phase === "onError") return res;

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
	}

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

	const v = this.validateStep({ job, ticket });
	if (v.err) return v.err;
	if (v.done) return v.res || v.err;

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

	const env = { job, ticket, ctx, v, res }; // <-- EVERYTHING

	const disp = {
	    [helpers.STAGE_STATUS.OK]: this._responseOk,
	    [helpers.STAGE_STATUS.WAIT]: this._responseWait,
	    [helpers.STAGE_STATUS.ERROR]: this._responseError,
	    [helpers.STAGE_STATUS.COMPLETE]: this._responseComplete,
	};

	const handler = disp[res.status] || this._responseUnknown;
	return handler.call(this, env);
    }
}
