import {lib, init as initLib}  from "/vendor/m7-js-lib/src/index.js";
import ActiveTags from "/vendor/m7-js-lib-active-tags/src/ActiveTags.js";
initLib();
window.lib = lib;

const requestHttpDeps = [
    "/vendor/m7-js-lib-tree/src/auto.js",
    "/vendor/m7-js-workspace/src/auto.js",
    "/vendor/m7-js-lib-primitive-log/src/auto.js",
    "/vendor/m7-js-lib-interval/src/auto.js",
    "/vendor/m7-js-lib-str-interp/src/auto.js",
    "/vendor/m7-js-lib-primitive-dom-eventdelegator/src/auto.js",
    "/vendor/m7-js-lib-primitive-dom-changeobserver/src/auto.js",
    "/vendor/m7-js-lib-site-form/src/auto.js",
];

async function loadRequestHttpDeps() {
    for (const modPath of requestHttpDeps) {
	await import(modPath);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadRequestHttpDeps();

    const AT = new ActiveTags(lib, {
	env: {
	    window,
	    document,
	    root: window,
	},
	boot: {
	    intervals: true,
	    events: true,
	},
	engine: {
	    opResolution: {
		auto: true
	    }
	},
	job: {
	    config: {
		evalEnabled: true,
		evalType: "text/at-eval",
		importEnabled: true,
		importPath: ["/vendor/m7-js-lib-active-tags/examples/"],
	    },
	},
    });

    lib.service.set("activeTags", AT);
    await AT.start();
    window.AT = AT;
});

