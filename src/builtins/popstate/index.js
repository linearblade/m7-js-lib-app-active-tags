/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

import helpers from "../../class/engine/helpers.js";

function hasOwn(obj, key) {
    return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function pickOwn(obj, keys, fallback = undefined) {
    for (const key of keys) {
	if (hasOwn(obj, key)) return obj[key];
    }
    return fallback;
}

function resolveHistoryArgs({ lib, args, ticket } = {}) {
    const parsed = lib.args.parse(args, {}, {
	parms: "pipelineKey eventName url title state inputs seedKey mode onSeed",
	pop: true,
    }) || {};

    return {
	pipelineKey: pickOwn(parsed, ["pipelineKey", "pipeline", "key"], ticket && ticket.pipelineKey ? ticket.pipelineKey : "default"),
	eventName: pickOwn(parsed, ["eventName", "event"], ticket && ticket.inputs ? ticket.inputs.eventName : null),
	url: pickOwn(parsed, ["url", "href"], false),
	title: pickOwn(parsed, ["title"], false),
	state: pickOwn(parsed, ["state"], {}),
	inputs: pickOwn(parsed, ["inputs"], {}),
	seedKey: pickOwn(parsed, ["seedKey", "seed", "id"], null),
	mode: pickOwn(parsed, ["mode"], "set"),
	onSeed: pickOwn(parsed, ["onSeed", "seedAction"], "complete"),
    };
}

function ensureJobWorkspace(job) {
    if (!job || typeof job !== "object") return {};
    if (!job.ws || typeof job.ws !== "object") job.ws = {};
    if (!job.ws.popstate || typeof job.ws.popstate !== "object") job.ws.popstate = {};
    if (!job.ws.popstate.seed || typeof job.ws.popstate.seed !== "object") job.ws.popstate.seed = {};
    return job.ws.popstate.seed;
}

function resolveSeedKey(payload = {}, ticket = null) {
    const explicit = payload && payload.seedKey != null ? String(payload.seedKey).trim() : "";
    if (explicit) return explicit;

    const pipelineKey = payload && payload.pipelineKey != null ? String(payload.pipelineKey).trim() : "";
    if (pipelineKey) return pipelineKey;

    if (ticket && ticket.pipelineKey != null) {
	const fromTicket = String(ticket.pipelineKey).trim();
	if (fromTicket) return fromTicket;
    }

    return "default";
}

async function runHistoryWrite({ job, lib, args, ticket, AT, step, mode } = {}) {
    try {
	if (!AT || !AT.popstate || typeof AT.popstate.writeBuiltinHistory !== "function") {
	    throw new Error("popstate builtin: AT.popstate.writeBuiltinHistory is unavailable");
	}

	const reason = String(lib.hash.get(ticket, "inputs.reason", "") || "").trim().toLowerCase();
	if (reason === "popstate") {
	    return helpers.SR_ok({
		op: `popstate.${mode}`,
		step,
		skipped: true,
		skipReason: "popstate-replay",
	    });
	}

	const payload = resolveHistoryArgs({ lib, args, ticket });
	const result = AT.popstate.writeBuiltinHistory({
	    job,
	    ticket,
	    mode,
	    pipelineKey: payload.pipelineKey,
	    eventName: payload.eventName,
	    url: payload.url,
	    title: payload.title,
	    state: payload.state,
	    inputs: payload.inputs,
	});

	return helpers.SR_ok({
	    op: `popstate.${mode}`,
	    step,
	    pipelineKey: payload.pipelineKey,
	    eventName: payload.eventName || null,
	    url: payload.url,
	    title: payload.title,
	    result: result || null,
	});
    } catch (err) {
	return helpers.SR_error(err, { op: `popstate.${mode}`, step });
    }
}

/**
 * `popstate.push` builtin.
 *
 * Writes a new browser history entry immediately.
 * Recommended placement: final pipeline stage.
 */
export async function popstatePush({ job, lib, args, ticket, AT, step } = {}) {
    return runHistoryWrite({ job, lib, args, ticket, AT, step, mode: "push" });
}

/**
 * `popstate.set` builtin.
 *
 * Rewrites the current browser history entry immediately.
 * Recommended placement: final pipeline stage.
 */
export async function popstateSet({ job, lib, args, ticket, AT, step } = {}) {
    return runHistoryWrite({ job, lib, args, ticket, AT, step, mode: "set" });
}

/**
 * `popstate.seed` builtin.
 *
 * First run:
 * - writes a `set` history entry
 * - marks a seed flag in `job.ws.popstate.seed`
 * - returns COMPLETE to stop the rest of the pipeline
 *
 * Later runs:
 * - returns OK and allows the pipeline to continue
 */
export async function popstateSeed({ job, lib, args, ticket, AT, step } = {}) {
    try {
	if (!AT || !AT.popstate || typeof AT.popstate.writeBuiltinHistory !== "function") {
	    throw new Error("popstate builtin: AT.popstate.writeBuiltinHistory is unavailable");
	}

	const payload = resolveHistoryArgs({ lib, args, ticket });
	const seedBucket = ensureJobWorkspace(job);
	const seedKey = resolveSeedKey(payload, ticket);

	if (seedBucket[seedKey] === true) {
	    return helpers.SR_ok({
		op: "popstate.seed",
		step,
		pipelineKey: payload.pipelineKey,
		seedKey,
		seeded: true,
		action: "continue",
	    });
	}

	const mode = String(payload.mode || "set").trim().toLowerCase() === "push" ? "push" : "set";
	const onSeed = String(payload.onSeed || "complete").trim().toLowerCase() === "continue"
	      ? "continue"
	      : "complete";
	const result = AT.popstate.writeBuiltinHistory({
	    job,
	    ticket,
	    mode,
	    pipelineKey: payload.pipelineKey,
	    eventName: payload.eventName,
	    url: payload.url,
	    title: payload.title,
	    state: payload.state,
	    inputs: payload.inputs,
	});

	seedBucket[seedKey] = true;

	const detail = {
	    op: "popstate.seed",
	    step,
	    pipelineKey: payload.pipelineKey,
	    seedKey,
	    seeded: true,
	    action: onSeed === "continue" ? "seed-continue" : "seed-complete",
	    mode,
	    result: result || null,
	};

	if (onSeed === "continue") {
	    return helpers.SR_ok(detail);
	}

	return helpers.SR_complete(detail);
    } catch (err) {
	return helpers.SR_error(err, { op: "popstate.seed", step });
    }
}

export default {
    push: popstatePush,
    set: popstateSet,
    seed: popstateSeed,
};
