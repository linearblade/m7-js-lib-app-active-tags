# Troubleshooting — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)


Common startup and runtime issues.

---

## Constructor throws: missing lib

Error pattern:

* `constructor requires lib as first argument`

Fix:

* Ensure `window.lib` is loaded before ActiveTags import/construct.

---

## Constructor throws: missing core services

Error pattern includes missing service keys.

Fix:

* Load/register service modules before creating ActiveTags:
  * event delegator
  * interval manager
  * DOM change observer
  * log service

See dependency guide: [INSTALLATION.md](./INSTALLATION.md)

---

## start() throws missing document/body

Error pattern:

* missing doc or doc body

Fix:

* Ensure browser DOM is available and call `start()` after DOM readiness.

---

## No jobs discovered

Symptoms:

* no event/interval registrations
* no pipeline activity

Fix checklist:

* selector matches (`boot.selector` default is `[data-activetag]`)
* elements exist at start time
* per-job config compiles successfully

---

## Pipelines enqueue but do not behave as expected

Check:

* job schema `enabled` / `autorun`
* stage op names match builtin/custom callable names
* `buffer` and `target` assumptions across stages
* error-phase pipeline presence

---

## Observer behavior surprises

Check:

* `boot.observeDom` gate
* `observe.selector` and `observe.attribute_filter` alignment
* underlying observer service contract

Reference:

* [../vendor_api_contracts/DOM_CHANGE_OBSERVER_API_CONTRACT.md](../vendor_api_contracts/DOM_CHANGE_OBSERVER_API_CONTRACT.md)

---

## Next debugging surfaces

* ActiveTags runtime entry -> [../../src/ActiveTags.js](../../src/ActiveTags.js)
* Engine/tick/VM path -> [../../src/class/engine/](../../src/class/engine/)
* Job config compile path -> [../../src/class/job/config/](../../src/class/job/config/)

---

## See also

* [Usage TOC](./TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)
