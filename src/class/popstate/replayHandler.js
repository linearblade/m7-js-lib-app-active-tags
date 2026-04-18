/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * Create the ActiveTags popstate replay handler.
 *
 * The handler is intentionally thin.
 * It only forwards browser popstate dispatch into the PopStateController,
 * which owns replay resolution and enqueue behavior.
 *
 * @param {Object} [opts]
 * @param {Object} opts.controller
 * @returns {Function}
 */
export function createReplayHandler({ controller } = {}) {
    return function replayHandler(event, currentURL, ctx) {
	if (!controller || typeof controller.handleReplayEvent !== "function") {
	    return null;
	}

	return controller.handleReplayEvent(event, currentURL, ctx);
    };
}

export default createReplayHandler;
