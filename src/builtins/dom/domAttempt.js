/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

import helpers from "../../class/engine/helpers.js";

/**
 * `dom.attempt` builtin.
 *
 * Thin wrapper around `lib.dom.attempt(source, true)`.
 * Uses parsed args (`target`, `barf`) shape for forward compatibility, but
 * always enforces strict attempt behavior and writes to `ticket.target`.
 *
 * @param {Object} params
 * @param {Object} params.lib
 * @param {*} [params.args]
 * @param {Object} [params.ticket]
 * @param {*} [params.target]
 * @param {*} [params.step]
 * @returns {Promise<Object>} StageResult-like (`ok` | `error`).
 */
export default async function domAttempt({ lib, args, ticket, target, step } = {}) {
    try {
        const parsed = lib.args.parse(args, {}, { parms: "target barf", pop: true }) || {};
        const source = parsed.target;
        const node = lib.dom.attempt(source, true);
        ticket.target = node;

        return helpers.SR_ok({
            op: "dom.attempt",
            step,
            resolved: node,
        });
    } catch (err) {
        return helpers.SR_error(err, { op: "dom.attempt", step });
    }
}
