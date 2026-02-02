import CONSTANTS from './constants.js';

export class DSL {

    constructor({lib,expr}) {
	this.lib  = lib;
	this.expr = expr;
    }
    
    /**
     * Phase 2: Compile/validate pipeline DSL (strings → parsed descriptors).
     *
     * Wrapper: iterates `output.pipelines` and compiles each pipeline item.
     * - Expects Phase 1 normalization already ran (_normalizeBlock PIPELINE),
     *   so `output.pipelines` should be a hash of pipelineName → pipelineObject.
     * - Mutates `output` in-place (adds compiled fields on each pipeline item).
     */
    _compilePipelineDSL(report, output) {
	const lib = this.lib;
	console.log('here', lib.utils.deepCopy(output) );
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
     * Compile one pipeline item.
     *
     * Stub for now:
     * - In a later pass, this will parse `p.run` / `p.onError` entries from raw
     *   strings into executable descriptors (AST), validate syntax (quotes closed,
     *   etc.), and optionally validate callable names.
     *
     * Expected future behavior:
     * - p.runAst     = Array<Descriptor>
     * - p.onErrorAst = Array<Descriptor>
     * - keep p.run/p.onError as raw tokens for debugging/round-tripping
     */
    _compilePipelineDSLItem(report, p, ctx = {}) {
	const lib = this.lib;

	p = lib.hash.to(p);
	ctx = lib.hash.to(ctx);

	console.log(`scrubbing pipeline ${ctx.key}`);
	
	p.run     = this.expr.parseList(p.run);
	p.onError = this.expr.parseList(p.onError);

	return p;
    }

}

export default DSL;
