# Standalone Bundling

[README](../../README.md) -> [Usage TOC](./TOC.md)

This guide documents how to produce the standalone distribution pair:

* `dist/nomap/activeTags.standalone.v<version>.min.js`
* `dist/nomap/activeTags.standalone.v<version>.min.js.LEGAL.txt`
* `dist/map/activeTags.standalone.v<version>.min.js`
* `dist/map/activeTags.standalone.v<version>.min.js.LEGAL.txt`
* `dist/map/activeTags.standalone.v<version>.min.js.map`

The bundle entry is:

* [../../src/standalone/prebundle.js](../../src/standalone/prebundle.js)

---

## Goal

Generate one minified ESM file that includes:

1. `m7-js-lib`
2. ActiveTags
3. Required primitive installers used by standalone install

---

## Build command

From repo root:

```bash
scripts/build-dist.sh
```

Current release version is read from:

* [../../VERSION](../../VERSION)

For this repository right now, that yields:

* `dist/nomap/activeTags.standalone.v1.0.min.js`
* `dist/nomap/activeTags.standalone.v1.0.min.js.LEGAL.txt`
* `dist/map/activeTags.standalone.v1.0.min.js`
* `dist/map/activeTags.standalone.v1.0.min.js.LEGAL.txt`
* `dist/map/activeTags.standalone.v1.0.min.js.map`

Manual nomap-only build:

```bash
scripts/build-standalone.sh --out-dir dist/nomap
```

Manual map build:

```bash
scripts/build-standalone.sh --out-dir dist/map --with-map
```

Build details:

* Entry: [../../src/standalone/prebundle.js](../../src/standalone/prebundle.js)
* Bundler: `esbuild@0.27.3` via `npx`
* Minification: enabled
* Legal comments: preserved via `--legal-comments=linked`
* Bundle banner: injected at top of JS (`@license` + SPDX line)
* Non-legal comments: stripped by minifier
* Output naming: versioned only (`activeTags.standalone.v<version>.min.js`)
* Output layout: `dist/nomap` for runtime bundles without sourcemaps, `dist/map` for sourcemap-enabled artifacts

---

## Release gate

Before tagging/publishing, run:

```bash
sh scripts/release-check.sh
```

This validates dist artifact presence for current `VERSION`, docs/example link integrity, and canonical naming/install references across active docs and examples.

See [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) for full flow.

---

## Consume the bundle

Use a module import (browser `type="module"` context):

```js
import { install, SERVICE_ID } from "/vendor/m7-js-lib-active-tags/dist/nomap/activeTags.standalone.v1.0.min.js";

document.addEventListener("DOMContentLoaded", async () => {
    const lib = install({
        conf: {
            boot: {
                intervals: true,
                events: true,
            },
            engine: {
                opResolution: {
                    auto: true,
                },
            },
        },
    });

    const AT = lib.service.get(SERVICE_ID);
    if (!AT) throw new Error(`missing ActiveTags service '${SERVICE_ID}'.`);

    // Release/runtime version marker (for diagnostics)
    console.log("ActiveTags version:", AT.VERSION);

    await AT.start();
});
```

Optional standalone feature flags:

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

* `popstate` defaults to `false`.
* `spa` defaults to `false`.
* `spa: true` installs the bundled SinglePageApp `basic` setup.
* Enabling `spa` also installs popstate as a dependency.
* See [INSTALLATION.md](./INSTALLATION.md) for the fuller standalone option examples.

---

## Notes

* Standalone install delegates final setup to canonical [../../src/install.js](../../src/install.js).
* Consumers using `dist/nomap/activeTags.standalone.v<version>.min.js` do not need to clone/download `m7-js-lib` or primitive dependency repos separately.
* In browser environments, standalone install auto-starts:
  * `primitive.dom.eventdelegator`
  * `primitive.dom.changeobserver`
* The build may show `eval` warnings from `str/interp`; bundle output is still generated.
* `scripts/build-dist.sh` builds both output directories by invoking `scripts/build-standalone.sh`.
* `scripts/build-standalone.sh` invokes `npx --yes esbuild@0.27.3`; first run requires npm registry access.
* Runtime version is available at `ActiveTags.VERSION` and on instances as `AT.VERSION`.

---

## Troubleshooting

If `npx esbuild` fails with network errors:

1. Ensure the machine can reach `registry.npmjs.org`.
2. Re-run `scripts/build-dist.sh`.

If bundle generation succeeds but runtime import fails:

1. Verify the served path points to your versioned dist file (for example `dist/nomap/activeTags.standalone.v1.0.min.js`).
2. Verify page script is running as ESM (`<script type="module">`).
