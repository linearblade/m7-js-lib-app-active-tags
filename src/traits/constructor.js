import requireLibs from '../helpers/requireLibs.js';

export const trait_constructor = {

    getOpts(conf) {
	const lib = this.lib;

	// clone via hash.to so we don't mutate caller
	const confObj = lib.hash.to(conf);
	delete confObj.intervalManager;
	delete confObj.logManager;

	return lib.hash.merge(
            {
		debug: false,
		log: { enable: false },
		observe: {
                    selectors: this.constructor.DEFAULT_SELECTOR,
                    debounceMs: 25,
                    observeAttributes: false
		}
            },
            confObj
	);
    },

    normalizeDelegator(lib) {
	if (!lib?.site) return;
	if (!lib.site.delegator && lib.site.delagator) {
            lib.site.delegator = lib.site.delagator;
	}
    },
    requireCoreDeps(lib) {
	requireLibs(lib, [
            'primitive.workspace',
            'dom',
            'site.delegator',
            'str.interp'
	], { mod: '[activeTags]' });
    }

};

export default trait_constructor;
