# Runtime Lifecycle — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)


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

## 6) Programmatic jobs (`AT.runtime`)

For advanced/runtime-only flows, jobs may be created directly through:

* `AT.runtime.createInternalJob(name, def?, opts?, e?)`
* `AT.runtime.createJob({ name, def?, opts?, e?, headless? })`
* `AT.runtime.createHeadlessJob(name, def?, opts?)`

Headless policy on `createJob`:

* `headless:true` drops any element binding (`e`)
* `headless:true` forces `indexElement = false` (no override)
* `headless:true` forces configure mode to `from` (`configureFrom(def)`)
* during stage execution, VM provides `AT.conf.env.document.body` as effective `e`/`job.e` when no element is bound

Reference: [../../src/class/runtime/Controller.js](../../src/class/runtime/Controller.js)

---

## Related

* Builtins & operations -> [OPERATIONS_BUILTINS.md](./OPERATIONS_BUILTINS.md)
* Engine architecture -> [../architecture/subsystems/ENGINE_AND_VM.md](../architecture/subsystems/ENGINE_AND_VM.md)

---

## See also

* [Usage TOC](./TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)
