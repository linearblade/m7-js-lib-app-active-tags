import  dom          from './dom/index.js';
import  form         from './form/index.js';
import  httpSend     from './httpSend.js';
import  confirm      from './confirm.js';
import  errorDump    from './errorDump.js';
import  buffer       from './buffer/index.js';
import  target       from './target/index.js';
export { dom };
export { form};
export { httpSend };
export { errorDump };
export { buffer };
export { target };

export default {
    confirm,
    dom,
    form ,
    http: {
	send: httpSend
    },
    error: {
	dump: errorDump
    },
    buffer,
    target
};
