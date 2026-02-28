# Quick Start — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)


This guide gets you from zero to a running ActiveTags instance quickly.

---

## 1) Import the release bundle

Use the standalone release bundle for normal integration:

```js
import { install, SERVICE_ID } from "/vendor/m7-js-lib-active-tags/dist/activeTags.standalone.v1.0.min.js";
```

This bundle includes m7 lib + ActiveTags + required primitive installers.

---

## 2) Install with config

```js
const lib = install({
  conf: {
    boot: {
      observeDom: true,
      events: true,
      intervals: true,
    },
  },
});

const AT = lib.service.get(SERVICE_ID);
if (!AT) throw new Error(`missing ActiveTags service '${SERVICE_ID}'.`);
```

Install performs:

* standalone primitive setup
* ActiveTags namespace install (`lib.app.ActiveTags`)
* ActiveTags service install (`lib.service.get(SERVICE_ID)`)
* ActiveTags instance construction with your `conf`

No discovery or runtime triggers are active yet.

---

## 3) Start runtime

```js
await AT.start();
```

`start()` performs:

* initial DOM scan via discover controller
* optional observer start
* event/interval registration
* event/interval activation per boot flags

---

## 4) Mark active elements

At minimum, ActiveTags scans for:

```html
<div data-activetag></div>
```

Default selector is configured in top-level schema (`boot.selector`).

---

## 5) Validate with repository example

Use these files as first references:

* Inject example -> [../../examples/inject/fromFile/injectFromFile.html](../../examples/inject/fromFile/injectFromFile.html)
  Demonstrates: event handling (`click`), `http.send` request usage, and DOM patching via `target.find` + `target.patch`.
* Stock ticker example -> [../../examples/stockTicker/stockTicker.html](../../examples/stockTicker/stockTicker.html)
  Demonstrates: multi-job coordination, auth-gated UI behavior, event-driven trade actions, and interval-driven quote updates.
* Headless jobs example -> [../../examples/headlessJobs/headlessJobs.html](../../examples/headlessJobs/headlessJobs.html)
  Demonstrates: `AT.runtime.createHeadlessJob(...)`, programmatic interval control (`on/off`), and manual enqueue/drain ticks.

These examples default to the versioned dist bundle and support `?runtime=dev` for source debugging.

---

## Next steps

* Basic tag setup -> [BASIC_TAG_SETUP.md](./BASIC_TAG_SETUP.md)
* Configuration guide -> [CONFIGURATION.md](./CONFIGURATION.md)
* Pipelines guide -> [PIPELINES.md](./PIPELINES.md)
* Events guide -> [EVENTS.md](./EVENTS.md)
* Intervals guide -> [INTERVALS.md](./INTERVALS.md)
* Requests guide -> [REQUESTS.md](./REQUESTS.md)
* Runtime lifecycle -> [RUNTIME_LIFECYCLE.md](./RUNTIME_LIFECYCLE.md)
* Builtins guide -> [OPERATIONS_BUILTINS.md](./OPERATIONS_BUILTINS.md)
* API index -> [../api/INDEX.md](../api/INDEX.md)

---

## See also

* [Usage TOC](./TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)
