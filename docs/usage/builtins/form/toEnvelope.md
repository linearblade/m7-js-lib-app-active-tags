# `form.toEnvelope`

[Builtins Index](../INDEX.md) -> [Form Module](./INDEX.md)

Source:

* [../../../../src/builtins/form/formToEnvelope.js](../../../../src/builtins/form/formToEnvelope.js)

## What it does

Builds a request envelope from form data and writes the envelope to `buffer`.

Source selection:

1. if `buffer.get()` already looks like `form.collect` output, use it
2. otherwise collect from `trigger` (fallback `job.e`) via `lib.dom.form.collect`

Envelope build path:

* body/url/header via `lib.dom.form.*`
* normalized request envelope via `lib.request.makeEnvelope`

## Args

Optional hash args, common fields:

* `json` (boolish): if yes and no explicit `contentType`, sets JSON mode
* `structured` / `structure` (boolish): controls flat vs inflated JSON/body shape
* `method`
* `contentType`
* `valueAsBody`
* `url` or `request.url`
* `headers` or `request.headers`
* `transport` / `request.transport`
* `credentials` / `request.credentials`
* `timeoutMs` / `request.timeoutMs`
* `response` / `responseParse` / `request.response`

Notes:

* boolish flags are resolved with `lib.bool.yes/no`.
* in JSON mode, `envelope.body` remains an object so pipelines can edit it before `@http.send`.

## Side Effects

* Writes envelope to `buffer`.
* Does not submit network request by itself.

## Return Contract

* `ok`: includes `source` (`buffer` or `collect`), plus method/url summary.
* `error`: unresolved source, collection failure, or envelope-build failure.

## Typical pipeline

```js
{
  run: [
    "@form.collect",
    { op: "@form.toEnvelope", args: { json: true, structured: true } },
    { op: "@http.send", args: { adhoc: true, buffer: true } }
  ],
  error: ["@error.dump"]
}
```
