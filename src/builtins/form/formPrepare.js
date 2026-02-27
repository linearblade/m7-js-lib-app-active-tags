/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * Prepare submit context for a form-driven pipeline.
 *
 * This builtin resolves the effective DOM element that should act as the
 * submit source and stages it for downstream form operations.
 *
 * In most cases this stage is **not required**:
 * - A typical form pipeline triggered by a submit button will already
 *   have a valid engine-provided `trigger`.
 * - `form.collect` and `form.submit` can usually operate without any
 *   explicit preparation.
 *
 * This stage exists primarily as:
 * - An explicit override point when a different submit source is desired
 *   (e.g. custom triggers, delegated events, synthetic submissions).
 * - A reserved staging hook for future extensions (confirmation,
 *   preprocessing, linting, or trigger normalization).
 *
 * Resolution order:
 *  1) `inputs.trigger` — explicit user override (if present)
 *  2) `trigger`        — engine-provided trigger element
 *  3) `job.e`          — the job’s bound element (typically the `<form>`)
 *
 * The resolved element is asserted to be a valid DOM element and stored
 * as `ticket.trigger` for downstream form stages.
 *
 * This stage performs **no submission, collection, or network activity**.
 * It exists purely to normalize and stage submit context.
 *
 * Failure semantics:
 * - Throws if no valid DOM element can be resolved.
 * - Thrown errors are caught and returned as a terminal stage error.
 *
 * @param {Object} params
 * @param {Object} params.job        The current job (guaranteed by engine)
 * @param {Object} params.lib        ActiveTags lib utilities
 * @param {Element|null} params.trigger
 *                                  Engine-provided trigger element
 * @param {Object|null} params.inputs
 *                                  User-provided inputs (may be null/undefined)
 * @param {Object} params.ticket     Current ticket (trigger slot is updated)
 * @param {Object} params.step       Pipeline step metadata
 *
 * @returns {StageResultLike}
 *   `{ status: "ok" }` after staging the submitter onto `ticket.trigger`,
 *   or `{ status: "error" }` if resolution or assertion fails.
 */

export default async function formPrepare({ job, lib, trigger, inputs, ticket, step } = {}) {
    try {
        // optional user override (may be null / non-dom)
        const override = lib.dom.attempt(inputs?.trigger);

        const submitter =
            override ||
            trigger ||
            job.e;

        lib.dom.attempt(submitter, true);

        // canonicalize trigger for the rest of the ticket lifetime
        ticket.trigger = submitter;

        return { status: "ok", detail: { op: "form.prepare", step } };
    } catch (err) {
        return { status: "error", error: err, detail: { op: "form.prepare", step } };
    }
}
