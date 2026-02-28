# Installation & Dependencies — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)


ActiveTags is a browser-oriented runtime module.

For canonical dependency/version requirements, see:

* [REQUIREMENTS.md](./REQUIREMENTS.md)

---

## Required runtime surface

ActiveTags requires:

1. A valid m7 `lib` instance (import, DI container, or any stored variable)
2. Core utility dependencies:
   * `hash`
   * `primitive.workspace`
   * `dom`
   * `str.interp`
3. Core services:
   * `primitive.dom.eventdelegator`
   * `primitive.interval`
   * `primitive.dom.changeobserver`
   * `primitive.log`

Service keys are defined in: [../../src/constants.js](../../src/constants.js)

---

## Module entry choices

### Primary runtime class

```js
import ActiveTags from "../../src/ActiveTags.js";
```

### Standalone barrel entry (preview)

```js
import {
  lib,
  ActiveTags,
  createActiveTags,
  startActiveTags
} from "../../src/standalone/index.js";
```

`src/standalone/index.js` exports:

* `lib` (best-effort `globalThis.lib`, may be `null`)
* `ActiveTags`
* `CONSTANTS`
* `resolveStandaloneLib(opts?)`
* `createActiveTags(conf?, opts?)`
* `startActiveTags(conf?, opts?)`

Basic startup:

```js
const { AT } = await startActiveTags({
  boot: { events: true, intervals: true, observeDom: true }
});
```

### Monorepo prebundle entry (single-blob target)

If you want one bundled/minified distributable that includes `lib`,
ActiveTags, and primitive installers, use:

```js
import {
  lib,
  initLib,
  ActiveTags,
  VERSION,
  installDomChangeObserver,
  installEventDelegator,
  installLog,
  installInterval,
  installAll,
  createActiveTags,
  startActiveTags
} from "../../src/standalone/prebundle.js";
```

Equivalent raw imports (before bundling/minification):

```js
import { lib, init as initLib } from "/vendor/m7-js-lib/src/index.js";
import ActiveTags from "/vendor/m7-js-lib-active-tags/src/ActiveTags.js";
import installDomChangeObserver from "/vendor/m7-js-lib-primitive-dom-changeobserver/src/install.js";
import installEventDelegator from "/vendor/m7-js-lib-primitive-dom-eventdelegator/src/install.js";
import installLog from "/vendor/m7-js-lib-primitive-log/src/install.js";
import installInterval from "/vendor/m7-js-lib-primitive-interval/src/install.js";
```

One-call boot path:

```js
const { AT } = await startActiveTags({
  boot: { events: true, intervals: true, observeDom: true }
});
```

If you want direct control, `installAll()` returns the lib instance.
You can assign it to `window.lib` on DOM ready:

```js
const runtimeLib = installAll();

document.addEventListener("DOMContentLoaded", () => {
  window.lib = runtimeLib;
}, { once: true });
```

Bundle/minify example (versioned standalone artifact):

```bash
scripts/build-standalone.sh --with-map
```

This emits `dist/activeTags.standalone.v<version>.min.js` (plus `.LEGAL.txt` and optional `.map`).
See [BUNDLING.md](./BUNDLING.md) for full release workflow.

### Auto-registration entry

```js
import "../../src/auto.js";
```

`auto.js` registers `ActiveTags` at `lib.app.ActiveTags`.

---

## Example dependency boot sequence

Reference implementation:

* [../../examples/test1.html](../../examples/test1.html)

This file demonstrates loading supporting m7 modules before creating `ActiveTags`.

---

## Environment assumptions

* Modern browser with ES module support
* DOM available (`document`, `MutationObserver` via observer service)
* Services pre-registered in `lib` before runtime construction

---

## Verification checklist

Before calling `new ActiveTags(...)`, verify:

* a valid `lib` instance is available in scope for `new ActiveTags(lib, ...)`
* `lib.require.all(...)` can resolve dependencies
* `lib.require.service(...)` returns all required services

If any dependency is missing, constructor/startup will throw.

---

## Related

* Quick start -> [QUICKSTART.md](./QUICKSTART.md)
* Troubleshooting -> [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## See also

* [Usage TOC](./TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)
