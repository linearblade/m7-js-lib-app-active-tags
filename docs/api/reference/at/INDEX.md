# Deep Reference — Top-Level `AT`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT` Deep Reference](./INDEX.md)

Primary source:

* [../../../../src/ActiveTags.js](../../../../src/ActiveTags.js)
* [../../../../src/traits/engine.js](../../../../src/traits/engine.js)
* [../../../../src/traits/job.js](../../../../src/traits/job.js)

---

## `start()`

### Signature

`start() -> Promise<void>`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | `start()` takes no arguments. |

### Returns

Resolves when boot-time activation is complete: initial discover scan, optional observer start, interval/event registration, and optional interval/event activation.

### Side effects

* Reads `lib._env.root.document` and validates `document.body`.
* Calls `AT.discover.scan()`.
* May call `AT.observer.start()` when `conf.boot.observeDom` is enabled.
* Calls `AT.intervals.registerAll()` and `AT.events.registerAll()`.
* May call `AT.intervals.on()` and `AT.events.on()` based on boot flags.

### Failure modes

* Throws if `document` or `document.body` is missing.
* Propagates errors from discover/observer/events/intervals subsystems.

### Example

```js
const AT = new ActiveTags(lib, conf);
await AT.start();
```

### Related methods

* [`AT.discover.scan()`](../at-discover/INDEX.md)
* [`AT.observer.start()`](../at-observer/INDEX.md)
* [`AT.events.registerAll()`](../at-events/INDEX.md)
* [`AT.intervals.registerAll()`](../at-intervals/INDEX.md)

---

## `enqueueAll(reason?)`

### Signature

`enqueueAll(reason?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `reason` | `string` | No | Diagnostic reason attached to enqueue inputs. Defaults to `"none given"` when empty. |

### Returns

Number of enqueue attempts issued across all eligible jobs and autorun pipeline keys.

### Side effects

* Iterates over `AT.jobs.list()`.
* For eligible jobs (`enabled !== false` and non-empty `autorun` list), calls `AT.engine.enqueue(job, key, opts)`.
* Normalizes `"__DEFAULT__"` autorun entries to `"default"`.
* Writes enqueue return values to console (`console.log`).

### Failure modes

* No-op for jobs that are disabled or have no autorun pipelines.
* Propagates exceptions from `AT.engine.enqueue(...)` if enqueue fails.

### Example

```js
// Enqueue all autorun pipelines discovered so far.
const count = AT.enqueueAll("boot");
```

### Related methods

* [`AT.engine.enqueue()`](../at-engine/INDEX.md)
* [`AT.jobs.list()`](../at-jobs/INDEX.md)

---

## `toJob(ref)`

### Signature

`toJob(ref) -> Job|undefined`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `ref` | `any` | Yes | Job-like reference forwarded to the job registry resolver. |

### Returns

Resolved `Job` instance when found; otherwise `undefined`.

### Side effects

None. This is a pure resolver wrapper over `AT.jobs.resolve(...)`.

### Failure modes

* Returns `undefined` when resolution fails.
* Does not throw for unresolved references.

### Example

```js
const job = AT.toJob("DEFAULT__at-3");
if (!job) return;
```

### Related methods

* [`AT.jobs.resolve()`](../at-jobs/INDEX.md)

---

## See also

* [Top-level `AT` index page](../AT.md)
* [`AT.jobs` deep reference](../at-jobs/INDEX.md)
* [`AT.engine` deep reference](../at-engine/INDEX.md)
* [Reference Manual index](../INDEX.md)
