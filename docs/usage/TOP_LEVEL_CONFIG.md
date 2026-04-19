# Top-Level Job Config — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This page documents what a per-job config contains, organized into five sections:

1. Basics
2. Pipelines
3. Intervals
4. Events
5. Requests

Primary source files:

* [../../src/class/job/config/schema/Master.js](../../src/class/job/config/schema/Master.js)
* [../../src/class/job/config/schema/constants.js](../../src/class/job/config/schema/constants.js)

---

## 1) Top-level input shape (authoring view)

Before compile, you can provide config keys in this layout:

```txt
{
  // 1) Basics
  name,
  require,
  enabled,
  autorun,
  env,

  // 2) Pipelines
  pipeline,
  pipelines,
  pipeline_shape,

  // 3) Intervals
  interval,
  intervals,
  interval_shape,

  // 4) Events
  event,
  events,
  event_shape,

  // 5) Requests
  request,
  requests,
  request_shape
}
```

---

## 2) Compiled shape (`job.config.schema`)

After compile, runtime reads this normalized shape:

```txt
{
  name,
  require,
  enabled,
  autorun,
  env,
  pipelines: { ... },
  intervals: { ... },
  events: { ... },
  requests: { ... }
}
```

The singular keys (`pipeline`, `event`, `interval`, `request`) and `*_shape` keys are authoring inputs. They are merged into the plural buckets in compiled output.

---

## 3) Section breakdown

### A) Basics

Top-level scalar/object policy keys:

* `name`
* `require`
* `enabled`
* `autorun`
* `env`

Details: [BASICS.md](./BASICS.md)

### B) Pipelines

Pipeline execution definitions:

* `pipeline` (singular default entry)
* `pipelines` (named entries)
* `pipeline_shape` (base defaults for every entry)

Details: [PIPELINES.md](./PIPELINES.md)

### C) Intervals

Timer-driven enqueue definitions:

* `interval` (singular default entry)
* `intervals` (named entries)
* `interval_shape` (base defaults for every entry)

Details: [INTERVALS.md](./INTERVALS.md)

### D) Events

Delegated DOM-event trigger definitions:

* `event` (singular default entry)
* `events` (named entries)
* `event_shape` (base defaults for every entry)

Details: [EVENTS.md](./EVENTS.md)

### E) Requests

Normalized request definition store:

* `request` (singular default entry; supports URL shorthand)
* `requests` (named entries)
* `request_shape` (base defaults for every entry)

Details: [REQUESTS.md](./REQUESTS.md)

---

## 4) Shared block rules (pipelines/events/intervals/requests)

All four blocks use the same normalization pattern:

* Merge order per item:
  1. Internal default shape
  2. User `*_shape` (if provided)
  3. Concrete item (`singular` or `plural.<name>`)
* Singular key maps to runtime key `default`.
* `plural.default` targets the same runtime key as singular.

Examples:

* `pipeline` -> `pipelines.default`
* `event` -> `events.default`
* `interval` -> `intervals.default`
* `request` -> `requests.default`

---

## 5) Minimal full example

Input:

```js
{
  name: "demo-job",
  enabled: true,
  autorun: true,
  pipeline: { run: "form.submit", error: "error.dump" },
  event: { event: "click", pipeline: "default" },
  interval: { repeat: 5000, pipeline: "default" },
  request: "/api/demo/submit"
}
```

Compiled sections of interest:

```js
{
  name: "demo-job",
  enabled: true,
  autorun: ["__DEFAULT__"],
  pipelines: {
    default: { run: ["form.submit"], error: ["error.dump"], enabled: true }
  },
  events: {
    default: {
      enabled: true,
      event: "click",
      selector: "__SELF__",
      pipeline: "default",
      listener: {
        options: { capture: false, passive: true, once: false },
        policy: {}
      },
      matched: { match: "closest", stop: false, prevent: false }
    }
  },
  intervals: {
    default: {
      enabled: true,
      autorun: ["__DEFAULT__"],
      repeat: 5000,
      max: 0,
      pipeline: "default",
      error: "stop",
      allowOverlap: false
    }
  },
  requests: {
    default: {
      url: "/api/demo/submit",
      method: "GET",
      encoding: "urlencoded",
      body: undefined,
      headers: {},
      credentials: false,
      timeoutMs: 10,
      transport: undefined,
      flags: { json: undefined, urlencoded: true }
    }
  }
}
```

---

## See also

* [Basics](./BASICS.md)
* [Pipelines](./PIPELINES.md)
* [Intervals](./INTERVALS.md)
* [Events](./EVENTS.md)
* [Requests](./REQUESTS.md)
* [Configuration Model](./CONFIGURATION.md)
* [Usage TOC](./TOC.md)
* [README](../../README.md)
