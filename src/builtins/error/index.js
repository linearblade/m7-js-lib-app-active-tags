import  errorDump  from './errorDump.js';

export  { errorDump };

export  function errorFail(){
    return false;
}
export const ERROR = {
    dump : errorDump,
    fail :  errorFail
};

export default ERROR;
