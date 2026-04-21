# Surface — `AT.engine.wake`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.engine` Deep Reference](./INDEX.md) -> [`AT.engine.wake`](./wake.md)

`AT.engine.wake` is the engine wait coordinator.

Wait management is exposed as `wake` in the current runtime.
For most application code, prefer calling [`AT.engine.pulse(...)`](./pulse.md) instead of reaching into this object directly.

## Primary purpose

`AT.engine.wake` tracks WAIT tickets and schedules the next engine wake when a timed wait becomes runnable.

## Surface

| Member | Signature | Notes |
|---|---|---|
| `refresh` | `refresh({ max?, ticket?, requireJob?, ctx? } = {}) -> void` | Recomputes the next wait wake and arms/cancels the internal timer as needed. |
| `cancel` | `cancel() -> void` | Cancels the currently armed wake timer, if any. |
| `requeueReadyWaiting` | `requeueReadyWaiting() -> number` | Advanced helper. Marks unblocked WAIT tickets runnable again and returns the count. |
| `nextWaitDelay` | `nextWaitDelay() -> number|null` | Advanced helper. Returns the next wait delay in ms, `0` when a wait is already ready, or `null` when nothing is waiting. |

## Common use

The most common direct use is manual resume after an external interrupt:

```js
AT.engine.unlockTicket(ticket.id, token);
AT.engine.wake.refresh();
```

If you already have the specific ticket and want to resume it immediately, you can also follow unlock with:

```js
await AT.engine.pulse({ ticket });
```

## Related methods

* [`pulse({ max?, ticket?, requireJob?, ctx? } = {})`](./pulse.md)
* [`unlockTicket(ticketId, token?)`](./unlock-ticket.md)
* [`unlock(jobLike, key = "default", token?)`](./unlock.md)

---

## See also

* [Waits & Interrupts](../../../usage/WAITS_AND_INTERRUPTS.md)
* [Back to subsystem index](./INDEX.md)
* [Reference Manual index](../INDEX.md)
