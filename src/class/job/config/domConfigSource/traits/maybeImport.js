/**
 * Parse and validate an import-style config reference.
 *
 * CONTRACT
 * --------
 * _maybeImport() recognizes import references of the form:
 *   "import:<url>[#<exportName>]"
 *
 * If the reference does not match the import form, returns null.
 * If the reference matches the import form, returns an import descriptor:
 *   { url, exportName }
 *
 * Import references are privileged.
 * When imports are disabled or blocked by policy, this method throws with
 * a structured error containing a stable code field.
 *
 *
 * INPUT
 * -----
 * @param {*} ref
 *   Candidate reference value.
 *   Non-string values return null.
 *
 *
 * IMPORT GRAMMAR
 * --------------
 * - Matches case-insensitively:
 *     import : <specifier>
 * - The specifier supports optional named export selection:
 *     <url>#<exportName>
 *
 * Examples:
 *   "import:/assets/config.js"
 *   "import:/assets/config.js#myExport"
 *
 *
 * POLICY GATES
 * ------------
 * 1. Global import enablement
 *    If allowImportConfig is false, throws CONFIG_IMPORT_DISABLED.
 *
 * 2. Scheme blocking
 *    URLs classified as resource schemes (data:, blob:, file:, extension schemes)
 *    are rejected with CONFIG_IMPORT_RESOURCE_BLOCKED.
 *
 * 3. Allow-list enforcement
 *    allowImportPath controls which external URLs may be imported.
 *
 *    - If allowImportPath is empty:
 *        Local-only mode.
 *        Only pathAbs and pathRel are allowed.
 *        External URLs are rejected with CONFIG_IMPORT_PATH_BLOCKED.
 *
 *    - If allowImportPath is non-empty:
 *        Local paths are always allowed.
 *        External URLs must resolve successfully and the resolved pathname
 *        must begin with one of the allowImportPath prefixes.
 *        Otherwise rejected with CONFIG_IMPORT_PATH_BLOCKED.
 *
 *
 * ERROR MODEL
 * -----------
 * Throws structured errors with Error.code set for:
 *   CONFIG_IMPORT_DISABLED
 *   CONFIG_IMPORT_EMPTY
 *   CONFIG_IMPORT_RESOURCE_BLOCKED
 *   CONFIG_IMPORT_URL_INVALID
 *   CONFIG_IMPORT_PATH_BLOCKED
 *
 * Callers are expected to catch and report these errors via Report.
 *
 *
 * RETURN VALUE
 * ------------
 * @returns {Object|null}
 *   null when ref is not an import reference.
 *   { url, exportName } when ref is a valid import reference.
 *
 *
 * NON-RESPONSIBILITIES
 * --------------------
 * Does not perform the dynamic import.
 * Does not validate imported value type.
 * Import execution is handled by _importConfig() and type enforcement
 * occurs in _resolveConfigTarget().
 */

 const trait_maybeImport = {
    _maybeImport(ref) {
	const lib = this.lib;

	if (typeof ref !== "string") return null;

	const m = ref.match(/^\s*import\s*:\s*(.+?)\s*$/i);
	if (!m) return null;

	
	// Gate: imports are privileged.
	if (!this.allowImportConfig) {
            throw Object.assign(
		new Error(`Import config disabled for '${ref}'`),
		{ code: "CONFIG_IMPORT_DISABLED" }
            );
	}


	const spec = m[1];
	const [rawUrl, rawExport] = spec.split("#", 2);

	const url = (rawUrl || "").trim();
	const exportName = rawExport ? rawExport.trim() : null;

	if (!url) {
            throw Object.assign(
		new Error(`Empty import specifier in '${ref}'`),
		{ code: "CONFIG_IMPORT_EMPTY" }
            );
	}

	// Classify URL-ish type
	const t = lib.utils.linkType(url); // "pathAbs" | "pathRel" | "urlAbs" | "urlNet" | "resource" | ...

	// Block special schemes by default (data:, blob:, file:, chrome-extension:, etc.)
	if (t === "resource") {
            throw Object.assign(
		new Error(`Import blocked (resource scheme): '${url}'`),
		{ code: "CONFIG_IMPORT_RESOURCE_BLOCKED", url, linkType: t }
            );
	}

	// Normalize allow list (pathname prefixes)
	const allowList = (lib.array.filterStrings
			   ? lib.array.filterStrings(this.allowImportPath)
			   : lib.array.to(this.allowImportPath).filter(s => typeof s === "string" && s.trim())
			  ).map(s => String(s).trim()).filter(Boolean);

	// No allow list => local-only (pathAbs/pathRel only)
	if (!allowList.length) {
            const isLocal = (t === "pathAbs" || t === "pathRel");
            if (!isLocal) {
		throw Object.assign(
                    new Error(`Import blocked (local-only mode): '${url}'`),
                    { code: "CONFIG_IMPORT_PATH_BLOCKED", url, linkType: t }
		);
            }
            return { url, exportName };
	}

	// Allow local always
	if (t === "pathAbs" || t === "pathRel") {
            return { url, exportName };
	}

	// External (urlAbs/urlNet): require allowList pathname prefix match
	const base = this.env?.baseURI || this.env?.document?.baseURI || "";

	let resolved;
	try {
            resolved = new URL(url, base || undefined);
	} catch (err) {
            throw Object.assign(
		new Error(`Invalid import URL '${url}' in '${ref}'`),
		{ code: "CONFIG_IMPORT_URL_INVALID", url, error: err }
            );
	}

	if (!allowList.some(prefix => resolved.pathname.startsWith(prefix))) {
            throw Object.assign(
		new Error(`Import blocked by importPath: '${resolved.pathname}'`),
		{
                    code: "CONFIG_IMPORT_PATH_BLOCKED",
                    url,
                    pathname: resolved.pathname,
                    allowImportPath: allowList.slice(),
                    linkType: t,
		}
            );
	}

	return { url, exportName };
    },

         /**
     * Import a configuration module reference and return its exported value.
     *
     * CONTRACT
     * --------
     * _importConfig() resolves an import descriptor into a module export value.
     * Results are memoized so repeated imports of the same URL and export name
     * share a single in-flight Promise and cached resolution.
     *
     * Import base resolution is document-scoped.
     * Relative URLs are resolved against the owning document baseURI rather than
     * the current JavaScript module file location.
     *
     *
     * INPUT
     * -----
     * @param {Object} imp
     *   Import descriptor produced by _maybeImport().
     *   Expected fields:
     *     url        module URL (absolute or relative)
     *     exportName optional named export to read
     *
     *
     * BEHAVIOR
     * --------
     * 1. Initializes a per-instance import cache.
     * 2. Determines a document base URL using:
     *      this.importBaseUrl (if provided)
     *      job element ownerDocument.baseURI
     *      global document.baseURI (if available)
     * 3. Resolves imp.url against the document base when possible.
     * 4. Builds a stable cache key using resolvedUrl and exportName.
     * 5. If cached, returns the cached Promise.
     * 6. Otherwise performs a dynamic import of the resolved URL and returns:
     *      mod[exportName] when exportName is provided
     *      otherwise mod.default if present, else the module namespace object
     * 7. Stores the Promise in the cache and returns it.
     *
     *
     * RETURN VALUE
     * ------------
     * @returns {Promise<*>}
     *   Promise resolving to the imported export value.
     *
     *
     * SECURITY AND POLICY
     * -------------------
     * This method assumes import eligibility and path allow-list validation
     * have already been enforced by _maybeImport() and the caller.
     * It does not perform allow-list checks itself.
     *
     *
     * NON-RESPONSIBILITIES
     * --------------------
     * Does not validate the imported value type.
     * Does not coerce the imported export into an object.
     * Type enforcement occurs in _resolveConfigTarget().
     */
    async _importConfig(imp) {
	this._importCache ||= new Map();

	// Resolve relative imports against the DOCUMENT, not the module file.
	const docBase =
              this.importBaseUrl ||
              this.job?.e?.ownerDocument?.baseURI ||
              (typeof document !== "undefined" ? document.baseURI : "");

	const resolvedUrl = docBase
              ? new URL(imp.url, docBase).href
              : imp.url;

	const key = `${resolvedUrl}#${imp.exportName || ""}`;
	if (this._importCache.has(key)) return this._importCache.get(key);

	const p = (async () => {
            const mod = await import(/* @vite-ignore */ resolvedUrl);
            return imp.exportName ? mod[imp.exportName] : (mod.default ?? mod);
	})();

	this._importCache.set(key, p);
	return p;
    }

     
};

export default trait_maybeImport;
