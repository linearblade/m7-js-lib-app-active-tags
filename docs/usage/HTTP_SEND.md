# HTTP Send (`http.send`) — ActiveTags

[README](../../README.md) -> [Usage TOC](./TOC.md)

This page documents the `http.send` builtin operation.

Primary source files:

* [../../src/builtins/http/httpSend.js](../../src/builtins/http/httpSend.js)
* [../../src/builtins/http/index.js](../../src/builtins/http/index.js)
* [../../src/class/job/config/schema/constants.js](../../src/class/job/config/schema/constants.js)
* [../../src/class/job/config/schema/Master.js](../../src/class/job/config/schema/Master.js)

---

## 1) What `http.send` does

`http.send` resolves an HTTP request config, sends it, then exports response data to the ticket buffer.

Key runtime behavior:

* HTTP transport only (`transport` must be `"http"` or empty).
* Request config can be assembled from:
  * named request in `job.config.schema.requests`
  * `buffer` payload (optional)
  * inline `request` override
* Transport execution is delegated to `lib.request.send(...)`.
* Response is always written to `buffer` and `inputs.response`.
* Optional response policy can project/validate response output.

---

## 2) Args contract

`http.send` parses args using:

```js
lib.args.parse(args, { adhoc: false }, { parms: "name buffer request adhoc", pop: true })
```

Fields:

* `name`:
  request key lookup in `job.config.schema.requests`
* `buffer`:
  boolish; when true, merges `lib.hash.to(buffer.get())`
* `request`:
  inline request hash override
* `adhoc`:
  if true, `name` may be omitted

Name behavior:

* `adhoc: false` -> missing `name` defaults to `"default"`
* `adhoc: true` -> missing `name` is allowed

Merge order:

1. named request (`name`) when provided
2. `buffer` payload when `buffer` is true
3. inline `request`

Arrays are replaced (not concatenated) during merge.

---

## 3) URL and request resolution

URL resolution order:

1. `request.endpoint.url`
2. constructed from:
   `endpoint.scheme`, `endpoint.host`, `endpoint.port`, `endpoint.path`, `endpoint.query`

Method default:

* defaults to `GET` when method is empty.

Body encoding:

* `encoding: "json"` with object/array body -> JSON string + auto `content-type: application/json` (if missing)
* `encoding: "urlencoded"` with hash body -> querystring + auto `content-type: application/x-www-form-urlencoded` (if missing)

Credentials:

* uses `request.credentials.mode` when provided
* otherwise uses `withCredentials` intent (`include` mode)

---

## 4) Transport execution path

Execution path:

1. ActiveTags `http.send` calls `lib.request.send(envelope)`
2. `lib.request` handles fetch/XHR fallback and response normalization

Response payload normalization:

* normalized payload includes:
  `ok`, `status`, `statusText`, `url`, `headers`, `body`

---

## 5) Response policy (`request.response`)

`request.response` is optional.

Supported policy keys:

* `parse`: `auto | json | text | raw | blob | arrayBuffer`
* `return`: `payload | body | json | text | headers | status`
* `path`: optional deep-pick path on selected return value
* `requireOk`: fail stage when response is not ok
* `acceptedStatus`: explicit accepted status list

Output behavior:

* Projected value is written to `buffer` and `inputs.response`.
* On policy failure, projected value is still written, then stage returns `error`.
* Policy metadata is written under `buffer.meta().http.responsePolicy`.

Default policy:

* if `request.response` is empty/omitted:
  * parse defaults to `auto`
  * return defaults to `payload`
  * no path pick
  * no status/ok enforcement

Note:

* Default request shape keeps `response` empty by design because response structures vary by transport.

---

## 6) Return/status contract

Successful stage returns:

* `status: "ok"`
* detail includes `op`, `refs`, `url`, `method`, and response `status`

Error stage returns:

* `status: "error"`
* error info in StageResult
* response export may still be present in buffer/meta

Network/transport note:

* some transport failures may be normalized into payload (`ok:false`, `status:0`) and still return `status:"ok"` unless `request.response.requireOk` or `acceptedStatus` enforces failure.

---

## 7) Examples

### Named request + buffer override

```js
{
  pipelines: {
    runQuote: {
      run: [
        // put endpoint/body override into buffer first
        "buffer.set:{endpoint:{url:'/api/quote?symbol=M7X'}}",
        { op: "@http.send", args: { name: "quote", buffer: true } }
      ],
      error: ["@error.dump"]
    }
  }
}
```

### Ad-hoc request (no name)

```js
{
  pipeline: {
    run: [
      {
        op: "@http.send",
        args: {
          adhoc: true,
          request: {
            transport: "http",
            endpoint: { url: "https://jsonplaceholder.typicode.com/todos/1" },
            method: "GET"
          }
        }
      }
    ]
  }
}
```

### Response policy projection

```js
{
  requests: {
    quote: {
      transport: "http",
      endpoint: { url: "/api/quote" },
      response: {
        parse: "json",
        return: "body",
        path: "data.price",
        requireOk: true
      }
    }
  }
}
```

---

## See also

* [Requests](./REQUESTS.md)
* [Builtins & Operations](./OPERATIONS_BUILTINS.md)
* [Examples Library](./EXAMPLES_LIBRARY.md)
* [Usage TOC](./TOC.md)
* [README](../../README.md)
