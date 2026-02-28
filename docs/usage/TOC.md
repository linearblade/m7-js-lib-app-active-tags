# Usage Documentation — Table of Contents

[README](../../README.md) -> [Usage TOC](./TOC.md) -> [Architecture Index](../architecture/INDEX.md) -> [API Index](../api/INDEX.md)


This section contains practical, user-facing guides for integrating and operating ActiveTags.

If you are looking for API-oriented references, see:

* **API Index** -> [../api/INDEX.md](../api/INDEX.md)
* **What Makes ActiveTags Different** -> [../WHAT_MAKES_US_DIFFERENT.md](../WHAT_MAKES_US_DIFFERENT.md)

If you are new, read top-to-bottom.

---

## Getting Started

* **Introduction** -> [INTRODUCTION.md](./INTRODUCTION.md)
  Problem framing, inline vs external config posture, and why ActiveTags exists.

* **About ActiveTags** -> [../ABOUT.md](../ABOUT.md)
  Internal model overview: compiler/VM pipeline, buffer/target conveyor, and runtime architecture posture.

* **Quick Start** -> [QUICKSTART.md](./QUICKSTART.md)
  Minimal boot flow and first active job.

* **Tutorial** -> [TUTORIAL.md](./TUTORIAL.md)
  Step-by-step guided flow from setup through configs, validation, intervals, events, and advanced usage.

* **Basic Tag Setup** -> [BASIC_TAG_SETUP.md](./BASIC_TAG_SETUP.md)
  Practical setup patterns for one `data-activetag` element, including `data-*`/`at-*` config sources and layered references.

* **Installation & Dependencies** -> [INSTALLATION.md](./INSTALLATION.md)
  Required m7 services, module loading, and runtime prerequisites.

* **Standalone Bundling** -> [BUNDLING.md](./BUNDLING.md)
  Build a versioned single-file minified standalone distribution (`activeTags.standalone.v<version>.min.js`).

* **Requirements** -> [REQUIREMENTS.md](./REQUIREMENTS.md)
  Version baseline, required dependency keys/services, and minified distribution posture.

---

## Configuration & Runtime

* **Configuration Model** -> [CONFIGURATION.md](./CONFIGURATION.md)
  Top-level runtime config and per-job config compile model.

* **Top-Level Job Config** -> [TOP_LEVEL_CONFIG.md](./TOP_LEVEL_CONFIG.md)
  What one job config contains, organized into Basics, Pipelines, Intervals, Events, and Requests.

* **Basics** -> [BASICS.md](./BASICS.md)
  Non-block top-level keys: `name`, `require`, `enabled`, `autorun`, and `env`.

* **Require Dependencies** -> [REQUIRE.md](./REQUIRE.md)
  Full guide for top-level `require`, scheduler gating, and unlock propagation behavior.

* **Pipelines** -> [PIPELINES.md](./PIPELINES.md)
  Defining `pipeline` / `pipelines` blocks, step formats, key selection, and trigger wiring.

* **Pipeline Handlers (User Code)** -> [PIPELINE_HANDLERS.md](./PIPELINE_HANDLERS.md)
  Function-step call shape, return contract, and runtime context usage (`ctx`, `AT`, `target`, `e`).

* **Engine Event Hooks** -> [ENGINE_HOOKS.md](./ENGINE_HOOKS.md)
  Hook names, emit timing, and payload contracts (`onEnqueue` vs Tick trace hooks).

* **Events** -> [EVENTS.md](./EVENTS.md)
  Defining event bindings, delegated trigger filters, and enqueue behavior.

* **Intervals** -> [INTERVALS.md](./INTERVALS.md)
  Defining interval timers, policy mapping, and tick enqueue behavior.

* **Requests** -> [REQUESTS.md](./REQUESTS.md)
  Defining normalized request blocks (`request`, `requests`, `request_shape`) for builtins and user functions.

* **HTTP Send (`http.send`)** -> [HTTP_SEND.md](./HTTP_SEND.md)
  Request resolution, args contract (`name/buffer/request/adhoc`), response policy, and output behavior.

* **Builtins Reference (Module -> Function)** -> [builtins/INDEX.md](./builtins/INDEX.md)
  Dedicated reference generated from `src/builtins/**` JSDoc with per-op args, side-effects, and return contracts.

* **v098 DSL Manual** -> [DSL_V098.md](./DSL_V098.md)
  Expression target grammar (`type:locator`), dispatch targets, interpolation, and compatibility notes.

* **Runtime Lifecycle** -> [RUNTIME_LIFECYCLE.md](./RUNTIME_LIFECYCLE.md)
  From `new ActiveTags(...)` through `start()`, enqueue, tick, and drain.

* **Builtins & Operations** -> [OPERATIONS_BUILTINS.md](./OPERATIONS_BUILTINS.md)
  Builtin operation families, buffer/target flow, and usage posture.

---

## Examples

* **Examples Library** -> [EXAMPLES_LIBRARY.md](./EXAMPLES_LIBRARY.md)
  Guided walkthrough of the repository examples and expected runtime behavior.

* **Examples/** -> [../../examples](../../examples)
  Local runnable examples and test rigs.

---

## Operational Guidance

* **Reviewing Logs** -> [REVIEWING_LOGS.md](./REVIEWING_LOGS.md)
  How ActiveTags integrates with `primitive.log`, bucket setup, and practical log review flow.

* **Troubleshooting** -> [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
  Common boot/config/runtime errors and resolution patterns.

---

## Related Docs

* **Architecture Index** -> [../architecture/INDEX.md](../architecture/INDEX.md)
* **API Index** -> [../api/INDEX.md](../api/INDEX.md)
* **Use Policy** -> [../USE_POLICY.md](../USE_POLICY.md)
* **AI Disclosure** -> [../AI_DISCLOSURE.md](../AI_DISCLOSURE.md)
* **About ActiveTags** -> [../ABOUT.md](../ABOUT.md)
* **Project README** -> [../../README.md](../../README.md)

---

## See also

* [Quick Start](./QUICKSTART.md)
* [Architecture Index](../architecture/INDEX.md)
* [API Index](../api/INDEX.md)
* [README](../../README.md)
