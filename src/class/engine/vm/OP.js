/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * OP (Operation Normalizer)
 * ==========================
 * Formalizes and normalizes raw stage return values into canonical StageResult objects.
 *
 * Role
 * ----
 * - Converts arbitrary user function return values into explicit
 *   helpers.SR_* StageResults.
 * - Eliminates implicit continuation semantics.
 * - Enforces explicit control flow signaling for OK / WAIT / ERROR / COMPLETE.
 *
 * Architectural Position
 * ----------------------
 * Engine
 *   → Tick (lifecycle + scheduling)
 *       → VM (single-stage execution)
 *           → OP (return normalization only)
 *
 * OP does NOT:
 * - Execute stage functions
 * - Mutate tickets
 * - Manage phase transitions
 * - Emit hooks
 * - Perform scheduling
 *
 * Design Philosophy
 * -----------------
 * - Control flow must be explicit.
 * - Truthy values do NOT imply continuation.
 * - Legacy behavior is recognized but coerced into explicit helpers.SR_* results.
 * - All outcomes are reduced to helpers.STAGE_STATUS.*.
 *
 * Normalization Rules (v1)
 * ------------------------
 * Scalar values:
 *   - If lib.bool.yes(value) → helpers.SR_ok (continue)
 *   - Otherwise              → helpers.SR_error
 *
 * Object values:
 *   - If `status` is an intentional bool (lib.bool.isIntent) →
 *       coerced to helpers.STAGE_STATUS.OK or ERROR
 *   - If `status` is already in helpers.STAGE_STATUS_RANGE →
 *       passed through (cloned)
 *   - If `{ wait: true }` →
 *       coerced to helpers.SR_wait (legacy compatibility)
 *
 * All other values:
 *   → helpers.SR_error
 *
 * Guarantees
 * ----------
 * - Always returns a StageResult-like object.
 * - Never throws.
 * - Never mutates ticket or engine state.
 * - Preserves `pipelineKey` and `op` metadata when provided.
 *
 * Notes
 * -----
 * - This module is intentionally coercive and opinionated.
 */

import helpers from '../helpers.js';

export class OP {
    constructor({lib}) {
	this.lib = lib;
    }

    /**
     * Produce a stable, human-readable label for an operation.
     *
     * Used for logging, tracing, and hook metadata.
     * Returns a best-effort string representation based on:
     *   - string ops → returned directly
     *   - function ops → function name or "(anonymous fn)"
     *   - object ops → constructor name or "(object op)"
     *   - null / other types → descriptive fallback
     *
     * Does not mutate input.
     *
     * @param {*} op
     *   Operation identifier (string | function | object | null).
     *
     * @returns {string}
     *   Safe label suitable for logs and diagnostics.
     */
    _opLabel(op) {
	// Prefer stable human-readable labels for logs/hooks.
	if (typeof op === "string") return op;

	if (typeof op === "function") {
            return op.name && op.name.length ? op.name : "(anonymous fn)";
	}

	if (op && typeof op === "object") {
            // Constructor name if meaningful
            const ctor = op.constructor && op.constructor.name;
            if (ctor && ctor !== "Object") return ctor;
            // Fallback
            return "(object op)";
	}

	if (op === null) return "(null op)";
	return `(${typeof op} op)`;
    }

    /**
     * Normalize a raw stage return value into a canonical StageResult.
     *
     * This method enforces explicit control-flow signaling by coercing
     * arbitrary return values into helpers.SR_* objects.
     *
     * Normalization rules
     * -------------------
     * 1) Scalar values:
     *    - If `lib.bool.yes(value)` → helpers.SR_ok
     *    - Otherwise                → helpers.SR_error
     *
     * 2) Object values:
     *    - If `status` is a bool-intent (`lib.bool.isIntent`) →
     *        coerced to:
     *          helpers.STAGE_STATUS.OK
     *          helpers.STAGE_STATUS.ERROR
     *
     *    - If `status` is already in helpers.STAGE_STATUS_RANGE →
     *        returned as a shallow clone.
     *
     *    - If `{ wait: true }` →
     *        coerced to helpers.SR_wait (legacy compatibility).
     *
     * 3) All other values:
     *    → helpers.SR_error
     *
     * Guarantees
     * ----------
     * - Always returns a StageResult-like object.
     * - Never throws.
     * - Does not mutate ticket or engine state.
     * - Preserves `pipelineKey` and `op` metadata when provided.
     *
     * @param {*} res
     *   Raw value returned by a stage function.
     *
     * @param {Object} [opts]
     * @param {string} [opts.pipelineKey]
     *   Pipeline identifier for diagnostics.
     * @param {*} [opts.op]
     *   Operation identifier for diagnostics.
     *
     * @returns {Object}
     *   A StageResult object produced via helpers.SR_ok / SR_wait / SR_error.
     */    
    _normalizeReturn(res, { pipelineKey, op } = {}) {
	if (this.lib.utils.isScalar(res)) {

	    // Explicit continue
	    if (this.lib.bool.yes(res)) {
		return helpers.SR_ok({ pipelineKey, op, legacy: true, value: res });
	    }

	    // Scalar but not recognized as continue => error
	    return helpers.SR_error(
		new Error("Stage returned falsy or unrecognized scalar"),
		{ pipelineKey, op, legacy: true, value: res }
	    );
	}
	
	//console.log('normaled resp', res);
	//base type will differentiate null, array, (object, hash) => object
	if(this.lib.utils.baseType(res,'object')) {
	    // Already a StageResult ... return new object in order to minimize fuckery in user func.
	    const status = res.status;
	    // Coerce boolish legacy status FIRST 
	    if (this.lib.bool.isIntent(status)) {
		const coerced = this.lib.bool.yes(status)
		      ? helpers.STAGE_STATUS.OK
		      : helpers.STAGE_STATUS.ERROR;
		return { ...res, status: coerced };
	    }
	    
	    // Accept canonical StageResult statuses 
	    if (helpers.STAGE_STATUS_RANGE.includes(status)) 
		return {...res};

	    
	    //console.log('invalid status... ', res.status);
	    // Explicit legacy wait
	    if (res.wait === true) {
		return helpers.SR_wait({
		    pipelineKey,
		    op,
		    legacy: true,
		    value: res.value ?? null,
		    await: res.await ?? null,
		});
	    }
	}

        return helpers.SR_error(
	    new Error("Stage returned value with no recognized continuation semantics"),
	    { pipelineKey, op, legacy: true, value:res }
        );
    }
    

}

export default OP;
