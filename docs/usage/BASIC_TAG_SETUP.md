# Basic Tag Setup — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This page explains how to set up a single ActiveTag element and where its config can come from.
Primary reference example: [../../examples/inject/fromFile/injectFromFile.html](../../examples/inject/fromFile/injectFromFile.html)

`examples/inject/fromFile/injectFromFile.html` shows a minimal active tag with `data-activetag`, `at-name`, and `at-at="import:..."`.

---

## 1) Mark an element as an ActiveTag

At minimum:

```html
<div data-activetag></div>
```

Default selector is `[data-activetag]`.

Runtime flow:

1. `AT.start()` runs an initial `discover.scan()` pass for existing matching elements.
2. If `boot.observeDom` is enabled, the observer starts and handles later DOM mutations.
3. Added/changed matching nodes are registered and autorun is swept.
4. When `observe.runtimeAttach` is enabled (default), newly discovered jobs are also synced into the event and interval controllers, then conditionally turned on using the normal boot gates.
5. Removed/change-away nodes enter the observer detach path.
6. When `observe.runtimeDispose` is enabled (default), runtime event and interval state is cleared before unregister so detached jobs do not leave old bindings behind. When it is disabled, the observer falls back to unregister-only behavior.

Practical note: page-load tags are discovered by the boot scan path, while the observer path is mainly for post-start DOM changes. If `observe.runtimeAttach` is disabled, the observer falls back to the legacy discovery-only behavior on the add side.

---

## 2) Attribute naming: `data-*` and `at-*`

Per-job DOM config reads both prefixes by default:

* `data-*`
* `at-*`

So these are equivalent config pointer styles:

* `data-config-at="..."`
* `at-config-at="..."`

And these are equivalent short pointer styles:

* `data-at="..."`
* `at-at="..."`

Why this works:

* Prefixes come from `AT.conf.job.config.attrPrefixes` (default: `["data-", "at-"]`).
* Attribute keys are inflated by `-` into nested config paths.

Example:

* `data-request-timeout-ms="8000"` becomes `request.timeout.ms`.

---

## 3) Disabling inline attributes during iteration

During local iteration, attributes can be temporarily disabled by prefixing a leading `d` on the attribute name, for example:

```html
<div
  data-activetag
  data-at="import:jumjum.import.js"
  ddata-at="find:.config"
  ddata-at="window:ws.conf.jumjum">
</div>
```

`ddata-*` (or similar) is not a recognized ActiveTags prefix, so it is ignored by config extraction.
This is just an iteration/debug convention to keep alternate references in place without deleting them.

---

## 4) Config source pointers (`config.at` / `at`)

ActiveTags reads config source pointer values from these paths by default:

1. `config.at`
2. `at`

That maps to attributes like:

* `data-config-at` / `at-config-at`
* `data-at` / `at-at`

Each pointer value can contain one or more source tokens.
Tokens are resolved left-to-right and merged in order (later tokens override earlier ones).
This token parsing path is implemented in [../../src/class/job/config/domConfigSource/DomConfigSource.js](../../src/class/job/config/domConfigSource/DomConfigSource.js).
Expression target syntax details are documented in [v1.0 DSL Manual](./DSL_V100.md).

---

## 5) Supported source types

### A) Inline DOM lookup: `find:...`

Example:

```html
<div data-activetag data-config-at="find:.config">
  <script class="config" type="application/json">
    { "name": "demo-job" }
  </script>
</div>
```

`find:.config` resolves relative to the active tag element and can return a DOM node containing config payload.

### B) Environment object lookup: `window:...`

Example:

```html
<div data-activetag data-config-at="window:ws.config.demo"></div>
```

This resolves from the runtime window/root context through the expression resolver.

### C) Module import: `import:...`

Example:

```html
<div data-activetag data-config-at="import:test-job.js"></div>
```

`import:<url>` and `import:<url>#<namedExport>` are supported.
Imports are policy-gated by:

* `job.config.importEnabled`
* `job.config.importPath` allow-list rules

Performance note:

* Import-based config resolution is awaited during job config read/compile.
* If many tags each import config, startup/configuration time can increase.
* For large setups, prefer importing once outside ActiveTags boot and then reference the in-memory object via `window:...` (or equivalent environment path).

See setup example in [../../examples/inject/fromFile/injectFromFile.html](../../examples/inject/fromFile/injectFromFile.html), where config import is enabled with `at-at="import:inject-file.js"`.

### D) DOM node `src` fallback

If a resolved DOM config node has no inline text, ActiveTags will attempt to read `data-src` or `src` and fetch text from there.
This is useful for script-tag style config containers.
For JSON script nodes in particular, this allows config loading even when the browser itself is not executing that script payload.

---

## 6) Layering multiple config sources

You can chain multiple sources in one attribute:

```html
<div
  data-activetag
  data-config-at="window:ws.config.base window:ws.config.testJob import:test-job.js"
  data-name="job-from-inline">
</div>
```

Merge order:

1. Base/default job config
2. Resolved source list (`config.at` / `at`) left-to-right
3. Inline DOM dataset (`data-*`/`at-*`) last

So inline keys are final overrides when the same field appears in multiple layers.

---

## 7) Backend composition options

This setup model supports different server/build patterns:

* Keep config inline with HTML modules/components.
* Keep shared config on globals (`window:...`).
* Load config modules (`import:...`) from local or allowed external paths.
* Layer base + variant sources per tag (for example: `window:ws.config.base window:ws.config.testJob`).

This makes ActiveTags workable across mixed construction styles (for example, PHP-rendered markup, remote config modules, or centrally stored config maps).

---

## 8) Minimal startup policy for basic tag experiments

From [../../examples/tutorial/tutorial.js](../../examples/tutorial/tutorial.js), these runtime options are relevant for config-source behavior:

```js
import { install, SERVICE_ID } from "/vendor/m7-js-lib-active-tags/dist/nomap/activeTags.standalone.v1.0.min.js";

const lib = install({
  conf: {
    boot: {
      observeDom: true,
      events: true,
      intervals: false,
    },
    job: {
      config: {
        evalEnabled: true,
        evalType: "text/at-eval",
        importEnabled: true,
        importPath: ["/vendor/m7-js-lib-active-tags/examples/"],
      },
    },
  }
});

const AT = lib.service.get(SERVICE_ID);
await AT.start();
```

Bundle-first startup is recommended for normal use. Manual `new ActiveTags(lib, conf)` wiring is still available for advanced/manual installs.

---

## 9) Debugging config-read failures quickly

If an external config reference fails (for example bad `find:`, `window:`, or `import:` target), the job still has DOM-derived attributes available.
So in failure cases you often still get inline dataset config, but not the expected external config object.

A practical debugging pattern is to always set a name in DOM attributes:

```html
<div at-name="test-link" at-config-at="xyz"></div>
```

Then inspect directly:

```js
const job = AT.toJob("test-link");
```

Useful report surfaces:

* `job.config.inputs`:
  DOM read snapshot (`dataSet`, `attrs`, resolved `at` list, resolved `config`, merged `output`).
* `job.config.inputs.report`:
  source-read/resolve/parse diagnostics (common place for config source errors).
* `job.config.schemaReport`:
  schema compile/normalization diagnostics (shape/format/data-structure issues after inputs are read).

This split helps you quickly decide if the issue is:

1. Source resolution/loading/parsing (`inputs.report`)
2. Schema structure/typing (`schemaReport`)

---

## See also

* [Quick Start](./QUICKSTART.md)
* [Configuration Model](./CONFIGURATION.md)
* [v1.0 DSL Manual](./DSL_V100.md)
* [Examples Library](./EXAMPLES_LIBRARY.md)
* [../../examples/inject/fromFile/injectFromFile.html](../../examples/inject/fromFile/injectFromFile.html)
* [../../examples/tutorial/tutorial.html](../../examples/tutorial/tutorial.html)
* [../../src/class/job/config/domConfigSource/DomConfigSource.js](../../src/class/job/config/domConfigSource/DomConfigSource.js)
* [Usage TOC](./TOC.md)
* [README](../../README.md)
