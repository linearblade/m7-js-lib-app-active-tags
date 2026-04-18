# Events — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This page documents how per-job event bindings are defined, normalized, and wired to pipeline enqueue.

Primary source files:

* [../../src/class/job/config/schema/Master.js](../../src/class/job/config/schema/Master.js)
* [../../src/class/job/config/schema/constants.js](../../src/class/job/config/schema/constants.js)
* [../../src/class/event/Controller.js](../../src/class/event/Controller.js)
* [../../src/class/event/typeNormalizers.js](../../src/class/event/typeNormalizers.js)
* [../../src/class/event/specialHandlers.js](../../src/class/event/specialHandlers.js)

---

## Quick event shape

```txt
event: { ... }              // singular default entry -> runtime key "default"
events: {
  <name>: {
    enabled  : <boolish>,
    event    : "<dom-event-type>",
    selector : "<optional-css-subselector>",
    pipeline : "<pipeline-key>",
    options  : { capture, passive, once },
    policy   : { match, stop, prevent }
  }
}
```

Singular `event` and named `events` may both be provided.
`event` maps directly to runtime key `default`.

Minimal example:

```js
{
  events: {
    submit: {
      event: "click",
      selector: "[data-save]",
      pipeline: "save"
    }
  }
}
```

---

## 1) Where event config ends up

Per-job compilation writes event definitions to:

* `job.config.schema.events`

Quick inspection:

```js
const job = AT.toJob("my-job");
console.log(job.config.schema.events);
console.log(job.config.schemaReport);
```

---

## 2) Event keys and merge model

ActiveTags recognizes three event-related keys:

* `event`: single/default event entry (compiles under key `default`)
* `events`: named map of event entries
* `event_shape`: base shape for this block family; used to set section defaults for every event entry

Per-item merge order:

1. internal default shape
2. `event_shape` (if present)
3. concrete entry (`event` or `events.<name>`)

`event_shape` applies to both:

* singular default entry (`event`)
* named entries (`events.<name>`)

`event_shape` defaults example:

```js
{
  event_shape: {
    options: { passive: true },
    selector: ".button"
  },
  events: {
    save: { event: "click", pipeline: "save" },
    cancel: { event: "click", pipeline: "cancel" }
  }
}
```

Key mapping detail:

* `event` compiles to runtime key `default`
* `events.<name>` compiles to runtime key `<name>`
* `event` and `events.default` target the same runtime key (`default`)

Default entry example:

```js
{
  event: {
    event: "click",
    pipeline: "save"
  }
}
```

Default event shape includes:

* `enabled: true`
* `event: ""`
* `selector: ""` (optional; no sub-selector filter)
* `pipeline: ""`
* `options: { capture: false, passive: true, once: false }`
 * `policy: { match: "closest", stop: false, prevent: false }`

---

## 3) Field normalization behavior

Schema normalizer (`_normalizeEventItem`) applies:

* `enabled`:
  default true unless explicit no-intent
* `event`:
  trimmed, lower-cased string
* `pipeline`:
  trimmed string
* `selector`:
  optional trimmed string filter inside the job element
* `options`:
  hash-coerced; `capture`, `passive`, `once` normalized boolish-yes
* `policy`:
  hash-coerced; `match`, `stop`, `prevent` normalized for EventDelegator use

Controller registration then requires:

* non-empty `event`
* non-empty `pipeline`

Entries missing either are skipped.

`policy` is passed through to the delegated event layer and currently supports:

* `match: "closest" | "target"`
* `prevent: true`
* `stop: true` (`stopImmediatePropagation()`)

Important caveat:

* If you use `policy.prevent: true`, also set `options.passive: false`.
  Passive listeners cannot reliably call `preventDefault()`.

---

## 4) Runtime flow (register/enable/on/off)

High-level lifecycle:

1. Register definitions:
   `AT.events.register(job)` or `AT.events.registerAll()`
2. Control logical gates:
   `AT.events.enable(...)` / `AT.events.disable(...)`
3. Install handlers:
   `AT.events.on(...)`
4. Uninstall handlers:
   `AT.events.off(...)`

`AT.start()` already does:

* `AT.events.registerAll()`
* `AT.events.on()` when `boot.events` is enabled

---

## 5) Trigger selector semantics (optional filter)

Event controller installs one delegated root selector from `boot.selector`.
Per-event `selector` is optional:

* if omitted:
  event is attached at the job element level (whole ActiveTag root context)
* if provided:
  it filters matches inside the job element via `target.closest(selector)`
  and only matched descendants trigger enqueue

Example:

* no selector:
  click on the job element context triggers the event
* `selector: ".button"`:
  only `.button` matches inside that job element trigger the event

`selector` is a per-event trigger filter (sub-target matcher), not the global delegator root.

---

## 6) Event type normalization and special filtering

Before installation, event type is normalized:

* `focus` -> `focusin`
* `blur` -> `focusout`

Special semantic handlers suppress internal transitions for:

* `pointerover` / `pointerout`
* `focusin` / `focusout`

This avoids enqueue spam when moving between descendants inside the same semantic boundary.

---

## 7) Delegator policy pass-through

Event definitions may include a `policy` block for advanced EventDelegator behavior.

Example:

```js
{
  events: {
    nav: {
      event: "click",
      selector: "a[href]",
      pipeline: "navigate",
      options: {
        passive: false,
      },
      policy: {
        prevent: true,
        match: "closest",
      },
    },
  },
}
```

This is useful for link interception, submit suppression, or narrow target matching without writing custom DOM glue outside ActiveTags.

---

## 8) What gets enqueued on trigger

When a binding fires, handler enqueues:

```js
engine.enqueue(job, pipelineKey, {
  inputs: {
    reason: "event",
    eventName,
    event,   // DOM event object
    trigger, // job root or matched sub-target
  },
  meta: {
    source: "delegator",
    eventType,
    eventName,
    subSelector,
  },
});
```

Then drain is scheduled asynchronously.

---

## 9) Attribute-based setup

Because prefixed attributes are inflated by `-`, this works:

```html
<div
  data-activetag
  data-name="demo-job"
  data-events-save-event="click"
  data-events-save-selector="[data-save]"
  data-events-save-pipeline="save"
  data-events-save-options-capture="false"
  data-events-save-options-passive="true"
  data-events-save-options-once="false">
</div>
```

This maps to:

* `events.save.event`
* `events.save.selector`
* `events.save.pipeline`
* `events.save.options.capture`
* `events.save.options.passive`
* `events.save.options.once`

---

## 9) Common pitfalls

* Missing pipeline key: event can register/install, but enqueue target pipeline may fail later at VM resolve time.
* `focus` / `blur` expectation: runtime delegates normalized types (`focusin` / `focusout`).
* `on()` vs `enable()`: enabling does not install handlers; call `on()` to activate.

---

## See also

* [Pipelines](./PIPELINES.md)
* [Intervals](./INTERVALS.md)
* [Requests](./REQUESTS.md)
* [Configuration Model](./CONFIGURATION.md)
* [Runtime Lifecycle](./RUNTIME_LIFECYCLE.md)
* [v1.0 DSL Manual](./DSL_V100.md)
* [AT.events Reference](../api/reference/AT_EVENTS.md)
* [Event Subsystem Architecture](../architecture/subsystems/EVENTS.md)
* [Usage TOC](./TOC.md)
* [README](../../README.md)
