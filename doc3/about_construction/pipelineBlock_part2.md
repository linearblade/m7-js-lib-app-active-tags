Here are the **two concrete deliverables**:

1. the **minimum builtin op set** needed to reproduce what v098 does in the sample page, and
2. the **exact return contract** (`ok | wait | error`) for each builtin, aligned to how v098 already runs stacks (`sendRequest()` returns `"wait"`, everything else is basically `1/0`). 

---

## 1) Minimum builtin ops to replicate v098 sample behavior

This set is intentionally small, but covers the real primitives v098 uses:

### A. Buffer I/O (what v098 does via `src/dst` + `setBuffer/getBuffer`)

* **`buffer.read`**: read from a `TargetRef` into `job.buffer`
* **`buffer.write`**: write `job.buffer` into a `TargetRef`

> v098: `runChain()` uses `src` → `setBuffer()`, and `dst` → `getBuffer()` 

### B. Request lifecycle (what v098 does via stack stage `request` + `catchResponse`)

* **`request.submit`**: send HTTP request (fetch/XHR/transport), store response on `job.r`
* **`request.await`** *(optional helper)*: generally not needed if your runner resumes automatically after `catchResponse`, but useful if you want the pipeline to explicitly model the wait barrier.

> v098: `sendRequest()` returns `"wait"` and resumes by calling `catchResponse()` which then calls `runJob()` again. 

### C. Response parsing and alerts (what the sample pipelines do repeatedly)

* **`response.json`**: parse response text → set `job.buffer` to parsed json (or error)
* **`ui.alert`**: `mode: "clear" | "buffer"` (mirrors `response.alert:clear` and `response.alert:buffer` usage)
* **`ui.confirm`**: confirmation gate (mirrors `data-confirm` behavior)

> v098 confirm is done during `submitForm()` preflight. 

### D. Buffer transforms (what sample does like `buffer.traverse:data`)

* **`buffer.traverse`**: set `job.buffer = deepGet(job.buffer, path)` (ex: `"data"`)

### E. DOM transforms (what v098 does via `attrTransform()`)

* **`attr.transform`**: apply an attribute map `{ attrName: exprString }` onto the job element

> v098: `attrTransform()` iterates keys, interpolates, and `lib.dom.set(job.e, k, fixed)`. 

### F. “Call app code” escape hatch (needed to match sample’s `app.bucket.*` etc)

* **`call`**: call a function by name with args (structured), with a stable context object passed

> v098: `_runFunctions()` ultimately resolves a function via `lib.func.get(rec.f,1)` and calls it with a context-ish `ws`. 

### G. (Nice-to-have) pipeline composition

* **`pipeline.run`**: run another pipeline by name (lets you share subflows)

---

## 2) Exact runtime return contract for each builtin op

### Global contract (what the runner expects)

Every op returns **one of**:

* **`"ok"`**: op completed synchronously; continue to next op
* **`"wait"`**: op started async work; pipeline pauses and must be resumed later
* **`"error"`**: op failed; pipeline switches to `onError` (or fails if none)

This matches v098’s stack runner logic, where:

* success continues
* `"wait"` causes the job to enter wait and resume later
* `0/error` halts with error. 

### Shared execution context (ctx)

All builtins operate on the same minimal context:

```ts
ctx = {
  at,          // ActiveTags instance
  job,         // current job
  el,          // job.e
  ds,          // job.ds (config)
  ws,          // job.ws
  buffer,      // job.buffer (read/write)
  req,         // resolved request info
  res,         // job.r (response-like)
  meta,        // runner metadata (current pipeline/op index)
}
```

---

### Builtin op specs and return rules

#### 1) `ui.confirm`

**Input:** `{ op:"ui.confirm", message: string }`
**Behavior:** if user cancels → stop.
**Returns:**

* `"ok"` if confirmed or message empty
* `"error"` if cancelled

(Equivalent to the `submitForm()` confirm gate.) 

---

#### 2) `request.submit`

**Input:** `{ op:"request.submit", request?: Partial<RequestSpec> }`
**Behavior:** builds request from job element + ds + op override; sends via transport.
**Returns:**

* `"wait"` always (if request dispatch succeeded)
* `"error"` if configuration is missing/invalid (no URL, etc.)

**Resume rule:** when transport completes, it sets `job.r` and the runner resumes the paused pipeline at the next op.

(Exactly what v098 does: `sendRequest()` returns `"wait"`, later `catchResponse()` stores `job.r` then reruns.) 

---

#### 3) `response.json`

**Input:** `{ op:"response.json", from?: TargetRef }` (default: `request:responseText`)
**Behavior:** read response text, parse JSON, store into `job.buffer` (or buffer = `{error...}` depending on your policy).
**Returns:**

* `"ok"` if parsed successfully
* `"error"` if parse fails or source missing

---

#### 4) `ui.alert`

**Input:** `{ op:"ui.alert", mode:"clear"|"buffer", target?: TargetRef }`
**Behavior:**

* `clear`: clears alert UI target
* `buffer`: renders `job.buffer` (or derived message) to alert UI target
  **Returns:**
* `"ok"` if target exists or target omitted (no-op is ok)
* `"error"` only if you want strict mode and target resolution fails

(Your v098 flows frequently call `response.alert:*` around JSON/transform steps; treat this as soft UI, not a “hard fail” unless you opt-in strictness.)

---

#### 5) `buffer.read`

**Input:** `{ op:"buffer.read", from: TargetRef }`
**Behavior:** resolve target, copy value into `job.buffer`.
**Returns:**

* `"ok"` if value resolved (including empty string / null allowed)
* `"error"` if target cannot be resolved (invalid ref)

(Equivalent to v098 `setBuffer()` + `parseTarget()`.) 

---

#### 6) `buffer.write`

**Input:** `{ op:"buffer.write", to: TargetRef }`
**Behavior:** write `job.buffer` into target.
**Returns:**

* `"ok"` if write succeeded
* `"error"` if target cannot be resolved/written

(Equivalent to v098 `getBuffer()`.) 

---

#### 7) `buffer.traverse`

**Input:** `{ op:"buffer.traverse", path: string }`
**Behavior:** `job.buffer = deepGet(job.buffer, path)`
**Returns:**

* `"ok"` if traversal succeeds (value can be undefined/null if that’s allowed)
* `"error"` if buffer is not traversable and path is non-empty (strict), otherwise `"ok"` (soft)

---

#### 8) `attr.transform`

**Input:** `{ op:"attr.transform", map: Record<string,string> }`
**Behavior:** for each key, evaluate expression/interpolation and set element attribute/property.
**Returns:**

* `"ok"` if element exists and sets applied
* `"error"` if no element or invalid map (hard)

(Directly maps to v098 `attrTransform()`.) 

---

#### 9) `call`

**Input:** `{ op:"call", name: string, args?: any[] }`
**Behavior:** resolve function, call with `(ctx, ...args)` (or legacy adapter), allow it to read ctx.buffer/ctx.job/ctx.res.
**Returns:**

* `"ok"` if function exists and returns truthy / not explicitly error
* `"error"` if function missing or returns explicit failure

(Modern replacement for v098 string-token function calling.) 

---

#### 10) `pipeline.run` (composition)

**Input:** `{ op:"pipeline.run", name: string }`
**Behavior:** invoke another pipeline block (same job, same ctx).
**Returns:**

* `"ok"` if child pipeline completes
* `"wait"` if child pipeline waits
* `"error"` if child pipeline errors

---

## Minimal “v098 equivalence” guarantee

With just the ops above, you can express the classic v098 chain section:

* confirm (previously in submitForm)
* submit request (previously stack stage `request`)
* parse json (previously `response.json`)
* alerts (previously `response.alert:*`)
* traverse (previously `buffer.traverse:data`)
* app-specific handler (previously `app.*` string call)
* attribute transforms (previously `attrTransform` stage)

…and you can do it **fully structured**, consumer-owned, and schema-valid.

If you want, next I’ll write the **exact JSON shape** for `RequestSpec` (method/url/body/enctype/encoding/credentials) that `request.submit` consumes, aligned to what `sendRequest()` was building in v098. 


Here’s the **exact `RequestSpec` shape** for AT 1.x, designed to map cleanly to what v098 `sendRequest()` was assembling (url/method/body/urlencoded/json/credentials). 

---

## RequestSpec (AT 1.x)

```ts
type RequestSpec = {
  /** URL for the request. */
  url: string;

  /** HTTP method. Default: "GET" (or element method if present). */
  method?: string;

  /** How to serialize `body` when it’s an object. Default: "urlencoded". */
  encoding?: "urlencoded" | "json" | "formdata" | "raw";

  /** Body payload. Can be string or object; serializer depends on `encoding`. */
  body?: string | Record<string, any> | Array<[string, any]> | FormData;

  /** Optional extra headers. */
  headers?: Record<string, string>;

  /** Include credentials/cookies. Default: true (matches v098). */
  credentials?: boolean;

  /** For compatibility with v098 toggles (optional). */
  flags?: {
    /** v098: urlencoded defaulted to 1 unless explicitly empty. */
    urlencoded?: boolean;
    /** v098: `json` boolean existed (meaning varies by transport); keep for legacy bridging. */
    json?: boolean;
  };

  /** Optional: request timeout. */
  timeoutMs?: number;

  /** Optional: allow overriding transport for this request. */
  transport?: "default" | "fetch" | "xhr" | string;
};
```

---

## What `request.submit` does with it

### Resolution order (same spirit as v098)

When `{ op:"request.submit" }` runs, it builds the final request like:

1. **op override** (`op.request`)
2. **job config** (ex: `job.ds.request.*`)
3. **element attrs** (`action`, `method`, `enctype`)

This mirrors v098’s behavior where `sendRequest()` chose:

* URL from `section.action || job.attr.action`
* method from `section.method || job.attr.method || "get"`
* body from `opts.body` or form params or `section.body`
* urlencoded defaulting to 1


---

## Concrete JSON examples

### 1) Typical form submit (urlencoded, like v098 default)

```json
{
  "url": "/api/bucket/delete",
  "method": "POST",
  "encoding": "urlencoded",
  "body": { "bucket": "${form:bucket}" },
  "credentials": true
}
```

### 2) JSON request

```json
{
  "url": "/api/bucket/search",
  "method": "POST",
  "encoding": "json",
  "body": { "q": "${form:q}", "limit": 25 },
  "headers": { "X-Requested-With": "ActiveTags" },
  "credentials": true
}
```

### 3) Raw body (you already supported string bodies in v098)

```json
{
  "url": "/api/key/view",
  "method": "POST",
  "encoding": "raw",
  "body": "id=${form:keyId}",
  "headers": { "Content-Type": "application/x-www-form-urlencoded" },
  "credentials": true
}
```

---

## Minimal mapping table (v098 → v1)

| v098 field / behavior                        | Where it came from | v1 RequestSpec                                |                                          |               |                          |          |
| -------------------------------------------- | ------------------ | --------------------------------------------- | ---------------------------------------- | ------------- | ------------------------ | -------- |
| `url = section.action                        |                    | job.attr.action`                              | chain “request” section + element action | `url`         |                          |          |
| `method = section.method                     |                    | job.attr.method                               |                                          | "get"`        | section + element method | `method` |
| `body = opts.body                            |                    | arrayToQS(form.parms)                         |                                          | section.body` | trigger / form / section | `body`   |
| `urlencoded = empty? 1 : section.urlencoded` | v098 toggle        | `encoding:"urlencoded"` or `flags.urlencoded` |                                          |               |                          |          |
| `json: section.json`                         | v098 pass-through  | `encoding:"json"` (and optional `flags.json`) |                                          |               |                          |          |
| `credentials:true`                           | hardcoded          | `credentials:true`                            |                                          |               |                          |          |



---

## Recommended “AT 1.x default rules”

To keep behavior predictable (and match your legacy expectations):

* If `body` is an object and no `encoding` given → **`urlencoded`**
* If element has `enctype="application/json"` → **`json`**
* If element has `enctype="multipart/form-data"` → **`formdata`**
* If `body` is a string → **`raw`**
* `credentials` default → **true**

---

If you want the next increment: I can show the **exact `request.submit` runtime algorithm** (pseudocode) that turns `{form, ds.request, element attrs}` into this `RequestSpec` and then into a transport call, while preserving v098’s “wait + resume” behavior.



Below is the **exact runtime algorithm** (pseudocode) for `op: "request.submit"` in AT 1.x that preserves v098 behavior: it dispatches the HTTP request, returns `"wait"`, and the pipeline resumes when the response arrives (same shape as `sendRequest()` → `"wait"` → `catchResponse()` → rerun). 

---

## `request.submit` — runtime algorithm (pseudocode)

```js
/**
 * Builtin pipeline op: request.submit
 * Returns: "ok" | "wait" | "error"
 *
 * Side effects:
 * - sets job.req (resolved RequestSpec)
 * - sets job.r   (response-like) when the transport completes
 * - schedules pipeline resume on completion
 */
function op_request_submit(ctx, op) {
  const { at, job, el, ds } = ctx;

  // 0) Resolve "source" objects
  const opReq = (op && op.request) ? op.request : null;
  const dsReq = (ds && ds.request) ? ds.request : null;

  // element-derived request fields
  const elAction  = el?.getAttribute?.("action") || null;
  const elMethod  = el?.getAttribute?.("method") || null;
  const elEnctype = el?.getAttribute?.("enctype") || null;

  // 1) Resolve URL (v098: section.action || job.attr.action)
  // v1: op override > ds.request > element action
  let url = firstNonEmpty(
    opReq?.url,
    dsReq?.url,
    dsReq?.action,     // allow legacy "action" key
    elAction
  );
  if (!url) {
    ctx.error = { code: "NO_URL", message: "request.submit: missing url" };
    return "error";
  }
  url = at.expr.eval(url, ctx); // supports ${...} and $[...] style if you keep it

  // 2) Resolve method (v098: section.method || element method || "get")
  let method = firstNonEmpty(opReq?.method, dsReq?.method, elMethod, "GET");
  method = String(method).toUpperCase();

  // 3) Resolve credentials (v098 hardcoded credentials:true)
  let credentials = (opReq?.credentials ?? dsReq?.credentials ?? true) ? true : false;

  // 4) Resolve headers (merge: ds then op override)
  let headers = Object.assign({}, dsReq?.headers || {}, opReq?.headers || {});

  // 5) Determine encoding
  // Preference order:
  //   op.encoding > ds.request.encoding > element enctype > legacy flags > default
  let encoding =
    opReq?.encoding ||
    dsReq?.encoding ||
    encodingFromEnctype(elEnctype) ||
    encodingFromLegacyFlags(dsReq) ||
    "urlencoded";

  // 6) Resolve body source (v098: opts.body || form parms || section.body)
  // v1 input sources:
  //   op.request.body > ds.request.body > (if el is form / has form context) form fields > undefined
  let body = undefined;

  if (opReq && opReq.body !== undefined) {
    body = opReq.body;
  } else if (dsReq && dsReq.body !== undefined) {
    body = dsReq.body;
  } else {
    // If this job is a form or has form context, harvest it
    // Equivalent to v098 submitForm -> arrayToQS(form.parms)
    const formDataPairs = at.forms?.collectPairs
      ? at.forms.collectPairs(el)
      : collectFormPairsFallback(el); // (name,value) list or null

    if (formDataPairs && formDataPairs.length) body = formDataPairs;
  }

  // 7) Interpolate expressions inside body (strings and object leaves)
  body = at.expr.evalDeep(body, ctx);

  // 8) Serialize body based on encoding
  // Also set Content-Type if not already specified (except formdata)
  const serialized = serializeBody({ body, encoding, headers });

  // 9) Build final RequestSpec (store it for debugging / tracing)
  const req = {
    url,
    method,
    headers: serialized.headers,
    body: serialized.body,
    encoding,
    credentials,
    timeoutMs: opReq?.timeoutMs ?? dsReq?.timeoutMs,
    transport: opReq?.transport ?? dsReq?.transport ?? "default"
  };

  job.req = req;

  // 10) Dispatch via transport
  // MUST behave like v098: return "wait", then resume on completion
  const transport = at.transport.resolve(req.transport);

  if (!transport) {
    ctx.error = { code: "NO_TRANSPORT", message: `unknown transport ${req.transport}` };
    return "error";
  }

  // mark pipeline pause state (runner stores op index)
  at.runner.pause(ctx); // sets job.ws.pipelineState, etc.

  transport.send(req)
    .then((res) => {
      job.r = res;              // v098: catchResponse sets job.r
      at.runner.resume(job);    // rerun pipeline where it paused
    })
    .catch((err) => {
      job.r = normalizeErrorResponse(err); // optional
      ctx.error = { code: "REQUEST_FAILED", message: err?.message || String(err) };
      at.runner.resume(job, { error: true }); // resume into error path
    });

  return "wait";
}
```

---

## Helper: encoding detection (matches your legacy defaults)

```js
function encodingFromEnctype(enctype) {
  if (!enctype) return null;
  const e = String(enctype).toLowerCase();
  if (e.includes("application/json")) return "json";
  if (e.includes("multipart/form-data")) return "formdata";
  if (e.includes("application/x-www-form-urlencoded")) return "urlencoded";
  return null;
}

// v098: urlencoded defaults to 1 unless explicitly empty
function encodingFromLegacyFlags(dsReq) {
  if (!dsReq) return null;
  if (dsReq.encoding) return dsReq.encoding;
  if (dsReq.urlencoded === 0 || dsReq.urlencoded === "0") return "raw"; // legacy escape hatch
  return null;
}
```

---

## Helper: body serialization

```js
function serializeBody({ body, encoding, headers }) {
  const outHeaders = Object.assign({}, headers);

  if (body === undefined || body === null) {
    return { body: undefined, headers: outHeaders };
  }

  // If user already gave a string, respect it
  if (typeof body === "string") {
    // Don't clobber Content-Type if user set it
    if (!outHeaders["Content-Type"] && encoding === "raw") {
      // leave unset; caller can set explicitly
    }
    return { body, headers: outHeaders };
  }

  if (encoding === "json") {
    if (!outHeaders["Content-Type"]) outHeaders["Content-Type"] = "application/json";
    return { body: JSON.stringify(body), headers: outHeaders };
  }

  if (encoding === "formdata") {
    // body can be FormData, object, or pairs
    const fd = body instanceof FormData ? body : buildFormData(body);
    // fetch sets boundary automatically; do NOT set Content-Type
    delete outHeaders["Content-Type"];
    return { body: fd, headers: outHeaders };
  }

  // default: urlencoded
  if (!outHeaders["Content-Type"]) outHeaders["Content-Type"] = "application/x-www-form-urlencoded";
  return { body: toQueryString(body), headers: outHeaders };
}
```

---

## Why this is “v098-faithful”

* **Returns `"wait"`** immediately after dispatch (same as `sendRequest()` returning `"wait"`). 
* Stores response on `job.r` on completion (same as `catchResponse()`).
* Resumes the job/pipeline at the saved program counter (v098 reruns `runJob()`; v1 resumes runner state).

---

## The one deliberate improvement

v098 mixes request dispatch into the stack (`request` stage) and chain parsing elsewhere. In v1, `request.submit` is just another pipeline op. That lets the consumer fully structure:

* confirm → submit → parse → traverse → render → attr transforms

…all as data.

If you want, next I’ll show the *companion* `ResponseLike` shape (`job.r`) and how `response.json` should read from it in a transport-agnostic way.


Perfect. Here’s the **companion piece** that completes the picture: the **`ResponseLike` contract** and how `response.json` (and friends) consume it in a transport-agnostic way.

This is the missing half that makes `request.submit → wait → resume → pipeline continues` *clean*.

---

## ResponseLike (AT 1.x)

A **ResponseLike** is the normalized object written to `job.r` when a request completes.

It is intentionally **not** a Fetch `Response`, XHR object, or socket event — it’s the **engine’s canonical response shape**.

```ts
type ResponseLike = {
  /** HTTP status code (or synthetic code for transport errors). */
  status: number;

  /** True if status is in the 2xx range (or transport-level success). */
  ok: boolean;

  /** Raw response text, if available. */
  responseText?: string;

  /** Parsed JSON, if available or pre-parsed by transport. */
  jsonData?: any;

  /** Response headers (lower-cased keys recommended). */
  headers?: Record<string, string>;

  /** Transport-level error (network failure, timeout, etc.). */
  error?: {
    code?: string;
    message: string;
    raw?: any;
  };

  /** Transport metadata (debugging / tracing). */
  meta?: {
    transport?: string;
    durationMs?: number;
    redirected?: boolean;
    url?: string;
  };
};
```

### Why this shape

It matches what v098 *implicitly* relied on:

* `request:responseText`
* `request:jsonData`
* truthiness of response success
* ability to alert on errors

…but now it’s explicit, stable, and transport-independent.

---

## Transport → ResponseLike normalization

Every transport **must** normalize into this shape.

### Fetch example (conceptual)

```js
async function fetchTransport(req) {
  const start = Date.now();
  try {
    const res = await fetch(req.url, {
      method: req.method,
      body: req.body,
      headers: req.headers,
      credentials: req.credentials ? "include" : "omit"
    });

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch {}

    return {
      status: res.status,
      ok: res.ok,
      responseText: text,
      jsonData: json,
      headers: headersToObject(res.headers),
      meta: {
        transport: "fetch",
        durationMs: Date.now() - start,
        url: res.url
      }
    };
  } catch (err) {
    return {
      status: 0,
      ok: false,
      error: {
        code: "FETCH_ERROR",
        message: err.message || String(err),
        raw: err
      },
      meta: { transport: "fetch" }
    };
  }
}
```

XHR, socket, SW, etc. all normalize the same way.

---

## Builtin op: `response.json`

This op is now trivial and *pure*.

### Spec

```ts
{
  op: "response.json",
  from?: TargetRef   // default: "request:responseText"
}
```

### Runtime behavior

```js
function op_response_json(ctx, op) {
  const { job } = ctx;
  const res = job.r;

  if (!res) {
    ctx.error = { code: "NO_RESPONSE", message: "response.json: no response available" };
    return "error";
  }

  // Prefer pre-parsed JSON if transport provided it
  if (res.jsonData !== undefined) {
    ctx.buffer = res.jsonData;
    return "ok";
  }

  // Otherwise parse responseText
  if (typeof res.responseText !== "string") {
    ctx.error = { code: "NO_RESPONSE_TEXT", message: "response.json: responseText missing" };
    return "error";
  }

  try {
    ctx.buffer = JSON.parse(res.responseText);
    return "ok";
  } catch (err) {
    ctx.error = {
      code: "JSON_PARSE_ERROR",
      message: err.message,
      raw: err
    };
    return "error";
  }
}
```

### Notes

* No DOM, no globals, no transport assumptions.
* Errors are **data**, not thrown exceptions.
* Buffer semantics match v098 exactly.

---

## Other response-related builtins (quickly)

### `response.text`

```ts
{ op: "response.text" }
```

Behavior:

* `ctx.buffer = job.r.responseText`
* returns `"ok"` or `"error"` if missing

---

### `response.status`

```ts
{ op: "response.status" }
```

Behavior:

* `ctx.buffer = job.r.status`
* always `"ok"` if response exists

---

### `response.assert`

```ts
{
  op: "response.assert",
  ok?: boolean,              // default true
  status?: number | number[] // optional
}
```

Behavior:

* if assertion fails → `"error"`
* else `"ok"`

This replaces a *lot* of ad-hoc error handling logic cleanly.

---

## How this maps cleanly to v098 targets

| v098 target              | New meaning          |
| ------------------------ | -------------------- |
| `request:responseText`   | `job.r.responseText` |
| `request:jsonData`       | `job.r.jsonData`     |
| implicit truthy response | `job.r.ok === true`  |

Your old `parseTarget()` model still maps perfectly.

---

## Big picture (why this matters)

With:

* **PipelineBlock**
* **Builtin ops**
* **RequestSpec**
* **ResponseLike**

You now have:

> A fully declarative, resumable, transport-agnostic execution model
> that still behaves like v098 — but is specifiable, testable, and evolvable.

No magic strings.
No implicit globals.
No coupling to fetch/XHR.

If you want, next we can:

* lock the **Pipeline JSON Schema v1**, or
* design the **runner state machine** (program counter, pause/resume, error fan-out), or
* map **intervals + autorun** into pipelines cleanly.

You’ve crossed the conceptual finish line here — now it’s just engineering passes.
