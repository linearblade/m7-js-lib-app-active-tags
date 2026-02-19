/**
 * Trait: resolveConfigTarget
 *
 * Adds:
 *  - async _resolveConfigTarget({report, ref, source})
 *  - async resolveConfigTarget({report, ref, source})   (optional public-ish helper)
 *  - helper methods used internally
 *
 * Behavior:
 * - Must remain identical to the legacy _resolveConfigTarget flow.
 * - Strict-mode throwing remains controlled by this._error().
 */

/**
 * Resolve a single config reference into a configuration object.
 *
 * CONTRACT
 * --------
 * _resolveConfigTarget() resolves one config reference string into a plain
 * object suitable for merging into configuration.
 *
 * The reference may resolve to:
 *   - A plain object value
 *   - A DOM node containing an inline payload
 *   - A DOM node pointing to an external payload via data-src or src
 *   - An imported module reference (when enabled)
 *
 * If resolution fails, a diagnostic is recorded and {} is returned in
 * non-strict mode.
 * In strict mode, _error() may throw and the return path is not guaranteed.
 *
 *
 * INPUT
 * -----
 * @param {Object} args
 *
 * @param {Report} args.report
 *   Diagnostics sink for resolution failures.
 *
 * @param {string} args.ref
 *   Config reference string.
 *   May be a target expression or an import reference.
 *
 * @param {Element} args.source
 *   DOM element used as resolution context for expression evaluation and
 *   interpolation.
 *
 *
 * RESOLUTION FLOW
 * ---------------
 * 1. Normalize and validate ref.
 *    Empty refs produce an error and return {}.
 *
 * 2. Determine resolution strategy.
 *    - If the ref matches an import form, resolution is routed through
 *      _importConfig() subject to import policy.
 *    - Otherwise ref is evaluated through ExpressionResolver.
 *
 * 3. Reduce expression results.
 *    If the result is an { src, prop } pair, reads src[prop].
 *
 * 4. DOM payload handling.
 *    If the resolved value is a DOM element:
 *      - Prefer inline payload from textContent or innerText.
 *      - If inline payload is empty, optionally fetch external payload from
 *        data-src or src.
 *      - Parse the payload via _resolveDomConfigNode(), which applies the
 *        configured security policy (JSON, optional eval, etc).
 *
 * 5. Type enforcement.
 *    The final resolved value must be an object hash.
 *    Non-object values produce an error and return {}.
 *
 *
 * SECURITY AND POLICY
 * -------------------
 * - Import resolution is opt-in and constrained by allowImportConfig and
 *   allowImportPath policy.
 * - Script evaluation of DOM payloads is opt-in and constrained by
 *   allowEvalConfig and allowEvalTypes policy.
 * - Disallowed resource schemes and unsafe locations must be rejected by
 *   _maybeImport() and _resolveDomConfigNode().
 *
 *
 * RETURN VALUE
 * ------------
 * @returns {Promise<Object>}
 *   Resolved configuration object.
 *   Returns {} on failure in non-strict mode.
 *
 *
 * ERROR HANDLING
 * --------------
 * Records report errors for:
 *   - empty refs
 *   - import failures
 *   - expression evaluation failures
 *   - DOM payload empty or parse failures
 *   - resolved value not being an object
 *
 *
 * NON-RESPONSIBILITIES
 * --------------------
 * Does not compile schema.
 * Does not merge multiple refs.
 * Does not execute runtime behavior.
 *
 */


const trait_configTargetResolver = {


    
    /**
     * Entry point expected by DomConfigSource callers.
     * Keeps the original method name.
     */

    async _resolveConfigTarget(ctx) {
        // allow future internal renames without changing call sites
        return this.resolveConfigTarget(ctx);
    },

    /**
     * Orchestration wrapper for DomConfigSource::_resolveConfigTarget
     *
     * IMPORTANT:
     * - Must preserve legacy behavior exactly.
     * - Report codes/messages must remain stable.
     * - Strict-mode throwing must remain controlled by this._error().
     */
    async resolveConfigTarget({ report, ref, source } = {}) {
        const lib = this.lib;

        ref = this._normalizeConfigRef(report, ref);
        if (!ref) return {}; // behavior: CONFIG_REF_EMPTY already recorded

        // Parse the target expression / import
        let info;
        let imp = null;

        try {
            // NOTE: _maybeImport must return null for non-import refs.
            // It may throw structured errors for import refs blocked by policy.
            imp = this._maybeImport(ref);

            if (imp) {
                info = await this._importConfig(imp);
            } else {
                info = this.expr.eval({ job: this.job }, ref);
            }
        } catch (err) {
            if (imp) {
                // import path failed OR policy threw after recognizing import syntax
                this._error(
                    report,
                    "configure",
                    "CONFIG_IMPORT_FAILED",
                    `Failed to import config reference '${ref}'`,
                    { error: err, ref, imp }
                );
            } else {
                // expression / local reference failed OR policy threw before imp assigned
                this._error(
                    report,
                    "configure",
                    "CONFIG_PARSE_TARGET_FAILED",
                    `Failed to parse config reference '${ref}'`,
                    { error: err, ref }
                );
            }
            return {};
        }

        // Evaluate into a value (preserve the odd legacy reduction rules)
        let val = this._reduceTargetInfoToValue(info);

        // DOM source => parse JSON from text
        if (lib.dom.is(val)) {
            const text = await this._readDomPayloadText(val);

            if (!text.trim()) {
                this._error(
                    report,
                    "configure",
                    "CONFIG_DOM_EMPTY",
                    `Config DOM source for '${ref}' had no text`,
                    { ref }
                );
                return {};
            }

            try {
                // $FIXUP kept intact
                val = this._resolveDomConfigNode(val, text, { source, ref });
            } catch (err) {
                const msg = (err && err.message) ? String(err.message) : "Config parse failed";

                this._error(
                    report,
                    "configure",
                    "CONFIG_PAYLOAD_PARSE_FAILED",
                    `Config payload failed for '${ref}': ${msg}`,
                    { error: err, ref, type: val?.type, tagName: val?.tagName }
                );
                return {};
            }
        }

        // Must resolve to an object/hash
        if (!lib.hash.is(val)) {
            this._error(
                report,
                "configure",
                "CONFIG_NOT_OBJECT",
                `Config reference '${ref}' did not resolve to an object(hash)`,
                { ref }
            );
            return {};
        }

        return val;
    },

    /**
     * Normalize and validate the config reference.
     * Preserves:
     * - trim semantics
     * - empty ref error code/message
     * - {} return behavior
     */
    _normalizeConfigRef(report, ref) {
        const lib = this.lib;
        ref = lib.str.to(ref, true).trim();

        if (!ref) {
            this._error(report, "configure", "CONFIG_REF_EMPTY", "Empty config reference");
            return "";
        }
        return ref;
    },

    /**
     * Preserve the legacy "info -> val" reduction logic EXACTLY.
     */
    _reduceTargetInfoToValue(info) {
        const lib = this.lib;

        let val = info;

        if (!(lib.utils.isScalar(info) || lib.dom.is(info))) {
            if (lib.hash.is(info) && info.src && info.prop) {
                val = lib.hash.get(info.src, info.prop);
            } else {
                val = info;
            }
        }

        return val;
    },

    /**
     * Resolve DOM payload text:
     * - Prefer inline textContent/innerText
     * - If inline empty: try data-src or src fetch
     * - Preserve empty string behavior
     *
     * NOTE: Preserves original fetch behavior (no try/catch wrap).
     */
    async _readDomPayloadText(node) {
        const lib = this.lib;

        // Prefer inline JSON if present
        const inline =
              lib.str.to(node.textContent, true).trim() ||
              lib.str.to(node.innerText, true).trim();

        if (!lib.utils.isEmpty(inline)) return inline;

        // If inline is empty, try external source
        const src = node.getAttribute("data-src") || node.src;
        if (!src) return "";

        return await fetch(src).then(r => r.text());
    },

        /**
     * Parse a DOM config payload into a configuration object.
     *
     * CONTRACT
     * --------
     * _resolveDomConfigNode() converts text content sourced from a DOM node
     * into a plain object configuration value.
     *
     * JSON parsing is the default behavior.
     * Script evaluation is supported only when explicitly enabled and only
     * for trusted SCRIPT nodes with an allowed type.
     *
     *
     * INPUT
     * -----
     * @param {Element} val
     *   DOM node that provided the payload text.
     *   Used to gate evaluation behavior (SCRIPT-only).
     *
     * @param {string} text
     *   Payload text to parse or evaluate.
     *
     * @param {Object} [ctx]
     *   Optional context object used for evaluation scope.
     *   May include:
     *     source  originating element used for resolution
     *     ref     config reference string being resolved
     *
     *
     * BEHAVIOR
     * --------
     * Default path
     *   Parses text as JSON using lib.json.parse when available, otherwise JSON.parse.
     *
     * Eval gating
     *   Evaluation is permitted only when all of the following are true:
     *     this.allowEvalConfig is true
     *     this.allowEvalTypes is provided
     *     val.tagName is SCRIPT
     *     val.type is an exact match for an allowed type
     *
     * If any gate fails, the JSON parse path is used.
     *
     * Eval path
     *   When permitted, evaluates the payload via Function constructor using
     *   a strict-mode wrapper and returns the evaluated result.
     *
     *   The evaluated payload must return an object.
     *   Non-object results throw an error.
     *
     *
     * EVALUATION SCOPE
     * ----------------
     * The eval path provides a single scope object containing:
     *   lib, job, source, ref
     *
     * The payload is evaluated with access to this scope object only.
     *
     *
     * SECURITY NOTES
     * --------------
     * - The eval path requires CSP support for unsafe-eval.
     * - Evaluation is opt-in and must remain gated by explicit config flags.
     * - This method does not attempt to sanitize or sandbox arbitrary code.
     *   It is intended for trusted pages only.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   Parsed or evaluated configuration object.
     *
     *
     * FAILURE MODES
     * -------------
     * Throws on JSON parse failure.
     * Throws on eval execution failure.
     * Throws if eval returns a non-object.
     */
    _resolveDomConfigNode(val, text, ctx = {}) {
	const lib = this.lib;
	//console.warn(val,text,ctx);
	// Default: JSON only
	const parseJSON = () => lib.json
              ? lib.json.parse(text)
              : JSON.parse(text);

	// Eval disabled → JSON only
	if (!this.allowEvalConfig || !this.allowEvalTypes) {
            return parseJSON();
	}

	// SCRIPT-only eval
	if (!val || String(val.tagName).toUpperCase() !== "SCRIPT") {
            return parseJSON();
	}

	// Exact type match (no substring hacks)
	const allowedTypes =
              lib.array.len(this.allowEvalTypes) 
              ? this.allowEvalTypes
              : [DEFAULT_EVAL_TYPE];

	const type = lib.str.to(val.type ,true).trim();
	if (!allowedTypes.includes(type)) {
            return parseJSON();
	}

	// ---- EVAL PATH (explicit, gated, scoped) ----
	// NOTE: requires CSP 'unsafe-eval'
	const scope = {
            lib,
            job: this.job,
            source: ctx.source,
            ref: ctx.ref,
	};

	const fn = new Function(
            "scope",
            `"use strict"; return (${text});`
	);

	const out = fn(scope);

	if (!out || typeof out !== "object") {
            throw new Error("Eval config source must return an object");
	}

	return out;
    }

};

export default trait_configTargetResolver;
export { trait_configTargetResolver};
