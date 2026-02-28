# m7-js-lib-app-active-tags v1.0

![ActiveTags Logo](logo.png)

*Deterministic Workflow Orchestration for DOM Components*

## Introduction
ActiveTags is designed for medium-to-high complexity interactive websites that need structured behavior without moving to a full frontend framework.

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

## Navigation

If you are new to the project, the recommended reading order is:

1. **About ActiveTags** -> [docs/ABOUT.md](docs/ABOUT.md)
2. **Introduction** -> [docs/usage/INTRODUCTION.md](docs/usage/INTRODUCTION.md)
3. **Quick Start** -> [docs/usage/QUICKSTART.md](docs/usage/QUICKSTART.md)
4. **Tutorial** -> [docs/usage/TUTORIAL.md](docs/usage/TUTORIAL.md)
5. **Usage TOC** -> [docs/usage/TOC.md](docs/usage/TOC.md)
6. **Architecture Index** -> [docs/architecture/INDEX.md](docs/architecture/INDEX.md)
7. **API Index** -> [docs/api/INDEX.md](docs/api/INDEX.md)

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
