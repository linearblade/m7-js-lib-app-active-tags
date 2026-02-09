/**
   provides validation for VM
 */
import helpers from '../helpers.js';

export class Validate {
    constructor({lib,builtins} ) {
	this.lib = lib;
	this.builtins = builtins;
    }

        //leaving this 'raw', b/c I havent decided if I will make tickets an class entity rather than a raw hash.
    //also this should be ideally groomed above and reject invalid ticket shapes.
    _ensureTicketRuntime(ticket) {
	// Minimal runtime fields for the runner.
	if (!ticket.cursor || typeof ticket.cursor !== "object") ticket.cursor = {};
	if (typeof ticket.cursor.stage !== "number") ticket.cursor.stage = 0;

	// phase: "run" or "error"
	if (!ticket.phase) ticket.phase = "run";

	// keep original error when transitioning into error
	if (!ticket.errorInfo) ticket.errorInfo = null;
    }


    
    /**
     * Resolve the pipeline definition by key from the job.
     *
     * Supported shapes (v1 target):
     *   job.pipelines = { default:{run:[...], error:[...]}, initial:{...} }
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
	const allowed = lib.utils.clamp(helpers.PIPELINE_PHASE, phase, null);
	if (!allowed) return null;

	// `allowed` is "run" or "error"
	return lib.hash.get(pipelineDef, allowed, null);
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
	    // If we've exhausted the error track, we treat this as a *handled* completion.
	    if (ticket.phase === helpers.PIPELINE_PHASE_ERROR) {
		return {
		    done: true,
		    complete: true,
		    res: helpers.SR_complete({
			pipelineKey,
			phase: helpers.PIPELINE_PHASE_ERROR,
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

    
}

export default Validate;
