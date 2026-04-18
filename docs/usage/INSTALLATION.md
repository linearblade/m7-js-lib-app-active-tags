# Installation & Dependencies — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)


ActiveTags is a browser-oriented runtime module.

> [!IMPORTANT]
> ActiveTags has multiple dependencies when installed from source.
> For fastest startup, use the versioned minified standalone bundle, which includes m7 lib, required primitives, and the ActiveTags install flow.
> Jump to [Recommended: versioned standalone bundle](#recommended-versioned-standalone-bundle).

For canonical dependency/version requirements, see:

* [REQUIREMENTS.md](./REQUIREMENTS.md)

---

## Required runtime surface

ActiveTags requires:

1. A valid m7 `lib` instance (import, DI container, or any stored variable)
2. Core utility dependencies:
   * `hash`
   * `dom`
   * `str.interp`
   * `primitive.workspace` (optional; not currently enforced by ActiveTags core dependency checks)
3. Core services:
   * `primitive.dom.eventdelegator`
   * `primitive.interval`
   * `primitive.dom.changeobserver`
   * `primitive.log`

Service keys are defined in: [../../src/constants.js](../../src/constants.js)

If you use the versioned standalone bundle, these prerequisites are installed automatically during `install({ conf })`.

Dependency repository locations (manual/source install paths):

* [m7-js-lib](https://github.com/linearblade/m7-js-lib)
* [m7-js-lib-primitive-dom-changeobserver](https://github.com/linearblade/m7-js-lib-primitive-dom-changeobserver)
* [m7-js-lib-primitive-dom-eventdelegator](https://github.com/linearblade/m7-js-lib-primitive-dom-eventdelegator)
* [m7-js-lib-primitive-interval](https://github.com/linearblade/m7-js-lib-primitive-interval)
* [m7-js-lib-primitive-log](https://github.com/linearblade/m7-js-lib-primitive-log)

---

## Module entry choices

### Recommended: versioned standalone bundle

```js
import { install, SERVICE_ID, VERSION } from "/vendor/m7-js-lib-active-tags/dist/nomap/activeTags.standalone.v1.0.min.js";

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

### Standalone feature flags

The standalone `install(opts)` wrapper can also install bundled navigation helpers.
Both are off by default.

* `popstate: false`
  Enable with `true` or pass an options object to install `app.popstatemanager`.
* `spa: false`
  Enable with `true` or pass an options object to install `app.singlepageapp`
  using the SinglePageApp `basic` setup.
* `spa` implies `popstate`
  When `spa` is enabled, standalone install ensures popstate is installed first.

Examples:

```js
const lib = install({
  conf: {
    boot: {
      events: true,
      intervals: true,
      observeDom: true,
    },
  },
});
```

```js
const lib = install({
  conf: { /* ActiveTags config */ },
  popstate: true,
});
```

```js
const lib = install({
  conf: { /* ActiveTags config */ },
  spa: true,
});
```

```js
const lib = install({
  conf: { /* ActiveTags config */ },
  popstate: true,
  spa: {
    enabled: true,
    popstateKey: "spa-link",
    linkSelector: "a.spa-link[href]",
    sourceSelector: "#main",
    targetSelector: "#main",
  },
});
```

Notes:

* `spa: true` uses the bundled SinglePageApp `basic` installer with its defaults.
* `spa: { ... }` passes your options through to that `basic` installer.
* `popstate: { ... }` passes your options through to the PopStateManager installer.
* `host` / `root` are inferred from the bundled lib environment or `window` when possible.

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
scripts/build-dist.sh
```

This emits `dist/nomap/activeTags.standalone.v<version>.min.js` and `dist/map/activeTags.standalone.v<version>.min.js` (plus matching `.LEGAL.txt` files and the sourcemap under `dist/map`).
See [BUNDLING.md](./BUNDLING.md) for full release workflow.

## Example dependency boot sequence

Reference implementation:

* [../../examples/inject/fromFile/injectFromFile.html](../../examples/inject/fromFile/injectFromFile.html)

This file demonstrates dist-first standalone boot with a runtime toggle.

---

## Environment assumptions

* Modern browser with ES module support
* DOM available (`document`, `MutationObserver` via observer service)
* For standalone dist install: required services are installed/validated by `install({ conf })`
* For manual/class installs: required services must be pre-registered in `lib` before runtime construction

---

## Verification checklist

Before starting runtime, verify:

* bundle path is valid (`dist/nomap/activeTags.standalone.v1.0.min.js`)
* service instance resolves (`lib.service.get(SERVICE_ID)`)
* page runs in ESM mode (`<script type="module">`)
* for releases/commits, run `sh scripts/release-check.sh` (see [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md))

For manual/source installs, verify:

* a valid `lib` instance is available in scope for `new ActiveTags(lib, ...)`
* `lib.require.all(...)` can resolve dependencies
* `lib.require.service(...)` returns all required services

---

## Related

* Quick start -> [QUICKSTART.md](./QUICKSTART.md)
* Release checklist -> [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)
* Troubleshooting -> [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## See also

* [Usage TOC](./TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)
