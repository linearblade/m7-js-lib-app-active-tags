import  dom          from './dom/index.js';
import  form         from './form/index.js';
import  httpSend     from './httpSend.js';
import  confirm      from './confirm.js';
import  error        from './error/index.js';
import  buffer       from './buffer/index.js';
import  target       from './target/index.js';

export { dom };
export { form};
export { httpSend };
export { buffer };
export { target };
export { error } ;

export default {
    confirm,
    dom,
    form ,
    http: {
	send: httpSend
    },
    error,
    buffer,
    target
};


