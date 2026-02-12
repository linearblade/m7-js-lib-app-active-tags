# Subsystem — Discover

[README](../../../README.md) -> [Architecture Index](../INDEX.md) -> [Subsystems](../SUBSYSTEMS.md)


Discover bridges DOM candidates into registered Job instances.

---

## Component

* [../../../src/class/discover/Controller.js](../../../src/class/discover/Controller.js)

---

## Responsibilities

* Sweep DOM by selector(s)
* De-duplicate candidate elements
* Create Job instances for new elements
* Register jobs into JobRegistry
* Trigger initial per-job config compile

---

## Behavioral posture

* Re-runnable and idempotent per element identity
* Execution-agnostic (does not run pipelines)
* Registry-facing, not engine-facing

---

## Inputs

* selector from call argument or boot config
* runtime job config policy
* expression resolver and environment


---

## See also

* [Subsystem Map](../SUBSYSTEMS.md)
* [Architecture Index](../INDEX.md)
* [Usage TOC](../../usage/TOC.md)
* [API Index](../../api/INDEX.md)
* [README](../../../README.md)
