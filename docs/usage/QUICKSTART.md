# Quick Start — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)


This guide gets you from zero to a running ActiveTags instance quickly.

---

## 1) Load required dependencies

ActiveTags expects a valid `lib` instance plus required services to be available.
The `lib` reference can come from an import, DI container, or any stored variable.

In this repository's example setup, service modules are loaded before ActiveTags:

* event delegator
* interval manager
* DOM change observer
* log service
* form service
* interpolation helper

See: [../../examples/test1.html](../../examples/test1.html)

---

## 2) Import and construct

```js
import ActiveTags from "../../src/ActiveTags.js";
import lib from "/m7-js-lib/...";

const AT = new ActiveTags(lib, {
  boot: {
    observeDom: true,
    events: true,
    intervals: true,
  }
});
```

Construction performs:

* top-level config compilation
* service resolution
* subsystem instantiation

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

* Boot page -> [../../examples/test1.html](../../examples/test1.html)
* Example config -> [../../examples/test-job.js](../../examples/test-job.js)
* Example pipelines -> [../../examples/testPipe.js](../../examples/testPipe.js)

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
