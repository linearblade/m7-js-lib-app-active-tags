# Subsystem — Builtins, Buffer, Target Conveyor

[README](../../../README.md) -> [Architecture Index](../INDEX.md) -> [Subsystems](../SUBSYSTEMS.md)


Builtins are stage operations; buffer and target form explicit ticket-local conveyor channels.

---

## Builtins root

* [../../../src/builtins/index.js](../../../src/builtins/index.js)

Builtin families:

* form
* dom
* error
* buffer
* target
* http

---

## Buffer conveyor

Buffer enables explicit stage-to-stage data handoff:

* write payload/meta in one stage
* read/traverse in downstream stages

Reference: [../../../src/builtins/buffer/index.js](../../../src/builtins/buffer/index.js)

---

## Target conveyor

Target enables explicit DOM focus routing:

* set/reset target
* derive target from buffer or DOM relationships
* route DOM operations against current target

Reference: [../../../src/builtins/target/index.js](../../../src/builtins/target/index.js)

---

## Why this matters

This conveyor model reduces implicit state coupling and keeps complex workflows inspectable and deterministic.

---

## See also

* [Subsystem Map](../SUBSYSTEMS.md)
* [Architecture Index](../INDEX.md)
* [Usage TOC](../../usage/TOC.md)
* [API Index](../../api/INDEX.md)
* [README](../../../README.md)
