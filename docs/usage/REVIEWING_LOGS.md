# Reviewing Logs — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This page covers how to review ActiveTags runtime logs.

Primary source files:

* [../../src/at_config/DEFAULT_CONFIG.js](../../src/at_config/DEFAULT_CONFIG.js)
* [../../src/ActiveTags.js](../../src/ActiveTags.js)

---

## 1) Logging package scope

ActiveTags logging is backed by a separate logger package (`primitive.log`).

Full logger API details live in that package repository:

* Placeholder repo: `(xyz)`

This page focuses only on how ActiveTags integrates with it.

---

## 2) Accessing the logger service

You can access the logger directly from `lib`:

```js
const log = lib.service.get("primitive.log");
```

Or from the ActiveTags instance:

```js
const log = AT.svc.log;
```

Both refer to the same service when wiring is correct.

---

## 3) ActiveTags log config and buckets

ActiveTags top-level config includes:

```js
log: {
  enabled: true,

  policy: {
    console: "warn",   // warn | error | info | log (as supported by lib logger)
    trace: false       // pipeline / VM trace output
  },

  // Logging buckets are created if not already present.
  // Advanced projects may customize these.
  buckets: {
    ROOT:     "activetags",
    CONFIG:   "activetags.config",
    RUNTIME:  "activetags.runtime",
    PIPELINE: "activetags.pipeline",
  }
}
```

At startup, ActiveTags creates these buckets when:

* `AT.svc.log` exists, and
* `log.enabled` is true.

---

## 4) Setting log behavior during setup

Example:

```js
import { install, SERVICE_ID } from "/vendor/m7-js-lib-active-tags/dist/activeTags.standalone.v1.0.min.js";

const lib = install({
  conf: {
    log: {
      enabled: true,
      policy: {
        console: "info",
        trace: false
      },
      buckets: {
        ROOT: "activetags",
        CONFIG: "activetags.config",
        RUNTIME: "activetags.runtime",
        PIPELINE: "activetags.pipeline"
      }
    },
  }
});

const AT = lib.service.get(SERVICE_ID);
await AT.start();
```

---

## 5) Quick review flow

1. Confirm logger service is available:
   `lib.service.get("primitive.log")`
2. Confirm ActiveTags logger handle exists:
   `AT.svc.log`
3. Set `log.enabled: true` and a visible console level (`info` or `log`) during debugging.
4. Start ActiveTags and reproduce the behavior you want to inspect.
5. Review console output grouped by ActiveTags bucket names (`activetags.*`).

---

## See also

* [Installation & Dependencies](./INSTALLATION.md)
* [Runtime Lifecycle](./RUNTIME_LIFECYCLE.md)
* [Troubleshooting](./TROUBLESHOOTING.md)
* [Usage TOC](./TOC.md)
* [README](../../README.md)
