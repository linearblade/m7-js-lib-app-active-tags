# Reference — `AT.engine`

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

This page is the surface index for `AT.engine` methods.

## Deep reference

* [`AT.engine` deep reference](./at-engine/INDEX.md)

## Methods

* [`tick({ ctx?, ticket? } = {})`](./at-engine/tick.md)
* [`drain({ max?, ticket?, ctx? } = {})`](./at-engine/drain.md)
* [`getTicketByJob(jobLike, key?)`](./at-engine/get-ticket-by-job.md)
* [`enqueue(jobLike, key = "default", opts?)`](./at-engine/enqueue.md)
* [`lockTicket(ticketId, lock?)`](./at-engine/lock-ticket.md)
* [`lock(jobLike, key = "default", lock?)`](./at-engine/lock.md)
* [`unlockTicket(ticketId, token?)`](./at-engine/unlock-ticket.md)
* [`unlock(jobLike, key = "default", token?)`](./at-engine/unlock.md)
* [`cancel(jobLike, key = "default")`](./at-engine/cancel.md)
* [`cancelTicket(ticketId)`](./at-engine/cancel-ticket.md)

---

## See also

* [`AT.events`](./AT_EVENTS.md)
* [`AT.intervals`](./AT_INTERVALS.md)
* [Reference Manual index](./INDEX.md)
