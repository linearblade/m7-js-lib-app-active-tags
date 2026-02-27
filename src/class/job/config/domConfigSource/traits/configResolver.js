/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

import { ARR_TO_OPTS,  MERGE_OPTS_V1 } from '../../../../../constants.js';

const trait_configResolver = {

    /**
     * Resolve config references into a single merged configuration object.
     *
     * CONTRACT
     * --------
     * _resolveConfig() resolves a list of configuration reference strings into
     * concrete configuration objects and merges them into a single snapshot.
     *
     * Resolution is performed sequentially and is order-sensitive.
     * Later references override earlier references on merge conflicts.
     *
     * This method may perform asynchronous resolution (imports, async loaders).
     * It does not compile schema.
     * It does not mutate Job or runtime state.
     *
     *
     * INPUT
     * -----
     * @param {Object} args
     *
     * @param {Report} args.report
     *   Diagnostics sink used to record resolution failures.
     *
     * @param {*} [args.list]
     *   List of configuration reference strings.
     *   Coerced to an array via lib.array.to(list, ARR_TO_OPTS).
     *
     * @param {Element} [args.source]
     *   DOM element used as interpolation or resolution context.
     *   Passed through to target resolution routines.
     *
     *
     * RESOLUTION POLICY
     * -----------------
     * - If list is empty or falsy, returns an empty object.
     * - Each non-empty ref is resolved via _resolveConfigTarget({ report, ref, source }).
     * - If a ref resolves to a non-object value:
     *     A diagnostic error is recorded to report.
     *     In strict mode, _error() may throw.
     *     In non-strict mode, the ref is skipped and resolution continues.
     *
     *
     * MERGE POLICY
     * ------------
     * Resolved objects are merged left-to-right:
     *   merged = merge(merged, resolvedRef, MERGE_OPTS_V1)
     *
     * Later refs override earlier refs.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Promise<Object>}
     *   Merged configuration object.
     *   Returns {} when no references are provided or none resolve successfully.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate schema correctness.
     * Does not apply final precedence layering beyond ordered ref merge.
     * Does not interpret reference semantics beyond target resolution.
     */
    async _resolveConfig({ report, list, source } = {}) {
	const lib = this.lib;

	// 1) Nothing to resolve
	if (!lib.array.len(list)) return {};

	list = lib.array.to(list, ARR_TO_OPTS);

	let merged = {};

	for (let i = 0; i < list.length; i++) {
            const ref = lib.str.to(list[i], true).trim();
            if (!ref) continue;

            const conf = await this._resolveConfigTarget({ report, ref, source });
            if (!lib.hash.is(conf)) {
		this._error(
                    report,
                    "configure",
                    "CONFIG_RESOLVE_FAILED",
                    `Config reference '${ref}' did not resolve to an object(hash)`,
                    { ref }
		);
		continue;
            }

            merged = lib.hash.merge(merged, conf, MERGE_OPTS_V1);
	}

	return merged;
    },
};

export default trait_configResolver;
