/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

import  dom          from './dom/index.js';
import  form         from './form/index.js';
import  http         from './http/index.js';
import { httpSend }  from './http/index.js';
import  confirm      from './confirm.js';
import  error        from './error/index.js';
import  buffer       from './buffer/index.js';
import  target       from './target/index.js';
import  e            from './e/index.js';

/**
 * Builtins root export surface used by ActiveTags engine config compilation.
 *
 * Namespaces:
 * - `confirm` (root op)
 * - `dom.*`
 * - `form.*`
 * - `http.send`
 * - `error.*`
 * - `buffer.*`
 * - `target.*`
 * - `e.*`
 *
 * This file is the canonical builtin registry source for:
 * - `AT.conf.engine.builtins` defaults
 * - runtime VM builtin lookup (`Validate._getFn`)
 */
export { dom };
export { form};
export { http };
export { httpSend };
export { buffer };
export { target };
export { e };
export { error } ;

/**
 * Default builtin registry tree.
 *
 * @type {Object}
 */
export default {
    confirm,
    dom,
    form ,
    http,
    error,
    buffer,
    target,
    e
};
