//hooks for testing. Use these for hooking in other sub systems or error tracing. 
export const hooks = {
    /**
     * Fires after enqueue (useful to confirm ticket creation).
     */
    onEnqueue: ({ job, ticket }) => {
	console.log("[AT][enqueue]", {
	    jobId: job?.id,
	    ticketId: ticket?.id,
	    pipelineKey: ticket?.pipelineKey,
	    phase: ticket?.phase,
	});
    },

    /**
     * Fires for every executed stage (only when a stage actually ran).
     * Great for verifying ordering: foo -> bar -> ...
     */
    onStage: (t) => {
	console.log("[AT][stage]", {
	    jobId: t.jobId,
	    ticketId: t.ticketId,
	    phase: t.stage?.phase,
	    pipelineKey: t.pipelineKey,
	    op: t.stage?.opLabel ?? t.stage?.op,
	    stageIndex: t.stage?.stageIndex,
	    status: t.res?.status,
	    reason: t.res?.detail?.reason ?? t.reason ?? null,
	});
    },

    /**
     * Terminal success only.
     * NOTE: This only fires if you added Engine.hooks.onComplete + Tick wiring.
     */
    onComplete: ({ job, ticket, summary }) => {
	console.log("[AT][complete]", {
	    jobId: job?.id,
	    ticketId: ticket?.id,
	    handled: !!summary?.handled,
	    phase: summary?.phase,
	    pipelineKey: summary?.pipelineKey,
	    originalError: summary?.originalError || null,
	});
    },

    /**
     * Terminal error only.
     */
    donError: ({ job, ticket, error, res }) => {
	console.error("[AT][error]", {
	    jobId: job?.id,
	    ticketId: ticket?.id,
	    phase: ticket?.phase,
	    pipelineKey: res?.detail?.pipelineKey || ticket?.pipelineKey || "default",
	    op: res?.detail?.op,
	    error,
	    detail: res?.detail,
	    original: ticket?.errorInfo || null,
	});
    },
    onError: ({ job, ticket, summary }) => {
	console.error("[AT][error]", {
	    jobId: job?.id,
	    ticketId: ticket?.id,
	    phase: summary?.phase,                 // "run" or "onError"
	    pipelineKey: summary?.pipelineKey,
	    error: summary?.error,
	    originalError: summary?.originalError || null,
	    // If onError failed, summary.error is the handler error,
	    // and summary.originalError carries the root cause.
	});
    },

    /**
     * ALWAYS fires once per ticket finalization (this is your "done" / "finally").
     * This is the hook to guarantee cleanup/logging is never missed.
     */
    onTicketDone: ({ job, ticket, summary }) => {
	// "done" == bird cooked: we are terminal now.
	const done = summary?.state === "complete" || summary?.state === "error";

	console.log("[AT][done]", {
	    done,
	    state: summary?.state,         // "complete" | "error"
	    handled: !!summary?.handled,   // true only when recovered via onError
	    phase: summary?.phase,
	    pipelineKey: summary?.pipelineKey,
	    jobId: job?.id,
	    ticketId: ticket?.id,
	});

	// Example cleanup place:
	// - release external locks
	// - clear UI busy indicators
	// - finalize logs/metrics
    },
};

export default hooks;
