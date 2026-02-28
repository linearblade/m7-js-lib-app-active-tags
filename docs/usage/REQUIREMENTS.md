# Requirements — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This page defines the runtime requirements for ActiveTags.

## Version baseline

ActiveTags requires:

1. [m7-js-lib v1 or later](/m7-js-lib/...)
2. [m7-js-lib-primitive-* modules](/m7-js-lib-primitive-.../)

## Required runtime surface

At runtime, a valid m7 `lib` instance must be available with these dependency keys.
The reference may come from an import, DI container, or any stored variable.
No global `window.lib` binding is required.

* [hash](/hash/...)
* [primitive.workspace](/primitive.workspace/...)
* [dom](/dom/...)
* [str.interp](/str.interp/...)

## Required services

ActiveTags requires these service keys:

* [primitive.dom.eventdelegator](/primitive.dom.eventdelegator/...)
* [primitive.log](/primitive.log/...)
* [primitive.interval](/primitive.interval/...)
* [primitive.dom.changeobserver](/primitive.dom.changeobserver/...)

Service constants are defined in:

* [../../src/constants.js](../../src/constants.js)

## Runtime form helpers

Form and HTTP-related builtins expect form helpers on `lib.dom.form`, including:

* `lib.dom.form.collect`
* `lib.dom.form.submit`

`http.send` now routes transport through `lib.request.send(...)`, so
`lib.request` is also required when HTTP/form envelope flows are used.

Current integration posture is to include these in the m7-js-lib v1 distribution.

## Minified distribution posture

The ActiveTags minified distribution is intended to include required primitive/runtime dependencies directly.

Including ActiveTags directly should not negatively affect minified installation behavior.

Recommended release path:

* `/vendor/m7-js-lib-active-tags/dist/activeTags.standalone.v1.0.min.js`

## Verification checklist

Before starting runtime, verify:

* bundle path resolves (`dist/activeTags.standalone.v1.0.min.js`)
* `install({ conf })` returns lib successfully
* `lib.service.get("app.activetags")` returns an instance

For manual/source construction, verify:

* a valid `lib` instance is available for `new ActiveTags(lib, ...)`
* `lib.require.all(...)` resolves core dependencies
* `lib.require.service(...)` resolves required services
* `lib.dom.form.collect` and `lib.dom.form.submit` are available when form/HTTP builtins are used
* `lib.request.send` is available when `http.send` is used

---

## See also

* [Installation & Dependencies](./INSTALLATION.md)
* [Quick Start](./QUICKSTART.md)
* [Troubleshooting](./TROUBLESHOOTING.md)
* [Usage TOC](./TOC.md)
* [README](../../README.md)
