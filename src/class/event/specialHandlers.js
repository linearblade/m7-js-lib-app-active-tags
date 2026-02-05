// event/specialHandlers.js
/**
 * Event Special Handlers
 * ----------------------
 *
 * This module contains **semantic event carveouts** used by the
 * ActiveTags EventController.
 *
 * Purpose:
 * --------
 * Not all DOM events map cleanly to human intent. Some events (notably
 * hover- and focus-related events) fire repeatedly during internal
 * transitions (e.g. moving between child elements), which makes them
 * unsuitable to route directly to pipelines without normalization.
 *
 * This file centralizes those semantics.
 *
 * Design Principles:
 * ------------------
 * 1) These handlers do NOT enqueue work.
 *    They only decide whether an event should be ignored (consumed)
 *    based on semantic rules.
 *
 * 2) These handlers are **pure functions**.
 *    They depend only on the provided context and do not mutate state.
 *
 * 3) Job identity is never resolved here.
 *    All handlers operate relative to an already-resolved ActiveTag
 *    root element (`el`).
 *
 * 4) Sub-delegation is first-class.
 *    When a sub-selector is present, boundary semantics are evaluated
 *    relative to that sub-target, not the entire ActiveTag element.
 *
 * 5) Order matters.
 *    Handlers are evaluated sequentially. The first handler to return
 *    `true` is considered to have consumed the event.
 *
 * Usage:
 * ------
 * The EventController imports `SPECIAL_EVENT_HANDLERS` and iterates
 * over them during event dispatch. This keeps the main event handling
 * logic generic and prevents semantic edge cases from polluting
 * controller code.
 *
 * Future Work:
 * ------------
 * This module is intentionally isolated to allow:
 *   - controller-level overrides
 *   - per-job or per-event handler policies
 *   - additional semantic handlers (e.g. dragenter/dragleave)
 *
 * without changing the EventController’s core logic.
 */


/**
 * Hover Semantic Handler
 * ---------------------
 *
 * Normalizes `pointerover` / `pointerout` (and mouseover/mouseout equivalents)
 * into *semantic hover enter / hover leave* behavior.
 *
 * Problem:
 * --------
 * Raw hover events fire repeatedly during internal DOM transitions
 * (e.g. moving between child elements), which makes them unsuitable
 * to trigger pipelines directly.
 *
 * This handler suppresses events that represent internal movement
 * within the same semantic boundary.
 *
 * Sub-delegation:
 * ---------------
 * When a sub-selector is present, hover boundaries are evaluated
 * relative to the sub-target, not the entire ActiveTag element.
 *
 * Example:
 *   - tag → button        : allowed (enter)
 *   - button → tag        : allowed (leave)
 *   - button child → child: suppressed
 *
 * Design Notes:
 * -------------
 * - This handler does NOT enqueue work.
 * - It only decides whether the event should be ignored.
 * - Job identity is already resolved upstream.
 *
 * Future Work:
 * ------------
 * - Extend to support dragenter / dragleave using the same
 *   boundary semantics if needed.
 */
export function handleHover({ el, e, eventType, subSelector }) {
    if (eventType !== "pointerover" && eventType !== "pointerout") return false;
    if (!e || !el) return false;

    const rt = e.relatedTarget;
    if (!rt) return false;

    // no sub-selector: original tag-level hover semantics
    if (!subSelector) {
        return el.contains(rt);
    }

    const t = e.target;

    const hit  = t  && t.closest ? t.closest(subSelector) : null;
    const rhit = rt && rt.closest ? rt.closest(subSelector) : null;

    const hitOk  = hit  && el.contains(hit);
    const rhitOk = rhit && el.contains(rhit);

    // ignore only if we stayed within the same sub-target
    return hitOk && rhitOk && hit === rhit;
}

/**
 * Focus / Blur Semantic Handler
 * -----------------------------
 *
 * NOTE / TODO:
 * Focus events (`focus` / `blur`) do not bubble and require normalization
 * to `focusin` / `focusout` for delegated handling.
 *
 * At present, normalization is assumed to occur at registration time
 * (i.e. before the delegator subscribes). If focus/blur are registered
 * without this normalization, the handler may never be invoked.
 *
 * This handler only addresses *semantic boundary behavior* (internal
 * focus shifts vs true enter/leave) and intentionally does NOT perform
 * event type normalization itself.
 *
 * Future work:
 * - Decide whether focus normalization should:
 *   a) always occur during event registration, or
 *   b) be enforced here with defensive duplication.
 *
 * Until then, focus-related configuration should use `focusin` /
 * `focusout` explicitly or ensure registration-time normalization.
 */
export function handleFocus({ el, e, eventType, subSelector }) {
    if (eventType !== "focusin" && eventType !== "focusout") return false;
    if (!e || !el) return false;

    const rt = e.relatedTarget;
    if (!rt) return false;

    if (!subSelector) {
        return el.contains(rt);
    }

    const t = e.target;

    const hit  = t  && t.closest ? t.closest(subSelector) : null;
    const rhit = rt && rt.closest ? rt.closest(subSelector) : null;

    const hitOk  = hit  && el.contains(hit);
    const rhitOk = rhit && el.contains(rhit);

    return hitOk && rhitOk && hit === rhit;
}


export const SPECIAL_EVENT_HANDLERS = [
    handleHover,
    handleFocus,
];

export default {
    handleHover, handleFocus
}

