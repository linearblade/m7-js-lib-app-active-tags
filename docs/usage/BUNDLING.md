# Standalone Bundling

[README](../../README.md) -> [Usage TOC](./TOC.md)

This guide documents how to produce a single-file standalone distribution:

* `dist/activeTags.standalone.v<version>.min.js`
* `dist/activeTags.standalone.v<version>.min.js.LEGAL.txt`
* `dist/activeTags.standalone.v<version>.min.js.map` (optional; only when built with `--with-map`)

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
scripts/build-standalone.sh
```

Current release version is read from:

* [../../VERSION](../../VERSION)

For this repository right now, that yields:

* `dist/activeTags.standalone.v1.0.min.js`
* `dist/activeTags.standalone.v1.0.min.js.LEGAL.txt`

Release build (v1.0 with sourcemap):

```bash
scripts/build-standalone.sh --version 1.0 --with-map
```

This also writes:

* `dist/activeTags.standalone.v1.0.min.js.map`

Optional sourcemap build:

```bash
scripts/build-standalone.sh --with-map
```

Optional version override:

```bash
scripts/build-standalone.sh --version 1.1
```

Build details:

* Entry: [../../src/standalone/prebundle.js](../../src/standalone/prebundle.js)
* Bundler: `esbuild@0.27.3` via `npx`
* Minification: enabled
* Legal comments: preserved via `--legal-comments=linked`
* Bundle banner: injected at top of JS (`@license` + SPDX line)
* Non-legal comments: stripped by minifier
* Output naming: versioned only (`activeTags.standalone.v<version>.min.js`)

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
import { install, SERVICE_ID } from "/vendor/m7-js-lib-active-tags/dist/activeTags.standalone.v1.0.min.js";

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

---

## Notes

* Standalone install delegates final setup to canonical [../../src/install.js](../../src/install.js).
* Consumers using `dist/activeTags.standalone.v<version>.min.js` do not need to clone/download `m7-js-lib` or primitive dependency repos separately.
* In browser environments, standalone install auto-starts:
  * `primitive.dom.eventdelegator`
  * `primitive.dom.changeobserver`
* The build may show `eval` warnings from `str/interp`; bundle output is still generated.
* `scripts/build-standalone.sh` invokes `npx --yes esbuild@0.27.3`; first run requires npm registry access.
* Runtime version is available at `ActiveTags.VERSION` and on instances as `AT.VERSION`.

---

## Troubleshooting

If `npx esbuild` fails with network errors:

1. Ensure the machine can reach `registry.npmjs.org`.
2. Re-run `scripts/build-standalone.sh`.

If bundle generation succeeds but runtime import fails:

1. Verify the served path points to your versioned dist file (for example `dist/activeTags.standalone.v1.0.min.js`).
2. Verify page script is running as ESM (`<script type="module">`).
