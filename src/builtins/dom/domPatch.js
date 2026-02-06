// builtins/domPatch.js
import helpers from '../../class/engine/helpers.js';

/**
 * dom.patch (v1, target-driven)
 *
 * Target:
 *  - `ticket.target` MUST be a DOM element (hard fail if not)
 *  - Target selection and navigation are handled explicitly via `target.*` builtins
 *
 * Sources:
 *  - `data-attr-*` attributes on the target element (prefix stripped)
 *  - op args (explicit patch object)
 *
 * Merge precedence:
 *  - op args override DOM attributes
 *
 * Effect:
 *  - For each key/value pair in the merged patch object:
 *      lib.dom.set(target, key, value)
 *
 * Notes:
 *  - This builtin does not read from or write to the buffer.
 *  - It operates strictly on the current working target.
 *  - Payload/data pipelines are expected to resolve targets explicitly
 *    before invoking dom.patch.
 */
export default async function domPatch({ job, lib, args, ticket, target, step } = {}) {
    try {
        // 1) target must be DOM (hard fail)
        const el = target || ticket.target;
        lib.dom.attempt(el, true);

        // 2) patch from DOM attributes on target
        const fromDom = lib.dom.filterAttributes(el, /^data-attr-/, 1) || {};

        // 3) patch from args (args wins)
        const fromArgs = lib.array.is(args)
            ? lib.hash.to(args[0])
            : lib.hash.to(args);

        const patch = { ...fromDom, ...fromArgs };

        // 4) apply
        let applied = 0;
        for (const k in patch) {
            if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
            lib.dom.set(el, k, patch[k]);
            applied++;
        }

        return helpers.SR_ok({
            op: "dom.patch",
            applied,
            keys: lib.hash.keys(patch),
            step,
        });
    } catch (err) {
        return helpers.SR_error(err, { op: "dom.patch", step });
    }
}
