# Subsystem — Jobs & Registry

[README](../../../README.md) -> [Architecture Index](../INDEX.md) -> [Subsystems](../SUBSYSTEMS.md)


This subsystem owns job identity, lookup, and lifecycle anchoring.

---

## Components

* Job model -> [../../../src/class/job/Job.js](../../../src/class/job/Job.js)
* Registry -> [../../../src/class/job/Registry.js](../../../src/class/job/Registry.js)

---

## Responsibilities

### Job

* stable identity metadata
* DOM anchor (`job.e`)
* runtime flags/status
* delegated config compiler (`job.config`)

### Registry

* id generation
* indexes by id/element/name
* reference resolution (`resolve(...)`)
* controlled unregister/shutdown coordination

---

## Why this matters

Execution and triggers depend on deterministic job identity; registry is the canonical lookup boundary.


---

## See also

* [Subsystem Map](../SUBSYSTEMS.md)
* [Architecture Index](../INDEX.md)
* [Usage TOC](../../usage/TOC.md)
* [API Index](../../api/INDEX.md)
* [README](../../../README.md)
