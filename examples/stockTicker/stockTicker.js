import {lib, init as initLib}   from  "/vendor/m7-js-lib/src/index.js";
import ActiveTags               from  "/vendor/m7-js-lib-active-tags/src/ActiveTags.js";
import installDomChangeObserver from  "/vendor/m7-js-lib-primitive-dom-changeobserver/src/install.js";
import installEventDelegator    from  "/vendor/m7-js-lib-primitive-dom-eventdelegator/src/install.js";
import installLog               from  "/vendor/m7-js-lib-primitive-log/src/install.js";
import installInterval          from  "/vendor/m7-js-lib-primitive-interval/src/install.js";
import installStrInterp         from  "/vendor/m7-js-lib-str-interp/src/install.js";
import installSiteForm          from  "/vendor/m7-js-lib-site-form/src/install.js";
import installTree              from  "/vendor/m7-js-lib-tree/src/install.js";
import installWorkspace         from  "/vendor/m7-js-workspace/src/install.js";
initLib();
//window.lib = lib;

//leave in place for any auto deps we may later have
const stockTickerAutoDeps = [
    //"/vendor/m7-js-lib-tree/src/auto.js",
    //"/vendor/m7-js-workspace/src/auto.js",
];

async function loadStockTickerDeps() {
    for (const modPath of stockTickerAutoDeps) {
	await import(modPath);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadStockTickerDeps();
    installWorkspace(lib);
    installTree(lib);
    installInterval(lib);
    installStrInterp(lib);
    installSiteForm(lib);
    installLog(lib, {
	host: window,
	root: window,
	managerOptions: { lib },
    });
    installDomChangeObserver(lib, { host: window, root: document.body, start: true });
    installEventDelegator(lib, { host: window, root: document, start: true });

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
