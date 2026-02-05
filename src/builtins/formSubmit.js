export default async function formSubmit({ job, lib, trigger, inputs, step } = {}) {
  try {
    if (!inputs || typeof inputs !== "object") {
      return { status: "error", error: new Error("form.submit: missing inputs"), detail: { op:"form.submit", step } };
    }

    // determine a submitter/trigger
    const e = inputs.event || null;
    const submitter =
      (e && e.submitter) ||
      trigger ||
      job?.e ||
      null;

    inputs.trigger = submitter;
    inputs.eventName = inputs.eventName || "submit";

    return { status: "ok", detail: { op: "form.submit", step } };
  } catch (err) {
    return { status: "error", error: err, detail: { op:"form.submit", step } };
  }
}
