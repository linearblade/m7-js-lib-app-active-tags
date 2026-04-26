/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

// expr/dispatch.js
// Build the parseTarget dispatch table for ExpressionResolver.parse(ctx, target)
//
// Contract:
//  - returns an object map: type -> () => TargetRef|value|Element|undefined
//  - each handler closes over ctx + resolver + loc
//  - no fallback / magic coercion happens here (caller decides)

export default function buildDispatch(resolver, ctx, loc) {
    const lib = resolver.lib;

    // normalize ctx (defensive)
    ctx = lib.hash.to(ctx) || {};

    const job    = resolver._asJob ? resolver._asJob(ctx.job) : ctx.job;
    const ticket = ctx.ticket || null;
    const ticketCTX = lib.hash.get(ctx,"ctx");
    // env (resolver already seeded these from m7-lib _env.root)
    const thisWindow   = lib.hash.get(ctx, "env.window")   || resolver.window;
    const thisDocument = lib.hash.get(ctx, "env.document") || resolver.document;

    // v1 runtime anchors
    const e      = lib.hash.get(job, "e");
    const tgt    = lib.hash.get(ticket, "target");
    const buffer = lib.hash.get(ticket, "buffer");

    // helpers
    const hasLoc = !(loc == null || loc === "");

    return {
        // ---------------------------------------------------------------------
        // Core sources
        // ---------------------------------------------------------------------
        job: () => {
            if (!job) return undefined;
            return hasLoc ? { src: job, prop: loc } : job;
        },

        ticket: () => {
            if (!ticket) return undefined;
            return hasLoc ? { src: ticket, prop: loc } : ticket;
        },

        config: () => {
            const schema = lib.hash.get(job, "config.schema");
            if (!schema) return undefined;
            return hasLoc ? { src: schema, prop: loc } : schema;
        },

        trans: () => {
            const tx = lib.hash.get(job, "transactions");
            if (!tx) return undefined;
            return hasLoc ? { src: tx, prop: loc } : tx;
        },

        ws: () => {
            const ws = lib.hash.get(job, "ws");
            if (!ws) return undefined;
            return { src: ws, prop: loc };
        },

        ctx: () => {
            if (!ticketCTX) return undefined;
            const v = ticketCTX;
            return hasLoc ? { src: v, prop: loc } : v;
        },

	
        // ---------------------------------------------------------------------
        // Buffer (v1)
        // ---------------------------------------------------------------------
        buffer: () => {
            if (!buffer) return undefined;
            const v = buffer.get();
            return hasLoc ? { src: v, prop: loc } : v;
        },

        buffer_meta: () => {
            if (!buffer) return undefined;
            const m = buffer.meta();
            return hasLoc ? { src: m, prop: loc } : m;
        },

        // ---------------------------------------------------------------------
        // Environment
        // ---------------------------------------------------------------------
        window: () => {
            if (!thisWindow) return undefined;
            return { src: thisWindow, prop: loc };
        },

        // ---------------------------------------------------------------------
        // DOM anchors
        // ---------------------------------------------------------------------
        this: () => {
            if (!e) return undefined;
            return { src: e, prop: loc };
        },

        target: () => {
            if (!tgt) return undefined;
            return { src: tgt, prop: loc };
        },

        // ---------------------------------------------------------------------
        // DOM navigation helpers (return DOM element)
        // ---------------------------------------------------------------------
        doc: () => {
            if (!thisDocument) return undefined;
            try {
                const found = thisDocument.querySelector(loc);
                if (!found) resolver.warn && resolver.warn(`couldnt find element with document.querySelector('${loc}')`, ctx);
                return found;
            } catch (err) {
                resolver.warn && resolver.warn(`error with document.querySelector('${loc}')`, ctx);
                return undefined;
            }
        },

        find: () => {
            const base = tgt || e;
            if (!base) return undefined;

            try {
                let result = base.querySelector(loc);
                if (!result && base.matches && base.matches(loc)) result = base;
                if (!result) resolver.warn && resolver.warn(`couldnt find element with e.querySelector('${loc}')`, ctx);
                return result;
            } catch (err) {
                resolver.warn && resolver.warn(`couldnt find element with querySelector('${loc}')`, ctx);
                return undefined;
            }
        },

        closest: () => {
            const base = tgt || e;
            if (!base) return undefined;

            try {
                return base.closest(loc);
            } catch (err) {
                resolver.warn && resolver.warn(`couldnt find element with closest('${loc}')`, ctx);
                return undefined;
            }
        },

        // ---------------------------------------------------------------------
        // Form value lookup (legacy helper, but wired to v1 collect)
        // ---------------------------------------------------------------------
        form: () => {
            const base = tgt || e;
            if (!base) return undefined;

            const collect = lib.hash.get(lib, "dom.form.collect");
            if (!collect) return undefined;

            const out = collect(base);
            const parms = out && out.parms;
            if (!parms) return undefined;

            for (let row of parms) {
                if (row[0] == loc) return row[1];
            }
            return undefined;
        },

        // ---------------------------------------------------------------------
        // Legacy inline (keep only if you still depend on it)
        // ---------------------------------------------------------------------
        inline: () => {
            if (!e) return undefined;
            return { src: e, prop: "innerHTML", special: loc };
        },
    };
}
