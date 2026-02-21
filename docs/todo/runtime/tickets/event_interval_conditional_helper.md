# Extract Shared Conditional Install Helper (Event + Interval)

[TODO index](../../INDEX.md) | [runtime open](../OPEN.md) | [runtime done](../DONE.md)

# Note: I've decided to put this on hold for the time being, b/c what I really want to do is get 'headless' jobs up and running (jobs without dom attached), and this would be wasted work invested here.

## Goal
Remove duplicated conditional-install ticket logic currently implemented separately in Event and Interval controllers.

## Problem
Both controllers implement near-identical flows for:
- gate checks (`enabled`, `on`, structural config validity)
- `require` merge from job schema + caller options
- synthetic internal job creation
- enqueue metadata composition

This duplication increases maintenance cost and drift risk.

## Primary Targets
- `src/class/event/Controller.js`
- `src/class/interval/Controller.js`
- `src/class/runtime/Controller.js` (only if helper belongs here)

## Proposed Change
Create one shared helper that accepts domain-specific adapters:
- key builder (`__eventController_*` vs `__intervalController_*`)
- run handler (calls `on(job,event)` or `on(job,interval)`)
- extra payload names (`eventName` / `intervalName`)
- structural validators (`event+pipeline` vs `repeat+pipeline`)

## Deliverables
- shared helper module for conditional synthetic-ticket setup
- Event controller uses helper
- Interval controller uses helper
- no behavior change in successful/failed gating paths

## Acceptance Criteria
- Event `conditionalOn(...)` behavior remains unchanged.
- Interval `conditionalOn(...)` behavior remains unchanged.
- `require` merge order remains `job require + extra require`.
- synthetic job creation still uses `runtime.createInternalJob(...)`.
- duplicated conditional setup code is removed from at least one controller path.

## Out of Scope
- changing public controller API contracts
- altering queue/scheduler semantics

