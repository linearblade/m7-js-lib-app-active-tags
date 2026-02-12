# Subsystem — Interval Controller

Interval controller maps job interval schema into managed timer registrations.

---

## Component

* [../../../src/class/interval/Controller.js](../../../src/class/interval/Controller.js)

---

## Responsibilities

* register interval definitions from job schema
* start/stop interval runtime state
* enqueue pipelines on interval ticks
* track interval entry state by job

---

## Service dependency

Uses `primitive.interval` service.

Related vendor contract:

* [../../vendor_api_contracts/INTERVAL_API_CONTRACT.md](../../vendor_api_contracts/INTERVAL_API_CONTRACT.md)

---

## Non-responsibilities

* does not execute pipeline stages
* does not manage VM stepping

