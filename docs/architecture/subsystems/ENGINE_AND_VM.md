# Subsystem — Engine & VM

The deterministic execution spine of ActiveTags.

---

## Components

* Engine facade -> [../../../src/class/engine/Engine.js](../../../src/class/engine/Engine.js)
* State store -> [../../../src/class/engine/EngineState.js](../../../src/class/engine/EngineState.js)
* Manager/policy -> [../../../src/class/engine/EngineManager.js](../../../src/class/engine/EngineManager.js)
* Tick driver -> [../../../src/class/engine/Tick.js](../../../src/class/engine/Tick.js)
* VM stepper -> [../../../src/class/engine/vm/VM.js](../../../src/class/engine/vm/VM.js)
* VM helpers/status -> [../../../src/class/engine/helpers.js](../../../src/class/engine/helpers.js)

---

## Ticket model

Tickets represent one execution request for `(jobId, pipelineKey)`.

Ticket-local state includes:

* stage cursor
* buffer
* target
* inputs
* lifecycle status

---

## Execution contract

* `enqueue(...)` prepares ticket
* `tick(...)` performs one stage transition
* `drain(...)` loops tick with bounds
* VM normalizes stage responses into explicit status categories

---

## Error posture

Errors are normalized into stage responses and routed through error-phase semantics when configured.

