// builtins/confirm.js

/**
 * `confirm` builtin.
 *
 * Shows a browser confirm dialog when enabled and controls pipeline flow
 * from the user decision.
 *
 * Message resolution precedence:
 * 1) `args.message`
 * 2) `data-confirm` attribute
 * 3) `data-confirm-text` / `data-confirm-message`
 * 4) `"Are you sure?"`
 *
 * Enablement policy:
 * - explicit `args.enabled`
 * - else enabled when confirm-related DOM attributes are present
 * - else no-op (`status: "ok", enabled:false`)
 *
 * Runtime behavior:
 * - Headless/no-window environments: soft-skip as `ok`
 * - Confirm accept: `ok`
 * - Confirm cancel: `complete` + `inputs.cancelled = true`
 *
 * @param {Object} params
 * @param {Object} params.job
 * @param {Object} params.lib
 * @param {*} [params.args]
 * @param {Object} [params.inputs]
 * @param {*} [params.step]
 *
 * @returns {Promise<Object>}
 *   StageResult-like object (`ok` | `complete` | `error`).
 */
export default async function confirmOp({ job, lib, args, inputs, step } = {}) {
  try {
    // node/headless environments: no confirm, so treat as pass (or error if you prefer)
    const win = lib?.hash?.get ? lib.hash.get(lib, "_env.root.window") : (typeof window !== "undefined" ? window : null);
    if (!win || typeof win.confirm !== "function") {
      return { status: "ok", detail: { op: "confirm", step, skipped: true, reason: "noWindowConfirm" } };
    }

    const e = job?.e;
    const fromDom = (e && lib?.dom?.filterAttributes)
      ? (lib.dom.filterAttributes(e, /^data-confirm-/, 1) || {})
      : {};

    // also allow plain data-confirm="Are you sure?"
    // (filterAttributes(/^data-confirm$/) doesn’t work well, so just read it directly)
    const directMsg = e?.getAttribute?.("data-confirm");

    const opts = (args && typeof args === "object") ? args : {};

    // message precedence: args.message > data-confirm > data-confirm-text > fallback
    const message =
      opts.message ||
      directMsg ||
      fromDom.text ||
      fromDom.message ||
      "Are you sure?";

    // enabled policy: if attribute exists or args.enabled true
    const enabled =
      ("enabled" in opts) ? !!opts.enabled :
      (directMsg != null) ? true :
      (Object.keys(fromDom).length > 0);

    if (!enabled) {
      return { status: "ok", detail: { op: "confirm", step, enabled: false } };
    }

    const ok = win.confirm(String(message));
    if (ok) {
      return { status: "ok", detail: { op: "confirm", step, confirmed: true } };
    }

    // cancel behavior: stop cleanly (no error pipeline)
    inputs.cancelled = true;
    return { status: "complete", detail: { op: "confirm", step, confirmed: false, cancelled: true } };
  } catch (err) {
    return { status: "error", error: err, detail: { op: "confirm", step } };
  }
}
