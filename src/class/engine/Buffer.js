/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

//engine/Buffer.js
/**
 * Buffer
 * ======
 *
 * Lightweight, mutable value container attached to each Engine ticket.
 *
 * Conceptual role in ActiveTags:
 * ------------------------------
 * ActiveTags pipelines operate like a conveyor belt.
 * Each ticket carries two core runtime primitives:
 *
 *   1) buffer — transient data store (this class)
 *   2) target — current DOM target (carried on the ticket)
 *
 * The buffer is the structured handoff mechanism between pipeline steps.
 * Each operation may:
 *   - read the current buffer value
 *   - transform it
 *   - write a new value (optionally attaching metadata)
 *
 * This enables deterministic, stepwise data flow without global mutation.
 *
 * Design goals:
 * -------------
 * - Extremely small surface area.
 * - No knowledge of jobs, engine, DOM, or pipelines.
 * - Mutable by design (tickets are single-threaded execution units).
 * - JSON-safe when serialized.
 *
 * Value semantics:
 * ----------------
 * - `#value` holds the current payload (any type).
 * - `#meta` holds optional structured metadata accumulated across writes.
 * - `set()` replaces the value and shallow-merges metadata.
 * - `clear()` resets both value and metadata.
 *
 * Metadata semantics:
 * -------------------
 * - Metadata is additive (Object.assign).
 * - Intended for tracing, diagnostics, or op-level annotations.
 * - Does NOT affect pipeline execution directly.
 *
 * Serialization:
 * --------------
 * - `toJSON()` returns only the buffer value.
 * - Metadata is intentionally excluded from JSON output.
 *
 * Threading model:
 * ----------------
 * - Buffers are ticket-scoped.
 * - No concurrency control is required.
 * - Engine guarantees single-step execution per ticket.
 *
 * This class is intentionally minimal.
 * It is a foundational primitive for pipeline data flow.
 */

export class Buffer {
    #value = null;
    #meta = {};

    constructor(initial = null) {
	this.#value = initial;
    }

    get() {
	return this.#value;
    }

    set(v, meta) {
	this.#value = v;
	if (meta && typeof meta === "object") {
	    Object.assign(this.#meta, meta);
	}
	return v;
    }

    clear() {
	this.#value = null;
	this.#meta = {};
    }

    meta() {
	return this.#meta;
    }

     toJSON() {
	return this.#value;
    }
}


export default Buffer;
