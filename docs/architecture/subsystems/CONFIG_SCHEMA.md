# Subsystem — Config Schema

This subsystem compiles runtime and job configuration into normalized, executable shapes.

---

## Components

### Top-level schema compiler

* [../../../src/at_config/Schema.js](../../../src/at_config/Schema.js)
* Defaults: [../../../src/at_config/DEFAULT_CONFIG.js](../../../src/at_config/DEFAULT_CONFIG.js)

Produces `AT.conf` used by runtime subsystems.

### Per-job config compiler

* [../../../src/class/job/config/JobConfig.js](../../../src/class/job/config/JobConfig.js)
* [../../../src/class/job/config/DomConfigSource.js](../../../src/class/job/config/DomConfigSource.js)
* [../../../src/class/job/config/schema/Master.js](../../../src/class/job/config/schema/Master.js)

Produces `job.config.schema` for event/interval/pipeline registration.

---

## Contract summary

* Compile first, execute later.
* Coercion + normalization preferred over implicit runtime guessing.
* Compiled outputs are runtime source of truth.

---

## Non-responsibilities

* No execution stepping
* No queue/scheduling control
* No direct DOM side-effects beyond config extraction
