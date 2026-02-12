# Configuration Model — ActiveTags

ActiveTags uses two configuration layers.

---

## Layer 1: Runtime config (`AT.conf`)

Compiled by top-level schema compiler:

* [../../src/at_config/Schema.js](../../src/at_config/Schema.js)
* Baseline defaults: [../../src/at_config/DEFAULT_CONFIG.js](../../src/at_config/DEFAULT_CONFIG.js)

This layer controls runtime policy, including:

* environment
* boot behavior
* observer behavior
* logging policy
* engine hooks/builtins
* job config policy defaults

---

## Layer 2: Per-job config (`job.config.schema`)

Compiled per discovered element through:

* [../../src/class/job/config/JobConfig.js](../../src/class/job/config/JobConfig.js)
* [../../src/class/job/config/DomConfigSource.js](../../src/class/job/config/DomConfigSource.js)
* [../../src/class/job/config/schema/Master.js](../../src/class/job/config/schema/Master.js)

This layer produces normalized job-level schema blocks (pipelines, events, intervals, requests).

---

## Merge posture

Top-level and per-job compilation both follow coercion/normalization-first posture:

* normalize shape
* compile deterministic output
* preserve warnings/errors in report objects

---

## Config sources in practice

For job config, effective input can include:

* default base policy from runtime config
* DOM data attributes
* config references (`data-config-at`/`at` path)
* optional eval/import paths (policy gated)

See repository example: [../../examples/test-job.js](../../examples/test-job.js)

---

## Key takeaway

Treat compiled outputs as source of truth:

* `AT.conf` for runtime behavior
* `job.config.schema` for job behavior

Avoid reading uncompiled raw inputs for runtime decisions.

---

## Related

* Runtime lifecycle -> [RUNTIME_LIFECYCLE.md](./RUNTIME_LIFECYCLE.md)
* Architecture -> [../architecture/INDEX.md](../architecture/INDEX.md)
