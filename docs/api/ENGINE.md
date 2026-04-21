# API Reference — Engine Runtime

[README](../../README.md) -> [API Index](./INDEX.md)


Engine runtime files:

* [../../src/class/engine/Engine.js](../../src/class/engine/Engine.js)
* [../../src/class/engine/EngineManager.js](../../src/class/engine/EngineManager.js)
* [../../src/class/engine/Tick.js](../../src/class/engine/Tick.js)
* [../../src/class/engine/vm/VM.js](../../src/class/engine/vm/VM.js)
* [../../src/class/engine/helpers.js](../../src/class/engine/helpers.js)

---

## Engine facade methods

Common public methods:

* `enqueue(jobLike, key, opts)`
* `tick({ ctx, ticket, requireJob })`
* `drain({ max, ticket, requireJob, ctx })`
* `pulse({ max, ticket, requireJob, ctx })`
* `cancel(...)`
* `lock(...)` / `unlock(...)`

---

## Wait management

For wait-aware execution, `pulse()` is the normal public entry point.

The Engine also exposes a wait coordinator at `AT.engine.wake` with primary methods:

* `refresh({ max, ticket, requireJob, ctx })`
* `cancel()`

---

## Stage statuses

Normalized VM stage statuses:

* `ok`
* `wait`
* `error`
* `complete`

`wait` parks the active ticket until it is unlocked or its wait timer expires.

---

## Ticket lifecycle

Canonical ticket states are defined in engine helpers.

Ticket data includes pipeline key, cursor, buffer, target, and runtime metadata.

Timed waits are resumed through the engine wake coordinator.


---

## See also

* [API Index](./INDEX.md)
* [Usage TOC](../usage/TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [README](../../README.md)
