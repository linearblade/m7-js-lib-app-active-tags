# Examples Library — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)


This page maps key repository examples to runtime concepts.

---

## Primary boot example

* [../../examples/inject/fromFile/injectFromFile.html](../../examples/inject/fromFile/injectFromFile.html)

Demonstrates:

* versioned dist bundle boot (`activeTags.standalone.v1.0.min.js`)
* standalone `install({ conf })` usage
* service lookup via `SERVICE_ID`
* active element markup patterns
* event/interval/runtime toggles

---

## Complete tutorial example

* [../../examples/tutorial/tutorial.html](../../examples/tutorial/tutorial.html)

Demonstrates:

* full tutorial flow from install/startup through events/intervals
* buffer + target conveyor usage in one job (`counter + render`)
* `http.send` to `target.patch` fragment injection pattern

---

## Job configuration example

* [../../examples/tutorial/tutorial-job.js](../../examples/tutorial/tutorial-job.js)

Demonstrates:

* `pipeline` and `pipelines` blocks
* events and intervals blocks
* request definitions
* mixed stage styles (callable + string + object op records)

---

## Pipeline callable examples

* [../../examples/tutorial/tutorial-job.js](../../examples/tutorial/tutorial-job.js)
* [../../examples/stockTicker/header.js](../../examples/stockTicker/header.js)
* [../../examples/stockTicker/stock-form.js](../../examples/stockTicker/stock-form.js)

Demonstrates user-defined callable stage functions wired into named pipelines.

---

## Additional example artifacts

* [../../examples/ATDefaultConf.js](../../examples/ATDefaultConf.js)
* [../../examples/inject/fromFile/inject-file.js](../../examples/inject/fromFile/inject-file.js)
* [../../examples/tutorial/tutorial-loaded-job.js](../../examples/tutorial/tutorial-loaded-job.js)

---

## Inject-from-file demos

* [../../examples/inject/fromFile/injectFromFile.html](../../examples/inject/fromFile/injectFromFile.html)
* [../../examples/inject/fromFileString/injectFromFile.html](../../examples/inject/fromFileString/injectFromFile.html)

Demonstrates:

* fetching local fragments with `http.send`
* patching DOM content via `target.find` + `target.patch`
* string pipeline DSL with semicolon stage separation and named args

---

## Headless runtime demo

* [../../examples/headlessJobs/headlessJobs.html](../../examples/headlessJobs/headlessJobs.html)

Demonstrates:

* creating a headless job via `AT.runtime.createHeadlessJob(...)`
* registering and controlling intervals programmatically
* updating page state from a headless interval pipeline

---

## See also

* [Usage TOC](./TOC.md)
* [Architecture Index](../architecture/INDEX.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)
