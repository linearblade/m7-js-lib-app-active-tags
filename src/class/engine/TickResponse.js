
export class TickResponse {
    constructor({lib}) {
	this.lib = lib;
    }

    _extractStage(res, ticket) {
	const d = res?.detail || null;
	if (!d) return null;

	// Transition result "enter onError" carries `from`
	const src = d.from || d;

	return {
            phase: src.phase || ticket?.phase || null,
            stageIndex: (typeof src.stageIndex === "number") ? src.stageIndex : null,
            op: (src.op !== undefined) ? src.op : null,
            opLabel: (src.opLabel !== undefined) ? src.opLabel : null,
            step: (src.step !== undefined) ? src.step : null,
	};
    }
    
    _makeTickTrace({ jobId = null, job = null, ticket = null, res = null, summary = null, flags = null } = {}) {
	const d = res?.detail || null;

	const pipelineKey =
              d?.pipelineKey ||
              ticket?.pipelineKey ||
              summary?.pipelineKey ||
              null;

	const stage = this._extractStage(res, ticket);

	const trace = {
            // core
            didWork: !!(flags?.didWork),
            jobId: jobId || job?.id || null,
            ticketId: ticket?.id || null,
            pipelineKey,
	    
	    //the normalized return code from the function call.
	    return_status: res?.return_status || null,

            // stage + result
            stage,        // may be null
            res: res || null,      // canonical name
            result: res || null,   // back-compat alias

            // terminal
            terminal: !!(flags?.terminal),
            summary: summary || null,

            // convenience flags (uniform)
            ok: !!(flags?.ok),
            waiting: !!(flags?.waiting),
            complete: !!(flags?.complete),
            error: !!(flags?.error),

            // meta reasons (uniform)
            reason: flags?.reason || null,
            locked: !!(flags?.locked),
            missingJob: !!(flags?.missingJob),
            empty: !!(flags?.empty),
	};

	return trace;
    }


    _makeTerminalSummary({ job, ticket, res, state }) {
        const detail = (res && typeof res === "object") ? (res.detail || {}) : {};
        const phase = ticket?.phase || detail.phase || "run";
        const pipelineKey =
              ticket?.pipelineKey ||
              detail.pipelineKey ||
              null;

        const handled =
              state === "complete" &&
              (detail.handled === true || phase === "onError");

        return {
            state,                 // "complete" | "error"
            phase,                 // "run" | "onError"
            handled,               // true if recovered via onError
            pipelineKey,           // best effort
            originalError: ticket?.errorInfo || null,
            error: state === "error" ? (res?.error || null) : null,
            res,
        };
    }
    
}
export default TickResponse;
