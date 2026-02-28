/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * ActiveTags runtime version.
 *
 * Build-time bundles inject __AT_VERSION__ via esbuild --define.
 * Source/dev mode falls back to "dev".
 */
const VERSION =
    typeof __AT_VERSION__ !== "undefined" && __AT_VERSION__
        ? __AT_VERSION__
        : "dev";

export default VERSION;
