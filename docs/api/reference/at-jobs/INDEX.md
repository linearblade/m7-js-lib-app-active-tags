# Deep Reference — `AT.jobs`

[README](../../../../README.md) -> [API Index](../../INDEX.md) -> [Reference Manual](../INDEX.md) -> [`AT.jobs` Deep Reference](./INDEX.md)

Primary source:

* [../../../../src/class/job/Registry.js](../../../../src/class/job/Registry.js)

---

## `resolve(x)`

### Signature

`resolve(x) -> Job|null`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `x` | `any` | Yes | Job-like reference (id/name string, element, job-like object). |

### Returns

Resolved `Job` or `null`.

### Side effects

None.

### Failure modes

* Returns `null` for unknown or unsupported references.
* Ambiguous name lookup returns `null`.

### Example

```js
const job = AT.jobs.resolve(ref);
if (!job) return;
```

### Related methods

* [`toJob(ref)`](../at/INDEX.md)
* [`getById(id)`](./INDEX.md)
* [`getByElement(el)`](./INDEX.md)

---

## `nextId()`

### Signature

`nextId() -> string`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Generates the next registry id. |

### Returns

A new id in `${prefix}-${counter}` format.

### Side effects

Increments the internal id counter.

### Failure modes

None.

### Example

```js
const id = AT.jobs.nextId();
```

### Related methods

* [`register(job)`](./INDEX.md)

---

## `hasElement(el)`

### Signature

`hasElement(el) -> boolean`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `el` | `Element` | Yes | DOM element to test. |

### Returns

`true` when the element is already bound to a registered job.

### Side effects

None.

### Failure modes

Returns `false` when the element is not registered.

### Example

```js
if (AT.jobs.hasElement(el)) return;
```

### Related methods

* [`getIdByElement(el)`](./INDEX.md)

---

## `getIdByElement(el)`

### Signature

`getIdByElement(el) -> string|null`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `el` | `Element` | Yes | DOM element bound to a job. |

### Returns

Job id for that element, or `null`.

### Side effects

None.

### Failure modes

Returns `null` when no mapping exists.

### Example

```js
const id = AT.jobs.getIdByElement(el);
```

### Related methods

* [`getByElement(el)`](./INDEX.md)

---

## `getById(id)`

### Signature

`getById(id) -> Job|null`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Canonical job id. |

### Returns

Registered job for that id, or `null`.

### Side effects

None.

### Failure modes

Returns `null` when id is unknown.

### Example

```js
const job = AT.jobs.getById("DEFAULT__at-1");
```

### Related methods

* [`resolve(x)`](./INDEX.md)
* [`getByName(name)`](./INDEX.md)

---

## `getByElement(el)`

### Signature

`getByElement(el) -> Job|null`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `el` | `Element` | Yes | DOM element bound to a job. |

### Returns

Registered job for that element, or `null`.

### Side effects

None.

### Failure modes

Returns `null` when no element mapping exists.

### Example

```js
const job = AT.jobs.getByElement(el);
```

### Related methods

* [`getIdByElement(el)`](./INDEX.md)
* [`hasElement(el)`](./INDEX.md)

---

## `getByName(name)`

### Signature

`getByName(name) -> Job|null`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Logical job name. |

### Returns

A single resolved job only when name resolution is unambiguous; otherwise `null`.

### Side effects

May emit a warning for ambiguous names.

### Failure modes

* Returns `null` when no matches exist.
* Returns `null` when multiple jobs share the same name.

### Example

```js
const job = AT.jobs.getByName("profile-card");
```

### Related methods

* [`listByName(name)`](./INDEX.md)

---

## `list()`

### Signature

`list() -> Job[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| _(none)_ | - | - | Returns all registered jobs. |

### Returns

Snapshot array of all jobs (Map insertion order).

### Side effects

None.

### Failure modes

Returns an empty array when registry is empty.

### Example

```js
for (const job of AT.jobs.list()) {
  // inspect each registered job
}
```

### Related methods

* [`listByStatus(status)`](./INDEX.md)
* [`listByName(name)`](./INDEX.md)

---

## `listByStatus(status)`

### Signature

`listByStatus(status) -> Job[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `status` | `string` | Yes | Exact `job.status` value to match (`===`). |

### Returns

Array of jobs whose status exactly matches.

### Side effects

None.

### Failure modes

Returns `[]` when no jobs match.

### Example

```js
const running = AT.jobs.listByStatus("running");
```

### Related methods

* [`list()`](./INDEX.md)

---

## `listByName(name)`

### Signature

`listByName(name) -> Job[]`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Logical name bucket in `byName`. |

### Returns

All jobs currently indexed under that name.

### Side effects

None.

### Failure modes

Returns `[]` when name is empty or has no indexed ids.

### Example

```js
const cards = AT.jobs.listByName("profile-card");
```

### Related methods

* [`getByName(name)`](./INDEX.md)
* [`setName(job, name)`](./INDEX.md)

---

## `register(job)`

### Signature

`register(job) -> Job`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `job` | `Job` | Yes | Job instance with a DOM element (`job.e`). |

### Returns

Registered job. If the element is already registered, returns the existing job.

### Side effects

* Assigns identity with `job.setIdentity({ id, createdAt })`.
* Updates `byId`, `byEl`, `createdAt`, and optional `byName` indexes.

### Failure modes

* Throws if `job` or `job.e` is missing.
* Throws on id collision with another registered job.

### Example

```js
const registered = AT.jobs.register(job);
```

### Related methods

* [`unregister(jobOrIdOrEl, opts?)`](./INDEX.md)
* [`setName(job, name)`](./INDEX.md)

---

## `unregister(jobOrIdOrEl, opts?)`

### Signature

`unregister(jobOrIdOrEl, opts?) -> boolean`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `jobOrIdOrEl` | `Job|string|number|Element|Object` | Yes | Target job reference to remove. |
| `opts` | `Object` | No | Optional options. |
| `opts.reason` | `string` | No | Reason passed into `job.shutdown()` and shutdown log metadata. |

### Returns

`true` when a job was resolved and removed; otherwise `false`.

### Side effects

* Calls `job.shutdown({ reason })` before index removal.
* Records shutdown metadata.
* Removes all id/element/name/createdAt indexes for the job.

### Failure modes

* No-op with `false` when the target cannot be resolved.
* Propagates exceptions thrown by `job.shutdown(...)`.

### Example

```js
AT.jobs.unregister(el, { reason: "dom removed" });
```

### Related methods

* [`register(job)`](./INDEX.md)
* [`resolve(x)`](./INDEX.md)

---

## `setName(job, name)`

### Signature

`setName(job, name) -> void`

### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `job` | `Job` | Yes | Registered job instance. |
| `name` | `string|null` | Yes | New logical name. Falsy values clear name indexing. |

### Returns

No return value.

### Side effects

* Removes prior name index entry (if any).
* Calls `job.setName(name)`.
* Adds the new name index entry when name is truthy.

### Failure modes

No-op when `job` or `job.id` is missing.

### Example

```js
AT.jobs.setName(job, "profile-card");
```

### Related methods

* [`listByName(name)`](./INDEX.md)
* [`getByName(name)`](./INDEX.md)

---

## See also

* [`AT.jobs` index page](../AT_JOBS.md)
* [`AT.discover` deep reference](../at-discover/INDEX.md)
* [`AT.observer` deep reference](../at-observer/INDEX.md)
