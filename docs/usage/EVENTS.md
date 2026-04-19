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
    listener : {
      options : { capture, passive, once },
      policy  : { ...opaque-low-level-pass-through }
    },
    matched  : { match, stop, prevent }
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
    listener: {
      options: { passive: true }
    },
    matched: {
      match: "closest"
    },
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
* `listener.options: { capture: false, passive: true, once: false }`
* `listener.policy: {}`
* `matched: { match: "closest", stop: false, prevent: false }`

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
* `listener.options`:
  hash-coerced; `capture`, `passive`, `once` normalized boolish-yes
* `listener.policy`:
  hash-coerced opaque low-level pass-through bag; ActiveTags does not interpret `match`, `stop`, or `prevent` here
* `matched`:
  hash-coerced; `match`, `stop`, `prevent` normalized for ActiveTags matched-only semantics

Controller registration then requires:

* non-empty `event`
* non-empty `pipeline`

Entries missing either are skipped.

`matched` currently controls ActiveTags event-match behavior:

* `match: "closest" | "target"`
* `prevent: true`
* `stop: true` (`stopImmediatePropagation()`)

Important caveat:

* If you use `matched.prevent: true`, also set `listener.options.passive: false`.
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
  it filters matches inside the job element using `matched.match`
  and only matched descendants trigger enqueue

Example:

* no selector:
  click on the job element context triggers the event
* `selector: ".button"`:
  only `.button` matches inside that job element trigger the event

`selector` is a per-event trigger filter (sub-target matcher), not the global delegator root.
`matched.match` controls how relevance is resolved:

* `"closest"`:
  `event.target.closest(selector)` semantics
* `"target"`:
  `event.target.matches(selector)` semantics

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

## 7) Listener Layer

Event definitions may include a `listener` block for listener-layer configuration.

Example:

```js
{
  events: {
    nav: {
      event: "click",
      selector: "a[href]",
      pipeline: "navigate",
      listener: {
        options: {
          passive: false,
        },
      }
    },
  },
}
```

`listener.options` is passed through to the delegated event layer.
`listener.policy` is an opaque low-level pass-through bag and does not control ActiveTags matched selector behavior.

---

## 8) Matched Block

Event definitions may also include a `matched` block for ActiveTags-owned
selector-resolution and matched-only event policy.

Example:

```js
{
  events: {
    nav: {
      event: "click",
      selector: "a[href]",
      pipeline: "navigate",
      matched: {
        match: "closest",
        prevent: true,
        stop: false,
      },
    },
  },
}
```

`matched` applies only after ActiveTags confirms selector relevance for the
current event. This is where selector resolution and matched-only
`preventDefault()` / `stopImmediatePropagation()` now live.

Important:

* `matched.prevent` runs after a real AT match only.
* `matched.stop` runs after a real AT match only.
* Internal hover/focus transitions filtered by ActiveTags special handlers do not trigger matched policy.

---

## 9) What gets enqueued on trigger

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

Notes:

* `inputs.event` is the raw browser event object captured at enqueue time.
* `inputs.trigger` is the normalized ActiveTags trigger element (job root or matched sub-target).
* If your handler only needs the relevant element, prefer `inputs.trigger` over reading from the raw event.

Then drain is scheduled asynchronously.

---

## 10) Attribute-based setup

Because prefixed attributes are inflated by `-`, this works:

```html
<div
  data-activetag
  data-name="demo-job"
  data-events-save-event="click"
  data-events-save-selector="[data-save]"
  data-events-save-pipeline="save"
  data-events-save-listener-options-capture="false"
  data-events-save-listener-options-passive="true"
  data-events-save-listener-options-once="false"
  data-events-save-matched-match="closest"
  data-events-save-matched-prevent="true">
</div>
```

This maps to:

* `events.save.event`
* `events.save.selector`
* `events.save.pipeline`
* `events.save.listener.options.capture`
* `events.save.listener.options.passive`
* `events.save.listener.options.once`
* `events.save.matched.match`
* `events.save.matched.prevent`

---

## 11) Common pitfalls

* Missing pipeline key: event can register/install, but enqueue target pipeline may fail later at VM resolve time.
* `focus` / `blur` expectation: runtime delegates normalized types (`focusin` / `focusout`).
* `on()` vs `enable()`: enabling does not install handlers; call `on()` to activate.
* `listener.policy` expectation: ActiveTags matched selector behavior now lives under `matched`, not `listener.policy`.

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
