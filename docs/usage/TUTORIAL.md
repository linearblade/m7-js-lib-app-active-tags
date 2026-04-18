# Tutorial — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This tutorial is a practical end-to-end build path for ActiveTags v1.0.

You will build a small interactive component and progressively add:

1. runtime install/start
2. a real ActiveTag job
3. console validation
4. interval-driven updates
5. event-driven interactions
6. advanced buffer/target + request flow

This tutorial uses the versioned standalone minified bundle for fastest setup.

Complete runnable tutorial example:

* [../../examples/tutorial/tutorial.html](../../examples/tutorial/tutorial.html)

This runnable example includes a startup marker job (`tutorial-loaded`) that writes `ActiveTags loaded.` once immediately after `AT.start()`.

---

## 1) ActiveTags setup

Create an HTML file (for example `tutorial.html`) with one module script.

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>ActiveTags Tutorial</title>
  </head>
  <body>
    <div data-activetag at-name="tutorial-loaded" at-at="import:tutorial-loaded-job.js">
      waiting for ActiveTags...
    </div>
    <div data-activetag at-name="tutorial-counter" at-at="import:tutorial-job.js"></div>

    <script type="module">
      import { install, SERVICE_ID } from "/vendor/m7-js-lib-active-tags/dist/nomap/activeTags.standalone.v1.0.min.js";

      const conf = {
        boot: {
          observeDom: true,
          events: true,
          intervals: true,
        },
        engine: {
          opResolution: {
            auto: true,
          },
        },
        job: {
          config: {
            evalEnabled: true,
            evalType: "text/at-eval",
            importEnabled: true,
            importPath: ["/vendor/m7-js-lib-active-tags/examples/"],
          },
        },
      };

      const lib = install({ conf });
      const AT = lib.service.get(SERVICE_ID);
      if (!AT) throw new Error(`missing ActiveTags service '${SERVICE_ID}'.`);

      await AT.start();

      // one-time startup marker run
      const loadedJob = AT.toJob("tutorial-loaded");
      if (loadedJob) {
        const ticket = AT.engine.enqueue(loadedJob, "default", {
          inputs: { reason: "tutorial.startup" },
          meta: { source: "tutorial-example" },
        });
        if (ticket) await AT.engine.drain({ ticket });
      }

      // Optional console helpers while learning.
      window.lib = lib;
      window.AT = AT;
    </script>
  </body>
</html>
```

What this gives you:

* all required primitives installed automatically via standalone install
* ActiveTags installed to namespace (`lib.app.ActiveTags`) and service (`lib.service.get(SERVICE_ID)`)
* runtime booted and ready to discover `data-activetag` elements
* visible startup confirmation (`tutorial-loaded` writes `ActiveTags loaded.`)

---

## 2) Defining some tags

Define two tags: one startup marker tag and one interactive counter tag.

```html
<div data-activetag at-name="tutorial-loaded" at-at="import:tutorial-loaded-job.js" class="tutorial-loaded-flag">
  waiting for ActiveTags...
</div>

<div data-activetag at-name="tutorial-counter" at-at="import:tutorial-job.js">
  <section class="tutorial-host">
    <h2>Counter Tutorial</h2>
    <p>Count: <strong class="tutorial-count">0</strong></p>

    <div class="tutorial-actions">
      <button type="button" data-inc>Increment</button>
      <button type="button" data-reset>Reset</button>
      <button type="button" data-load-fragment>Load Fragment</button>
    </div>

    <div class="tutorial-fragment">
      Fragment output appears here.
    </div>
  </section>
</div>
```

Key points:

* `data-activetag` marks discoverable job roots.
* `tutorial-loaded` is a simple startup marker job.
* `tutorial-counter` is the interactive tutorial job.
* `at-at="import:..."` resolves both module configs from the example directory.

---

## 3) Adding basic configs

Create `tutorial-job.js` next to the HTML file.

```js
function readCounter({ job, lib, buffer } = {}) {
  const ws = job && job.ws ? job.ws : {};
  const count = Number(lib.hash.get(ws, "counter.value"));
  const safe = Number.isFinite(count) ? count : 0;

  if (buffer && typeof buffer.set === "function") {
    buffer.set({ count: safe }, { source: "readCounter" });
  }

  return true;
}

export default {
  name: "tutorial-counter",
  enabled: true,
  autorun: true,

  pipeline: {
    run: [
      readCounter,
      "@target.find:selector=.tutorial-count,reset=true",
      "@target.patch:textContent=${buffer:count}",
      "@target.reset",
    ],
    error: ["@error.dump"],
  },
};
```

Create `tutorial-loaded-job.js` for the startup marker:

```js
function markLoaded({ job } = {}) {
  const root = job && job.e;
  if (!root) return true;
  root.innerHTML = "ActiveTags loaded.";
  return true;
}

export default {
  name: "tutorial-loaded",
  enabled: true,
  autorun: false,
  pipeline: {
    run: [markLoaded],
    error: ["@error.dump"],
  },
};
```

Why this is useful:

* You are already using the v1.0 op DSL (`;` row delimiter, `,` arg delimiter, `key=value` args).
* You are using explicit builtin markers (`@...`) for deterministic builtin lookup.
* You are using the core conveyor pattern:
  * data in `buffer`
  * DOM pointer in `target`

---

## 4) Running basic validation in console

After page load, run these checks in DevTools:

```js
lib.service.list();
```

You should see primitive services plus `app.activetags`.

```js
const loaded = AT.toJob("tutorial-loaded");
loaded && loaded.e && loaded.e.textContent;
// expected: "ActiveTags loaded."
```

```js
const job = AT.toJob("tutorial-counter");
job;
job.config.schema;
```

Manual pipeline execution test:

```js
const ticket = AT.engine.enqueue(job, "default", {
  inputs: { reason: "manual" },
  meta: { source: "tutorial-console" },
});
await AT.engine.drain({ ticket });
```

If this works, your install + discovery + pipeline execution loop is healthy.

---

## 5) Adding intervals

Now evolve `tutorial-job.js` so the count increments every second.

```js
function getCounter({ job, lib } = {}) {
  const ws = job && job.ws ? job.ws : {};
  const count = Number(lib.hash.get(ws, "counter.value"));
  return Number.isFinite(count) ? count : 0;
}

function setCounter({ job, lib, value } = {}) {
  const ws = job && job.ws ? job.ws : {};
  lib.hash.set(ws, "counter.value", Number(value) || 0);
  return true;
}

function incrementCounter({ job, lib } = {}) {
  const next = getCounter({ job, lib }) + 1;
  return setCounter({ job, lib, value: next });
}

function renderCounter({ job, lib, buffer } = {}) {
  const count = getCounter({ job, lib });
  buffer.set({ count }, { source: "renderCounter" });
  return true;
}

export default {
  name: "tutorial-counter",
  enabled: true,
  autorun: true,

  pipeline: {
    run: [
      renderCounter,
      "@target.find:selector=.tutorial-count,reset=true",
      "@target.patch:textContent=${buffer:count}",
      "@target.reset",
    ],
    error: ["@error.dump"],
  },

  pipelines: {
    tick: {
      run: [
        incrementCounter,
        renderCounter,
        "@target.find:selector=.tutorial-count,reset=true",
        "@target.patch:textContent=${buffer:count}",
        "@target.reset",
      ],
      error: ["@error.dump"],
    },
  },

  interval_shape: {
    allowOverlap: false,
    onError: "continue",
  },
  intervals: {
    tick: {
      repeat: 1000,
      pipeline: "tick",
    },
  },
};
```

Note: interval bindings are registered and started by `AT.start()` when `boot.intervals` is enabled.

---

## 6) Adding events

Add click-driven controls to increment and reset.

Update pipelines/events in `tutorial-job.js`:

```js
function resetCounter({ job, lib } = {}) {
  return setCounter({ job, lib, value: 0 });
}

export default {
  // ...same base keys

  pipeline: {
    run: [
      renderCounter,
      "@target.find:selector=.tutorial-count,reset=true",
      "@target.patch:textContent=${buffer:count}",
      "@target.reset",
    ],
    error: ["@error.dump"],
  },

  pipelines: {
    increment: {
      run: [
        incrementCounter,
        renderCounter,
        "@target.find:selector=.tutorial-count,reset=true",
        "@target.patch:textContent=${buffer:count}",
        "@target.reset",
      ],
      error: ["@error.dump"],
    },
    reset: {
      run: [
        resetCounter,
        renderCounter,
        "@target.find:selector=.tutorial-count,reset=true",
        "@target.patch:textContent=${buffer:count}",
        "@target.reset",
      ],
      error: ["@error.dump"],
    },
    tick: {
      run: [
        incrementCounter,
        renderCounter,
        "@target.find:selector=.tutorial-count,reset=true",
        "@target.patch:textContent=${buffer:count}",
        "@target.reset",
      ],
      error: ["@error.dump"],
    },
  },

  events: {
    inc_click: {
      event: "click",
      selector: "[data-inc]",
      pipeline: "increment",
    },
    reset_click: {
      event: "click",
      selector: "[data-reset]",
      pipeline: "reset",
    },
  },

  intervals: {
    tick: {
      repeat: 1000,
      pipeline: "tick",
      allowOverlap: false,
      onError: "continue",
    },
  },
};
```

At this point you have both trigger classes working together:

* interval triggers for autonomous updates
* event triggers for user-driven updates

---

## 7) Advanced

### A) Add request + buffer + target chain

A common pattern:

1. `@http.send` loads content/data into `buffer`
2. `@target.find` points to a target node
3. `@target.patch` writes output

Example stage row:

```js
"@http.send:name=fragment,url=./fragment.html;@target.find:selector=.tutorial-fragment,reset=true;@target.patch:innerHTML=${buffer};@target.reset"
```

### B) Runtime control APIs

You can toggle bindings at runtime without changing config:

```js
const job = AT.toJob("tutorial-counter");

AT.intervals.off(job, "tick");   // pause interval
AT.intervals.on(job, "tick");    // resume interval

AT.events.off(job, "inc_click"); // disable increment button handler
AT.events.on(job, "inc_click");  // re-enable
```

### C) Learn from canonical repository examples

* Complete tutorial reference implementation: [../../examples/tutorial/tutorial.html](../../examples/tutorial/tutorial.html)
* Inject flow (`http.send` + target patch): [../../examples/inject/fromFile/injectFromFile.html](../../examples/inject/fromFile/injectFromFile.html)
* Multi-job auth/event/interval composition: [../../examples/stockTicker/stockTicker.html](../../examples/stockTicker/stockTicker.html)
* Headless jobs + interval control: [../../examples/headlessJobs/headlessJobs.html](../../examples/headlessJobs/headlessJobs.html)

---

## See also

* [Quick Start](./QUICKSTART.md)
* [Installation & Dependencies](./INSTALLATION.md)
* [Basic Tag Setup](./BASIC_TAG_SETUP.md)
* [Pipelines](./PIPELINES.md)
* [Pipeline Handlers](./PIPELINE_HANDLERS.md)
* [Events](./EVENTS.md)
* [Intervals](./INTERVALS.md)
* [Builtins & Operations](./OPERATIONS_BUILTINS.md)
* [v1.0 DSL Manual](./DSL_V100.md)
* [Usage TOC](./TOC.md)
* [README](../../README.md)
