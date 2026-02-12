# Subsystem — Discover

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

