// -----------------------------------------------------------------------------
// StageRegistry (name -> async function)
// -----------------------------------------------------------------------------

export class StageRegistry {
    constructor({ lib, strict = false } = {}) {
	if (!lib) throw new Error("StageRegistry requires lib");
	this.lib = lib;
	this.strict = !!strict;
	this.map = new Map(); // stageKey -> ref (string|fn|descriptor)
    }

    register(stageKey, ref) {
	if (!stageKey) throw new Error("StageRegistry.register(stageKey, ref) requires stageKey");
	this.map.set(String(stageKey), ref);

	// optional eager check ONLY if strict
	if (this.strict) {
	    const fn = this.lib.func.get(ref);
	    if (typeof fn !== "function") {
		throw new Error(`Stage '${stageKey}' is not resolvable at register-time (strict mode)`);
	    }
	}
    }

    get(stageKey) {
	const ref = this.map.get(String(stageKey));
	if (ref == null) return null;
	const fn = this.lib.func.get(ref);
	return fn;
    }
}
