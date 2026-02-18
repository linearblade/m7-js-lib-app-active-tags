import {lib, init as initLib}  from "/vendor/m7-js-lib/src/index.js";
import ActiveTags from "/vendor/m7-js-lib-active-tags/src/ActiveTags.js";
initLib();
window.lib = lib;
const stockTickerDeps = [
    "/vendor/m7-js-lib-tree/src/auto.js",
    "/vendor/m7-js-workspace/src/auto.js",
    "/vendor/m7-js-lib-primitive-log/src/auto.js",
    "/vendor/m7-js-lib-interval/src/auto.js",
    "/vendor/m7-js-lib-str-interp/src/auto.js",
    "/vendor/m7-js-lib-primitive-dom-eventdelegator/src/auto.js",
    "/vendor/m7-js-lib-primitive-dom-changeobserver/src/auto.js",
    "/vendor/m7-js-lib-site-form/src/auto.js",
];

async function loadStockTickerDeps() {
    // Keep order aligned with the prior HTML script sequence.
    for (const modPath of stockTickerDeps) {
	await import(modPath);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadStockTickerDeps();

    const AT = new ActiveTags(lib, {
	env: {
	    // optional — ActiveTags will derive these if omitted,
	    // but being explicit is fine
	    window,
	    document,
	    root: window,
	},

	// runtime/system toggles (keep yours here; names depend on your ActiveTags impl)
	boot: {
	    intervals: true,
	    events: true,
	},
	engine: {
	    // hooks: true
	    opResolution : {
		auto: true
	    }
	},
	// job-default config (this is what gets sliced + passed into Job.configure)
	job: {
	    config: {
		evalEnabled: true,
		evalType: "text/at-eval", // string or array ok
		importEnabled: true,
		importPath: ["/vendor/m7-js-lib-active-tags/examples/"], // optional allow-list
	    },
	},
    });

    lib.service.set("activeTags", AT);
    await AT.start();
    window.AT = AT;
});
