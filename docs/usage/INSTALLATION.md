# Installation & Dependencies — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)


ActiveTags is a browser-oriented runtime module.

For canonical dependency/version requirements, see:

* [REQUIREMENTS.md](./REQUIREMENTS.md)

---

## Required runtime surface

ActiveTags requires:

1. `window.lib`
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

### Auto-registration entry

```js
import "../../src/auto.js";
```

`auto.js` registers `ActiveTags` at `lib.site.activeTags`.

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

* `window.lib` exists
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
