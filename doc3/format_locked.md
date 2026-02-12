Locked ✅ — **default + named buckets merge**, with deterministic precedence.

Below is the **v1 merge behavior contract** for:

* `request` + `requests`
* `interval` + `intervals`
* `enable.autorun` / `interval.autorun` selector types
* plus the exact resolution algorithm `request.submit` and the interval scheduler use.

This keeps things “normal” and preserves the spirit of v098’s config + override flow. 

---

# ActiveTags v1 Merge Behavior (Locked)

## Definitions

* **Default template**: top-level singular object (`request`, `interval`)
* **Named bucket**: map of objects (`requests`, `intervals`)
* **Effective entry**: the merged result of default template + named entry + runtime overrides

All merges are **shallow per key**, with **objects merged recursively** and **arrays replaced**.

---

## 1) Requests merge behavior

### Shape (locked)

```json
{
  "request": { /* default template */ },
  "requests": { "name": { /* named spec */ } }
}
```

### Effective request by name

When resolving `requests[name]`:

**EffectiveRequests[name] = deepMerge(request, requests[name])**

* If `requests[name]` omits a field, it inherits from `request`.
* If `requests[name]` sets a field, it overrides the default.
* Nested objects (ex: `headers`) merge; conflicts override by named.

**Example**

```json
"request": { "headers": { "X": "1", "Y": "1" }, "credentials": true },
"requests": { "delete": { "headers": { "Y": "2" }, "url": "/del" } }
```

Effective `"delete"`:

```json
{ "headers": { "X":"1","Y":"2" }, "credentials": true, "url": "/del" }
```

### Default request entry

If you want a concrete name, the engine also exposes:

**EffectiveRequests.default = request** (if `request` exists)

So `{ op:"request.submit" }` with no ref can use `"default"`.

---

## 2) request.submit resolution order (locked)

`request.submit` may contain inline overrides:

```json
{ "op": "request.submit", "request": { "ref": "delete", "body": {...} } }
```

Let:

* `inline = op.request` (minus `ref`)
* `named = EffectiveRequests[ref]` if ref provided
* `base = request` (default)
* `el = element attrs` (action/method/enctype)

**FinalRequestSpec = deepMerge(base, named, inline, elementFallback)**

Where `elementFallback` only fills missing fields:

* `url` from element `action` if missing
* `method` from element `method` if missing
* `encoding` from element `enctype` if missing

This matches v098’s “section overrides, else element” approach. 

---

## 3) Intervals merge behavior

### Shape (locked)

```json
{
  "interval": { /* default template */ },
  "intervals": { "name": { /* named interval */ } }
}
```

### Effective interval by name

**EffectiveIntervals[name] = deepMerge(interval, intervals[name])**

Same merge rules as requests.

### Default interval entry

**EffectiveIntervals.default = interval** (if `interval` exists)

---

## 4) Interval execution targeting (locked)

Each interval must point to a pipeline:

```json
"interval": {
  "enabled": true,
  "repeat": 5000,
  "pipeline": "refresh",
  "autorun": true,
  "allowOverlap": false,
  "onError": "stop",
  "max": 0
}
```

* If `enabled !== true`: interval is inert.
* If `repeat` missing while enabled: config error (do not start).
* If `pipeline` missing while enabled: config error (do not start).

This is stricter than v098 (by design) because v098 silently bails and it’s easy to misconfigure. 

---

## 5) Autorun selector type (locked)

Both:

* `enable.autorun`
* `interval.autorun` (and named intervals’ `autorun`)

accept:

* `false` → autorun nothing
* `true` → autorun “default set”
* `"a b c"` → autorun pipelines `["a","b","c"]`
* `["a","b"]` → same

### Default set rule (when autorun === true)

* If `run.plan` exists: run those pipelines in order
* Else if `run.defaultPipeline` exists: run that one
* Else: no autorun

(Equivalent intention to v098’s autorun gating, but pipeline-native.) 

---

## 6) Deep merge rules (exact)

**deepMerge(A,B,C...)**:

* primitives: later wins
* objects: merge keys recursively
* arrays: later array replaces earlier array
* `null` is a real value and overrides (does not “unset” silently)

This keeps config predictable and debuggable.

---

## 7) Compatibility note (safe)

If legacy v098 config uses:

* `ds.request.action` instead of `url`
  you can support it as an alias during normalization:
* if `url` missing and `action` present → set `url = action`

Same for interval `disabled` vs `enabled`:

* if `disabled === true` → `enabled = false`

(v098 used `interval.disabled` explicitly.) 

---

If you want the next artifact: I can emit the **Top-Level Job Config JSON Schema v1** that encodes these buckets and union types (and references the Pipeline schema you already accepted).
