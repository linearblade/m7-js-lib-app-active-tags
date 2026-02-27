/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * Event Type Normalizers
 * ----------------------
 *
 * Provides pure normalization utilities that convert configured event type
 * strings into delegator-safe equivalents.
 *
 * PURPOSE
 * -------
 * Some DOM events do not delegate reliably in their native form.
 * For example, focus and blur do not bubble, while focusin and focusout do.
 *
 * This module centralizes event type normalization so the EventController
 * can remain generic and unaware of DOM bubbling edge cases.
 *
 *
 * EXECUTION PHASE
 * ---------------
 * Normalization occurs before delegated handler installation.
 * The normalized event type is what is passed to the EventDelegator.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * Normalizers must be pure functions.
 * They must accept a string and return a string.
 * They must not mutate external state.
 * They must not access controller or runtime services.
 *
 *
 * EXTENSIBILITY
 * -------------
 * Additional normalizers may be appended to EVENT_TYPE_NORMALIZERS.
 * normalizeEventType() applies each normalizer in sequence,
 * allowing composable transformation of event types.
 *
 *
 * NON-RESPONSIBILITIES
 * --------------------
 * Does not install handlers.
 * Does not filter events.
 * Does not enqueue pipelines.
 * Does not interact with the Engine or Delegator.
 */

/**
 * Normalize non-bubbling focus and blur events to bubbling equivalents.
 *
 * CONTRACT
 * --------
 * Converts:
 *   "focus" to "focusin"
 *   "blur"  to "focusout"
 *
 * All other event types are returned unchanged.
 *
 * This enables reliable delegation since focusin and focusout bubble,
 * while focus and blur do not.
 *
 *
 * INPUT
 * -----
 * @param {string} eventType
 *   Lowercase DOM event type string.
 *
 *
 * RETURN VALUE
 * ------------
 * @returns {string}
 *   A delegator-safe event type string.
 *
 *
 * SIDE EFFECTS
 * ------------
 * None.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * Must remain a pure function.
 * Must not access external state.
 */
export function normalizeFocusBlur(eventType) {
    if (eventType === "focus") return "focusin";
    if (eventType === "blur")  return "focusout";
    return eventType;
}

/**
 * Ordered list of event type normalizer functions.
 *
 * CONTRACT
 * --------
 * Each entry must be a pure function with signature:
 *   fn(eventType: string) -> string
 *
 * Normalizers are applied in array order by normalizeEventType().
 * The output of one normalizer becomes the input to the next.
 *
 *
 * EXTENSIBILITY
 * -------------
 * Additional normalizers may be appended to this array.
 * Ordering matters. Earlier normalizers may transform input
 * consumed by later ones.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * Entries must not produce side effects.
 * Entries must not depend on controller or runtime state.
 * The array itself should be treated as configuration, not mutated at runtime.
 */

export const EVENT_TYPE_NORMALIZERS = [
    normalizeFocusBlur,
];


/**
 * Normalize a configured event type using registered normalizers.
 *
 * CONTRACT
 * --------
 * Applies each function in EVENT_TYPE_NORMALIZERS sequentially
 * to the provided eventType string.
 *
 * The output of one normalizer becomes the input of the next.
 *
 * The final transformed string is returned.
 *
 *
 * INPUT
 * -----
 * @param {string} eventType
 *   Lowercase DOM event type string.
 *
 *
 * RETURN VALUE
 * ------------
 * @returns {string}
 *   A normalized, delegator-safe event type.
 *
 *
 * SIDE EFFECTS
 * ------------
 * None.
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * Must remain pure.
 * Must not mutate EVENT_TYPE_NORMALIZERS.
 * Must not access runtime services.
 */
export function normalizeEventType(eventType) {
    for (const fn of EVENT_TYPE_NORMALIZERS) {
        eventType = fn(eventType);
    }
    return eventType;
}
