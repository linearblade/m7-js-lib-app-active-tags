# Deep Reference — `AT.engine`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md)

This page links to one method-level file per public method in this subsystem.

Primary source:

* [../../../../src/class/engine/Engine.js](../../../../src/class/engine/Engine.js)
* [../../../../src/class/engine/EngineManager.js](../../../../src/class/engine/EngineManager.js)
* [../../../../src/class/engine/Tick.js](../../../../src/class/engine/Tick.js)

---

## Method Pages

* [`tick({ ctx?, ticket?, requireJob? } = {})`](./tick.md)
* [`drain({ max?, ticket?, requireJob?, ctx? } = {})`](./drain.md)
* [`pulse({ max?, ticket?, requireJob?, ctx? } = {})`](./pulse.md)
* [`getTicketByJob(jobLike, key?)`](./get-ticket-by-job.md)
* [`enqueue(jobLike, key = "default", opts?)`](./enqueue.md)
* [`lockTicket(ticketId, lock?)`](./lock-ticket.md)
* [`lock(jobLike, key = "default", lock?)`](./lock.md)
* [`unlockTicket(ticketId, token?)`](./unlock-ticket.md)
* [`unlock(jobLike, key = "default", token?)`](./unlock.md)
* [`cancel(jobLike, key = "default")`](./cancel.md)
* [`cancelTicket(ticketId)`](./cancel-ticket.md)

## Wait Management Surface

* [`AT.engine.wake`](./wake.md)

---

## See also

* [Reference Manual index](../INDEX.md)
