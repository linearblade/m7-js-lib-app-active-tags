/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

function markLoaded({ job } = {}) {
  const root = job && job.e;
  if (!root) return true;

  root.innerHTML = "ActiveTags loaded.";
  return true;
}

export default {
  name: "tutorial-loaded",
  enabled: true,
  autorun: false,
  pipeline: {
    run: [markLoaded],
    error: ["@error.dump"],
  },
};
