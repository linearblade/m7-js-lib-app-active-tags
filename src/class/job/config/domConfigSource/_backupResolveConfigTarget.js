/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

    async _backup_resolveConfigTarget({ report, ref, source } = {}) {
	const lib = this.lib;

	ref = lib.str.to(ref, true).trim();
	if (!ref) {
            this._error(report, "configure", "CONFIG_REF_EMPTY", "Empty config reference");
            return {};
	}

	// Interpolate reference


	//console.log('ref' , ref);
	//const scheme = this.expr.interpScheme({ e: source }, undefined);
	//ref = lib.str.interp(ref, scheme);
	//console.log('after', ref);
	// Parse the target expression
	let info;
	//console.warn(ref);
	let imp = null;

	try {
	    imp = this._maybeImport(ref);

	    if (imp) {
		info = await this._importConfig(imp);
	    } else {
		info = this.expr.eval({ job: this.job }, ref);
	    }
	} catch (err) {
	    if (imp) {
		// import path failed
		this._error(
		    report,
		    "configure",
		    "CONFIG_IMPORT_FAILED",
		    `Failed to import config reference '${ref}'`,
		    { error: err, ref, imp }
		);
	    } else {
		// expression / local reference failed
		this._error(
		    report,
		    "configure",
		    "CONFIG_PARSE_TARGET_FAILED",
		    `Failed to parse config reference '${ref}'`,
		    { error: err, ref }
		);
	    }

	    return {};
	}
	//console.warn(info);
	// Evaluate into a value
	let val = info;

	if (!(lib.utils.isScalar(info) || lib.dom.is(info))) {
            if (lib.hash.is(info) && info.src && info.prop) {
		val = lib.hash.get(info.src, info.prop);
            } else {
		val = info;
            }
	}

	// DOM source => parse JSON from text
	if (lib.dom.is(val)) {

	    let text = "";

	    // Prefer inline JSON if present
	    const inline =
		  lib.str.to(val.textContent, true).trim() ||
		  lib.str.to(val.innerText, true).trim();
	    text = inline;
	    
	    // If inline is empty, try external source
	    if (lib.utils.isEmpty(inline)) {
		const src = val.getAttribute("data-src") || val.src;
		if (src) {
		    text = await fetch(src).then(r => r.text());
		}
	    } else {
		text = inline;
	    }
	    

            if (!text.trim()) {
		this._error(
                    report,
                    "configure",
                    "CONFIG_DOM_EMPTY",
                    `Config DOM source for '${ref}' had no text`,
                    { ref }
		);
		return {};
            }

            try {
		//$FIXUP
		val = this._resolveDomConfigNode(val, text, { source, ref });
		//console.warn(val);
		//val = JSON.parse(text);
            } catch (err) {
		const msg = (err && err.message) ? String(err.message) : "Config parse failed";

		this._error(
		    report,
		    "configure",
		    "CONFIG_PAYLOAD_PARSE_FAILED",
		    `Config payload failed for '${ref}': ${msg}`,
		    { error: err, ref, type: val?.type, tagName: val?.tagName }
		);

		return {};
            }
	}

	// Must resolve to an object/hash
	if (!lib.hash.is(val)) {
            this._error(
		report,
		"configure",
		"CONFIG_NOT_OBJECT",
		`Config reference '${ref}' did not resolve to an object(hash)`,
		{ ref }
            );
            return {};
	}

	return val;
    }
