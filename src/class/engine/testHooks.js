/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * Engine Test / Diagnostic Hooks
 * ===============================
 *
 * Purpose
 * -------
 * Provides a reference implementation of Engine hook callbacks for:
 * - debugging
 * - lifecycle tracing
 * - integration testing
 * - external system instrumentation
 *
 * This module is NOT part of core engine logic.
 * It is an optional observer layer that demonstrates how to subscribe
 * to Engine lifecycle events via `Engine.hooks`.
 *
 * What This File Does
 * -------------------
 * - Implements all supported Engine hook callbacks:
 *     - onEnqueue
 *     - onStage
 *     - onComplete
 *     - onError
 *     - onTicketDone
 * - Emits structured console logs for each lifecycle transition.
 * - Serves as living documentation for hook payload shapes.
 *
 * What This File Does NOT Do
 * --------------------------
 * - Does not modify engine state.
 * - Does not alter ticket execution.
 * - Does not participate in scheduling.
 * - Does not retry, swallow, or mutate errors.
 *
 * Design Role
 * -----------
 * This file is a template and diagnostic tool.
 *
 * It demonstrates:
 * - What hook signatures look like.
 * - When each hook fires.
 * - What data is available at each lifecycle phase.
 *
 * Consumers may:
 * - Replace this implementation entirely.
 * - Partially override selected hooks.
 * - Route hook events into:
 *     - logging frameworks
 *     - analytics systems
 *     - devtools panels
 *     - test assertions
 *     - observability pipelines
 *
 * Configuration
 * -------------
 * Hook wiring is controlled by ActiveTags engine configuration.
 * Hooks may be:
 * - enabled
 * - disabled
 * - overridden
 * - extended
 *
 * This module is inert unless explicitly wired into the Engine configuration.
 *
 * Stability
 * ---------
 * Hook payload contracts should be considered semi-public runtime API.
 * If hook signatures change, this file should be updated accordingly.
 */

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
