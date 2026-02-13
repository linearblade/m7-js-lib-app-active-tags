# Method — `start()`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [Top-Level `AT` Deep Reference](./INDEX.md) -> [`start()`](./start.md)

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

* [`AT.discover.scan()`](../at-discover/scan.md)
* [`AT.observer.start()`](../at-observer/start.md)
* [`AT.events.registerAll()`](../at-events/register-all.md)
* [`AT.intervals.registerAll()`](../at-intervals/register-all.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
