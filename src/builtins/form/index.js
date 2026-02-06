import  formCollect      from './formCollect.js';
import  formPrepare      from './formPrepare.js';
import  formSubmit       from './formSubmit.js';
import  requestHeaders   from './requestHeaders.js';

export { formCollect };
export { formPrepare };
export { formSubmit };
export { requestHeaders };

export const FORM = {
    collect: formCollect,
    prepare: formPrepare,
    submit: formSubmit,
    headers: requestHeaders
};

export default FORM;
