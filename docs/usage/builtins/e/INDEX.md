# Root Element Builtins (`e.*`)

[Builtins Index](../INDEX.md)

Module source:

* [../../../../src/builtins/e/index.js](../../../../src/builtins/e/index.js)

`e.*` ops resolve from `job.e` (job root element), not from current `ticket.target`.

For headless jobs, VM provides an execution-time `job.e` fallback from
`AT.conf.env.document.body` when no bound element exists.

## Functions

* [`e.self`](./self.md)
* [`e.reset`](./reset.md)
* [`e.find`](./find.md)
* [`e.closest`](./closest.md)
* [`e.parent`](./parent.md)
* [`e.child`](./child.md)
