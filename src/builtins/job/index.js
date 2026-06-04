/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

import helpers from "../../class/engine/helpers.js";

function ensureWaitCtx(ctx) {
    if (!ctx || typeof ctx !== "object") return {};
    if (!ctx.__jobWait || typeof ctx.__jobWait !== "object") {
        ctx.__jobWait = {};
    }
    return ctx.__jobWait;
}

function makeWaitKey({ ticket, ref } = {}) {
    const ticketId = ticket && ticket.id ? String(ticket.id) : "ticket";
    const waitRef = ref == null ? "job" : String(ref);
    return `${ticketId}:${waitRef}`;
}

/**
 * `job.wait` builtin.
 *
 * Wait until another registered job has completed at least once
 * (`dep.flags.hasRun === true`).
 *
 * Args:
 * - `job`       : required job id/name/ref
 * - `timeout`   : retry delay in ms
 * - `max_tries` : when > 0, fail after this many waits
 */
export async function jobWait({ lib, args, ctx, ticket, AT, step } = {}) {
    const op = "job.wait";

    try {
        const parsed = lib.args.parse(args, {}, {
            parms: "job timeout max_tries",
            pop: true,
        }) || {};

        const jobList = lib.array.to(parsed.job).filter((item) => item != null && item !== "");
        if (!jobList.length) {
            throw new Error("[job.wait] job is required.");
        }

        if (!AT || typeof AT.toJob !== "function") {
            throw new Error("[job.wait] AT.toJob is unavailable.");
        }

        const deps = jobList.map((jobRef) => ({
            ref: jobRef,
            dep: AT.toJob(jobRef) || null,
        }));

        const depNames = deps.map(({ dep, ref }) => dep ? (dep.id || dep.name || String(ref)) : String(ref));
        const pending = deps.filter(({ dep }) => !dep || !lib.bool.yes(lib.hash.get(dep, "flags.hasRun")));

        if (!pending.length) {
            return helpers.SR_ok({
                op,
                step,
                job: depNames.length === 1 ? depNames[0] : depNames,
                done: true,
            });
        }

        const timeout = Math.max(0, lib.number.toInt(parsed.timeout) || 1000);
        const maxTries = lib.number.toInt(parsed.max_tries);
        const bucket = ensureWaitCtx(ctx);
        const pendingNames = pending.map(({ dep, ref }) => dep ? (dep.id || dep.name || String(ref)) : String(ref));
        const waitKey = makeWaitKey({ ticket, ref: pendingNames.join("|") });
        const tries = (lib.number.toInt(bucket[waitKey]) || 0) + 1;
        bucket[waitKey] = tries;

        if (maxTries > 0 && tries > maxTries) {
            return helpers.SR_error(
                new Error(`[job.wait] max tries exceeded for '${pendingNames.join(", ")}'.`),
                {
                    op,
                    step,
                    job: depNames.length === 1 ? depNames[0] : depNames,
                    pending: pendingNames,
                    tries,
                    max_tries: maxTries,
                }
            );
        }

        return helpers.SR_wait(
            {
                type: "job.wait",
                token: waitKey,
                until: Date.now() + timeout,
            },
            {
                op,
                step,
                job: depNames.length === 1 ? depNames[0] : depNames,
                pending: pendingNames,
                tries,
                timeout,
                max_tries: maxTries,
            }
        );
    } catch (err) {
        return helpers.SR_error(err, { op, step });
    }
}

/**
 * `job.run` builtin.
 *
 * Explicitly enqueue and start one or more registered jobs.
 *
 * Args:
 * - `job`               : required job id/name/ref
 * - `pipeline`          : optional pipeline key (defaults to `ready`)
 * - `reason`            : optional input reason
 * - `require_drain_max` : optional follow-up drain max (defaults to 25)
 */
export async function jobRun({ lib, args, ctx, AT, step } = {}) {
    const op = "job.run";

    try {
        const parsed = lib.args.parse(args, {}, {
            parms: "job pipeline reason require_drain_max",
            pop: true,
        }) || {};

        const jobList = lib.array.to(parsed.job).filter((item) => item != null && item !== "");
        if (!jobList.length) {
            throw new Error("[job.run] job is required.");
        }

        if (!AT || typeof AT.toJob !== "function" || !AT.engine) {
            throw new Error("[job.run] Active Tags engine is unavailable.");
        }

        const deps = jobList.map((jobRef) => ({
            ref: jobRef,
            dep: AT.toJob(jobRef) || null,
        }));

        const missing = deps.filter(({ dep }) => !dep);
        if (missing.length) {
            throw new Error(`[job.run] missing job(s): ${missing.map(({ ref }) => String(ref)).join(", ")}.`);
        }

        const pipeline = lib.str.to(parsed.pipeline, true).trim() || "ready";
        const reason = lib.str.to(parsed.reason, true).trim() || "runtime";
        const requireDrainMax = Math.max(1, lib.number.toInt(parsed.require_drain_max) || 25);
        const ran = [];

        for (const { dep, ref } of deps) {
            lib.hash.set(dep, "flags.hasRun", false);
            const meta = { source: op };
            const inputs = { reason };
            const ticket = AT.engine.enqueue(dep, pipeline, { inputs, meta });

            if (!ticket) {
                throw new Error(`[job.run] failed to enqueue '${dep.id || dep.name || String(ref)}'.`);
            }

            await AT.engine.drain({ ticket, ctx });
            await AT.engine.drain({ requireJob: dep, ctx, max: requireDrainMax });
            AT.engine.wake.refresh({ ctx });

            ran.push(dep.id || dep.name || String(ref));
        }

        return helpers.SR_ok({
            op,
            step,
            job: ran.length === 1 ? ran[0] : ran,
            pipeline,
            reason,
        });
    } catch (err) {
        return helpers.SR_error(err, { op, step });
    }
}

export default {
    run: jobRun,
    wait: jobWait,
};
