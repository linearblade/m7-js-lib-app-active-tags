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

Resolves when boot-time activation is complete: initial discover scan, optional observer start, interval/event registration, optional interval/event activation, and startup autorun drain.

When the observer is enabled, later DOM changes are handled after `start()` by the observer/runtime path, using `conf.observe.runtimeAttach` and `conf.observe.runtimeDispose`.

### Side effects

* Reads `lib._env.root.document` and validates `document.body`.
* Calls `AT.discover.scan()`.
* May call `AT.observer.start()` when `conf.boot.observeDom` is enabled.
* Calls `AT.intervals.registerAll()` and `AT.events.registerAll()`.
* May call `AT.intervals.conditionalOn()` and `AT.events.conditionalOn()` based on boot flags.
* Calls `AT.autorun("startup")`.
* Establishes the post-start observer path that can attach/dispose runtime event and interval state for later matching DOM mutations.

### Failure modes

* Throws if `document` or `document.body` is missing.
* Propagates errors from discover/observer/events/intervals subsystems.

### Example

```js
const AT = new ActiveTags(lib, conf);
await AT.start();
```

### Related methods

* [`AT.autorun(opts?)`](./autorun.md)
* [`AT.discover.scan()`](../at-discover/scan.md)
* [`AT.observer.start()`](../at-observer/start.md)
* [`AT.events.registerAll()`](../at-events/register-all.md)
* [`AT.intervals.registerAll()`](../at-intervals/register-all.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
