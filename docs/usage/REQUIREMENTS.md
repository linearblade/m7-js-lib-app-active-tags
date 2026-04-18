# Requirements — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This page defines the runtime requirements for ActiveTags.

## Version baseline

ActiveTags requires:

1. [m7-js-lib](https://github.com/linearblade/m7-js-lib) (v1+)
2. Primitive dependencies (manual/source install paths):
   * [m7-js-lib-primitive-dom-changeobserver](https://github.com/linearblade/m7-js-lib-primitive-dom-changeobserver)
   * [m7-js-lib-primitive-dom-eventdelegator](https://github.com/linearblade/m7-js-lib-primitive-dom-eventdelegator)
   * [m7-js-lib-primitive-interval](https://github.com/linearblade/m7-js-lib-primitive-interval)
   * [m7-js-lib-primitive-log](https://github.com/linearblade/m7-js-lib-primitive-log)

## Required runtime surface

At runtime, a valid m7 `lib` instance must be available with these dependency keys.
The reference may come from an import, DI container, or any stored variable.
No global `window.lib` binding is required.

* [hash (m7-js-lib)](https://github.com/linearblade/m7-js-lib)
* [dom (m7-js-lib)](https://github.com/linearblade/m7-js-lib)
* [str.interp (m7-js-lib-str-interp)](https://github.com/linearblade/m7-js-lib-str-interp)

Optional (currently not enforced by ActiveTags core dependency checks):

* [primitive.workspace (m7-js-workspace)](https://github.com/linearblade/m7-js-workspace)

Runtime enforcement posture:

* `hash` is asserted directly via `lib.hash.set` in [../../src/install.js](../../src/install.js)
* `dom` + `str.interp` are asserted through `CORE_DEPS` in [../../src/constants.js](../../src/constants.js)
* required services are asserted through `CORE_SERVICES` in [../../src/constants.js](../../src/constants.js)

## Required services

ActiveTags requires these service keys:

* [primitive.dom.eventdelegator](https://github.com/linearblade/m7-js-lib-primitive-dom-eventdelegator)
* [primitive.log](https://github.com/linearblade/m7-js-lib-primitive-log)
* [primitive.interval](https://github.com/linearblade/m7-js-lib-primitive-interval)
* [primitive.dom.changeobserver](https://github.com/linearblade/m7-js-lib-primitive-dom-changeobserver)

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

If you consume the versioned standalone dist file, you do not need to clone/download
the dependency repositories above separately.

Recommended release path:

* `/vendor/m7-js-lib-active-tags/dist/nomap/activeTags.standalone.v1.0.min.js`

## Verification checklist

Before starting runtime, verify:

* bundle path resolves (`dist/nomap/activeTags.standalone.v1.0.min.js`)
* `install({ conf })` returns lib successfully
* `lib.service.get(SERVICE_ID)` returns an instance (from the standalone import)

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
