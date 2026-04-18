/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * Popstate Controller
 * -------------------
 *
 * Owns the ActiveTags-side integration surface for the PopStateManager
 * service.
 *
 * Responsibilities:
 * - install the ActiveTags popstate replay handler
 * - capture event-level popstate directives before mutation
 * - write minimal replay state after successful completion
 * - replay a stored pipeline when browser back/forward targets AT state
 */

import createReplayHandler from './replayHandler.js';

const INVALID_HISTORY_URL = "__INVALID_URL__";

function copyObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
	return {};
    }

    return { ...value };
}

function cleanString(value) {
    if (value === null || value === undefined) {
	return "";
    }

    return String(value).trim();
}

function normalizeHistoryScalar(value) {
    if (value === true || value === false) {
	return value;
    }

    const next = cleanString(value);
    return next || false;
}

function deriveTitleFromUrl(url) {
    const text = cleanString(url);
    if (!text) return false;

    const stripped = text.split("#")[0].split("?")[0];
    const parts = stripped.split("/").filter(Boolean);
    const leaf = parts.length ? parts[parts.length - 1] : stripped;
    const decoded = cleanString(leaf);
    if (!decoded) return false;

    return decoded.replace(/\.[a-z0-9]+$/i, "") || decoded;
}

export class Controller {
    /**
     * @param {Object} [opts]
     * @param {Object} opts.AT
     * @param {Object} opts.lib
     */
    constructor({ AT, lib } = {}) {
	if (!AT) throw new Error("PopStateController requires { AT }");
	if (!lib) throw new Error("PopStateController requires { lib }");

	this.AT = AT;
	this.lib = lib;

	// runtime subsystem refs (non-owning)
	this.engine = AT.engine || null;
	this.jobs = AT.jobs || null;
	this.runtime = AT.runtime || null;
	this.svc = AT.svc || null;
	this.popstate = AT.svc ? (AT.svc.popstate || null) : null;
	this.handlerKey = "active-tags";

	// reserved mutable state for future startup / replay orchestration
	this.state = {
	    started: false,
	    handler: null,
	    baselineSeeded: false,
	};

	Object.freeze(this);
    }

    start() {
	if (this.state.started) return this;
	if (!this.popstate) return this;

	this.installReplayHandler();
	this.state.started = true;
	console.log("[activeTags.popstate] started; handler installed:", this.handlerKey);
	return this;
    }

    stop() {
	if (!this.popstate || !this.state.started) return this;

	this.uninstallReplayHandler();
	this.state.started = false;
	this.state.baselineSeeded = false;
	return this;
    }

    installReplayHandler() {
	if (!this.popstate) return null;

	const handler = this.createReplayHandler();
	if (typeof this.popstate.register === "function") {
	    this.popstate.register(this.handlerKey, handler);
	}
	if (typeof this.popstate.start === "function") {
	    this.popstate.start();
	}

	this.state.handler = handler;
	return handler;
    }

    uninstallReplayHandler() {
	if (!this.popstate) return this;

	if (typeof this.popstate.unregister === "function") {
	    this.popstate.unregister(this.handlerKey);
	}
	if (typeof this.popstate.stop === "function") {
	    this.popstate.stop();
	}

	this.state.handler = null;
	return this;
    }

    createReplayHandler() {
	return createReplayHandler({ controller: this });
    }

    seedBaseline() {
	if (!this.popstate || this.state.baselineSeeded) return null;

	const state = this._buildBaselineSeedState();
	if (!state) return null;

	this.state.baselineSeeded = true;
	return this.popstate.set(state);
    }

    _buildBaselineSeedState() {
	return {
	    popstate: this.handlerKey,
	    baseline: true,
	};
    }

    /**
     * Public popstate dispatch entrypoint.
     *
     * Called by the registered PopStateManager handler when browser
     * back/forward navigation targets ActiveTags-managed state.
     *
     * Wiring note:
     * This method is invoked from `src/class/popstate/replayHandler.js`.
     */
    handleReplayEvent(event, currentURL, ctx) {
	try {
	    if (this._isBaselineState(ctx)) {
		return this._restoreBaseline(event, currentURL, ctx);
	    }

	    const envelope = this._resolveReplayEnvelope(event, currentURL, ctx);
	    if (!this._shouldReplay(envelope)) return null;
	    return this._enqueueReplay(envelope);
	} catch (err) {
	    console.error("[activeTags.popstate] replay failed:", err);
	    return null;
	}
    }

    _isBaselineState(ctx) {
	const state = ctx && typeof ctx === "object" && ctx.state && typeof ctx.state === "object"
	    ? ctx.state
	    : null;

	return !!(state && state.baseline === true);
    }

    _restoreBaseline(event, currentURL, ctx) {
	void event;
	void currentURL;
	void ctx;

	// if (!this.popstate || typeof this.popstate.loadUrl !== "function") return null;
	// return this.popstate.loadUrl(currentURL);
	return null;
    }

    _resolveReplayEnvelope(event, currentURL, ctx) {
	const state = ctx && typeof ctx === "object" && ctx.state && typeof ctx.state === "object"
	    ? ctx.state
	    : null;
	const replay = state && typeof state.replay === "object" && !Array.isArray(state.replay)
	    ? state.replay
	    : null;

	if (!replay) return null;

	const jobId = cleanString(replay.jobId) || null;
	const jobName = cleanString(replay.jobName) || null;
	const eventName = cleanString(replay.eventName) || null;
	const pipelineKey = cleanString(replay.pipelineKey) || null;

	return {
	    event,
	    currentURL: cleanString(currentURL),
	    ctx,
	    state,
	    replay,
	    jobId,
	    jobName,
	    eventName,
	    pipelineKey,
	    inputPayload: copyObject(replay.inputs),
	    statePayload: copyObject(replay.state),
	};
    }

    _shouldReplay(envelope) {
	if (!envelope) return false;
	if (!envelope.pipelineKey) return false;
	if (!envelope.jobId && !envelope.jobName) return false;
	return true;
    }

    _enqueueReplay(envelope) {
	const job = this.AT.toJob(envelope.jobId) ||
	      (envelope.jobName ? this.AT.toJob(envelope.jobName) : null);
	if (!job || !job.id) return null;

	const ticket = this.engine.enqueue(job, envelope.pipelineKey, {
	    inputs: {
		...envelope.inputPayload,
		reason: "popstate",
		eventName: envelope.eventName,
		popstate: true,
		popstateEvent: envelope.event || null,
		popstateContext: envelope.ctx || null,
		popstateState: envelope.state || null,
		replay: envelope.replay || null,
		replayState: envelope.statePayload,
	    },
	    meta: {
		source: "popstate",
		popstate: true,
		eventName: envelope.eventName,
	    },
	});

	Promise.resolve().then(async () => {
	    await this.engine.drain({ ticket, ctx: {} });
	    await this.engine.drain({ requireJob: job, ctx: {}, max: 25 });
	});

	return ticket;
    }

    /**
     * Public engine pre-chaser entrypoint.
     *
     * Intended for EngineManager.enqueue(...) so popstate metadata can be
     * captured before the page mutates.
     *
     * Wiring note:
     * This method belongs in `src/class/engine/EngineManager.js`
     * inside `enqueue(...)`, immediately after ticket creation.
     */
    preChaseEnqueue({ job, ticket, pipelineKey, inputs, meta } = {}) {
	try {
	    const snapshot = this._captureReplaySnapshot({ job, ticket, pipelineKey, inputs, meta });
	    if (!snapshot || !ticket || !ticket.meta || typeof ticket.meta !== "object") return null;
	    ticket.meta.popstate = snapshot;
	    return snapshot;
	} catch (err) {
	    console.error("[activeTags.popstate] pre-chase failed:", err);
	    return null;
	}
    }

    _captureReplaySnapshot({ job, ticket, pipelineKey, inputs, meta } = {}) {
	const directive = this._resolveHistoryDirective({ job, ticket, pipelineKey, inputs, meta });
	if (!directive) return null;

	return {
	    jobId: cleanString(job && job.id) || cleanString(ticket && ticket.jobId) || null,
	    jobName: cleanString(job && job.name) || null,
	    eventName: directive.eventName,
	    pipelineKey: cleanString(pipelineKey || (ticket && ticket.pipelineKey)) || "default",
	    directive,
	};
    }

    _resolveHistoryDirective({ job, ticket, pipelineKey, inputs, meta } = {}) {
	void ticket;
	void pipelineKey;
	void meta;

	if (!job || !job.id || !inputs || typeof inputs !== "object") return null;
	if (cleanString(inputs.reason).toLowerCase() !== "event") return null;

	const eventName = cleanString(inputs.eventName);
	if (!eventName) return null;

	const eventDef = this.lib.hash.get(job, `config.schema.events.${eventName}`);
	const popstate = eventDef && typeof eventDef === "object" ? eventDef.popstate : null;

	if (!popstate || typeof popstate !== "object" || Array.isArray(popstate)) return null;

	return {
	    eventName,
	    mode: cleanString(popstate.mode).toLowerCase() === "set" ? "set" : "push",
	    url: normalizeHistoryScalar(popstate.url),
	    title: normalizeHistoryScalar(popstate.title),
	    state: copyObject(popstate.state),
	    inputs: copyObject(popstate.inputs),
	};
    }

    /**
     * Public engine success post-chaser entrypoint.
     *
     * Intended for Tick._responseComplete(...) so successful runs can decide
     * whether to write history state.
     *
     * Wiring note:
     * This method belongs in `src/class/engine/Tick.js`
     * inside `_responseComplete(env)`.
     */
    postChaseComplete(env = {}) {
	const ticket = env && env.ticket ? env.ticket : null;

	try {
	    const snapshot = ticket && ticket.meta && typeof ticket.meta === "object"
		? ticket.meta.popstate || null
		: null;
	    if (!snapshot) return null;

	    return this._writeHistoryState({
		job: env.job || null,
		ticket,
		snapshot,
		directive: snapshot.directive || null,
	    });
	} catch (err) {
	    console.error("[activeTags.popstate] post-chase complete failed:", err);
	    return null;
	} finally {
	    this._clearTicketSnapshot(ticket);
	}
    }

    /**
     * Public engine error post-chaser entrypoint.
     *
     * Intended for Tick._responseError(...) so pending popstate state can be
     * ignored or cleaned up on failure.
     *
     * Wiring note:
     * This method belongs in `src/class/engine/Tick.js`
     * inside `_responseError(env)`.
     */
    postChaseError(env = {}) {
	try {
	    return this._clearTicketSnapshot(env && env.ticket ? env.ticket : null);
	} catch (err) {
	    console.error("[activeTags.popstate] post-chase error cleanup failed:", err);
	    return null;
	}
    }

    /**
     * Public engine unknown-status post-chaser entrypoint.
     *
     * Intended for Tick._responseUnknown(...) so popstate cleanup behavior
     * stays symmetrical with the other terminal paths.
     *
     * Wiring note:
     * This method belongs in `src/class/engine/Tick.js`
     * inside `_responseUnknown(env)`.
     */
    postChaseUnknown(env = {}) {
	try {
	    return this._clearTicketSnapshot(env && env.ticket ? env.ticket : null);
	} catch (err) {
	    console.error("[activeTags.popstate] post-chase unknown cleanup failed:", err);
	    return null;
	}
    }

    /**
     * Public manual history write entrypoint.
     *
     * Intended for explicit pipeline-driven history ops such as
     * `@popstate.set` / `@popstate.push`.
     */
    writeBuiltinHistory({
	job,
	ticket,
	mode = "push",
	pipelineKey,
	eventName = null,
	url = false,
	title = false,
	state = {},
	inputs = {},
    } = {}) {
	if (!job || !job.id) return null;

	const nextPipelineKey = cleanString(pipelineKey || (ticket && ticket.pipelineKey)) || "default";
	const nextEventName = cleanString(eventName || (ticket && ticket.inputs && ticket.inputs.eventName)) || null;
	const directive = {
	    eventName: nextEventName,
	    mode: cleanString(mode).toLowerCase() === "set" ? "set" : "push",
	    url: normalizeHistoryScalar(url),
	    title: normalizeHistoryScalar(title),
	    state: copyObject(state),
	    inputs: copyObject(inputs),
	};

	const snapshot = {
	    jobId: cleanString(job.id) || cleanString(ticket && ticket.jobId) || null,
	    jobName: cleanString(job.name) || null,
	    eventName: nextEventName,
	    pipelineKey: nextPipelineKey,
	    directive,
	};

	return this._writeHistoryState({ job, ticket, snapshot, directive });
    }

    _clearTicketSnapshot(ticket = null) {
	if (!ticket || !ticket.meta || typeof ticket.meta !== "object") return null;

	const snapshot = ticket.meta.popstate || null;
	delete ticket.meta.popstate;
	return snapshot;
    }

    _buildHistoryState({ job, ticket, snapshot, directive } = {}) {
	const nextDirective = directive && typeof directive === "object"
	    ? directive
	    : (snapshot && snapshot.directive && typeof snapshot.directive === "object" ? snapshot.directive : null);
	if (!nextDirective) return null;

	const jobId = cleanString(job && job.id) ||
	      cleanString(snapshot && snapshot.jobId) ||
	      cleanString(ticket && ticket.jobId) ||
	      null;
	const jobName = cleanString(job && job.name) ||
	      cleanString(snapshot && snapshot.jobName) ||
	      null;
	const eventName = cleanString(snapshot && snapshot.eventName) || null;
	const pipelineKey = cleanString(snapshot && snapshot.pipelineKey) ||
	      cleanString(ticket && ticket.pipelineKey) ||
	      null;

	if (!jobId || !pipelineKey) return null;

	return {
	    popstate: this.handlerKey,
	    replay: {
		jobId,
		jobName,
		eventName,
		pipelineKey,
		state: copyObject(nextDirective.state),
		inputs: copyObject(nextDirective.inputs),
	    },
	};
    }

    _writeHistoryState({ job, ticket, snapshot, directive } = {}) {
	const nextDirective = directive && typeof directive === "object"
	    ? directive
	    : (snapshot && snapshot.directive && typeof snapshot.directive === "object" ? snapshot.directive : null);
	if (!nextDirective) return null;

	const state = this._buildHistoryState({ job, ticket, snapshot, directive: nextDirective });
	if (!state) return null;

	const mode = cleanString(nextDirective.mode).toLowerCase() === "set" ? "set" : "push";
	const nextURL = this._resolveHistoryUrl({ job, ticket, snapshot, directive: nextDirective });
	const nextTitle = this._resolveHistoryTitle({ job, ticket, snapshot, directive: nextDirective, url: nextURL });
	const host = this.popstate && this.popstate.history ? this.popstate.history.host : null;
	const currentURL = host && host.location && typeof host.location.href === "string"
	    ? host.location.href
	    : "";
	const url = this._sanitizeHistoryUrl(nextURL);
	const finalURL = (url === false) ? currentURL : url;
	const title = nextTitle || "";

	if (mode === "set") {
	    return this._setHistoryState({ url: finalURL, title, state });
	}

	return this._pushHistoryState({ url: finalURL, title, state });
    }

    _resolveHistoryUrl({ job, ticket, snapshot, directive } = {}) {
	void ticket;

	const value = directive && typeof directive === "object" ? directive.url : false;
	if (value === false) return false;
	if (typeof value === "string" && value) return value;
	if (value !== true) return false;

	return this._resolveRequestDerivedUrl({ job, snapshot });
    }

    _resolveHistoryTitle({ job, ticket, snapshot, directive, url } = {}) {
	void ticket;

	const value = directive && typeof directive === "object" ? directive.title : false;
	if (value === false) return false;
	if (typeof value === "string" && value) return value;
	if (value !== true) return false;

	const requestUrl = this._resolveRequestDerivedUrl({ job, snapshot });
	return deriveTitleFromUrl(requestUrl || url || "");
    }

    _resolveRequestDerivedUrl({ job, snapshot } = {}) {
	if (!job || !job.id) return false;

	const pipelineKey = cleanString(snapshot && snapshot.pipelineKey) || "default";
	const steps = this.lib.array.to(this.lib.hash.get(job, `config.schema.pipelines.${pipelineKey}.run`));
	for (const step of steps) {
	    if (!step || typeof step !== "object") continue;
	    const op = cleanString(step.op).replace(/^@/, "").toLowerCase();
	    if (op !== "http.send") continue;

	    const args = this.lib.hash.to(step.args);
	    const directUrl = cleanString(args.url || this.lib.hash.get(args, "request.endpoint.url"));
	    if (directUrl) return directUrl;

	    const requestName = cleanString(args.name || args.requestName) || "default";
	    const requestUrl = cleanString(this.lib.hash.get(job, `config.schema.requests.${requestName}.endpoint.url`));
	    if (requestUrl) return requestUrl;
	}

	return false;
    }

    _sanitizeHistoryUrl(url = false) {
	if (url === false) return false;

	const nextURL = cleanString(url);
	if (!nextURL) return false;

	const host = this.popstate && this.popstate.history ? this.popstate.history.host : null;
	const currentHref = host && host.location && typeof host.location.href === "string"
	    ? host.location.href
	    : "";
	if (!currentHref || typeof URL !== "function") return INVALID_HISTORY_URL;

	try {
	    const current = new URL(currentHref);
	    if (nextURL === INVALID_HISTORY_URL) {
		return new URL(INVALID_HISTORY_URL, current).href;
	    }

	    const resolved = new URL(nextURL, current);
	    const protocol = cleanString(resolved.protocol).toLowerCase();
	    if (!["http:", "https:"].includes(protocol)) {
		return new URL(INVALID_HISTORY_URL, current).href;
	    }
	    if (resolved.origin !== current.origin) {
		return new URL(INVALID_HISTORY_URL, current).href;
	    }

	    return resolved.href;
	} catch (err) {
	    void err;
	    try {
		return new URL(INVALID_HISTORY_URL, currentHref).href;
	    } catch (fallbackErr) {
		void fallbackErr;
		return INVALID_HISTORY_URL;
	    }
	}
    }

    _setHistoryState({ url, title, state } = {}) {
	if (!this.popstate) return null;

	const manager = this.popstate;
	const history = manager.history || null;
	const stateSvc = manager.state || null;
	const host = history && history.host ? history.host : null;
	const currentURL = host && host.location && typeof host.location.href === "string"
	    ? host.location.href
	    : "";
	const nextURL = cleanString(url) || currentURL;
	const nextTitle = cleanString(title) || null;
	const nextStatePayload = copyObject(state);

	if (
	    stateSvc &&
	    typeof stateSvc.buildEnvelope === "function" &&
	    typeof stateSvc.buildPageState === "function" &&
	    history &&
	    typeof history.set === "function"
	) {
	    const nextState = stateSvc.buildEnvelope({
		type: "start",
		url: nextURL,
		previous: null,
		state: nextStatePayload,
		pos: history.statePos,
	    });

	    const pageState = stateSvc.buildPageState(nextState);
	    history.set(pageState, {
		title: nextTitle,
		url: nextURL,
	    });

	    if (manager.conf && typeof manager.conf === "object") {
		manager.conf.last = nextURL;
	    }

	    return nextState;
	}

	if (typeof manager.set !== "function") return null;
	return manager.set(nextStatePayload);
    }

    _pushHistoryState({ url, title, state } = {}) {
	if (!this.popstate || typeof this.popstate.push !== "function") return null;

	const host = this.popstate && this.popstate.history ? this.popstate.history.host : null;
	const currentURL = host && host.location && typeof host.location.href === "string"
	    ? host.location.href
	    : "";
	const nextURL = cleanString(url) || currentURL;

	if (!nextURL) return null;

	return this.popstate.push(nextURL, cleanString(title), copyObject(state));
    }
}

export default Controller;
