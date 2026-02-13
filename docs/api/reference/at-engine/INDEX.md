# Deep Reference — `AT.engine`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md)

Primary source:

* [../../../../src/class/engine/Engine.js](../../../../src/class/engine/Engine.js)
* [../../../../src/class/engine/EngineManager.js](../../../../src/class/engine/EngineManager.js)
* [../../../../src/class/engine/Tick.js](../../../../src/class/engine/Tick.js)

---

## `tick({ ctx?, ticket? } = {})`

### Signature

`tick({ ctx?, ticket? } = {}) -> Promise<Object>`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `ctx` | `Object` | No | Execution context forwarded to VM operations. |
| `ticket` | `string|Ticket|null` | No | Optional targeted ticket id/object. When omitted, scheduler-selected execution is used. |

### Returns

Normalized tick trace object (wrapped in a promise) describing one execution step.

### Side effects

* May promote queued ticket to active.
* Executes one VM stage.
* Updates ticket/job runtime state.
* Emits engine hooks (`onStage`, `onComplete`, `onError`, etc.) as applicable.

### Failure modes

* Does not throw VM step errors outward; they are normalized into error traces.
* Returns trace with `didWork: false` when nothing runnable, missing ticket, locked state, etc.

### Example

```js
const trace = await AT.engine.tick();
if (!trace.didWork) {
  // engine is idle or blocked
}
```

### Related methods

* [`drain({ max?, ticket?, ctx? } = {})`](./INDEX.md)
* [`enqueue(jobLike, key = "default", opts?)`](./INDEX.md)

---

## `drain({ max?, ticket?, ctx? } = {})`

### Signature

`drain({ max?, ticket?, ctx? } = {}) -> Promise<number>`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `max` | `number` | No | Maximum tick iterations. Defaults to `1000`. |
| `ticket` | `string|Ticket` | No | Optional targeted ticket id/object for scoped draining. |
| `ctx` | `Object` | No | Execution context forwarded to each tick. |

### Returns

Number of tick iterations that performed work.

### Side effects

Repeatedly invokes `tick(...)` until no work remains or `max` is reached.

### Failure modes

Stops early when `tick()` reports no work (`didWork: false`).

### Example

```js
await AT.engine.drain({ max: 200 });
```

### Related methods

* [`tick({ ctx?, ticket? } = {})`](./INDEX.md)

---

## `getTicketByJob(jobLike, key?)`

### Signature

`getTicketByJob(jobLike, key?) -> Ticket|null|Ticket[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Job reference resolved by engine job registry. |
| `key` | `string|undefined` | No | Pipeline key. When omitted, returns all active tickets for job. |

### Returns

* With `key`: single `Ticket` or `null`.
* Without `key`: `Ticket[]` (possibly empty).

### Side effects

None.

### Failure modes

Unresolved job returns `null` (keyed mode) or `[]` (all-tickets mode).

### Example

```js
const one = AT.engine.getTicketByJob(job, "default");
const all = AT.engine.getTicketByJob(job);
```

### Related methods

* [`enqueue(jobLike, key = "default", opts?)`](./INDEX.md)
* [`cancel(jobLike, key = "default")`](./INDEX.md)

---

## `enqueue(jobLike, key = "default", opts?)`

### Signature

`enqueue(jobLike, key = "default", opts?) -> Ticket`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Job reference resolved by engine job registry. |
| `key` | `string` | No | Pipeline key used for aliasing (`jobId + pipelineKey`). |
| `opts` | `Object` | No | Optional enqueue payload. |
| `opts.inputs` | `Object` | No | Runtime inputs for stage execution. |
| `opts.priority` | `number` | No | Scheduling priority metadata. Defaults to `0`. |
| `opts.meta` | `Object` | No | Diagnostic metadata attached to the ticket. |

### Returns

Ticket object for that alias. Existing active alias tickets are reused (dedupe behavior).

### Side effects

* Creates/updates runtime alias and ticket indexes.
* Pushes new ticket into per-job queue when new.
* May mark job runnable in scheduler.
* May fire `onEnqueue` hook.

### Failure modes

Throws if job cannot be resolved to a registered job with id.

### Example

```js
const ticket = AT.engine.enqueue(job, "default", {
  inputs: { reason: "manual" },
  meta: { source: "api" }
});
```

### Related methods

* [`getTicketByJob(jobLike, key?)`](./INDEX.md)
* [`drain({ max?, ticket?, ctx? } = {})`](./INDEX.md)

---

## `lockTicket(ticketId, lock?)`

### Signature

`lockTicket(ticketId, lock?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `ticketId` | `string` | Yes | Target ticket id. |
| `lock` | `Object` | No | Optional lock object. Default lock is generated when omitted. |

### Returns

`1` when ticket lock was set, otherwise `0`.

### Side effects

Mutates `ticket.lock` on the targeted ticket.

### Failure modes

Returns `0` when ticket record is missing.

### Example

```js
AT.engine.lockTicket(ticket.id, { type: "ticket", token: "manual-1" });
```

### Related methods

* [`unlockTicket(ticketId, token?)`](./INDEX.md)
* [`lock(jobLike, key = "default", lock?)`](./INDEX.md)

---

## `lock(jobLike, key = "default", lock?)`

### Signature

`lock(jobLike, key = "default", lock?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `key` | `string` | No | Alias pipeline key. |
| `lock` | `Object` | No | Optional lock object. Default `jobKey` lock is generated when omitted. |

### Returns

`1` when active alias ticket was found and locked; otherwise `0`.

### Side effects

Resolves alias ticket id and delegates to `lockTicket(...)`.

### Failure modes

Returns `0` when no active ticket exists for `(job, key)`.

### Example

```js
AT.engine.lock(job, "default");
```

### Related methods

* [`unlock(jobLike, key = "default", token?)`](./INDEX.md)
* [`getTicketByJob(jobLike, key?)`](./INDEX.md)

---

## `unlockTicket(ticketId, token?)`

### Signature

`unlockTicket(ticketId, token?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `ticketId` | `string` | Yes | Target ticket id. |
| `token` | `string` | No | Optional lock token guard. If provided and mismatch occurs, unlock fails. |

### Returns

`1` on success (or already unlocked), `0` on missing ticket or token mismatch.

### Side effects

* Clears `ticket.lock`.
* May mark job runnable again if it still has pending work.

### Failure modes

Token mismatch returns `0` and keeps lock unchanged.

### Example

```js
AT.engine.unlockTicket(ticket.id, "manual-1");
```

### Related methods

* [`lockTicket(ticketId, lock?)`](./INDEX.md)

---

## `unlock(jobLike, key = "default", token?)`

### Signature

`unlock(jobLike, key = "default", token?) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `key` | `string` | No | Alias pipeline key. |
| `token` | `string` | No | Optional token passed through to `unlockTicket(...)`. |

### Returns

`1` when alias ticket unlock succeeds (or was already unlocked), otherwise `0`.

### Side effects

Resolves alias ticket id and delegates to `unlockTicket(...)`.

### Failure modes

Returns `0` when no active alias ticket exists or token check fails.

### Example

```js
AT.engine.unlock(job, "default");
```

### Related methods

* [`lock(jobLike, key = "default", lock?)`](./INDEX.md)

---

## `cancel(jobLike, key = "default")`

### Signature

`cancel(jobLike, key = "default") -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobLike` | `Job|string|Element|Object` | Yes | Target job reference. |
| `key` | `string` | No | Alias pipeline key. |

### Returns

`1` when the alias ticket is found and cancelled, otherwise `0`.

### Side effects

Resolves alias ticket id and delegates to `cancelTicket(...)`.

### Failure modes

Returns `0` when no active alias ticket exists.

### Example

```js
AT.engine.cancel(job, "default");
```

### Related methods

* [`cancelTicket(ticketId)`](./INDEX.md)

---

## `cancelTicket(ticketId)`

### Signature

`cancelTicket(ticketId) -> number`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `ticketId` | `string` | Yes | Target ticket id. |

### Returns

`1` when cancellation/cleanup succeeded, `0` when ticket record is missing.

### Side effects

* Deletes ticket from global runtime ticket index.
* Removes ticket from active slot or job queue when present.
* Cleans alias mapping defensively when it points to the target ticket.
* May mark job runnable if queued work remains and job is not locked.

### Failure modes

Returns `0` for unknown ticket id.

### Example

```js
AT.engine.cancelTicket(ticket.id);
```

### Related methods

* [`cancel(jobLike, key = "default")`](./INDEX.md)
* [`getTicketByJob(jobLike, key?)`](./INDEX.md)

---

## See also

* [`AT.engine` index page](../AT_ENGINE.md)
* [`AT.events` deep reference](../at-events/INDEX.md)
* [`AT.intervals` deep reference](../at-intervals/INDEX.md)
