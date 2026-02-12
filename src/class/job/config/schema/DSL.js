/**
 * Pipeline DSL Compiler
 * =====================
 *
 * PURPOSE
 * -------
 * Compiles normalized pipeline definitions into a canonical, runtime-ready
 * representation.
 *
 * This module is Phase 2 of Job configuration compilation.
 * It operates after structural normalization has completed and before
 * runtime execution begins.
 *
 *
 * POSITION IN COMPILATION PIPELINE
 * --------------------------------
 * Phase 1  Structural normalization
 *   - Coerce shapes
 *   - Apply defaults
 *   - Validate block structure
 *
 * Phase 2  DSL compilation  ← this module
 *   - Parse pipeline run and error definitions
 *   - Normalize into canonical list form
 *   - Prepare descriptors for runtime consumption
 *
 * Phase 3  Runtime execution
 *   - Engine and VM consume compiled pipeline definitions
 *
 *
 * INPUT CONTRACT
 * --------------
 * Expects:
 *   output.pipelines to be a hash of:
 *     pipelineName → pipelineObject
 *
 * Each pipelineObject may contain:
 *   run     string | array | mixed DSL form
 *   error   string | array | mixed DSL form
 *
 * Structural guarantees are assumed to be enforced upstream.
 *
 *
 * CURRENT BEHAVIOR
 * ----------------
 * - Coerces run and error blocks into canonical list form using
 *   ExpressionResolver.parseList().
 * - Mutates the provided output object in place.
 * - Ensures each pipeline object is aware of its own name.
 *
 *
 * FUTURE DIRECTION
 * ----------------
 * This module is the correct location for:
 *   - Descriptor compilation
 *   - AST construction
 *   - Static validation of operation shape
 *   - Compile-time diagnostics
 *
 * Runtime execution logic must never be placed here.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * Must remain deterministic.
 * Must not access Engine or runtime state.
 * Must not enqueue or execute pipelines.
 * Must not mutate configuration outside the pipelines block.
 *
 *
 * ERROR HANDLING
 * --------------
 * Diagnostics are reported via the provided Report instance.
 * This compiler should never throw for user configuration errors.
 *
 *
 * NON-RESPONSIBILITIES
 * --------------------
 * Does not execute pipelines.
 * Does not resolve Job instances.
 * Does not interpret descriptor semantics.
 */


import CONSTANTS from './constants.js';



export class DSL {

    /**
     * Create a new Pipeline DSL compiler instance.
     *
     * @param {Object} opts
     * @param {Object} opts.lib
     *   The m7 lib instance used for safe coercion and hash utilities.
     *
     * @param {ExpressionResolver} opts.expr
     *   An ExpressionResolver instance configured by the ActiveTags constructor.
     *   This resolver is used to parse run and error DSL blocks into canonical
     *   list form during compilation.
     *
     * This constructor performs dependency wiring only.
     * It does not execute compilation.
     */
    constructor({lib,expr}) {
	this.lib  = lib;
	this.expr = expr;
    }
    
    /**
     * Compile pipeline DSL for all pipeline definitions.
     *
     * CONTRACT
     * --------
     * _compilePipelineDSL() is a Phase 2 configuration compiler step.
     * It compiles pipeline run and error definitions from mixed DSL forms
     * into canonical, runtime-ready structures.
     *
     * This function is a wrapper over output.pipelines.
     * It does not execute pipelines.
     * It does not validate operation semantics beyond DSL parsing.
     *
     *
     * PRECONDITIONS
     * -------------
     * Phase 1 normalization must already have run for the pipelines block.
     * output.pipelines is expected to be a hash of:
     *   pipelineName -> pipelineObject
     *
     *
     * INPUT
     * -----
     * @param {Report} report
     *   Diagnostics sink used to record compilation issues.
     *
     * @param {Object} output
     *   Normalized configuration object.
     *   The object is coerced to a hash for safe access.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Coerces output to an object hash.
     * 2. Reads output.pipelines.
     * 3. If pipelines is not a hash, returns output unchanged.
     * 4. Iterates pipeline keys in deterministic order.
     * 5. For each pipeline object:
     *      Ensures p.name is set to the pipeline key for diagnostics.
     *      Invokes _compilePipelineDSLItem(report, p, { key }).
     *      Stores the compiled pipeline object back into pipelines[key].
     * 6. Writes pipelines back onto output and returns output.
     *
     *
     * MUTATION
     * --------
     * Mutates pipeline objects in place.
     * May also replace individual pipeline objects with the compiled result
     * returned by _compilePipelineDSLItem().
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   The same output reference when possible, containing compiled pipeline data.
     *
     *
     * ERROR HANDLING
     * --------------
     * User configuration errors should be reported to report.
     * This function should not throw for user DSL issues.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not enqueue pipelines.
     * Does not access Engine or runtime state.
     * Does not interpret compiled descriptors at runtime.
     */
    _compilePipelineDSL(report, output) {
	const lib = this.lib;
	//console.log('here', lib.utils.deepCopy(output) );
	output = lib.hash.to(output);

	const pipelines = lib.hash.get(output, "pipelines");
	if (!lib.hash.is(pipelines)) return output;
	const keys = lib.hash.keys(pipelines);
	//console.log(keys);
	for (const key of keys) {

            const p = pipelines[key];
            if (!lib.hash.is(p)) continue;

            // Ensure pipeline item knows its own name (helps diagnostics)
            p.name = key;
            pipelines[key] = this._compilePipelineDSLItem(report, p, { key });
	}

	// Write back (in case output.pipelines was not the same reference)
	lib.hash.set(output, "pipelines", pipelines);

	return output;
    }

    /**
     * Compile a single pipeline definition into canonical DSL form.
     *
     * CONTRACT
     * --------
     * _compilePipelineDSLItem() transforms the run and error blocks of a
     * pipeline object into normalized list form using ExpressionResolver.
     *
     * It does not execute pipelines.
     * It does not validate operation semantics.
     * It does not construct execution descriptors or AST nodes.
     *
     *
     * INPUT
     * -----
     * @param {Report} report
     *   Diagnostics sink for compilation warnings or errors.
     *
     * @param {Object} p
     *   A single pipeline configuration object.
     *   Expected to contain run and optionally error definitions.
     *
     * @param {Object} [ctx]
     *   Optional compilation context.
     *   May include:
     *     key  pipeline name used for diagnostics.
     *
     *
     * BEHAVIOR
     * --------
     * 1. Coerces p and ctx to safe object hashes.
     * 2. Normalizes p.run into canonical list form via expr.parseList().
     * 3. Normalizes p.error into canonical list form via expr.parseList().
     * 4. Returns the mutated pipeline object.
     *
     * Canonical list form ensures:
     *   - Strings, arrays, and mixed DSL inputs are converted into a
     *     consistent array structure.
     *   - Downstream runtime consumers can assume array semantics.
     *
     *
     * MUTATION
     * --------
     * Mutates the provided pipeline object in place.
     * Overwrites p.run and p.error with parsed list results.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Object}
     *   The same pipeline object reference, containing normalized DSL fields.
     *
     *
     * FUTURE EXTENSION
     * ----------------
     * This method is the correct insertion point for:
     *   - AST descriptor construction
     *   - Static validation of operation shape
     *   - Compile-time diagnostics per pipeline step
     *
     * Additional compiled artifacts may be attached to p, such as:
     *   p.runAst
     *   p.errorAst
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not enqueue pipelines.
     * Does not interact with Engine or VM.
     * Does not mutate configuration outside the provided pipeline object.
     */
    _compilePipelineDSLItem(report, p, ctx = {}) {
	const lib = this.lib;

	p = lib.hash.to(p);
	ctx = lib.hash.to(ctx);

	//console.log(`scrubbing pipeline ${ctx.key}`);
	
	p.run     = this.expr.parseList(p.run);
	p.error = this.expr.parseList(p.error);

	return p;
    }

}

export default DSL;
