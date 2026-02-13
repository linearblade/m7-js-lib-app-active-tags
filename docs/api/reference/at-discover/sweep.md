# Method — `sweep(sel?)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.discover` Deep Reference](./INDEX.md) -> [`sweep(sel?)`](./sweep.md)

## `sweep(sel?)`

### Signature

`sweep(sel?) -> Element[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `sel` | `string|Element|Array<string|Element>|null` | No | Selector(s) or element(s). Defaults to `conf.boot.selector`. |

### Returns

De-duplicated array of matching DOM elements.

### Side effects

None. `sweep()` is discovery-only and does not register jobs.

### Failure modes

* Throws if `conf.env` is missing.
* Throws if `conf.env.document` is missing or invalid.

### Example

```js
const nodes = AT.discover.sweep(["[at]", "[data-at]"]);
```

### Related methods

* [`scan(sel?, opts?)`](./scan.md)
* [`AT.observer.start()`](../at-observer/start.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
