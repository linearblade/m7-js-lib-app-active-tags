# Subsystem — Event Controller

[README](../../../README.md) -> [Architecture Index](../INDEX.md) -> [Subsystems](../SUBSYSTEMS.md)


Event controller maps job event schema into delegated DOM handlers.

---

## Component

* [../../../src/class/event/Controller.js](../../../src/class/event/Controller.js)

---

## Responsibilities

* register event definitions from job schema
* install/uninstall delegated handlers through service
* enable/disable per-event runtime state
* enqueue pipelines on event trigger

---

## Service dependency

Uses `primitive.dom.eventdelegator` service.

Related vendor contract:

* [../../vendor_api_contracts/DOM_EVENT_DELEGATOR_API_CONTRACT.md](../../vendor_api_contracts/DOM_EVENT_DELEGATOR_API_CONTRACT.md)

---

## Non-responsibilities

* does not execute pipelines directly
* does not own scheduler policy


---

## See also

* [Subsystem Map](../SUBSYSTEMS.md)
* [Architecture Index](../INDEX.md)
* [Usage TOC](../../usage/TOC.md)
* [API Index](../../api/INDEX.md)
* [README](../../../README.md)
