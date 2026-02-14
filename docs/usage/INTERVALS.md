# Intervals — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This page documents how per-job interval definitions are normalized and wired into runtime timer triggers.

Primary source files:

* [../../src/class/job/config/schema/Master.js](../../src/class/job/config/schema/Master.js)
* [../../src/class/job/config/schema/constants.js](../../src/class/job/config/schema/constants.js)
* [../../src/class/interval/Controller.js](../../src/class/interval/Controller.js)
* [../vendor_api_contracts/INTERVAL_API_CONTRACT.md](../vendor_api_contracts/INTERVAL_API_CONTRACT.md)

---

## Quick interval shape

```txt
interval: { ... }           // singular default entry -> runtime key "default"
intervals: {
  <name>: {
    enabled      : <boolish>,
    repeat       : <ms>,
    max          : <number>,          // 0 = unlimited
    pipeline     : "<pipeline-key>",
    allowOverlap : <boolish>,
    onError      : "stop|continue",   // runtime mapping key
    autorun      : <selector-list>    // normalized, currently not used by interval controller
  }
}
```

Singular `interval` and named `intervals` may both be provided.
`interval` maps directly to runtime key `default`.

Minimal example:

```js
{
  intervals: {
    poll: {
      repeat: 2000,
      pipeline: "refresh",
      allowOverlap: false
    }
  }
}
```

---

## 1) Where interval config ends up

Per-job compilation writes interval definitions to:

* `job.config.schema.intervals`

Quick inspection:

```js
const job = AT.toJob("my-job");
console.log(job.config.schema.intervals);
console.log(job.config.schemaReport);
```

---

## 2) Interval keys and merge model

ActiveTags recognizes three interval-related keys:

* `interval`: single/default interval entry (compiles under key `default`)
* `intervals`: named map of interval entries
* `interval_shape`: base shape for this block family; used to set section defaults for every interval entry

Per-item merge order:

1. internal default shape
2. `interval_shape` (if present)
3. concrete entry (`interval` or `intervals.<name>`)

`interval_shape` applies to both:

* singular default entry (`interval`)
* named entries (`intervals.<name>`)

`interval_shape` defaults example:

```js
{
  interval_shape: {
    repeat: 5000,
    allowOverlap: false
  },
  intervals: {
    poll: { pipeline: "refresh" },
    heartbeat: { pipeline: "pulse", repeat: 1000 }
  }
}
```

Key mapping detail:

* `interval` compiles to runtime key `default`
* `intervals.<name>` compiles to runtime key `<name>`
* `interval` and `intervals.default` target the same runtime key (`default`)

Default entry example:

```js
{
  interval: {
    repeat: 2000,
    pipeline: "refresh"
  }
}
```

Default interval shape includes:

* `enabled: true`
* `autorun: ["__DEFAULT__"]`
* `repeat: 0`
* `max: 0`
* `pipeline: "initial"`
* `error: "stop"` (schema default field)
* `allowOverlap: false`

---

## 3) Field normalization behavior

Schema normalizer (`_normalizeIntervalItem`) applies:

* `enabled`:
  default true unless explicit no-intent
* `autorun`:
  normalized list form (`boolean|string|array` input posture)
* `allowOverlap`:
  true only on explicit yes-intent
* `repeat`:
  integer, clamped to `>= 0`

Controller registration then requires:

* finite `repeat > 0`
* non-empty `pipeline`

Entries missing either are skipped.

---

## 4) Runtime flow (register/enable/on/off)

High-level lifecycle:

1. Register definitions:
   `AT.intervals.register(job)` or `AT.intervals.registerAll()`
2. Control logical gates:
   `AT.intervals.enable(...)` / `AT.intervals.disable(...)`
3. Start timers:
   `AT.intervals.on(...)`
4. Stop timers:
   `AT.intervals.off(...)`

`AT.start()` already does:

* `AT.intervals.registerAll()`
* `AT.intervals.on()` when `boot.intervals` is enabled

---

## 5) Service policy mapping

When an interval is activated (`_onOne`), controller maps config to interval-service options:

* `repeat` -> `everyMs`
* `max` -> `maxRuns`
* `allowOverlap: true` -> `overlapPolicy: "queue"`
* `allowOverlap: false` -> `overlapPolicy: "coalesce"`
* `onError: "stop"` -> `errorPolicy: "pause"`
* otherwise -> `errorPolicy: "continue"`

Runtime timer name format:

* `at:<jobId>:<intervalName>`

---

## 6) What gets enqueued on interval ticks

On each timer tick, controller enqueues:

```js
engine.enqueue(job, pipelineKey, {
  inputs: {
    reason: "interval",
    intervalName, // logical interval key
    interval: ctx // interval service context payload
  },
  meta: {
    source: "interval",
    intervalKey: intervalName, // logical interval key
    intervalName: runtimeName  // runtime timer id
  }
});
```

Then it drains engine for that ticket.

---

## 7) Attribute-based setup

Because prefixed attributes are inflated by `-`, this works:

```html
<div
  data-activetag
  data-name="demo-job"
  data-intervals-poll-repeat="2000"
  data-intervals-poll-pipeline="refresh"
  data-intervals-poll-max="0"
  data-intervals-poll-allow-overlap="false"
  data-intervals-poll-on-error="stop">
</div>
```

This maps to:

* `intervals.poll.repeat`
* `intervals.poll.pipeline`
* `intervals.poll.max`
* `intervals.poll.allowOverlap`
* `intervals.poll.onError`

---

## 8) Common pitfalls

* `repeat` must be `> 0`: `0` means it will not register as runnable.
* Missing pipeline key: interval can exist in config but is skipped/blocked at register/on gates if empty.
* `error` vs `onError` naming:
  default interval shape defines `error`, but activation path currently reads `onError` for policy mapping.
  Prefer setting `onError` when you need explicit runtime error-policy behavior.
* Interval-level `autorun`:
  it is normalized by schema, but current interval controller path does not consume it for tick routing.

---

## See also

* [Pipelines](./PIPELINES.md)
* [Events](./EVENTS.md)
* [Requests](./REQUESTS.md)
* [Configuration Model](./CONFIGURATION.md)
* [Runtime Lifecycle](./RUNTIME_LIFECYCLE.md)
* [AT.intervals Reference](../api/reference/AT_INTERVALS.md)
* [Interval Subsystem Architecture](../architecture/subsystems/INTERVALS.md)
* [Usage TOC](./TOC.md)
* [README](../../README.md)
