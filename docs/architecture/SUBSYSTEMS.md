# Subsystem Map — ActiveTags

This map aligns runtime subsystems to responsibilities.

---

## Orchestrator

* **ActiveTags class** -> [../../src/ActiveTags.js](../../src/ActiveTags.js)

Responsibilities:

* compose subsystems
* compile runtime config
* expose runtime lifecycle entry (`start()`)

---

## Config compilation

* Top-level schema -> [../../src/at_config/Schema.js](../../src/at_config/Schema.js)
* Per-job config -> [../../src/class/job/config/JobConfig.js](../../src/class/job/config/JobConfig.js)
* Job schema compiler -> [../../src/class/job/config/schema/Master.js](../../src/class/job/config/schema/Master.js)

---

## Discovery and registry

* Discover controller -> [../../src/class/discover/Controller.js](../../src/class/discover/Controller.js)
* Job registry -> [../../src/class/job/Registry.js](../../src/class/job/Registry.js)
* Job model -> [../../src/class/job/Job.js](../../src/class/job/Job.js)

---

## Runtime execution

* Engine facade -> [../../src/class/engine/Engine.js](../../src/class/engine/Engine.js)
* Manager/policy -> [../../src/class/engine/EngineManager.js](../../src/class/engine/EngineManager.js)
* State -> [../../src/class/engine/EngineState.js](../../src/class/engine/EngineState.js)
* Tick driver -> [../../src/class/engine/Tick.js](../../src/class/engine/Tick.js)
* VM -> [../../src/class/engine/vm/VM.js](../../src/class/engine/vm/VM.js)

---

## Trigger controllers

* Events -> [../../src/class/event/Controller.js](../../src/class/event/Controller.js)
* Intervals -> [../../src/class/interval/Controller.js](../../src/class/interval/Controller.js)
* Observer -> [../../src/class/observer/Controller.js](../../src/class/observer/Controller.js)

---

## Expression and operations

* Expression resolver -> [../../src/class/expressions/ExpressionResolver.js](../../src/class/expressions/ExpressionResolver.js)
* Builtins root -> [../../src/builtins/index.js](../../src/builtins/index.js)

