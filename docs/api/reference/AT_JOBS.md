# Reference — `AT.jobs` (Job Registry)

[README](../../../README.md) -> [API Index](../INDEX.md) -> [Reference Manual](./INDEX.md)

Primary source:

* [../../../src/class/job/Registry.js](../../../src/class/job/Registry.js)

## Core methods

### `resolve(x) -> Job|null`

Resolves a job-like reference (id, element, name, job-like object) into a registered `Job`.

### `list() -> Job[]`

Returns a snapshot array of all registered jobs.

### `register(job) -> Job`

Registers a job instance and indexes it by id/element/name.

### `unregister(jobOrIdOrEl, opts?) -> boolean`

Unregisters a job, invokes shutdown, and removes index bindings.

## Lookup methods

### `getById(id) -> Job|null`

Returns the job mapped to a specific id.

### `getByElement(el) -> Job|null`

Returns the job currently bound to a DOM element.

### `getByName(name) -> Job|null`

Returns a single job when name resolution is unambiguous; otherwise `null`.

### `listByName(name) -> Job[]`

Returns all jobs registered under a logical name.

### `listByStatus(status) -> Job[]`

Returns jobs whose `job.status` matches the provided status.

## Identity and naming helpers

### `nextId() -> string`

Generates the next registry-scoped job id.

### `hasElement(el) -> boolean`

Checks whether an element is already registered.

### `getIdByElement(el) -> string|null`

Returns the job id bound to an element.

### `setName(job, name) -> void`

Updates job logical name and refreshes name index bindings.

---

## See also

* [Top-level `AT`](./AT.md)
* [Discover controller](./AT_DISCOVER.md)
* [API Index](../INDEX.md)
