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

If you use the versioned standalone bundle, these prerequisites are installed automatically during `install({ conf })`.

---

## Module entry choices

### Recommended: versioned standalone bundle

```js
import { install, SERVICE_ID, VERSION } from "/vendor/m7-js-lib-active-tags/dist/activeTags.standalone.v1.0.min.js";

const lib = install({
  conf: {
    boot: {
      events: true,
      intervals: true,
      observeDom: true,
    },
  },
});

const AT = lib.service.get(SERVICE_ID);
if (!AT) throw new Error(`missing ActiveTags service '${SERVICE_ID}'.`);

await AT.start();
console.log("ActiveTags version:", VERSION);
```

Use this as the default integration path.

### Advanced/manual source entry: class-level

```js
import ActiveTags from "../../src/ActiveTags.js";
```

This path requires you to provide and manage a correctly-wired `lib` + services yourself.

### Advanced/manual source entry: standalone barrel

```js
import {
  lib,
  ActiveTags,
  createActiveTags,
  startActiveTags,
  VERSION
} from "../../src/standalone/index.js";
```

`src/standalone/index.js` exports:

* `lib` (best-effort `globalThis.lib`, may be `null`)
* `ActiveTags`
* `CONSTANTS`
* `VERSION`
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
  SERVICE_ID,
  VERSION,
  install
} from "../../src/standalone/prebundle.js";
```

Equivalent raw imports (before bundling/minification, manual build flow):

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
const runtimeLib = install({
  conf: {
    boot: { events: true, intervals: true, observeDom: true }
  }
});
const AT = runtimeLib.service.get(SERVICE_ID);
await AT.start();
```

If you want direct control in standalone mode, call `install({ conf })` and fetch the service by `SERVICE_ID`:

```js
const runtimeLib = install({
  conf: {
    boot: { events: true, intervals: true, observeDom: true }
  }
});
const AT = runtimeLib.service.get(SERVICE_ID);
```

Manual bundle/minify example (versioned standalone artifact):

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

* [../../examples/inject/fromFile/injectFromFile.html](../../examples/inject/fromFile/injectFromFile.html)

This file demonstrates dist-first standalone boot with a runtime toggle.

---

## Environment assumptions

* Modern browser with ES module support
* DOM available (`document`, `MutationObserver` via observer service)
* Services pre-registered in `lib` before runtime construction

---

## Verification checklist

Before starting runtime, verify:

* bundle path is valid (`dist/activeTags.standalone.v1.0.min.js`)
* service instance resolves (`lib.service.get(SERVICE_ID)`)
* page runs in ESM mode (`<script type="module">`)

For manual/source installs, verify:

* a valid `lib` instance is available in scope for `new ActiveTags(lib, ...)`
* `lib.require.all(...)` can resolve dependencies
* `lib.require.service(...)` returns all required services

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
