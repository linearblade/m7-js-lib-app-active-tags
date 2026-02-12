# API Reference — ActiveTags Class

Primary runtime class:

* [../../src/ActiveTags.js](../../src/ActiveTags.js)

---

## Constructor

`new ActiveTags(lib, conf = {})`

High-level behavior:

* compile top-level runtime config
* resolve required services/dependencies
* instantiate registry, engine, controllers

---

## Public lifecycle

### `start()`

Initial runtime activation:

* initial discover scan
* optional observer start
* register events/intervals
* enable events/intervals per boot gates

---

## Mixed-in helper surfaces

### Job helper trait

* `toJob(ref)`

Source: [../../src/traits/job.js](../../src/traits/job.js)

### Engine helper trait

* `enqueueAll(reason)`

Source: [../../src/traits/engine.js](../../src/traits/engine.js)

