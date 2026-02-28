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

## Quick example

```js
import { install, SERVICE_ID } from "./dist/activeTags.standalone.v1.0.min.js";

const lib = install({
  conf: {
    boot: {
      observeDom: true,
      events: true,
      intervals: true,
    }
  }
});

const AT = lib.service.get(SERVICE_ID);
if (!AT) throw new Error(`missing ActiveTags service '${SERVICE_ID}'.`);

await AT.start();
```

---

## Philosophy

> "Declare behavior in DOM/config. Execute deterministically in one runtime."

---

## License

See [LICENSE.md](LICENSE.md) for full terms.

* Usage rights and restrictions are defined in [LICENSE.md](LICENSE.md)
* Commercial licensing inquiries: [legal@m7.org](mailto:legal@m7.org)

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
