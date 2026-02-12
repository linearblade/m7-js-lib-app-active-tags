# System Overview — ActiveTags

ActiveTags is a deterministic runtime for DOM-declared workflows.

---

## Top-level composition

`ActiveTags` orchestrates:

* top-level config compile
* job registry
* expression resolver
* engine runtime
* trigger controllers (discover/event/interval/observer)

Entry point:

* [../../src/ActiveTags.js](../../src/ActiveTags.js)

---

## Runtime flow

1. Compile runtime config (`AT.conf`)
2. Discover active DOM elements and register jobs
3. Compile per-job schema
4. Register trigger definitions (events/intervals)
5. Enqueue tickets on trigger activity
6. Execute through Engine -> Tick -> VM

---

## Design boundaries

### ActiveTags (orchestrator)

Owns composition and lifecycle gates (`start()`).

### Controllers (trigger/attachment layer)

Discover, Event, Interval, Observer convert DOM/time signals into enqueue requests.

### Engine (execution layer)

Owns ticket lifecycle, stage stepping, and error transitions.

### Builtins (operation layer)

Provide standardized side-effect operations in pipeline stages.

---

## Determinism posture

The runtime centers around explicit status transitions and ticket-local state:

* `ready`
* `running`
* `wait`
* `error`
* `complete`

Reference constants/helpers:

* [../../src/class/engine/helpers.js](../../src/class/engine/helpers.js)

