# Reference — `AT.engine`

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

Primary source:

* [../../../src/class/engine/Engine.js](../../../src/class/engine/Engine.js)
* [../../../src/class/engine/EngineManager.js](../../../src/class/engine/EngineManager.js)

## Execution

### `tick({ ctx?, ticket? } = {}) -> Object`

Advances one execution step. Returns tick result from engine tick subsystem.

### `drain({ max?, ticket?, ctx? } = {}) -> Promise<number>`

Repeatedly runs `tick()` until no work remains or `max` is reached. Returns number of steps performed.

## Ticket lookup / enqueue

### `getTicketByJob(jobLike, key?) -> Ticket|null|Ticket[]`

With `key`, returns single active ticket for `(job, key)` alias. Without `key`, returns all active tickets for job.

### `enqueue(jobLike, key = "default", opts?) -> Ticket`

Creates or reuses ticket by `(job, pipelineKey)` alias and queues runtime work.

## Locking

### `lockTicket(ticketId, lock?) -> number`

Locks a specific ticket (`1` success, `0` missing ticket).

### `lock(jobLike, key = "default", lock?) -> number`

Alias-level lock convenience wrapper over `lockTicket`.

### `unlockTicket(ticketId, token?) -> number`

Unlocks a specific ticket (`1` success/already unlocked, `0` missing ticket or token mismatch).

### `unlock(jobLike, key = "default", token?) -> number`

Alias-level unlock convenience wrapper over `unlockTicket`.

## Cancellation

### `cancel(jobLike, key = "default") -> number`

Cancels the active alias ticket for `(job, key)` if present.

### `cancelTicket(ticketId) -> number`

Cancels/removes a ticket by id and cleans associated indexes/aliases.

---

## See also

* [`AT.events`](./AT_EVENTS.md)
* [`AT.intervals`](./AT_INTERVALS.md)
* [Engine Runtime](../ENGINE.md)
* [API Index](../INDEX.md)
