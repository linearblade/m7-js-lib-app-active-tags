# Pipelines — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This page documents how to define and wire per-job pipelines in ActiveTags.

Primary source files:

* [../../src/class/job/config/schema/Master.js](../../src/class/job/config/schema/Master.js)
* [../../src/class/job/config/schema/DSL.js](../../src/class/job/config/schema/DSL.js)
* [../../src/class/engine/vm/Validate.js](../../src/class/engine/vm/Validate.js)
* [../../src/class/engine/helpers.js](../../src/class/engine/helpers.js)

---

## Quick phase grammar

```txt
pipeline item:
  run   : <phase>
  error : <phase>

<phase>       ::= <string-list> | <step-array>
<string-list> ::= "token token token"
token         ::= op | op:arg1,arg2,arg3

<step-array>  ::= [ <step>, ... ]
<step>        ::= "op"
               |  "op:arg1,arg2,arg3"
               |  { op: "<name>", args: <array|hash|scalar> }
```

Interpolation rule:

* `"${...}"` resolves to raw value type.
* `"text ${...}"` resolves to interpolated string.

At-a-glance examples:

```js
"foo"                    // -> { op: "foo", args: [] }
"foo:${window:bar},123" // -> { op: "foo", args: ["${window:bar}", "123"] }
{ op: "foo", args: { x: "${window:bar}" } }
```

---

## 1) Where pipeline config ends up

Per-job compilation writes pipelines to:

* `job.config.schema.pipelines`

Quick inspection:

```js
const job = AT.toJob("my-job");
console.log(job.config.schema.pipelines);
console.log(job.config.schemaReport);
```

`schemaReport` is useful when normalization warns about invalid values.

---

## 2) Pipeline keys and merge model

ActiveTags recognizes three pipeline-related config keys:

* `pipeline`: single/default definition
* `pipelines`: named map of definitions
* `pipeline_shape`: base shape for this block family; used to set section defaults for every pipeline entry

Per-item merge order is:

1. internal default shape (`{ run: [], error: [] }`)
2. `pipeline_shape` (if present)
3. concrete entry (`pipeline` or `pipelines.<name>`)

`pipeline_shape` applies to both:

* singular default entry (`pipeline`)
* named entries (`pipelines.<name>`)

`pipeline_shape` defaults example:

```js
{
  pipeline_shape: {
    error: "error.dump"
  },
  pipelines: {
    save: { run: "form.prepare form.submit" },
    patch: { run: "dom.patch" }
  }
}
```

Key mapping detail:

* `pipeline` compiles to runtime key `default`
* `pipelines.<name>` compiles to runtime key `<name>`
* `pipeline` and `pipelines.default` target the same runtime key (`default`)

---

## 3) Minimal definitions

### A) Default pipeline

```js
{
  pipeline: {
    run: "form.prepare form.collect form.submit",
    error: "error.dump"
  }
}
```

Default pipeline notes:

* `pipeline` is the unnamed/default entry.
* Runtime key is `default`.
* You do not provide a pipeline name field inside `pipeline`.
* Compiler injects pipeline `name` metadata from the key (`default` here).

### B) Named pipelines

```js
{
  pipelines: {
    save: {
      run: [
        "form.prepare",
        "form.collect",
        { op: "form.submit", args: { contentType: "json" } }
      ],
      error: [{ op: "error.dump", args: { throw: true } }]
    },
    hover_on: {
      run: "target.closest dom.patch",
      error: "error.dump"
    }
  }
}
```

Named pipeline notes:

* Key names are pipeline names.
* For `pipelines.save`, compiler injects `name: "save"` metadata internally.

Canonical phase keys are `run` and `error`.
Use `error`, not `onError`.

---

## 4) Step formats supported by the compiler

Pipeline phase fields (`run`, `error`) are compiled by `ExpressionResolver.parseList(...)`.
Accepted step shapes:

* space-delimited string:
  * `run: "space delimited string"` -> `["space", "delimited", "string"]`
* array of step strings and/or step objects:
  * `run: ["space", { op: "delimited" }, "string"]`

String step parsing:

* token form is `function:arg1,arg2,arg3`
* `"foo"` -> `{ op: "foo", args: [], raw: "foo" }`
* `"foo:${window:bar},123,abc"` -> `{ op: "foo", args: ["${window:bar}", "123", "abc"], raw: "foo:${window:bar},123,abc" }`
* shorthand-string args are positional and remain strings after parse

Object step form:

```js
{
  op: "foo",
  args: ["${window:bar}", 123, "abc - ${window:baz}"]
}
```

or:

```js
{
  op: "foo",
  args: {
    foo: "...",
    bar: 123,
    baz: () => {}
  }
}
```

Interpolation/materialization behavior:

* VM materializes args before calling the op.
* Encapsulated expression values (for example `"${window:bar}"`) resolve as raw value type.
  * Example: if `window.bar` is a function, that arg is passed as a function.
* Template strings (for example `"abc - ${window:baz}"`) resolve to interpolated strings.
* Interpolation walks arrays and hashes recursively.

---

## 5) Runtime selection and phases

Runtime executes by pipeline key:

* default key is `default` (`PIPELINE_KEY_DEFAULT`)
* VM reads `job.config.schema.pipelines.<pipelineKey>`
* normal execution uses phase `run`
* when a stage errors, VM resolves phase `error`

If a referenced key does not exist, runtime reports a missing-pipeline error.

---

## 6) How pipelines get triggered

Common trigger paths:

* job-level autorun:
  * `autorun: true` normalizes to `["__DEFAULT__"]`
  * `"__DEFAULT__"` is converted to `default` during enqueue sweep
* event bindings:
  * `events.<name>.pipeline = "<pipelineKey>"`
* interval bindings:
  * `intervals.<name>.pipeline = "<pipelineKey>"`
* manual enqueue:

```js
const job = AT.toJob("demo-job");
AT.engine.enqueue(job, "save", {
  inputs: { reason: "manual trigger" },
  meta: { source: "console" }
});
```

---

## 7) Attribute-based pipeline setup

Because prefixed attributes are inflated by `-`, these map naturally:

```html
<div
  data-activetag
  data-name="demo-job"
  data-pipeline-run="form.prepare form.collect form.submit"
  data-pipeline-error="error.dump"
  data-pipelines-save-run="form.prepare form.collect form.submit"
  data-events-submit-event="click"
  data-events-submit-selector="[data-save]"
  data-events-submit-pipeline="save">
</div>
```

This produces config paths like:

* `pipeline.run`
* `pipeline.error`
* `pipelines.save.run`
* `events.submit.pipeline`

---

## 8) Common pitfalls

* `onError` vs `error`: runtime phase key is `error`.
* Missing pipeline references: autorun/events/intervals can reference keys that do not exist; failure appears at VM step resolution.
* `pipeline.enabled` expectation: pipeline items are normalized with `enabled`, but VM execution currently resolves by key + phase (`run`/`error`) and does not gate on `pipeline.enabled`.

---

## See also

* [Configuration Model](./CONFIGURATION.md)
* [Events](./EVENTS.md)
* [Intervals](./INTERVALS.md)
* [Requests](./REQUESTS.md)
* [v098 DSL Manual](./DSL_V098.md)
* [Builtins & Operations](./OPERATIONS_BUILTINS.md)
* [Runtime Lifecycle](./RUNTIME_LIFECYCLE.md)
* [Basic Tag Setup](./BASIC_TAG_SETUP.md)
* [../../examples/test-job.js](../../examples/test-job.js)
* [Usage TOC](./TOC.md)
* [README](../../README.md)
