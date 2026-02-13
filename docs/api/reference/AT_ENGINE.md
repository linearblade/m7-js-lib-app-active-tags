# Reference — `AT.engine`

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

This page is the surface index for `AT.engine` methods.

## Deep reference

* [`AT.engine` deep reference](./at-engine/INDEX.md)

## Methods

* `tick({ ctx?, ticket? } = {})`
* `drain({ max?, ticket?, ctx? } = {})`
* `getTicketByJob(jobLike, key?)`
* `enqueue(jobLike, key = "default", opts?)`
* `lockTicket(ticketId, lock?)`
* `lock(jobLike, key = "default", lock?)`
* `unlockTicket(ticketId, token?)`
* `unlock(jobLike, key = "default", token?)`
* `cancel(jobLike, key = "default")`
* `cancelTicket(ticketId)`

---

## See also

* [`AT.events`](./AT_EVENTS.md)
* [`AT.intervals`](./AT_INTERVALS.md)
* [Reference Manual index](./INDEX.md)
