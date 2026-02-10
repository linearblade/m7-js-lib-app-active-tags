const atConf = {
  // ---------------------------------------------------------------------------
  // Environment (optional; inferred if omitted)
  // ---------------------------------------------------------------------------
  env: { window, document, root: window },

  // ---------------------------------------------------------------------------
  // Job configuration policy
  // (how job config is discovered, parsed, merged, and interpreted)
  // ---------------------------------------------------------------------------
  job: {
    config: {
      // --- where job config is allowed to come from ---
      allowExternal: true,                 // false => base-only mode (no DOM / script config)
      at: ["config.at", "at"],             // DSL pointer(s) to job config sources

      // --- how job-related DOM attributes / config keys are read ---
      attrPrefixes: ["data-", "at-"],

      // --- evaluation / import policy for job config ---
      evalEnabled: true,
      evalType: ["text/at-eval", "text/at-config"],
      importEnabled: true,
      importPath: ["/vendor/m7-js-lib-active-tags/examples/"],

      // --- merge semantics for layered job config ---
      // base    : constructor-provided config
      // external: DOM / script-derived config
      // inline  : inline or per-element overrides
      merge: {
        order: ["base", "external", "inline"],
        objects: "deep",
        arrays: "concatUnique"
      }
    }
  },

  // ---------------------------------------------------------------------------
  // Boot policy
  // (one-time initialization behavior + initial runtime enablement)
  // ---------------------------------------------------------------------------
  boot: {
    // DOM discovery selector used during boot sweep
    selector: "[data-activetag], form[data-activetag]",

    // perform initial DOM sweep immediately on construction
    bootSweep: true,

    // start DOM observer for dynamically-added elements
    observeDom: true,

    // initial runtime state only (can be changed later via runtime API)
    intervals: true,
    events: true
  },

  // ---------------------------------------------------------------------------
  // Logging / diagnostics policy
  // ---------------------------------------------------------------------------
  log: {
    enabled: true,
    policy: {
      console: "warn",   // warn | error | info | log (as supported by lib logger)
      trace: false       // pipeline / VM trace output
    }
  },

  // ---------------------------------------------------------------------------
  // Error handling posture
  // ---------------------------------------------------------------------------
  errors: {
    // behavior when a pipeline op throws
    onOpError: "error"   // "error" | "complete" | "continue" (if supported)
  }
};
