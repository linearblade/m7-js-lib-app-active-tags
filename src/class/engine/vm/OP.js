import helpers from '../helpers.js';

export class OP {
    constructor({lib}) {
	this.lib = lib;
    }

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
     * Normalize a stage return value into a StageResult.
     *
     * This function formalizes legacy return semantics and removes all
     * implicit behavior. Continuation, waiting, and completion must be
     * expressed explicitly.
     *
     * Normalization rules:
     * - Scalar values:
     *   - If `lib.bool.yes(value)` → OK (continue)
     *   - Otherwise               → ERROR
     *
     * - Object values:
     *   - If `status` is an intentional value (`lib.bool.isIntent`) →
     *     treated as an explicit StageResult and passed through.
     *   - If `{ wait: true }` →
     *     WAIT (explicit legacy wait token).
     *
     * - All other values:
     *   - ERROR (no recognized continuation semantics).
     *
     * Notes:
     * - Implicit legacy WAIT semantics have been removed.
     * - Truthy values do NOT imply continuation unless explicitly
     *   recognized by `lib.bool.yes`.
     * - This function is coercive and opinionated by design; it enforces
     *   explicit control flow signaling.
     *
     * @param {*} res
     *     Raw value returned by a stage function.
     *
     * @param {Object} [opts]
     * @param {string} [opts.pipelineKey]
     *     Pipeline identifier for diagnostics.
     * @param {*} [opts.op]
     *     Operation identifier for diagnostics.
     *
     * @returns {Object}
     *     A StageResult object produced via `helpers.SR_*`.
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
	

	//base type will differentiate null, array, (object, hash) => object
	if(this.lib.utils.baseType(res,'object')) {
	    // Already a StageResult
	    if (this.lib.bool.isIntent(res.status)) {
		return res;
	    }
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
    
    _normalizeReturn(res, { pipelineKey, op } = {}) {

	// Already a StageResult
	if (res && typeof res === "object" && res.status) {
	    return res;
	}

	// ---- Legacy / implied semantics ----
	// v098 rules (formalized):
	// - falsy        -> ERROR
	// - true / 1     -> OK
	// - truthy other -> WAIT

	// Falsy => ERROR
	if (!res) {
	    return helpers.SR_error(
		new Error("Stage returned falsy"),
		{ pipelineKey, op, legacy: true }
	    );
	}

	// Explicit success
	if (res === true || res === 1) {
	    return helpers.SR_ok({ pipelineKey, op, legacy: true });
	}

	// Any other truthy value => WAIT
	return helpers.SR_wait({
	    pipelineKey,
	    op,
	    legacy: true,
	    value: res
	});
    }

}

export default OP;
