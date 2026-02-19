import { ARR_TO_OPTS,  MERGE_OPTS_V1 } from '../../../../../constants.js';

const trait_tagParser = {

    /**
     * Read and inflate prefixed attributes from a DOM element.
     *
     * CONTRACT
     * --------
     * _readDataset() extracts attributes whose names begin with configured
     * prefix strings and produces a nested, JSON-safe object.
     *
     * This method reads DOM attributes, not element.dataset.
     * It is commonly used for data-* style inputs, but the prefixes are
     * fully configurable.
     *
     *
     * PREFIX SEMANTICS
     * ----------------
     * - Iterates over conf.config.attrPrefixes in declared order.
     * - For each prefix:
     *     Selects attributes whose names start with the prefix.
     *     Strips the prefix from the attribute key.
     *     Inflates dashed keys into nested objects using "-" as delimiter.
     * - Results are merged in prefix order.
     *   Later prefixes override earlier prefixes on conflict.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     * @param {Report} [args.report]
     *   Optional diagnostics sink.
     *   Currently reserved for future warnings and is not required.
     *
     * @param {Element} args.source
     *   DOM element to read attributes from.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   Nested object produced from prefixed attributes.
     *   Always returns a plain object.
     *
     *
     * SIDE EFFECTS
     * ------------
     * None.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not resolve config targets.
     * Does not validate schema correctness.
     * Does not interpret or coerce values beyond key normalization.
     */
    _readDataset({ report, source } = {}) {
	const lib = this.lib;

	const prefixes = lib.array.to(
            this.conf.config.attrPrefixes,
            ARR_TO_OPTS
	).filter(v => typeof v === "string");

	let out = {};

	for (let i = 0; i < prefixes.length; i++) {
            const prefix = prefixes[i];
            if (!prefix) continue;
            const re = new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
            const raw = lib.dom.filterAttributes(source, re, prefix.length) || {};

            const inflated = lib.hash.inflate(raw, { delim: "-" });
            const normalized = lib.hash.to(inflated);

            // merge in declared order (later prefixes override earlier ones)
            out = lib.hash.merge(out, normalized, MERGE_OPTS_V1);
	}

	return out;
    },
    
    
    /**
     * Capture selected element fields as runtime attributes.
     *
     * CONTRACT
     * --------
     * _readAttrs() captures a lightweight snapshot of selected fields from a
     * DOM element. These values are treated as runtime inputs and are not
     * merged into configuration output.
     *
     * Captured values may be re-read at runtime by other subsystems.
     * This method provides an initial snapshot for convenience and diagnostics.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     * @param {Report} [args.report]
     *   Optional diagnostics sink.
     *   Currently reserved for future warnings and is not required.
     *
     * @param {Element} args.source
     *   DOM element to read from.
     *
     * @param {string|Array<string>} [args.list=this.conf.config.capture_attrs]
     *   Field list describing which properties or attributes to capture.
     *   Each entry is passed to lib.dom.get(source, key).
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   Plain object mapping each requested key to its captured value.
     *
     *
     * SIDE EFFECTS
     * ------------
     * None.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not perform schema compilation.
     * Does not resolve config bindings.
     * Does not apply merge precedence.
     */
    _readAttrs({ report, source, list = this.conf.config.capture_attrs } = {}) {
	const lib = this.lib;

	list = lib.array.to(list, ARR_TO_OPTS);

	const out = {};
	for (const item of list) {
            out[item] = lib.dom.get(source, item);
	}

	return out;
    },
    
    /**
     * Extract configuration binding references from an inflated dataset object.
     *
     * CONTRACT
     * --------
     * _getConfigAt() reads one or more dataset keys and returns a flat list of
     * configuration reference strings.
     *
     * It always returns an array.
     * It does not resolve references.
     * It does not validate references.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     *
     * @param {*} [args.ds]
     *   Dataset-like object to read from.
     *   Coerced to an object via lib.hash.to().
     *
     * @param {*} [args.list]
     *   One or more dataset keys used to locate config references.
     *   Coerced to an array via lib.array.to(list, ARR_TO_OPTS).
     *
     *
     * BEHAVIOR
     * --------
     * - Iterates list in declared order.
     * - For each key:
     *     Reads ds[key]
     *     Coerces to string and trims
     *     Splits into tokens using lib.array.to(value, ARR_TO_OPTS)
     *     Appends all tokens to the result array
     *
     * Empty, missing, or non-string-coercible values are ignored.
     *
     * Ordering is preserved:
     *   list order determines lookup order
     *   split order is preserved within each value
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Array<string>}
     *   Flat array of extracted reference strings.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not apply priority or first-hit semantics.
     * Does not verify that extracted references exist.
     * Resolution occurs in _resolveConfig().
     */
    _getConfigAt({ ds, list } = {}) {
	const lib = this.lib;
	ds = lib.hash.to(ds);

	let at = [];
	list = lib.array.to(list, ARR_TO_OPTS);

	for (const loc of list) {
            const s = lib.str.to(lib.hash.get(ds, loc, ''), true).trim();
            if (!s) continue;
	    
            const items = lib.array.to(s, ARR_TO_OPTS);
            if (items.length) at.push(...items);
	}

	return at;
    }


};

export default trait_tagParser;
