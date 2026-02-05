// builtins/confirm.js

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
