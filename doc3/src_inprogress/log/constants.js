// log/constants.js
export const CONSOLE_LEVEL = Object.freeze({
    OFF:   0,  // never emit
    ERROR: 1,  // error only
    WARN:  2,  // warn + error
    INFO:  3,  // info + warn + error
    LOG:   4,  // log + info + warn + error
    ALL:   5   // emit everything
});
