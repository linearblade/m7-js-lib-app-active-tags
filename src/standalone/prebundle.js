/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

/**
 * Standalone prebundle entry (monorepo/vendor layout).
 *
 * Goal:
 * - Export a single import surface that includes:
 *   - lib + initLib
 *   - ActiveTags
 *   - required primitive installers
 * - Provide convenience helpers to install all dependencies, then boot AT.
 *
 * Notes:
 * - This entry is intended to be bundled/minified into one distributable blob.
 * - Import paths assume sibling repositories under a shared `vendor/` folder.
 */

import { lib, init as initLib } from "../../../m7-js-lib/src/index.js";
import ActiveTags from "../ActiveTags.js";
import { SERVICE_ID } from "../install.js";
import VERSION from "../version.js";
import installStandalone from "./install.js";

/**
 * Single standalone installer with bundled lib integration.
 *
 * Installs missing primitive services, then delegates canonical ActiveTags
 * install (`src/install.js`) for namespace + service registration.
 *
 * @param {Object} [opts={}]
 * @returns {Object} lib instance
 */
export function install(opts = {}) {
    return installStandalone(opts);
}

export {
    lib,
    initLib,
    ActiveTags,
    SERVICE_ID,
    VERSION,
};

export default {
    lib,
    initLib,
    ActiveTags,
    SERVICE_ID,
    VERSION,
    install,
};
