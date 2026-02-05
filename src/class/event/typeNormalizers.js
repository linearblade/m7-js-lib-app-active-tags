/**
 * Event Type Normalizers
 * ---------------------
 * Normalizes configured event types into delegated-safe equivalents.
 * These run at REGISTRATION time (before subscribing with the delegator).
 *
 * Each normalizer receives a string eventType and returns the normalized type.
 */

export function normalizeFocusBlur(eventType) {
    if (eventType === "focus") return "focusin";
    if (eventType === "blur")  return "focusout";
    return eventType;
}

export const EVENT_TYPE_NORMALIZERS = [
    normalizeFocusBlur,
];

export function normalizeEventType(eventType) {
    for (const fn of EVENT_TYPE_NORMALIZERS) {
        eventType = fn(eventType);
    }
    return eventType;
}
