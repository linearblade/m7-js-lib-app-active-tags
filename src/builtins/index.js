import  domPatch     from './domPatch.js';
import  formCollect  from './formCollect.js';
import  formSubmit   from './formSubmit.js';
import  httpSend     from './httpSend.js';
import  confirm      from './confirm.js';

export { domPatch };
export { formCollect };
export { formSubmit };
export { httpSend };

export default {
    confirm,
    dom : {
	patch: domPatch
    },
    form : {
	collect: formCollect,
	submit : formSubmit
    },
    http: {
	send: httpSend
    }
};
