Here’s a **locked Runtime Validator spec v1** for the Job Config *after normalization + merge*. It’s written as rules (not code) so it’s implementation-agnostic, but deterministic.

This validator runs in two phases:

1. **Normalize & Merge** (build effective buckets)
2. **Validate** (hard errors vs soft warnings)

Grounded in the kinds of silent-bail issues v098 had (missing interval.repeat, missing request url, etc.). 

---

# Runtime Validator v1 (Job Config)

## Inputs

* `rawConfig`: object from external config + data-* inflate, etc.
* `job`: `{ element, name, ds/env/ws }`
* `pipelines`: `rawConfig.pipelines` (required by schema)

## Output

A `ValidationReport`:

```ts
type ValidationReport = {
  ok: boolean;
  errors: Array<{ code: string; path: string; message: string }>;
  warnings: Array<{ code: string; path: string; message: string }>;
  normalized: NormalizedJobConfig; // optional, if you want validator to also return it
};
```

---

## Phase 1: Normalize & Merge (deterministic)

### 1.1 Normalize `require`

* If `require` is a string → split on whitespace to array.
* If missing → set to `[]`.

### 1.2 Normalize `enable`

Defaults:

* `enable.enabled = true` if missing
* `enable.autorun = true` if missing

Normalize `enable.autorun` to an array selector:

* if `false` → `[]`
* if `true` → `["__DEFAULT__"]` (special token meaning “use autorun default set”)
* if string → split whitespace into `["a","b"]`
* if array → use as-is

### 1.3 Normalize `confirm`

* If `confirm` is `true` → normalize to `{ mode:"default" }`
* If string → `{ mode:"text", message:string }`
* If `false|null|undefined` → `{ mode:"none" }`

Normalize `pipelineConfirm`:

* For each pipeline name:

  * boolean/string → same normalization as above

### 1.4 Build effective request bucket

Let:

* `defaultRequest = rawConfig.request || null`
* `namedRequests = rawConfig.requests || {}`

Build `effectiveRequests`:

* If `defaultRequest` exists → `effectiveRequests.default = defaultRequest`
* For each `name in namedRequests`:

  * `effectiveRequests[name] = deepMerge(defaultRequest, namedRequests[name])`

(Deep merge rules: objects recursive, arrays replaced, primitives last-wins.)

### 1.5 Build effective interval bucket

Let:

* `defaultInterval = rawConfig.interval || null`
* `namedIntervals = rawConfig.intervals || {}`

Build `effectiveIntervals`:

* If `defaultInterval` exists → `effectiveIntervals.default = defaultInterval`
* For each `name in namedIntervals`:

  * `effectiveIntervals[name] = deepMerge(defaultInterval, namedIntervals[name])`

Normalize legacy `disabled`:

* If `disabled === true` → set `enabled = false`

Normalize `interval.autorun` (same as enable.autorun):

* false → []
* true → ["**DEFAULT**"]
* string → split
* array → as-is

---

## Phase 2: Validation Rules

### Error severity levels

* **ERROR**: job must not run; interval must not start; `request.submit` must fail fast if executed.
* **WARN**: job may run, but something is suspicious or will no-op.

---

## 2.1 Core structural validation (ERROR)

#### R001: pipelines exists

* If `pipelines` missing or empty → **ERROR**

  * path: `pipelines`
  * code: `R001_NO_PIPELINES`

#### R002: pipeline block has run

* For each pipeline `pipelines[k]`:

  * If `run` missing or empty → **ERROR**

    * path: `pipelines.${k}.run`
    * code: `R002_PIPELINE_NO_RUN`

#### R003: referenced pipeline names must exist

Collect pipeline references from:

* `run.defaultPipeline`
* `run.plan[]`
* `interval*.pipeline`
* `enable.autorun` selector list (if not default token)
* `interval*.autorun` selector list (if not default token)
* `pipeline.run` ops
* optional: `pipelineConfirm` keys should refer to real pipelines (WARN or ERROR)

If any referenced pipeline name not in `pipelines` → **ERROR**

* code: `R003_UNKNOWN_PIPELINE`
* path: wherever referenced

---

## 2.2 Request validation (ERROR/WARN)

> Requests can be absent if pipelines never submit. But if `request.submit` exists, it must resolve.

#### R101: validate request specs in buckets (WARN)

For each entry in `effectiveRequests`:

* If both `url` and legacy `action` are missing → **WARN**

  * code: `R101_REQUEST_NO_URL`
  * path: `requests.${name}.url`

#### R102: request.submit ref must resolve (ERROR at pipeline compile-time if possible)

Scan pipelines for `{ op:"request.submit" }`:

For each `request.submit` op:

* Determine `ref`:

  * if op has `request.ref` → use it
  * else → `ref = "default"`
* If `effectiveRequests[ref]` missing:

  * **ERROR**
  * code: `R102_REQUEST_REF_NOT_FOUND`
  * path: `pipelines.${p}.run[${i}]`

#### R103: request.submit resolved request must have url (ERROR)

After merging inline overrides + bucket + default + element fallback (runtime resolution):

* If final `url` still missing → **ERROR**

  * code: `R103_REQUEST_URL_MISSING`
  * path: `pipelines.${p}.run[${i}].request`

*(This mirrors v098 where sendRequest bails if url missing.)* 

#### R104: method sanity (WARN)

If method exists and not one of common verbs (`GET POST PUT PATCH DELETE HEAD OPTIONS`) → **WARN**

* code: `R104_REQUEST_METHOD_UNUSUAL`

---

## 2.3 Interval validation (ERROR/WARN)

#### R201: interval enabled requires repeat + pipeline (ERROR)

For each interval in `effectiveIntervals`:

* Determine `enabled`:

  * if `enabled === false` → skip all checks
  * else (default true) → interval is enabled
* If enabled:

  * If `repeat` missing or not >0 → **ERROR**

    * code: `R201_INTERVAL_REPEAT_MISSING`
    * path: `intervals.${name}.repeat`
  * If `pipeline` missing → **ERROR**

    * code: `R202_INTERVAL_PIPELINE_MISSING`
    * path: `intervals.${name}.pipeline`

*(v098 logs and bails if repeat missing; v1 makes it a formal error.)* 

#### R203: interval pipeline must exist (ERROR)

* If `interval.pipeline` not in `pipelines` → **ERROR**

  * code: `R203_INTERVAL_UNKNOWN_PIPELINE`

#### R204: overlap + wait risk (WARN)

If `allowOverlap === true` and the interval pipeline contains `request.submit`:

* **WARN** “may overlap network calls”
* code: `R204_INTERVAL_OVERLAP_WITH_REQUEST`

This calls out the “clogging under slow network” risk explicitly. 

#### R205: max sanity (WARN)

If `max` exists and is 0 → treat as infinite (ok)
If `max` < 0 → **WARN** (or ERROR if you want strict)

* code: `R205_INTERVAL_MAX_INVALID`

---

## 2.4 Confirm validation (WARN)

#### R301: pipelineConfirm key should exist (WARN)

If `pipelineConfirm` contains key not in pipelines:

* **WARN**
* code: `R301_PIPELINECONFIRM_UNKNOWN_PIPELINE`

---

## 2.5 TargetRef validation (optional, usually WARN)

You *can* validate TargetRef strings syntactically, but full resolution needs DOM/job state.
Recommended:

* If `TargetRefString` does not contain `:` → **WARN** malformed
* code: `R401_TARGETREF_MALFORMED`

---

## 2.6 Requirements validation (WARN/ERROR depending on mode)

#### R501: require references unknown job names (WARN)

At config-validation time you may not know all jobs yet.
So:

* If require references job name not registered yet → **WARN** (not ERROR)
* code: `R501_REQUIRE_NOT_FOUND_YET`

At runtime (autorun tick):

* if required job still incomplete → job is simply gated (not error)

This matches v098’s gating semantics. 

---

# Optional: “compile-time pipeline report”

As a nice debugging output, produce:

* `pipelinesUsedByAutorun`
* `pipelinesUsedByIntervals`
* `requestsReferencedByPipelines`
* `intervalsEnabled`

So users can see what will actually run.

---

If you want, next I can write a **very small “normalized config object” example** showing what the validator outputs after merge (effectiveRequests/effectiveIntervals + normalized autorun selectors), using your current config draft.
