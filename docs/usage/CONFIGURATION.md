# Configuration Model — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)


ActiveTags uses two configuration layers.

---

## Layer 1: Runtime config (`AT.conf`)

Compiled by top-level schema compiler:

* [../../src/at_config/Schema.js](../../src/at_config/Schema.js)
* Baseline defaults: [../../src/at_config/DEFAULT_CONFIG.js](../../src/at_config/DEFAULT_CONFIG.js)

This layer controls runtime policy, including:

* environment
* boot behavior
* observer behavior
* logging policy
* engine operation surface and lookup policy
* job config policy defaults

### Runtime `engine` block (`AT.conf.engine`)

Primary implementation sources:

* [../../src/at_config/DEFAULT_CONFIG.js](../../src/at_config/DEFAULT_CONFIG.js)
* [../../src/at_config/Schema.js](../../src/at_config/Schema.js)

Default shape:

```js
engine: {
  builtins: true,
  hooks: false,
  opResolution: {
    order: ["user", "lib", "builtin"],
    auto: true
  }
}
```

#### `engine.builtins`

Compiled as a functions-only builtin map.

Schema semantics:

* `true` -> use default ActiveTags builtins bundle.
* `false` or `null` (user layer) -> disable all builtins (`{}`).
* object -> merged with defaults (user entries win on conflict), then filtered to function values only.
* Non-function values are removed during compile.
* Deep filtering is enabled for builtins (nested namespaces preserved when valid).

Practical references:

* [Builtins & Operations](./OPERATIONS_BUILTINS.md)
* [../../src/builtins/index.js](../../src/builtins/index.js)

#### `engine.hooks`

Compiled as a functions-only hook map.

Schema semantics:

* `true` -> use built-in test hook bundle (`testHooks`).
* `false` or `null` (user layer) -> disable all hooks (`{}`).
* object -> merged with default hooks map, then filtered to function values only.
* Omitted `engine.hooks` keeps compiled default behavior (from default config; currently `false`).

Canonical hook keys:

* `onEnqueue`
* `onDequeue`
* `onStage`
* `onComplete`
* `onError`
* `onTicketDone`

Practical references:

* [Engine Event Hooks](./ENGINE_HOOKS.md)
* [../../src/class/engine/testHooks.js](../../src/class/engine/testHooks.js)

#### `engine.opResolution`

Controls symbolic operation lookup for non-explicit steps.

Shape:

```js
opResolution: {
  order: ["user", "lib", "builtin"], // allowed tokens: "user" | "lib" | "builtin"
  auto: true
}
```

Compile normalization:

* `order` entries are lowercased, filtered to valid tokens, and de-duped in stable order.
* Invalid/empty `order` falls back to `["user", "lib", "builtin"]`.
* `auto` defaults to `true` when omitted.

Runtime behavior:

* Explicit builtin steps (`@foo.bar` or `{ builtin: true }`) use builtin-only lookup.
* Non-explicit steps with `auto: true` use ordered lookup from `order`.
* Non-explicit steps with `auto: false` resolve user handlers only.

Strict mode note:

* Using `auto: false` can improve deterministic resolution and reduce fallback work.
* Pair strict mode with `engine.hooks.onError` (and ideally `onTicketDone`) so unresolved-op failures are visible in logs/telemetry.

Related:

* [Pipelines](./PIPELINES.md)
* [Builtins & Operations](./OPERATIONS_BUILTINS.md)
* [Pipeline Handlers](./PIPELINE_HANDLERS.md)

---

## Layer 2: Per-job config (`job.config.schema`)

Compiled per discovered element through:

* [../../src/class/job/config/JobConfig.js](../../src/class/job/config/JobConfig.js)
* [../../src/class/job/config/domConfigSource/DomConfigSource.js](../../src/class/job/config/domConfigSource/DomConfigSource.js)
* [../../src/class/job/config/schema/Master.js](../../src/class/job/config/schema/Master.js)

This layer produces normalized job-level schema blocks (pipelines, events, intervals, requests).

---

## What is inside one job config

This page explains compile model and source layering.
For key-by-key shape documentation, use:

* [Top-Level Job Config](./TOP_LEVEL_CONFIG.md)
* [Basics](./BASICS.md)
* [Pipelines](./PIPELINES.md)
* [Events](./EVENTS.md)
* [Intervals](./INTERVALS.md)
* [Requests](./REQUESTS.md)

---

## Merge posture

Top-level and per-job compilation both follow coercion/normalization-first posture:

* normalize shape
* compile deterministic output
* preserve warnings/errors in report objects

---

## Config sources in practice

For job config, effective input can include:

* default base policy from runtime config
* DOM data attributes
* config references (`data-config-at`/`at` path)
* optional eval/import paths (policy gated)

See repository example: [../../examples/tutorial/tutorial-job.js](../../examples/tutorial/tutorial-job.js)

---

## Key takeaway

Treat compiled outputs as source of truth:

* `AT.conf` for runtime behavior
* `job.config.schema` for job behavior

Avoid reading uncompiled raw inputs for runtime decisions.

---

## Related

* Top-level job shape -> [TOP_LEVEL_CONFIG.md](./TOP_LEVEL_CONFIG.md)
* Basics -> [BASICS.md](./BASICS.md)
* Builtins & operations -> [OPERATIONS_BUILTINS.md](./OPERATIONS_BUILTINS.md)
* Engine event hooks -> [ENGINE_HOOKS.md](./ENGINE_HOOKS.md)
* Pipelines -> [PIPELINES.md](./PIPELINES.md)
* Events -> [EVENTS.md](./EVENTS.md)
* Intervals -> [INTERVALS.md](./INTERVALS.md)
* Requests -> [REQUESTS.md](./REQUESTS.md)
* Runtime lifecycle -> [RUNTIME_LIFECYCLE.md](./RUNTIME_LIFECYCLE.md)
* Architecture -> [../architecture/INDEX.md](../architecture/INDEX.md)

---

## See also

* [Usage TOC](./TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)
