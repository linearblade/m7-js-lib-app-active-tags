/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * `error.dump` builtin.
 *
 * Captures current ticket error context into a diagnostic payload, optionally
 * logs it to console, stores it on `inputs.errors`, and can rethrow for stack
 * trace debugging.
 *
 * Options (via `args` hash):
 * - `includeInputs` (default true)
 * - `includeCtx` (default false)
 * - `console` (default true)
 * - `level` ("warn" | default error)
 * - `printStack` (default true)
 * - `debugger` (default false)
 * - `throw` (default false)
 *
 * @param {Object} params
 * @param {Object} params.job
 * @param {Object} params.lib
 * @param {*} [params.args]
 * @param {*} [params.trigger]
 * @param {Object} [params.ticket]
 * @param {Object} [params.inputs]
 * @param {Object} [params.ctx]
 * @param {*} [params.step]
 *
 * @returns {Promise<Object>}
 *   StageResult-like object (`ok` | `error`).
 */
export default async function errorDump({ job, lib, args, trigger, ticket, inputs, ctx, step } = {}) {
  try {
    const opts = (args && typeof args === "object") ? args : {};

    const original = ticket?.errorInfo || null;
    const err =
      original?.error ||
      ticket?.last?.res?.error ||
      null;

    const payload = {
      at: Date.now(),
      op: "error.dump",
      phase: ticket?.phase || null,
      pipelineKey: ticket?.pipelineKey || null,
      step: step || null,
      jobId: job?.id || null,
      jobName: job?.name || null,
      trigger: trigger || null,
      original,
      error: err ? { name: err.name, message: err.message, stack: err.stack } : null,
      inputs: (opts.includeInputs === false) ? null : inputs,
      ctx: opts.includeCtx ? ctx : null,
    };

    // store for later inspection
    if (inputs && typeof inputs === "object") {
      if (!Array.isArray(inputs.errors)) inputs.errors = [];
      inputs.errors.push(payload);
    }

    // console output (keeps stack visible)
    if (opts.console !== false) {
      const log = (opts.level === "warn") ? console.warn : console.error;
      log("[AT][error.dump]", payload);
      if (opts.printStack !== false && err) log(err); // ensures browser prints stack as an Error
    }

    // optional breakpoint for “traceable”
    if (opts.debugger === true) debugger;

    // OPTIONAL: throw to stop execution + get a real stack trace
    if (opts.throw === true) {
      // Prefer rethrowing original if present (best stack)
      if (err instanceof Error) {
        err.atPayload = payload; // attach payload for inspection
        throw err;
      }

      // Otherwise throw a new error with cause
      const e = new Error("AT error.dump: throwing for trace", { cause: err || undefined });
      e.atPayload = payload;
      throw e;
    }

    return { status: "ok", detail: { op: "error.dump", dumped: true, step } };
  } catch (err2) {
    return { status: "error", error: err2, detail: { op: "error.dump", step } };
  }
}
