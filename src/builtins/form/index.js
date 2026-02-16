import  formCollect      from './formCollect.js';
import  formPrepare      from './formPrepare.js';
import  formSubmit       from './formSubmit.js';
import  requestHeaders   from './requestHeaders.js';

/**
 * Form builtin namespace registry.
 *
 * Exported ops:
 * - `form.collect`
 * - `form.prepare`
 * - `form.submit`
 * - `form.headers`
 */
export { formCollect };
export { formPrepare };
export { formSubmit };
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
    headers: requestHeaders
};

export default FORM;
