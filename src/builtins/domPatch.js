// builtins/domPatch.js
import helpers from '../class/engine/helpers.js';

/**
 * dom.patch (v1)
 *
 * Sources:
 *  - data-attr-* attributes on the job element (strip the prefix)
 *  - op args (explicit patch object)
 *
 * Merge precedence:
 *  - args override DOM attributes
 *
 * Effect:
 *  - for each key: lib.dom.set(job.e, key, value)
 */
// builtins/domPatch.js
// NOTE: Must conform to VM call signature:
// ({ job, lib, args, trigger, ticket, inputs, ctx, step }) => StageResultLike

export default async function domPatch({ job, lib, args, step } = {}) {
    try {
	const e = job?.e;
	if ( !lib.dom.is(e)) {

	    return {
		status: "error",
		error: new Error("dom.patch: job.e is not a DOM element"),
		detail: { op: "dom.patch", step },
	    };
	}

	// 1) Scan element for data-attr-* directives (strip => keys like "style.color")
	// Uses the same behavior you referenced (strip matched prefix).
	const fromDom = lib.dom.filterAttributes(e, /^data-attr-/, 1) || {};

	// 2) Merge with args patch object (args wins)
	// You said args is like: {"style.color":"red"} (or args.args in your higher config)
	// In the VM you pass v.args directly, so domPatch expects args to BE the patch object.
	const fromArgs = lib.array.is(args) ?
	      lib.hash.to(args[0]) :
	      lib.hash.to(args) ;
	const patch = { ...fromDom, ...fromArgs };

	// 3) Apply using lib.dom.set
	let applied = 0;
	for (const k in patch) {
	    if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
	    lib.dom.set(e, k, patch[k]);
	    applied++;
	}

	return {
	    status: "ok",
	    detail: {
		op: "dom.patch",
		applied,
		keys: lib.hash.keys(patch),
		step,
	    },
	};
    } catch (err) {
	return {
	    status: "error",
	    error: err,
	    detail: { op: "dom.patch", step },
	};
    }
}
