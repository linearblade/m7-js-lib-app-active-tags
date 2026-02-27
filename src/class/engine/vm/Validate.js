/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * Validate (VM Step Resolver)
 * ============================
 * Resolves pipeline configuration and stage metadata for a single VM step.
 *
 * Role
 * ----
 * - Ensures ticket runtime fields exist.
 * - Resolves pipeline definition by key.
 * - Selects the correct phase track (run | error).
 * - Determines the current stage record.
 * - Resolves the operation and executable function.
 *
 * Architectural Position
 * ----------------------
 * Engine
 *   → Tick (lifecycle + scheduling)
 *       → VM (single-stage execution)
 *           → Validate (pipeline + stage resolution only)
 *
 * Validate does NOT:
 * - Execute stage functions
 * - Normalize return values
 * - Mutate ticket phase transitions
 * - Finalize tickets
 * - Emit hooks
 *
 * Phase Semantics
 * ---------------
 * - Phase must be one of:
 *     helpers.PIPELINE_PHASE_RUN   ("run")
 *     helpers.PIPELINE_PHASE_ERROR ("error")
 *
 * - `_getSteps()` selects the correct phase track from the pipeline
 *   definition based on the ticket's current phase.
 *
 * Step Resolution Flow
 * --------------------
 * `_validateStep({ job, ticket })` performs:
 *
 * 1) Resolve pipeline definition via `ticket.pipelineKey`
 *    (defaults to helpers.PIPELINE_KEY_DEFAULT ("default")).
 *
 * 2) Resolve steps for the current phase.
 *
 * 3) Determine current stage by `ticket.cursor.stage`.
 *
 * 4) If stage does not exist:
 *      - If in error phase → return handled completion.
 *      - Otherwise         → return normal completion.
 *
 * 5) Resolve:
 *      - operation identifier
 *      - operation function (builtins → lib.func registry)
 *
 * 6) Return either:
 *      - `{ err }`   → StageResult error
 *      - `{ done }`  → StageResult complete
 *      - executable stage metadata:
 *          { pipelineKey, pipelineDef, steps, stepRec, op, args, fn }
 *
 * Guarantees
 * ----------
 * - Never throws.
 * - Does not mutate job or engine state.
 * - May mutate ticket runtime fields via `_ensureTicketRuntime`.
 * - Always returns a structured descriptor for VM consumption.
 *
 * Notes
 * -----
 * - This module assumes prior normalization of job configuration.
 */

import helpers from '../helpers.js';

export class Validate {
    constructor({lib,builtins,AT} ) {
	this.lib = lib;
	this.builtins = builtins;
	this.fnPolicy = lib.hash.get(AT.conf.engine.opResolution);
    }

    //leaving this 'raw', b/c I havent decided if I will make tickets an class entity rather than a raw hash.
    //also this should be ideally groomed above and reject invalid ticket shapes.
    /**
     * Ensure minimal runtime shape for a ticket.
     *
     * Initializes fields required by VM execution:
     *   - ticket.cursor.stage (number)
     *   - ticket.phase (helpers.PIPELINE_PHASE_RUN | helpers.PIPELINE_PHASE_ERROR)
     *   - ticket.errorInfo (nullable)
     *
     * This is defensive grooming only. It does not validate
     * the full ticket structure or enforce schema correctness.
     *
     * Mutates the provided ticket object in-place.
     */
    _ensureTicketRuntime(ticket) {
	// Minimal runtime fields for the runner.
	if (!ticket.cursor || typeof ticket.cursor !== "object") ticket.cursor = {};
	if (typeof ticket.cursor.stage !== "number") ticket.cursor.stage = 0;

	// phase: "run" or "error"
	if (!ticket.phase) ticket.phase = helpers.PIPELINE_PHASE_RUN;

	// keep original error when transitioning into error
	if (!ticket.errorInfo) ticket.errorInfo = null;
    }


    /**
     * Resolve a pipeline definition from a job by key.
     *
     * Lookup path:
     *   job.config.schema.pipelines[key]
     *
     * Defaults to helpers.PIPELINE_KEY_DEFAULT ("default") when `pipelineKey` is nullish.
     *
     * @param {Object} job
     * @param {string} pipelineKey
     * @returns {Object|null}
     *   Pipeline definition object, or null if missing.
     */
    _getPipelineDef(job, pipelineKey) {
	if (!job) return null;

	const key = String(pipelineKey || helpers.PIPELINE_KEY_DEFAULT);
	return this.lib.hash.get(job, `config.schema.pipelines.${key}`, null);
    }
    
    /**
     * Resolve the step list for the given pipeline phase.
     *
     * Validates that `phase` is one of:
     *   helpers.PIPELINE_PHASE_RUN | helpers.PIPELINE_PHASE_ERROR
     *
     * Returns the corresponding step array from the pipeline
     * definition, or null if invalid/missing.
     */
    
    _getSteps(pipelineDef, phase) {
	if (!pipelineDef) return null;

	const lib = this.lib;
	const allowed = lib.utils.clamp(helpers.PIPELINE_PHASE, phase, null);
	if (!allowed) return null;

	// `allowed` is "run" or "error"
	return lib.hash.get(pipelineDef, allowed, null);
    }
    /**
     * Normalize a raw pipeline step into `{ op, args }`.
     *
     * Accepts either:
     *   - string shorthand (e.g. "request.submit")
     *   - object form (e.g. { op: "request.submit", ... })
     *
     * Returns a normalized descriptor with:
     *   - op   (string | null)
     *   - args (object | null)
     *   - raw  (original step value)
     */

    _resolveStage(step) {
	// step can be:
	// - "request.submit"
	// - { op:"request.submit", ... }
	let rec = this.lib.hash.to(step, "op");
	return { op: rec.op || null, args: rec.args || null, raw: step,builtin:rec.builtin };
    }

    /**
     * Resolve an operation function by name.
     *
     * Resolution order:
     *   1) builtins registry (explicit overrides)
     *   2) lib.func registry
     *
     * Returns the resolved function or null/undefined if not found.
     */
    _getFnold(fn){
	const builtin = this.lib.hash.get(this.builtins,fn,null);
	if(builtin) return builtin;
	return this.lib.func.get(fn);
    }

    /**
     * Next-gen op resolver (staged, not yet the default call path).
     *
     * Rules:
     * - If builtin === true: strict builtin lookup only.
     * - If builtin !== true and fnPolicy.auto === true:
     *     use ordered lookup from fnPolicy.order.
     * - If builtin !== true and fnPolicy.auto !== true:
     *     user lookup only.
     *
     * Ordered lookup keys:
     * - "user"    -> `lib.func.get(fn)`
     * - "lib"     -> resolves `lib.*` paths against this Validate instance root
     *                (`lib.func.get(fn, { root: this })`)
     * - "builtin" -> ActiveTags builtin map lookup
     *
     * @param {*} fn
     * @param {boolean} [builtin]
     * @returns {Function|null}
     */
    _getFn(fn, builtin = undefined) {
	const lib = this.lib;
	if (typeof fn === "function") return fn;

	const lookupBuiltin = () => lib.hash.get(this.builtins, fn, null);
	const lookupUser = () => lib.func.get(fn);
	const lookupLib = () => {
	    if (!lib.str.is(fn)) return null;
	    const token = fn.trim();
	    if (token.indexOf("lib.") !== 0) return null;
	    return lib.func.get(token, { root: this });
	};

	// explicit builtin path (strict)
	if (builtin === true) {
	    const rv =  lookupBuiltin();
	    //console.log('try builting for ',fn,rv);
	    return rv;
	}

	const policy = lib.hash.slice(lib.hash.to(this.fnPolicy), "order auto");
	const auto = lib.bool.yes(policy.auto);
	if (!auto) return lookupUser();

	const scan = lib.array.to(policy.order, helpers.ARR_TO_OPTS);
	const dispatch = {
	    user: lookupUser,
	    lib: lookupLib,
	    builtin: lookupBuiltin,
	};

	for (const item of scan) {
	    const key = lib.str.to(item, true).trim().toLowerCase();
	    const resolver = dispatch[key];
	    if (!resolver) continue;
	    const hit = resolver();
	    if (hit) return hit;
	}

	return null;
    }

    /**
     * Resolve and validate the next executable stage for a ticket.
     *
     * Contract
     * --------
     * - Pure resolver for VM: determines what should run next (or why it cannot).
     * - Does NOT execute ops, normalize returns, transition phases, or emit hooks.
     * - May return either:
     *     A) error descriptor   → `{ err: StageResultError, ... }`
     *     B) completion         → `{ done: true, complete: true, res: StageResultComplete, ... }`
     *     C) executable context → `{ err: null, pipelineKey, pipelineDef, steps, stepRec, op, args, fn }`
     *
     * Inputs
     * ------
     * - `ticket.pipelineKey` selects the pipeline (defaults to helpers.PIPELINE_KEY_DEFAULT ("default") ).
     * - `ticket.phase` selects the phase track:
     *     helpers.PIPELINE_PHASE_RUN ("run") |
     *     helpers.PIPELINE_PHASE_ERROR ("error")
     * - `ticket.cursor.stage` selects the stage index within the phase track.
     *
     * Resolution order
     * ----------------
     * 1) Resolve pipeline definition via `_getPipelineDef(job, pipelineKey)`.
     *    - If missing → returns `{ err }` (Missing pipeline).
     *
     * 2) Resolve phase step list via `_getSteps(pipelineDef, ticket.phase)`.
     *    - If invalid/missing → returns `{ err, pipelineDef }` (Invalid pipeline definition).
     *
     * 3) Resolve current step record by index:
     *      `stepRec = steps[ticket.cursor.stage]`
     *
     * 4) End-of-phase handling (no step record):
     *    - If `ticket.phase === helpers.PIPELINE_PHASE_ERROR`:
     *        returns a handled completion via `helpers.SR_complete({ handled:true, original: ticket.errorInfo })`.
     *    - Otherwise:
     *        returns a normal completion via `helpers.SR_complete({ handled:false })`.
     *
     * 5) Resolve operation descriptor via `_resolveStage(stepRec)`:
     *    - If missing `op` → returns `{ err, stepRec }` (Invalid step).
     *
     * 6) Resolve executable function via `_getFn(op)`:
     *    - If not found → returns `{ err, op, stepRec }` (Unknown op).
     *
     * Output notes
     * ------------
     * - `pipelineDef`, `steps`, and `stepRec` are returned for diagnostic context.
     * - Completion results include `pipelineKey`, `phase`, and `handled` flags.
     * - The VM is expected to feed `{ err }` and `{ done }` outcomes through the
     *   normal status dispatch (no early returns).
     *
     * @param {Object} args
     * @param {Object} args.job
     *   Job containing pipeline configuration under `job.config.schema.pipelines`.
     * @param {Object} args.ticket
     *   Ticket providing pipelineKey/phase/cursor.stage selectors.
     *
     * @returns {Object}
     *   One of:
     *   - Error: `{ err: StageResultError, pipelineKey, pipelineDef?, steps?, stepRec?, op? }`
     *   - Done:  `{ done:true, complete:true, res: StageResultComplete, pipelineKey, pipelineDef, steps }`
     *   - Exec:  `{ err:null, pipelineKey, pipelineDef, steps, stepRec, op, args, fn }`
     */
    
    _validateStep({ job, ticket }) {
	const pipelineKey = String(ticket.pipelineKey || helpers.PIPELINE_KEY_DEFAULT);
	
	const pipelineDef = this._getPipelineDef(job, pipelineKey);
	if (!pipelineDef) {
	    return {
		err: helpers.SR_error(new Error(`Missing pipeline '${pipelineKey}'`), { pipelineKey }),
		pipelineKey,
	    };
	}

	const steps = this._getSteps(pipelineDef, ticket.phase);
	if (!steps) {
	    return {
		err: helpers.SR_error(new Error(`Invalid pipeline '${pipelineKey}' definition`), {
		    pipelineKey,
		    phase: ticket.phase,
		}),
		pipelineKey,
		pipelineDef,
	    };
	}

	const stepRec = steps[ticket.cursor.stage];
	//console.log(`stage is ${ticket.cursor.stage}`);
	// End-of-phase
	if (!stepRec) {
	    // If we've exhausted the error track, we treat this as a *handled* completion.
	    if (ticket.phase === helpers.PIPELINE_PHASE_ERROR) {
		return {
		    done: true,
		    complete: true,
		    res: helpers.SR_complete({
			pipelineKey,
			phase: helpers.PIPELINE_PHASE_ERROR,
			handled: true,
			original: ticket.errorInfo || null,
		    }),
		    pipelineKey,
		    pipelineDef,
		    steps,
		};
	    }

	    // Normal run end-of-line: clean completion.
	    return {
		done: true,
		complete: true,
		res: helpers.SR_complete({
		    pipelineKey,
		    phase: ticket.phase,
		    handled: false,
		}),
		pipelineKey,
		pipelineDef,
		steps,
	    };
	}
	const { op, args,builtin } = this._resolveStage(stepRec);
	if (!op) {
	    return {
		err: helpers.SR_error(new Error("Invalid pipeline step (missing op)"), { pipelineKey, step: stepRec }),
		pipelineKey,
		pipelineDef,
		steps,
		stepRec,
	    };
	}

	const fn = this._getFn(op,builtin);
	if (!fn) {
	    return {
		err: helpers.SR_error(new Error(`Unknown op '${op}'`), { pipelineKey, op, step: stepRec }),
		pipelineKey,
		pipelineDef,
		steps,
		stepRec,
		op,
	    };
	}

	return {
	    err: null,
	    pipelineKey,
	    pipelineDef,
	    steps,
	    stepRec,
	    op,
	    args,
	    fn,
	};
    }

    
}

export default Validate;
