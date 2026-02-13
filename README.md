# m7-js-lib-active-tags

![ActiveTags Logo](logo.png)

*Deterministic Workflow Orchestration for DOM Components*

## Introduction
ActiveTags is a workflow-orchestration runtime for DOM components in MVC-style applications.

It turns ordinary HTML elements into drop-in interactive components by compiling declarative pipelines (events, intervals, DOM mutations, and actions) and executing them deterministically through a custom DSL and miniature VM.

This removes ad hoc glue code across DOM events, timers, observers, and request/response flow, making behavior more organized, reusable, and easier to reason about in moderate-to-high complexity components and websites.

ActiveTags is transport-agnostic (server-rendered HTML, JSON APIs, or mixed response models) and config-surface agnostic (inline attributes, structured JS/JSON config objects, or external references), so teams are not forced into inline string configuration for complex behavior.

ActiveTags is not a rendering framework and does not require platform-owning architecture.

---

## Navigation

If you are new to the project, the recommended reading order is:

1. **About ActiveTags** -> [docs/ABOUT.md](docs/ABOUT.md)
2. **Introduction** -> [docs/usage/INTRODUCTION.md](docs/usage/INTRODUCTION.md)
3. **Quick Start** -> [docs/usage/QUICKSTART.md](docs/usage/QUICKSTART.md)
4. **Usage TOC** -> [docs/usage/TOC.md](docs/usage/TOC.md)
5. **Architecture Index** -> [docs/architecture/INDEX.md](docs/architecture/INDEX.md)
6. **API Index** -> [docs/api/INDEX.md](docs/api/INDEX.md)

Related documents:

* **DOM Observer API Contract** -> [docs/vendor_api_contracts/DOM_CHANGE_OBSERVER_API_CONTRACT.md](docs/vendor_api_contracts/DOM_CHANGE_OBSERVER_API_CONTRACT.md)
* **Event Delegator API Contract** -> [docs/vendor_api_contracts/DOM_EVENT_DELEGATOR_API_CONTRACT.md](docs/vendor_api_contracts/DOM_EVENT_DELEGATOR_API_CONTRACT.md)
* **Interval API Contract** -> [docs/vendor_api_contracts/INTERVAL_API_CONTRACT.md](docs/vendor_api_contracts/INTERVAL_API_CONTRACT.md)
* **Log API Contract** -> [docs/vendor_api_contracts/LOG_API_CONTRACT.md](docs/vendor_api_contracts/LOG_API_CONTRACT.md)
* **Use Policy** -> [docs/USE_POLICY.md](docs/USE_POLICY.md)
* **AI Disclosure** -> [docs/AI_DISCLOSURE.md](docs/AI_DISCLOSURE.md)
* **Requirements** -> [docs/usage/REQUIREMENTS.md](docs/usage/REQUIREMENTS.md)
* **About ActiveTags** -> [docs/ABOUT.md](docs/ABOUT.md)
* **What Makes ActiveTags Different** -> [docs/WHAT_MAKES_US_DIFFERENT.md](docs/WHAT_MAKES_US_DIFFERENT.md)

---

## Motivation

ActiveTags was built to solve practical problems in real-world MVC systems:

1. Deliver SPA-like behavior without adopting a platform-owning framework.
2. Build complex components (for example, chat interfaces) without monolithic JavaScript glue.
3. Orchestrate multi-source workflows (requests, sockets, heartbeats, status updates) in one deterministic pipeline model.
4. Configure components quickly via JSON-style config and admin controls, instead of hardwiring behavior repeatedly in backend code.
5. Keep behavior reusable and portable across legacy PHP sites, JavaScript-driven pages, and framework-hosted environments, while preserving clear HTML/CSS/logic role boundaries.

In short: ActiveTags is ruthless about killing glue code.

---

## What this library guarantees

* Top-level runtime config is compiled before activation
* Discovered elements are registered as stable Jobs
* Per-job schema is compiled before trigger execution
* Events, intervals, and observer signals become enqueue sources
* VM stage results are normalized (`ok`, `wait`, `error`, `complete`)
* Runtime dataflow is explicit via ticket-local `buffer` and `target`

These are design guarantees, not informal conventions.

---

## Quick example

```js
import ActiveTags from "./src/ActiveTags.js";
import lib from "/m7-js-lib/...";

const AT = new ActiveTags(lib, {
  boot: {
    observeDom: true,
    events: true,
    intervals: true,
  }
});

await AT.start();
```

---

## Core concepts

### Job model

A Job is a runtime identity anchored to a DOM element, with compiled config and lifecycle state.

### Compile-first posture

ActiveTags compiles both runtime config (`AT.conf`) and per-job schema before runtime execution.

### Deterministic execution

Engine runtime executes tickets stage-by-stage through `tick()` / `drain()` and explicit status transitions.

### Buffer/target conveyor

Pipeline operations pass data and DOM focus explicitly through ticket-local conveyor channels.

---

## What this library does not do

It does not:

* own rendering or templating
* implement a virtual DOM
* provide reactive state management
* replace backend domain logic
* hide workflow semantics behind implicit framework behavior

---

## Documentation map

* Usage docs -> [docs/usage/TOC.md](docs/usage/TOC.md)
* About -> [docs/ABOUT.md](docs/ABOUT.md)
* Introduction -> [docs/usage/INTRODUCTION.md](docs/usage/INTRODUCTION.md)
* Architecture docs -> [docs/architecture/INDEX.md](docs/architecture/INDEX.md)
* API docs -> [docs/api/INDEX.md](docs/api/INDEX.md)
* Source entry -> [src/ActiveTags.js](src/ActiveTags.js)
* Examples -> [examples/](examples/)

---

## Philosophy

> "Declare behavior in DOM/config. Execute deterministically in one runtime."

---

## License

See [LICENSE.md](LICENSE.md) for full terms.

* Free for personal, non-commercial use
* Commercial licensing available under the M7 Moderate Team License (MTL-10)

---

## AI Usage Disclosure

See:

* [docs/AI_DISCLOSURE.md](docs/AI_DISCLOSURE.md)
* [docs/USE_POLICY.md](docs/USE_POLICY.md)

for permitted use of AI in derivative tools or automation layers.

---

## Feedback / Security

* General inquiries: [legal@m7.org](mailto:legal@m7.org)
* Security issues: [security@m7.org](mailto:security@m7.org)
