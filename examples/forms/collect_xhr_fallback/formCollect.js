/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

import {lib, init as initLib}   from  "/vendor/m7-js-lib/src/index.js";
import ActiveTags               from  "/vendor/m7-js-lib-active-tags/src/ActiveTags.js";
import installDomChangeObserver from  "/vendor/m7-js-lib-primitive-dom-changeobserver/src/install.js";
import installEventDelegator    from  "/vendor/m7-js-lib-primitive-dom-eventdelegator/src/install.js";
import installLog               from  "/vendor/m7-js-lib-primitive-log/src/install.js";
import installInterval          from  "/vendor/m7-js-lib-primitive-interval/src/install.js";
import installTree              from  "/vendor/m7-js-lib-tree/src/install.js";

initLib();

const formCollectAutoDeps = [];

async function loadFormCollectDeps() {
    for (const modPath of formCollectAutoDeps) {
        await import(modPath);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadFormCollectDeps();

    installTree(lib);
    installInterval(lib);
    installLog(lib, {
        host: window,
        root: window,
        managerOptions: { lib },
    });
    installDomChangeObserver(lib, { host: window, root: document.body, start: true });
    installEventDelegator(lib, { host: window, root: document, start: true });

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
