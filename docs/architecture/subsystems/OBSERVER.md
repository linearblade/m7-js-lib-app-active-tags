# Subsystem — Observer Controller

[README](../../../README.md) -> [Architecture Index](../INDEX.md) -> [Subsystems](../SUBSYSTEMS.md)


Observer controller translates DOM mutation batches into discover/register/unregister signals.

---

## Component

* [../../../src/class/observer/Controller.js](../../../src/class/observer/Controller.js)

---

## Responsibilities

* apply observer selector policy from runtime config
* start/stop observation against shared service
* translate mutation batch buckets into discover/remove operations

---

## Service dependency

Uses `primitive.dom.changeobserver` service.

Related vendor contract:

* [../../vendor_api_contracts/DOM_CHANGE_OBSERVER_API_CONTRACT.md](../../vendor_api_contracts/DOM_CHANGE_OBSERVER_API_CONTRACT.md)

---

## Runtime boundary

Observer is reporting/translation layer; it does not execute pipelines directly.


---

## See also

* [Subsystem Map](../SUBSYSTEMS.md)
* [Architecture Index](../INDEX.md)
* [Usage TOC](../../usage/TOC.md)
* [API Index](../../api/INDEX.md)
* [README](../../../README.md)
