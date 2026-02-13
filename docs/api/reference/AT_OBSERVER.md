# Reference — `AT.observer`

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

Primary source:

* [../../../src/class/observer/Controller.js](../../../src/class/observer/Controller.js)

## Methods

### `start() -> void`

Builds selector specs from config, applies them to the observer service, and starts DOM observation.

### `stop() -> void`

Stops DOM observation through the injected observer service.

### `setSelectors(selectorSpecs) -> void`

Replaces observer selector specs directly (advanced runtime override).

## Notes

* `AT.observer` is policy/lifecycle around a shared observer service.
* Observation callbacks translate DOM changes into discover/register/unregister signals.

---

## See also

* [`AT.discover`](./AT_DISCOVER.md)
* [`AT.jobs`](./AT_JOBS.md)
* [API Index](../INDEX.md)
