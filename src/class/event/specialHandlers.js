/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * Event Special Handlers
 * ----------------------
 *
 * Provides semantic filtering for delegated DOM events used by the
 * ActiveTags Event Controller.
 *
 * PURPOSE
 * -------
 * Some DOM events do not directly represent meaningful user intent.
 * Hover and focus related events may fire repeatedly during internal
 * DOM transitions, such as movement between child elements.
 *
 * This module centralizes semantic boundary rules so that:
 *   The Event Controller remains generic
 *   Pipeline dispatch logic remains clean
 *   Edge cases are isolated and testable
 *
 *
 * EXECUTION MODEL
 * ---------------
 * Each handler receives a context object containing:
 *   el           resolved ActiveTag root element
 *   e            DOM event object
 *   eventType    normalized delegator-safe event type
 *   subSelector  optional sub-delegation selector
 *   matchMode    selector resolution mode for sub-delegation
 *
 * Handlers are evaluated sequentially.
 * The first handler that returns true is considered to have consumed
 * the event.
 *
 * Returning true means:
 *   The event should be ignored
 *   No pipeline should be enqueued
 *
 * Returning false means:
 *   Normal event processing should continue
 *
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * Handlers must be pure functions.
 * Handlers must not enqueue pipelines.
 * Handlers must not install or uninstall delegated handlers.
 * Handlers must not mutate controller or Job state.
 *
 * Job identity is already resolved upstream.
 * All logic operates relative to the provided root element.
 *
 *
 * SUB-DELEGATION
 * --------------
 * When a sub-selector is present, semantic boundary checks are evaluated
 * relative to the matched sub-target rather than the entire root element.
 *
 *
 * EXTENSIBILITY
 * -------------
 * Additional semantic handlers may be appended to
 * SPECIAL_EVENT_HANDLERS.
 *
 * Ordering matters.
 * Earlier handlers have priority over later ones.
 *
 *
 * NON-RESPONSIBILITIES
 * --------------------
 * Does not normalize event types.
 * Does not perform event delegation.
 * Does not interact with the Engine.
 */

/**
 * Resolve a matched sub-target inside an ActiveTag root.
 *
 * @param {Object} ctx
 * @param {Element} ctx.el
 * @param {Node} ctx.node
 * @param {string} ctx.subSelector
 * @param {string} [ctx.matchMode="closest"]
 * @returns {Element|null}
 */
export function resolveMatchedTarget({ el, node, subSelector, matchMode = "closest" } = {}) {
    if (!el || !node || !subSelector) return null;

    let hit = null;

    if (matchMode === "target") {
        hit = typeof node.matches === "function" && node.matches(subSelector) ? node : null;
    } else {
        hit = typeof node.closest === "function" ? node.closest(subSelector) : null;
    }

    return hit && el.contains(hit) ? hit : null;
}

/**
 * Hover Semantic Handler
 * ----------------------
 *
 * Provides semantic boundary filtering for delegated hover events.
 *
 * CONTRACT
 * --------
 * Suppresses pointerover and pointerout events that represent internal
 * movement within the same semantic hover boundary.
 *
 * If the event represents a true boundary enter or leave, returns false.
 * If the event represents internal movement and should be ignored,
 * returns true.
 *
 *
 * APPLICABILITY
 * -------------
 * Only applies to:
 *   pointerover
 *   pointerout
 *
 * All other event types return false immediately.
 *
 *
 * INPUT
 * -----
 * @param {Object} ctx
 * @param {Element} ctx.el
 *   The resolved ActiveTag root element.
 *
 * @param {Event} ctx.e
 *   The DOM event object.
 *
 * @param {string} ctx.eventType
 *   Normalized event type string.
 *
 * @param {string|null} ctx.subSelector
 *   Optional sub-delegation selector used to narrow hover boundaries.
 *
 * @param {string} [ctx.matchMode="closest"]
 *   Selector resolution mode used when subSelector is present.
 *
 *
 * SEMANTIC RULES
 * --------------
 * Tag-level semantics
 *   Without subSelector, the boundary is the entire ActiveTag element.
 *   If relatedTarget is contained within el, the movement is internal
 *   and the event is suppressed.
 *
 * Sub-delegation semantics
 *   When subSelector is provided, boundaries are evaluated relative to
 *   the matched sub-target element.
 *
 *   The event is suppressed only if:
 *     Both the current target and relatedTarget resolve to the same
 *     sub-target within el.
 *
 *   Movement between different sub-targets or into or out of the
 *   ActiveTag boundary is allowed.
 *
 *
 * RETURN VALUE
 * ------------
 * @returns {boolean}
 *   true  if the event should be consumed and ignored
 *   false if normal processing should continue
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
 * Must not enqueue pipelines.
 * Must not mutate controller or Job state.
 */

export function handleHover({ el, e, eventType, subSelector, matchMode = "closest" }) {
    if (eventType !== "pointerover" && eventType !== "pointerout") return false;
    if (!e || !el) return false;

    const rt = e.relatedTarget;
    if (!rt) return false;

    // no sub-selector: original tag-level hover semantics
    if (!subSelector) {
        return el.contains(rt);
    }

    const t = e.target;

    const hit  = resolveMatchedTarget({ el, node: t,  subSelector, matchMode });
    const rhit = resolveMatchedTarget({ el, node: rt, subSelector, matchMode });

    // ignore only if we stayed within the same sub-target
    return !!hit && !!rhit && hit === rhit;
}


/**
 * Focus Semantic Handler
 * ----------------------
 *
 * Provides semantic boundary filtering for delegated focus events.
 *
 * CONTRACT
 * --------
 * Suppresses focusin and focusout events that represent internal focus
 * transitions within the same semantic boundary.
 *
 * If the event represents a true boundary enter or leave, returns false.
 * If the event represents internal focus movement and should be ignored,
 * returns true.
 *
 *
 * APPLICABILITY
 * -------------
 * Only applies to:
 *   focusin
 *   focusout
 *
 * All other event types return false immediately.
 *
 * Event type normalization from focus and blur to focusin and focusout
 * must occur before this handler is invoked.
 * This handler does not perform event type normalization.
 *
 *
 * INPUT
 * -----
 * @param {Object} ctx
 * @param {Element} ctx.el
 *   The resolved ActiveTag root element.
 *
 * @param {Event} ctx.e
 *   The DOM event object.
 *
 * @param {string} ctx.eventType
 *   Normalized event type string.
 *
 * @param {string|null} ctx.subSelector
 *   Optional sub-delegation selector used to narrow focus boundaries.
 *
 * @param {string} [ctx.matchMode="closest"]
 *   Selector resolution mode used when subSelector is present.
 *
 *
 * SEMANTIC RULES
 * --------------
 * Tag-level semantics
 *   Without subSelector, the boundary is the entire ActiveTag element.
 *   If relatedTarget is contained within el, the focus shift is internal
 *   and the event is suppressed.
 *
 * Sub-delegation semantics
 *   When subSelector is provided, boundaries are evaluated relative to
 *   the matched sub-target element.
 *
 *   The event is suppressed only if:
 *     Both the current target and relatedTarget resolve to the same
 *     sub-target within el.
 *
 *   Focus movement between different sub-targets or into or out of the
 *   ActiveTag boundary is allowed.
 *
 *
 * RETURN VALUE
 * ------------
 * @returns {boolean}
 *   true  if the event should be consumed and ignored
 *   false if normal processing should continue
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
 * Must not enqueue pipelines.
 * Must not mutate controller or Job state.
 */
export function handleFocus({ el, e, eventType, subSelector, matchMode = "closest" }) {
    if (eventType !== "focusin" && eventType !== "focusout") return false;
    if (!e || !el) return false;

    const rt = e.relatedTarget;
    if (!rt) return false;

    if (!subSelector) {
        return el.contains(rt);
    }

    const t = e.target;

    const hit  = resolveMatchedTarget({ el, node: t,  subSelector, matchMode });
    const rhit = resolveMatchedTarget({ el, node: rt, subSelector, matchMode });

    return !!hit && !!rhit && hit === rhit;
}


export const SPECIAL_EVENT_HANDLERS = [
    handleHover,
    handleFocus,
];

export default {
    resolveMatchedTarget,
    handleHover,
    handleFocus
}
