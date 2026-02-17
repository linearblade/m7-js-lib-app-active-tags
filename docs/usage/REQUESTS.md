# Requests — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This page documents how request definitions are normalized into `job.config.schema.requests`.

Primary source files:

* [../../src/class/job/config/schema/Master.js](../../src/class/job/config/schema/Master.js)
* [../../src/class/job/config/schema/constants.js](../../src/class/job/config/schema/constants.js)
* [../../src/builtins/form/formSubmit.js](../../src/builtins/form/formSubmit.js)
* [../../src/builtins/http/httpSend.js](../../src/builtins/http/httpSend.js)

---

## Quick request shape

```txt
request: <string|object>    // singular default entry -> runtime key "default"
requests: {
  <name>: <string|object>
}
request_shape: { ... }      // base shape for this block family
```

Request object fields (canonical shape):

```txt
{
  url,
  method,
  encoding,
  body,
  headers,
  credentials,
  timeoutMs,
  transport,
  flags
}
```

---

## 1) Where request config ends up

Per-job compilation writes request definitions to:

* `job.config.schema.requests`

Quick inspection:

```js
const job = AT.toJob("my-job");
console.log(job.config.schema.requests);
console.log(job.config.schemaReport);
```

---

## 2) Request keys and merge model

ActiveTags recognizes three request-related keys:

* `request`: single/default request entry (compiles under key `default`)
* `requests`: named map of request entries
* `request_shape`: base shape used to set defaults for every request entry

Per-item merge order:

1. internal default shape
2. `request_shape` (if present)
3. concrete entry (`request` or `requests.<name>`)

`request_shape` applies to both:

* singular default entry (`request`)
* named entries (`requests.<name>`)

Key mapping detail:

* `request` compiles to runtime key `default`
* `requests.<name>` compiles to runtime key `<name>`
* `request` and `requests.default` target the same runtime key (`default`)

---

## 3) Hotkey shorthand (`url`)

Requests use hotkey coercion with key `url`.
This means a scalar request value is treated as URL shorthand.

Examples:

```js
{ request: "/api/save" }
```

becomes effectively:

```js
{ requests: { default: { url: "/api/save" } } }
```

Named shorthand works too:

```js
{
  requests: {
    save: "/api/save",
    remove: "/api/remove"
  }
}
```

---

## 4) Field normalization behavior

From `_normalizeRequestItem(req, ctx)`:

* `req = lib.hash.to(req, ctx.hotkey)`:
  scalar shorthand coerces through hotkey (`url`)
* `method`:
  uppercased and clamped to allowed methods
  (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`)
  invalid values fall back to default (`GET`)
* `credentials`:
  true only on explicit yes-intent (`lib.bool.yes`)
* `timeoutMs`:
  numeric coercion with default fallback (`CONSTANTS.REQUEST.TIMEOUT_DEFAULT`, currently `10`)
* `headers`:
  always hash-coerced
* `flags`:
  always hash-coerced
* `encoding` / `transport`:
  free-form passthrough fields (not clamped here)

Default request shape includes:

* `url: undefined`
* `method: "GET"`
* `encoding: "urlencoded"`
* `body: undefined`
* `headers: {}`
* `credentials: undefined` (normalizer produces bool result at compile output)
* `timeoutMs: undefined` (normalizer produces numeric output)
* `transport: undefined`
* `flags: { json: undefined, urlencoded: true }`

---

## 5) `request_shape` defaults example

```js
{
  request_shape: {
    method: "POST",
    timeoutMs: 8000,
    headers: { "X-App": "demo" }
  },
  requests: {
    save: "/api/save",
    load: { url: "/api/load", method: "GET" }
  }
}
```

In this example:

* both requests inherit shape defaults
* `load.method` overrides shape default to `GET`

---

## 6) Usage posture in ActiveTags

Requests are a generalized normalized key store.

Important:

* ActiveTags core does not execute request definitions automatically.
* There is no internal request controller that runs `job.config.schema.requests` by itself.
* This block is designed for builtins and user-defined functions to consume.

Typical consumption pattern:

```js
const req = lib.hash.get(job, "config.schema.requests.save");
```

Then your builtin/op decides how to serialize/submit.

---

## 7) Attribute-based setup

Because prefixed attributes are inflated by `-`, these patterns work:

```html
<div
  data-activetag
  data-request="/api/default"
  data-requests-save-url="/api/save"
  data-requests-save-method="post"
  data-request-shape-timeout-ms="8000"
  data-request-shape-headers-x-app="demo">
</div>
```

This maps to:

* `request` (scalar shorthand -> `url`)
* `requests.save.url`
* `requests.save.method`
* `request_shape.timeout.ms`
* `request_shape.headers.x.app`

---

## 8) Common pitfalls

* Expecting auto execution:
  definitions are stored/normalized, not automatically dispatched by core runtime.
* Method casing:
  values are clamped to allowed methods; unknown methods silently default.
* Timeout assumptions:
  timeout is normalized numerically; non-numeric values fall back.
* `http.send` semantics:
  request execution behavior is documented in [HTTP Send (`http.send`)](./HTTP_SEND.md).

---

## See also

* [Pipelines](./PIPELINES.md)
* [Events](./EVENTS.md)
* [Intervals](./INTERVALS.md)
* [Builtins & Operations](./OPERATIONS_BUILTINS.md)
* [HTTP Send (`http.send`)](./HTTP_SEND.md)
* [Configuration Model](./CONFIGURATION.md)
* [Runtime Lifecycle](./RUNTIME_LIFECYCLE.md)
* [Usage TOC](./TOC.md)
* [README](../../README.md)
