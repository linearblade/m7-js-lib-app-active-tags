/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * Recording popstate service for ActiveTags PopStateController tests.
 *
 * Matches the surface Controller uses:
 * - history.host.location.href
 * - push(url, title, state)   // note: url-first, not History.pushState order
 * - set(state)
 * - register/unregister/start/stop for replay handler install
 */

export function createRecordingPopstateService(opts = {}) {
    const href = opts.href || "http://app.test/start";
    const log = [];
    const handlers = new Map();

    const host = {
        location: { href },
        history: {
            state: null,
        },
    };

    const service = {
        history: { host },
        conf: { last: href },
        log,
        handlers,
        register(key, handler) {
            handlers.set(String(key), handler);
            log.push({ op: "register", key: String(key) });
        },
        unregister(key) {
            handlers.delete(String(key));
            log.push({ op: "unregister", key: String(key) });
        },
        start() {
            log.push({ op: "start" });
        },
        stop() {
            log.push({ op: "stop" });
        },
        /**
         * Controller._pushHistoryState calls: popstate.push(url, title, state)
         */
        push(url, title, state) {
            const entry = {
                op: "push",
                url: url ?? null,
                title: title ?? null,
                state: state ?? null,
            };
            log.push(entry);
            host.history.state = state ?? null;
            if (typeof url === "string" && url) {
                host.location.href = url;
                service.conf.last = url;
            }
            return state ?? null;
        },
        /**
         * Controller seed / set fallback: popstate.set(statePayload)
         */
        set(state) {
            const entry = {
                op: "set",
                state: state ?? null,
                url: host.location.href,
            };
            log.push(entry);
            host.history.state = state ?? null;
            return state ?? null;
        },
        /**
         * Fire an installed replay handler as if the browser popped state.
         */
        fireReplay(state, currentURL = host.location.href) {
            const handler = handlers.get("active-tags");
            if (typeof handler !== "function") {
                throw new Error("[test] no active-tags replay handler registered");
            }
            return handler({ state }, currentURL, {});
        },
        clearLog() {
            log.length = 0;
        },
    };

    return service;
}

export default createRecordingPopstateService;
