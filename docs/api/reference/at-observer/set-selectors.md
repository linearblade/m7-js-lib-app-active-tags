# Method — `setSelectors(selectorSpecs)`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.observer` Deep Reference](./INDEX.md) -> [`setSelectors(selectorSpecs)`](./set-selectors.md)

## `setSelectors(selectorSpecs)`

### Signature

`setSelectors(selectorSpecs) -> void`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `selectorSpecs` | `any` | Yes | Prebuilt selector spec(s) expected by the observer service. |

### Returns

No return value.

### Side effects

* Stores provided value in `_selectorSpecs`.
* Forwards value directly to `observer.setSelectors(...)`.

### Failure modes

* No-op when observer service is missing.
* Invalid selector spec shapes may fail later in the observer service.

### Example

```js
AT.observer.setSelectors([
  {
    selector: "[at]",
    includeSubtreeMatches: true,
    observeAttributes: true,
    attributeFilter: ["at"],
    onEvent: (batch) => console.log(batch)
  }
]);
```

### Related methods

* [`start()`](./start.md)
* [`stop()`](./stop.md)

---

## See also

* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
