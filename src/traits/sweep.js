import CONSTANTS from '../constants.js';
export const trait_sweep = {

    /**
     * Discover candidate DOM elements for Active Tags jobs.
     *
     * `bootSweep` is a **pure discovery utility**. It inspects the DOM based on the
     * provided input and returns a de-duplicated list of DOM elements that *may*
     * be eligible to become Jobs.
     *
     * This method:
     * - Accepts selectors and/or DOM elements
     * - Normalizes all inputs into a flat list
     * - De-duplicates results
     * - Does NOT create Jobs
     * - Does NOT mutate runtime state
     * - Does NOT schedule or execute anything
     *
     * It is intentionally "dumb" and side-effect free so it can be safely reused by:
     * - `load()` (initial scan)
     * - MutationObserver handlers (subtree discovery)
     * - Manual or programmatic re-scans
     *
     * Accepted inputs:
     * - `null` / `undefined` → uses `ActiveTags.DEFAULT_SELECTOR`
     * - CSS selector string
     * - DOM Element
     * - Array / array-like of selectors and/or DOM elements
     *
     * @param {string|Element|Array<string|Element>|null} [sel=null]
     *        Selector(s) or DOM element(s) used to discover candidate nodes.
     *
     * @returns {Element[]}
     *          De-duplicated array of DOM elements discovered by the sweep.
     *          Returns an empty array if no candidates are found.
     *
     * @notes
     * - Returned elements are *candidates only*; eligibility and job creation
     *   are handled by `registerJobs()`.
     * - This method is safe to call repeatedly and on arbitrary subtrees.
     */
    
    sweep(sel = null) {
	const input = sel ?? CONSTANTS.DEFAULT_SELECTOR;

	const targets = lib.dom.is(input)
	      ? [input]
	      : lib.array.to(input);

	const out = [];
	const seen = new Set();

	const push = (node) => {
	    if (!node || !lib.dom.is(node) || seen.has(node)) return;
	    seen.add(node);
	    out.push(node);
	};

	for (const t of targets) {
	    // direct DOM element
	    if (lib.dom.is(t)) {
		push(t);
		continue;
	    }

	    // treat as selector
	    const selector = String(t ?? '').trim();
	    if (!selector) continue;

	    const nodes = document.querySelectorAll(selector);
	    for (const n of nodes) push(n);
	}

	if (out.length === 0) return [];
	return out;
    },

};

export default trait_sweep;
