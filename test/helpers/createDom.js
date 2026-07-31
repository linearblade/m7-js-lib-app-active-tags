/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 *
 * Minimal Element/document polyfill for Node controller tests.
 *
 * lib.dom.is requires `instanceof Element`, so we install a global Element
 * base class and build a tiny tree that supports:
 * - data-activetag discovery
 * - getAttributeNames (DomConfigSource)
 * - querySelectorAll('[data-activetag]')
 *
 * Intentionally non-circular so Schema deep-copy of conf.env does not explode.
 */

let elementPolyfilled = false;

/**
 * Ensure globalThis.Element exists for lib.dom.is / isDom checks.
 */
export function ensureElementPolyfill() {
    if (elementPolyfilled && typeof globalThis.Element === "function") {
        return globalThis.Element;
    }

    if (typeof globalThis.Element !== "function") {
        globalThis.Element = class Element {
            constructor() {
                this.nodeType = 1;
            }
        };
    }

    elementPolyfilled = true;
    return globalThis.Element;
}

function makeClassList(el) {
    const syncAttr = () => {
        const text = [...el._classes].join(" ");
        if (text) el.attrs.class = text;
        else delete el.attrs.class;
        el.className = text;
    };

    return {
        add(...tokens) {
            for (const t of tokens) {
                const token = String(t || "").trim();
                if (token) el._classes.add(token);
            }
            syncAttr();
        },
        remove(...tokens) {
            for (const t of tokens) {
                el._classes.delete(String(t || "").trim());
            }
            syncAttr();
        },
        toggle(token, force) {
            const name = String(token || "").trim();
            if (!name) return false;
            if (force === true) {
                el._classes.add(name);
                syncAttr();
                return true;
            }
            if (force === false) {
                el._classes.delete(name);
                syncAttr();
                return false;
            }
            if (el._classes.has(name)) {
                el._classes.delete(name);
                syncAttr();
                return false;
            }
            el._classes.add(name);
            syncAttr();
            return true;
        },
        contains(token) {
            return el._classes.has(String(token || "").trim());
        },
        toString() {
            return [...el._classes].join(" ");
        },
    };
}

/**
 * Fake element compatible with ActiveTags discover, DomConfigSource, form.collect,
 * target/e builtins (classList, querySelector, closest, parentElement, value/name).
 */
export class FakeElement extends (ensureElementPolyfill()) {
    constructor(tag = "div") {
        super();
        this.tagName = String(tag || "div").toUpperCase();
        this.attrs = Object.create(null);
        this.dataset = Object.create(null);
        this.childNodes = [];
        this.children = [];
        this.parentNode = null;
        this.textContent = "";
        this.innerHTML = "";
        this.value = "";
        this.name = "";
        this.type = "";
        this.checked = false;
        this.disabled = false;
        this.className = "";
        this._classes = new Set();
        this.classList = makeClassList(this);
        this.id = "";
    }

    get parentElement() {
        return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
    }

    setAttribute(name, value) {
        const key = String(name);
        const str = String(value);
        this.attrs[key] = str;
        if (key === "class") {
            this._classes = new Set(str.split(/[,\s]+/).filter(Boolean));
            this.className = [...this._classes].join(" ");
        }
        if (key === "id") this.id = str;
        if (key === "name") this.name = str;
        if (key === "type") this.type = str;
        if (key === "value") this.value = str;
        if (key.startsWith("data-")) {
            const dataKey = key
                .slice(5)
                .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            this.dataset[dataKey] = str;
        }
    }

    getAttribute(name) {
        const key = String(name);
        if (key === "class") return this.className || null;
        if (key === "name" && this.name) return this.name;
        if (key === "type" && this.type) return this.type;
        if (key === "value" && this.value !== "" && this.value != null) return String(this.value);
        if (key === "id" && this.id) return this.id;
        return Object.prototype.hasOwnProperty.call(this.attrs, key)
            ? this.attrs[key]
            : null;
    }

    hasAttribute(name) {
        const key = String(name);
        if (key === "class") return this._classes.size > 0 || key in this.attrs;
        if (key === "name") return !!this.name || key in this.attrs;
        if (key === "value") return this.value !== "" || key in this.attrs;
        if (key === "id") return !!this.id || key in this.attrs;
        return Object.prototype.hasOwnProperty.call(this.attrs, key);
    }

    removeAttribute(name) {
        const key = String(name);
        delete this.attrs[key];
        if (key === "class") {
            this._classes.clear();
            this.className = "";
        }
        if (key === "id") this.id = "";
        if (key === "name") this.name = "";
        if (key === "type") this.type = "";
        if (key === "value") this.value = "";
        if (key.startsWith("data-")) {
            const dataKey = key
                .slice(5)
                .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            delete this.dataset[dataKey];
        }
    }

    getAttributeNames() {
        const names = new Set(Object.keys(this.attrs));
        if (this.className) names.add("class");
        if (this.id) names.add("id");
        if (this.name) names.add("name");
        if (this.type) names.add("type");
        if (this.value !== "" && this.value != null) names.add("value");
        return [...names];
    }

    appendChild(node) {
        if (!node) return node;
        this.childNodes.push(node);
        this.children.push(node);
        node.parentNode = this;
        return node;
    }

    removeChild(node) {
        this.childNodes = this.childNodes.filter((n) => n !== node);
        this.children = this.children.filter((n) => n !== node);
        if (node) node.parentNode = null;
        return node;
    }

    matches(selector) {
        const sel = String(selector || "").trim();
        if (!sel) return false;

        // Comma groups: any match
        if (sel.includes(",")) {
            return sel.split(",").some((part) => this.matches(part.trim()));
        }

        if (sel === "*") return true;
        if (sel === "[data-activetag]") return this.hasAttribute("data-activetag");
        if (sel.startsWith(".")) return this.classList.contains(sel.slice(1));
        if (sel.startsWith("#")) return this.id === sel.slice(1);
        if (sel.startsWith("[")) {
            const m = sel.match(/^\[([^=\]]+)(?:=["']?([^"'\]]*)["']?)?\]$/);
            if (!m) return false;
            const attr = m[1];
            if (m[2] === undefined) return this.hasAttribute(attr);
            return this.getAttribute(attr) === m[2];
        }

        // tag
        if (/^[a-zA-Z][\w-]*$/.test(sel)) {
            return this.tagName.toLowerCase() === sel.toLowerCase();
        }

        // tag.class or tag#id simple
        const tagClass = sel.match(/^([a-zA-Z][\w-]*)\.([\w-]+)$/);
        if (tagClass) {
            return (
                this.tagName.toLowerCase() === tagClass[1].toLowerCase() &&
                this.classList.contains(tagClass[2])
            );
        }
        const tagId = sel.match(/^([a-zA-Z][\w-]*)#([\w-]+)$/);
        if (tagId) {
            return (
                this.tagName.toLowerCase() === tagId[1].toLowerCase() &&
                this.id === tagId[2]
            );
        }

        return false;
    }

    querySelectorAll(selector) {
        const sel = String(selector || "").trim();
        const out = [];
        const walk = (node) => {
            for (const child of node.childNodes || []) {
                if (child.nodeType === 1 && child.matches?.(sel)) out.push(child);
                walk(child);
            }
        };
        // include self for form.querySelectorAll style from parent only over descendants
        walk(this);
        return out;
    }

    querySelector(selector) {
        const all = this.querySelectorAll(selector);
        return all[0] || null;
    }

    closest(selector) {
        let node = this;
        while (node) {
            if (typeof node.matches === "function" && node.matches(selector)) {
                return node;
            }
            node = node.parentNode;
        }
        return null;
    }
}

/**
 * Build a minimal <form> tree for form.collect tests.
 *
 * @param {object} document
 * @param {Object} [opts]
 * @param {string} [opts.action]
 * @param {string} [opts.method]
 * @param {Array<{name:string,value:string,type?:string,tag?:string}>} [opts.fields]
 * @returns {{ form: FakeElement, submitBtn: FakeElement, fields: FakeElement[] }}
 */
export function createFakeForm(document, opts = {}) {
    const form = document.createElement("form");
    form.setAttribute("action", opts.action || "http://example.test/submit");
    form.setAttribute("method", opts.method || "POST");
    // HTMLFormElement-like props used by some collectors
    form.action = opts.action || "http://example.test/submit";
    form.method = opts.method || "POST";

    const fields = [];
    const fieldDefs = opts.fields || [
        { name: "user", value: "ada", tag: "input", type: "text" },
        { name: "note", value: "hello", tag: "input", type: "text" },
    ];

    for (const def of fieldDefs) {
        const tag = def.tag || "input";
        const el = document.createElement(tag);
        el.name = def.name;
        el.value = def.value;
        el.type = def.type || "text";
        el.setAttribute("name", def.name);
        el.setAttribute("value", def.value);
        if (def.type) el.setAttribute("type", def.type);
        form.appendChild(el);
        fields.push(el);
    }

    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.name = "go";
    submitBtn.value = "Send";
    submitBtn.setAttribute("type", "submit");
    submitBtn.setAttribute("name", "go");
    submitBtn.setAttribute("value", "Send");
    form.appendChild(submitBtn);

    return { form, submitBtn, fields };
}

/**
 * Build a live env bag for ActiveTags conf.env.
 *
 * Returns the same document object tests should mutate (append elements to
 * `document.body`). Schema may deep-copy conf.env; querySelectorAll closes
 * over this document so discovery still sees live appends.
 *
 * @param {Object} [opts]
 * @param {string} [opts.href]
 * @returns {{ root: object, window: object, document: object, baseURI: string, body: FakeElement }}
 */
export function createDomEnv(opts = {}) {
    ensureElementPolyfill();
    const href = opts.href || "http://active-tags.test/";

    const body = new FakeElement("body");
    body.tagName = "BODY";

    const document = {
        body,
        baseURI: href,
        createElement(tag) {
            return new FakeElement(tag);
        },
        querySelectorAll(selector) {
            const sel = String(selector || "").trim();
            const out = [];
            const walk = (node) => {
                if (!node) return;
                if (node !== body && node.nodeType === 1 && node.matches?.(sel)) {
                    out.push(node);
                }
                for (const child of node.childNodes || []) walk(child);
            };
            walk(document.body);
            return out;
        },
        querySelector(selector) {
            return document.querySelectorAll(selector)[0] || null;
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
        body,
    };
}

/**
 * Create a data-activetag host element (optionally already named).
 *
 * @param {object} document
 * @param {Object} [attrs]
 * @returns {FakeElement}
 */
export function createActiveTagElement(document, attrs = {}) {
    const el = document.createElement("div");
    el.setAttribute("data-activetag", "");
    for (const [key, value] of Object.entries(attrs)) {
        if (value === undefined || value === null) continue;
        el.setAttribute(key, String(value));
    }
    return el;
}

/**
 * Recording event-delegator stub for EventController installation tests.
 *
 * Matches the minimal contract EventController expects:
 *   on({ eventType, selector, options, policy, tag, handler }) -> offFn
 */
export function createRecordingDelegator() {
    const handlers = [];

    function removeRec(rec) {
        const idx = handlers.indexOf(rec);
        if (idx >= 0) handlers.splice(idx, 1);
    }

    return {
        handlers,
        on(opts = {}) {
            const rec = {
                eventType: opts.eventType,
                selector: opts.selector,
                options: opts.options,
                policy: opts.policy,
                tag: opts.tag,
                handler: opts.handler,
            };
            handlers.push(rec);
            return function offFn() {
                removeRec(rec);
            };
        },
        /**
         * Tag-based teardown used by EventController._offOne.
         */
        offTag(tag) {
            const want = String(tag || "");
            for (let i = handlers.length - 1; i >= 0; i--) {
                if (String(handlers[i].tag || "") === want) {
                    handlers.splice(i, 1);
                }
            }
        },
        /**
         * Invoke installed handlers for an event type with `this` = element.
         */
        fire(eventType, element, event = {}) {
            const type = String(eventType || "").toLowerCase();
            const ev = {
                type,
                target: element,
                preventDefault() {},
                stopImmediatePropagation() {},
                ...event,
            };
            for (const rec of [...handlers]) {
                if (String(rec.eventType || "").toLowerCase() !== type) continue;
                if (typeof rec.handler === "function") {
                    rec.handler.call(element, ev);
                }
            }
        },
        clear() {
            handlers.length = 0;
        },
    };
}

/**
 * Recording interval-manager stub for IntervalController tests.
 *
 * Matches the contract IntervalController uses:
 *   register({ name, everyMs, maxRuns, overlapPolicy, errorPolicy, fn })
 *   start(name)
 *   cancel(name)
 *
 * Does not wall-clock tick; tests call `fire(name)` to invoke the stored fn.
 */
export function createRecordingIntervalManager() {
    /** @type {Map<string, object>} */
    const intervals = new Map();

    return {
        intervals,
        register(opts = {}) {
            const name = String(opts.name || "");
            if (!name) {
                throw new Error("[test] interval.register requires name");
            }
            intervals.set(name, {
                name,
                everyMs: opts.everyMs,
                maxRuns: opts.maxRuns,
                overlapPolicy: opts.overlapPolicy,
                errorPolicy: opts.errorPolicy,
                fn: opts.fn,
                started: false,
                cancelled: false,
                fireCount: 0,
            });
            return name;
        },
        start(name) {
            const rec = intervals.get(String(name));
            if (!rec) return 0;
            rec.started = true;
            rec.cancelled = false;
            return 1;
        },
        cancel(name) {
            const key = String(name);
            const rec = intervals.get(key);
            if (!rec) return 0;
            rec.started = false;
            rec.cancelled = true;
            intervals.delete(key);
            return 1;
        },
        pause() {},
        resume() {},
        dispose() {
            intervals.clear();
        },
        /**
         * Manually invoke the registered interval callback (no wall clock).
         */
        fire(name, ctx = {}) {
            const rec = intervals.get(String(name));
            if (!rec || typeof rec.fn !== "function") return false;
            rec.fireCount += 1;
            rec.fn(ctx);
            return true;
        },
        listNames() {
            return [...intervals.keys()];
        },
        listStarted() {
            return [...intervals.entries()]
                .filter(([, rec]) => rec.started)
                .map(([name]) => name);
        },
        get(name) {
            return intervals.get(String(name)) || null;
        },
    };
}

export default createDomEnv;
