# API Reference — Engine Runtime

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
* `tick({ ctx, ticket })`
* `drain({ max, ticket, ctx })`
* `cancel(...)`
* `lock(...)` / `unlock(...)`

---

## Stage statuses

Normalized VM stage statuses:

* `ok`
* `wait`
* `error`
* `complete`

---

## Ticket lifecycle

Canonical ticket states are defined in engine helpers.

Ticket data includes pipeline key, cursor, buffer, target, and runtime metadata.

