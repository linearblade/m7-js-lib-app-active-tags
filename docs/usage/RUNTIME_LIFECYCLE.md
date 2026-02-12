# Runtime Lifecycle — ActiveTags

This page describes runtime flow from construction to execution.

---

## 1) Construction

`new ActiveTags(lib, conf)`:

* compiles top-level config snapshot
* resolves required services
* creates subsystem controllers
* creates JobRegistry and Engine

Reference: [../../src/ActiveTags.js](../../src/ActiveTags.js)

---

## 2) Start

`await AT.start()`:

1. validates environment document
2. performs initial discover scan
3. starts observer if configured
4. registers intervals/events from jobs
5. enables intervals/events per boot gates

---

## 3) Trigger phase

Runtime triggers enqueue tickets; they do not execute pipelines directly:

* event controller
* interval controller
* manual enqueue (`engine.enqueue(...)` / trait helpers)

---

## 4) Execution phase

Engine runtime model:

* enqueue creates ticket
* `tick()` advances one stage
* `drain()` loops ticks until idle/max
* VM normalizes stage results (`ok|wait|error|complete`)

Core files:

* [../../src/class/engine/Engine.js](../../src/class/engine/Engine.js)
* [../../src/class/engine/Tick.js](../../src/class/engine/Tick.js)
* [../../src/class/engine/vm/VM.js](../../src/class/engine/vm/VM.js)
* [../../src/class/engine/helpers.js](../../src/class/engine/helpers.js)

---

## 5) Dataflow phase

Within a ticket:

* `buffer` carries stage-to-stage payload/meta
* `target` tracks current DOM operation focus

This explicit conveyor model is a core design strength for deterministic workflows.

---

## Related

* Builtins & operations -> [OPERATIONS_BUILTINS.md](./OPERATIONS_BUILTINS.md)
* Engine architecture -> [../architecture/subsystems/ENGINE_AND_VM.md](../architecture/subsystems/ENGINE_AND_VM.md)
