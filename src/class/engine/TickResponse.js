/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * TickResponse
 * ------------
 * Trace and summary builder for Engine tick execution.
 *
 * Role
 * - Centralizes the construction of a stable, JSON-friendly tick trace payload.
 * - Normalizes per-step metadata (phase, stageIndex, op, step) from StageResult-like objects.
 * - Produces terminal summaries used by hooks and diagnostics.
 *
 * Why this exists
 * - Tick emits multiple hooks with consistent payload shape.
 * - VM/ops may return heterogeneous result shapes; TickResponse extracts “best effort”
 *   fields and returns a uniform envelope.
 * - Keeps Tick logic focused on execution flow, not payload assembly.
 *
 * Output contracts
 * - `_makeTickTrace(...)` returns an object that is safe to log/serialize and stable over time.
 * - Includes both `res` and `result` as aliases for back-compat.
 * - Provides uniform booleans: ok, waiting, complete, error, terminal, locked, missingJob, empty.
 * - Includes `stage` when available; null when not extractable.
 *
 * Terminal summary
 * - `_makeTerminalSummary(...)` returns a compact terminal descriptor for complete/error paths.
 * - Computes `handled` for error-phase recovery semantics (best-effort).
 *
 * Naming and vocabulary (do not conflate)
 * - Pipeline *phase* is one of:
 *     - helpers.PIPELINE_PHASE_RUN   ("run")
 *     - helpers.PIPELINE_PHASE_ERROR ("error")
 *   This is a pipeline routing concept (which pipeline list we are executing).
 *
 * - Engine *hook* keys are separate identifiers, e.g.:
 *     - HOOKS.ERROR ("onError")
 *   This is an event/callback name, not a pipeline phase.
 *
 * Non-responsibilities
 * - Does not mutate engine state, tickets, or jobs.
 * - Does not interpret pipeline semantics.
 * - Does not emit hooks (Tick does that).
 */

import helpers from './helpers.js';
export class TickResponse {
    constructor({lib}) {
	this.lib = lib;
    }
    /**
     * Extract a normalized "stage pointer" from a StageResult-like object.
     *
     * Purpose
     * - Converts heterogeneous result shapes into a stable, minimal descriptor
     *   of "where we are" in the pipeline for logging/tracing.
     *
     * Supported shapes
     * - Standard StageResult:
     *     `res.detail.{ phase, stageIndex, op, opLabel, step }`
     *
     * - Transition results (e.g. "enter error phase"):
     *     `res.detail.from` is treated as the canonical source payload.
     *
     * - Fallback:
     *     When `stageIndex` is not present at the top level, this method
     *     will attempt to read `res.detail.step.stageIndex`.
     *
     * Phase vocabulary
     * - `phase` is one of:
     *     - helpers.PIPELINE_PHASE_RUN   ("run")
     *     - helpers.PIPELINE_PHASE_ERROR ("error")
     *
     * Fallback rules
     * - `phase` falls back to `ticket.phase` when missing.
     * - Missing or non-object `res.detail` returns null.
     *
     * @param {Object} res
     *   StageResult-like object produced by VM/Tick.
     *
     * @param {Object} ticket
     *   Current run ticket (used only for phase fallback).
     *
     * @returns {Object|null}
     *   Normalized stage descriptor:
     *   `{ phase, stageIndex, op, opLabel, step }`,
     *   or null when not extractable.
     */
    _extractStage(res, ticket) {
	const d = res?.detail || null;
	if (!d) return null;

	// Transition result "enter error (helpers.PIPELINE_PHASE_ERROR) phase" carries `from`
	const src = d.from || d;

	return {
            phase: src.phase || ticket?.phase || null,
            //stageIndex: (typeof src.stageIndex === "number") ? src.stageIndex : null,
	    stageIndex:
		(typeof src.stageIndex === "number") ? src.stageIndex :
		(typeof src?.step?.stageIndex === "number") ? src.step.stageIndex :
		null,
            op: (src.op !== undefined) ? src.op : null,
            opLabel: (src.opLabel !== undefined) ? src.opLabel : null,
            step: (src.step !== undefined) ? src.step : null,
	};
    }

    /**
     * Build a normalized tick trace payload.
     *
     * Purpose
     * - Produces a stable, JSON-friendly object describing the outcome of a single
     *   scheduler/tick decision, suitable for:
     *   - engine hooks (HOOKS.STAGE, HOOKS.DONE, HOOKS.COMPLETE, HOOKS.ERROR)
     *   - logging and diagnostics
     *   - test assertions
     *
     * Normalization behavior
     * - Resolves `pipelineKey` from (highest priority first):
     *   1) `res.detail.pipelineKey`
     *   2) `ticket.pipelineKey`
     *   3) `summary.pipelineKey`
     * - Extracts a normalized stage pointer via `_extractStage(res, ticket)`.
     * - Preserves the original StageResult-like value under `res`.
     * - Duplicates `res` into `result` for backwards compatibility.
     * - Surfaces uniform booleans derived from `flags` so callers can test state
     *   without inspecting StageResult internals.
     *
     * Output shape
     * - Returned object contains:
     *   - core identifiers: jobId, ticketId, pipelineKey
     *   - execution metadata: didWork, return_status
     *   - stage pointer: stage (nullable)
     *   - raw result: res + result alias
     *   - terminal info: terminal + summary
     *   - convenience booleans: ok, waiting, complete, error
     *   - meta reasons: reason, locked, missingJob, empty
     *
     * Notes
     * - This function does not emit hooks; it only builds payloads consumed by Tick.
     * - Pipeline *phase* is carried inside `stage.phase` and uses:
     *     - helpers.PIPELINE_PHASE_RUN   ("run")
     *     - helpers.PIPELINE_PHASE_ERROR ("error")
     *
     * @param {Object} [args]
     * @param {string|null} [args.jobId]
     *   Explicit job id (overrides job.id if provided).
     * @param {Job|null} [args.job]
     *   Resolved job instance (optional; used for id fallback).
     * @param {Object|null} [args.ticket]
     *   Current run ticket (optional; used for id and pipelineKey fallbacks).
     * @param {Object|null} [args.res]
     *   StageResult-like object returned from VM/Tick (may be null).
     * @param {Object|null} [args.summary]
     *   Terminal summary object (only meaningful when `flags.terminal` is true).
     * @param {Object|null} [args.flags]
     *   Normalized boolean flags produced by Tick (didWork, ok, waiting, complete,
     *   error, terminal, locked, missingJob, empty) plus optional `reason`.
     *
     * @returns {Object}
     *   Normalized trace payload.
     */
    _makeTickTrace({ jobId = null, job = null,  ticket = null, res = null, summary = null, flags = null } = {}) {
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

    /**
     * Build a compact terminal summary for a finished ticket.
     *
     * Purpose
     * - Produces a minimal, stable descriptor for terminal ticket outcomes that can be emitted
     *   to hooks and logs.
     * - Encapsulates recovery semantics (error-phase handling) in one place.
     *
     * Terminal states
     * - `state` is authoritative and is expected to be one of:
     *     - helpers.TICKET_STATE.COMPLETE ("complete")
     *     - helpers.TICKET_STATE.ERROR    ("error")
     *
     * Phase resolution
     * - `phase` is resolved (highest priority first) from:
     *     1) `ticket.phase`
     *     2) `res.detail.phase`
     *     3) helpers.PIPELINE_PHASE_RUN ("run")
     *
     * Pipeline key resolution
     * - `pipelineKey` is resolved best-effort from:
     *     1) `ticket.pipelineKey`
     *     2) `res.detail.pipelineKey`
     *
     * Error recovery detection
     * - `handled` is true when:
     *     - state === helpers.TICKET_STATE.COMPLETE, AND
     *     - either:
     *         a) `res.detail.handled === true`, OR
     *         b) `phase === helpers.PIPELINE_PHASE_ERROR`
     * - This indicates the pipeline entered the error phase but ultimately completed successfully.
     *
     * Error payloads
     * - `originalError` is sourced from `ticket.errorInfo` (if present).
     * - `error` is included only when `state === helpers.TICKET_STATE.ERROR`,
     *   and is taken from `res.error`.
     * - The full `res` object is preserved for downstream inspection.
     *
     * @param {Object} args
     * @param {Job} args.job
     *   Resolved job instance (currently informational; not directly used).
     * @param {Object} args.ticket
     *   Ticket associated with this terminal state.
     * @param {Object} args.res
     *   StageResult-like object returned from the VM.
     * @param {string} args.state
     *   Final terminal state for this ticket (helpers.TICKET_STATE.COMPLETE | helpers.TICKET_STATE.ERROR).
     *
     * @returns {Object}
     *   Terminal summary:
     *   {
     *     state,
     *     phase,
     *     handled,
     *     pipelineKey,
     *     originalError,
     *     error,
     *     res
     *   }
     */
    _makeTerminalSummary({ job, ticket, res, state }) {
	const detail = (res && typeof res === "object") ? (res.detail || {}) : {};
	const phase = ticket?.phase || detail.phase || helpers.PIPELINE_PHASE_RUN;
	const pipelineKey =
              ticket?.pipelineKey ||
              detail.pipelineKey ||
              null;

	const handled =
              state === helpers.TICKET_STATE.COMPLETE &&
              (detail.handled === true || phase === helpers.PIPELINE_PHASE_ERROR);

	return {
            // Ticket terminal state
            // One of: helpers.TICKET_STATE.COMPLETE ("complete") | helpers.TICKET_STATE.ERROR ("error")
            state,

            // Pipeline phase (do not confuse with hook names)
            // One of: helpers.PIPELINE_PHASE_RUN ("run") | helpers.PIPELINE_PHASE_ERROR ("error")
            phase,

            // Best-effort recovery indicator:
            // true if the completion occurred after entering the error phase, or if the op marked handled=true.
            handled,

            // Best-effort pipelineKey at time of termination
            pipelineKey,

            // Original error captured on ticket (if any)
            originalError: ticket?.errorInfo || null,

            // Error object only when terminal state is ERROR
            error: state === helpers.TICKET_STATE.ERROR ? (res?.error || null) : null,

            // Raw StageResult-like object
            res,
	};
    }
    
}
export default TickResponse;
