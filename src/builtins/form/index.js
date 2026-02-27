/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

import  formCollect      from './formCollect.js';
import  formPrepare      from './formPrepare.js';
import  formSubmit       from './formSubmit.js';
import  formToEnvelope   from './formToEnvelope.js';
import  requestHeaders   from './requestHeaders.js';

/**
 * Form builtin namespace registry.
 *
 * Exported ops:
 * - `form.collect`
 * - `form.prepare`
 * - `form.submit`
 * - `form.toEnvelope`
 * - `form.headers`
 */
export { formCollect };
export { formPrepare };
export { formSubmit };
export { formToEnvelope };
export { requestHeaders };

/**
 * Namespace object used for builtin tree registration under `form.*`.
 *
 * @type {Object}
 */
export const FORM = {
    collect: formCollect,
    prepare: formPrepare,
    submit: formSubmit,
    toEnvelope: formToEnvelope,
    headers: requestHeaders
};

export default FORM;
