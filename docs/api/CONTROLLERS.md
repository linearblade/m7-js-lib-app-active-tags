# API Reference — Controllers

Controller surfaces instantiated by `ActiveTags`:

* Discover -> [../../src/class/discover/Controller.js](../../src/class/discover/Controller.js)
* Events -> [../../src/class/event/Controller.js](../../src/class/event/Controller.js)
* Intervals -> [../../src/class/interval/Controller.js](../../src/class/interval/Controller.js)
* Observer -> [../../src/class/observer/Controller.js](../../src/class/observer/Controller.js)

---

## Discover

Primary methods:

* `scan(sel?, opts?)`
* `registerJobs(list, opts?)`
* `sweep(sel?)`

---

## Events

Primary methods:

* `registerAll()` / `register(job)`
* `on(...)` / `off(...)`
* `enable(...)` / `disable(...)`
* `remove(job)`

---

## Intervals

Primary methods:

* `registerAll()` / `register(job)`
* `on(...)` / `off(...)`
* `enable(...)` / `disable(...)`
* `remove(job)`

---

## Observer

Primary methods:

* `start()`
* `stop()`
* selector configuration updates (service pass-through)

