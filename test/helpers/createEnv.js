/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * Minimal browser-like env for Node tests.
 *
 * ActiveTags controllers require `conf.env.document.querySelectorAll`.
 * Engine headless jobs only need a body-ish fallback on document.
 * This is intentionally fake — not a full DOM.
 */

export function createFakeEnv(opts = {}) {
    const href = opts.href || "http://active-tags.test/";

    const body = {
        nodeType: 1,
        tagName: "BODY",
        querySelectorAll() {
            return [];
        },
    };

    const document = {
        body,
        baseURI: href,
        querySelectorAll() {
            return [];
        },
        createElement(tag) {
            return {
                nodeType: 1,
                tagName: String(tag || "DIV").toUpperCase(),
                querySelectorAll() {
                    return [];
                },
            };
        },
    };

    const window = {
        document,
        location: { href },
    };

    return {
        root: window,
        window,
        document,
        baseURI: href,
    };
}

export default createFakeEnv;
