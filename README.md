# m7-js-lib-active-tags

A deterministic, DOM-driven workflow runtime for backend-hydrated UI behavior.

ActiveTags turns configured DOM elements into registered Jobs, compiles configuration into normalized schemas, and executes runtime work through a ticket-based Engine/VM lifecycle.

It is a runtime primitive, not a UI framework.

---

## Navigation

If you are new to the project, the recommended reading order is:

1. **Quick Start** -> [docs/usage/QUICKSTART.md](docs/usage/QUICKSTART.md)
2. **Usage TOC** -> [docs/usage/TOC.md](docs/usage/TOC.md)
3. **Architecture Index** -> [docs/architecture/INDEX.md](docs/architecture/INDEX.md)
4. **API Index** -> [docs/api/INDEX.md](docs/api/INDEX.md)

Related documents:

* **DOM Observer API Contract** -> [docs/vendor_api_contracts/DOM_CHANGE_OBSERVER_API_CONTRACT.md](docs/vendor_api_contracts/DOM_CHANGE_OBSERVER_API_CONTRACT.md)
* **Event Delegator API Contract** -> [docs/vendor_api_contracts/DOM_EVENT_DELEGATOR_API_CONTRACT.md](docs/vendor_api_contracts/DOM_EVENT_DELEGATOR_API_CONTRACT.md)
* **Interval API Contract** -> [docs/vendor_api_contracts/INTERVAL_API_CONTRACT.md](docs/vendor_api_contracts/INTERVAL_API_CONTRACT.md)
* **Log API Contract** -> [docs/vendor_api_contracts/LOG_API_CONTRACT.md](docs/vendor_api_contracts/LOG_API_CONTRACT.md)
* **Use Policy** -> [docs/USE_POLICY.md](docs/USE_POLICY.md)
* **AI Disclosure** -> [docs/AI_DISCLOSURE.md](docs/AI_DISCLOSURE.md)
* **What Makes ActiveTags Different** -> [docs/WHAT_MAKES_US_DIFFERENT.md](docs/WHAT_MAKES_US_DIFFERENT.md)

---

## Why this exists

Most server-rendered systems accumulate custom glue code between:

* DOM events
* request/response handling
* timed behavior
* DOM mutation handling
* state handoff across async boundaries

ActiveTags centralizes these concerns into one deterministic runtime model.

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

const AT = new ActiveTags(window.lib, {
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
