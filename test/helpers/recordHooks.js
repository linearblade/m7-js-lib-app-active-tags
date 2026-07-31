/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * Assertion-friendly Engine lifecycle hook recorder.
 *
 * Replaces console-oriented src/class/engine/testHooks.js for automated tests.
 */

export function recordHooks() {
    const log = [];

    function push(type, payload = {}) {
        const entry = { type, at: Date.now(), ...payload };
        log.push(entry);
        return entry;
    }

    const hooks = {
        onEnqueue({ job, ticket } = {}) {
            push("enqueue", {
                jobId: job?.id ?? null,
                ticketId: ticket?.id ?? null,
                pipelineKey: ticket?.pipelineKey ?? null,
                state: ticket?.state ?? null,
            });
        },
        onDequeue(trace = {}) {
            // TickResponse flattens flags onto the trace (ok/waiting/complete/error/reason).
            push("dequeue", {
                jobId: trace.jobId ?? trace.job?.id ?? null,
                ticketId: trace.ticketId ?? trace.ticket?.id ?? null,
                reason: trace.reason ?? trace.flags?.reason ?? null,
            });
        },
        onStage(trace = {}) {
            push("stage", {
                jobId: trace.jobId ?? trace.job?.id ?? null,
                ticketId: trace.ticketId ?? trace.ticket?.id ?? null,
                status: trace.res?.status ?? trace.result?.status ?? null,
                ok: !!(trace.ok ?? trace.flags?.ok),
                waiting: !!(trace.waiting ?? trace.flags?.waiting),
                error: !!(trace.error ?? trace.flags?.error),
                complete: !!(trace.complete ?? trace.flags?.complete),
                didWork: !!(trace.didWork ?? trace.flags?.didWork),
            });
        },
        onComplete(trace = {}) {
            push("complete", {
                jobId: trace.jobId ?? trace.job?.id ?? null,
                ticketId: trace.ticketId ?? trace.ticket?.id ?? null,
                status: trace.res?.status ?? null,
                complete: !!(trace.complete ?? trace.flags?.complete),
                terminal: !!(trace.terminal ?? trace.flags?.terminal),
            });
        },
        onError(trace = {}) {
            push("error", {
                jobId: trace.jobId ?? trace.job?.id ?? null,
                ticketId: trace.ticketId ?? trace.ticket?.id ?? null,
                status: trace.res?.status ?? null,
                message: trace.res?.error?.message ?? null,
                error: !!(trace.error ?? trace.flags?.error),
                terminal: !!(trace.terminal ?? trace.flags?.terminal),
            });
        },
        onTicketDone(trace = {}) {
            push("done", {
                jobId: trace.jobId ?? trace.job?.id ?? null,
                ticketId: trace.ticketId ?? trace.ticket?.id ?? null,
                complete: !!(trace.complete ?? trace.flags?.complete),
                error: !!(trace.error ?? trace.flags?.error),
                terminal: !!(trace.terminal ?? trace.flags?.terminal),
            });
        },
    };

    return {
        hooks,
        log,
        of(type) {
            return log.filter((e) => e.type === type);
        },
        clear() {
            log.length = 0;
        },
        types() {
            return log.map((e) => e.type);
        },
    };
}

export default recordHooks;
