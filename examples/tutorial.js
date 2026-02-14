import lib from "/vendor/m7-js-lib/src/index.js";
import ActiveTags from "/vendor/m7-js-lib-active-tags/src/ActiveTags.js";
import testPipes from "./testPipe.js";

window.lib = lib;
window.testPipes = testPipes;
window.ActiveTags = ActiveTags;

const tutorialDeps = [
  "/vendor/m7-js-lib-tree/src/auto.js",
  "/vendor/m7-js-workspace/src/auto.js",
  "/vendor/m7-js-lib-primitive-log/src/auto.js",
  "/vendor/m7-js-lib-interval/src/auto.js",
  "/vendor/m7-js-lib-str-interp/src/auto.js",
  "/vendor/m7-js-lib-primitive-dom-eventdelegator/src/auto.js",
  "/vendor/m7-js-lib-primitive-dom-changeobserver/src/auto.js",
  "/vendor/m7-js-lib-site-form/src/auto.js",
];

async function loadTutorialDeps() {
  // Keep order aligned with the prior HTML script sequence.
  for (const modPath of tutorialDeps) {
    await import(modPath);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadTutorialDeps();

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
  window.AT = AT;

  await AT.start();
});
