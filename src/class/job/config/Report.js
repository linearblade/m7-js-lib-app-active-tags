/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

// class/schema/Report.js

/**
 * Report
 * ------
 * Structured compilation/normalization diagnostics for the ActiveTags schema compiler.
 *
 * Design intent:
 * - Small, explicit diagnostic object with a stable contract.
 * - Keeps Master/SchemeService clean: no "report is a random hash" leaking everywhere.
 * - Designed to be deep-copy/exportable and safe to attach to jobs.
 *
 * Contract:
 * - `errors` and `warnings` are append-only arrays of entries.
 * - `ok` is derived by default (errors.length === 0), but can be materialized via finalize().
 * - Never throws for consumer data issues; only for programmer misuse (missing lib).
 *
 * Entry shape:
 * { code: string, path: string, message: string, meta?: object }
 *
 * LLM integration notes:
 * - This class exists to stop the drift of ad-hoc report hashes.
 * - Keep the entry format stable (code/path/message/meta) so tools can parse it.
 * - Prefer coercion at the edges; Report should accept garbage-ish path/message and normalize.
 */

export default class Report {
    /**
     * @param {Object} args
     * @param {Object} args.lib - m7 lib instance
     */
    constructor({ lib }) {
        if (!lib) throw new Error("Report: missing lib");
        this.lib = lib;

        this.errors = [];
        this.warnings = [];

        // Optional materialized ok flag; if unset, ok() computes from errors.
        this._ok = null;
    }

    /**
     * Add an error entry.
     *
     * @param {string} code
     * @param {string} path
     * @param {string} message
     * @param {Object} [meta]
     * @returns {Report} this
     */
    error(code, path, message, meta) {
        this.errors.push(this._entry(code, path, message, meta));
        this._ok = null; // invalidate materialized ok
        return this;
    }

    /**
     * Add a warning entry.
     *
     * @param {string} code
     * @param {string} path
     * @param {string} message
     * @param {Object} [meta]
     * @returns {Report} this
     */
    warn(code, path, message, meta) {
        this.warnings.push(this._entry(code, path, message, meta));
        return this;
    }

    /**
     * True if there are no errors.
     * If finalize() has been called, returns the materialized value.
     *
     * @returns {boolean}
     */
    ok() {
        if (this._ok !== null) return this._ok;
        return this.errors.length === 0;
    }

    /**
     * Materialize ok flag and return it.
     * Useful if you want report.ok as a plain boolean snapshot.
     *
     * @returns {boolean}
     */
    finalize() {
        this._ok = (this.errors.length === 0);
        return this._ok;
    }

    /**
     * Merge another report into this one (append).
     *
     * Notes:
     * - Does not deep-copy entries by default; caller can export() if isolation is needed.
     *
     * @param {Report|Object} other
     * @returns {Report} this
     */
    merge(other) {
        const lib = this.lib;
        if (!other) return this;

        // Accept either a Report instance or a plain hash with errors/warnings.
        const o = (other instanceof Report) ? other : lib.hash.to(other);

        const errs = (o instanceof Report) ? o.errors : (lib.array.is(o.errors) ? o.errors : []);
        const warns = (o instanceof Report) ? o.warnings : (lib.array.is(o.warnings) ? o.warnings : []);

        for (let i = 0; i < errs.length; i++) this.errors.push(errs[i]);
        for (let i = 0; i < warns.length; i++) this.warnings.push(warns[i]);

        this._ok = null;
        return this;
    }

    /**
     * Export a plain JSON-safe report object.
     * Consumers can safely mutate the returned object.
     *
     * @returns {{ok:boolean, errors:Array, warnings:Array}}
     */
    export() {
        const lib = this.lib;

        // snapshot ok at export-time
        const out = {
            ok: this.ok(),
            errors: this.errors,
            warnings: this.warnings
        };

        return lib.utils.deepCopy(out);
    }
    static emptyExportShape(){
	return {
            ok       : null,
            errors   : [],
            warnings : []
	}
    }
    /**
     * Internal: normalize an entry into the stable shape.
     */
    _entry(code, path, message, meta) {
        const lib = this.lib;

        // Keep coercion simple and lib-native; don't over-validate.
        code = lib.str.to(code, true);
        path = lib.str.to(path, true);
        message = lib.str.to(message, true);

        const e = { code, path, message };

        if (lib.hash.is(meta)) e.meta = meta;
        return e;
    }
}
