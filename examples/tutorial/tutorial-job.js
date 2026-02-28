/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

function getWorkspace(job) {
  return job && job.ws ? job.ws : {};
}

function getCount({ job, lib } = {}) {
  const ws = getWorkspace(job);
  const value = Number(lib.hash.get(ws, "counter.value"));
  return Number.isFinite(value) ? value : 0;
}

function setCount({ job, lib, value } = {}) {
  const ws = getWorkspace(job);
  lib.hash.set(ws, "counter.value", Number(value) || 0);
  return true;
}

function incrementCounter({ job, lib } = {}) {
  return setCount({ job, lib, value: getCount({ job, lib }) + 1 });
}

function resetCounter({ job, lib } = {}) {
  return setCount({ job, lib, value: 0 });
}

function renderCounterToBuffer({ job, lib, buffer } = {}) {
  if (!buffer || typeof buffer.set !== "function") return true;
  buffer.set({ count: getCount({ job, lib }) }, { source: "tutorial.renderCounterToBuffer" });
  return true;
}

function renderCounterSteps() {
  return [
    renderCounterToBuffer,
    "@target.find:selector=.tutorial-count,reset=true",
    "@target.patch:textContent=${buffer:count}",
    "@target.reset",
  ];
}

export default {
  name: "tutorial-counter",
  enabled: true,
  autorun: true,

  requests: {
    fragment: {
      transport: "http",
      endpoint: {
        url: "./fragment.html",
      },
      method: "GET",
      response: {
        parse: "text",
        return: "text",
        requireOk: true,
      },
    },
  },

  pipeline: {
    run: renderCounterSteps(),
    error: ["@error.dump"],
  },

  pipelines: {
    increment: {
      run: [incrementCounter, ...renderCounterSteps()],
      error: ["@error.dump"],
    },
    reset: {
      run: [resetCounter, ...renderCounterSteps()],
      error: ["@error.dump"],
    },
    tick: {
      run: [incrementCounter, ...renderCounterSteps()],
      error: ["@error.dump"],
    },
    load_fragment: {
      run: [
        { op: "@http.send", args: { name: "fragment", url: "./fragment.html" } },
        "@target.find:selector=.tutorial-fragment,reset=true",
        "@target.patch:innerHTML=${buffer}",
        "@target.reset",
      ],
      error: ["@error.dump"],
    },
  },

  events: {
    inc_click: {
      event: "click",
      selector: "[data-inc]",
      pipeline: "increment",
    },
    reset_click: {
      event: "click",
      selector: "[data-reset]",
      pipeline: "reset",
    },
    load_fragment_click: {
      event: "click",
      selector: "[data-load-fragment]",
      pipeline: "load_fragment",
    },
  },

  intervals: {
    tick: {
      repeat: 1500,
      pipeline: "tick",
      allowOverlap: false,
      onError: "continue",
    },
  },
};
