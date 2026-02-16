import  errorDump  from './errorDump.js';

/**
 * Error builtin namespace exports.
 */
export  { errorDump };

/**
 * `error.fail` builtin.
 *
 * Returns `false` intentionally so VM scalar normalization treats the
 * stage as failure and transitions into error handling.
 *
 * @returns {boolean}
 */
export  function errorFail(){
    return false;
}

/**
 * Error namespace registry.
 *
 * @type {{dump: Function, fail: Function}}
 */
export const ERROR = {
    dump : errorDump,
    fail :  errorFail
};

export default ERROR;
