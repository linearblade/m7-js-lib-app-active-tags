export default async function errorCapture({ job, lib, args, trigger, ticket, inputs, ctx, step,expr } = {}) {

  try {
      const opts = lib.args.parse(args, {}, {
          parms: "capture dst which",
          pop: true,
      }) || {};

      if (!['original','last'].includes(opts.which) )
	  opts.which = 'original';
      if (!['message','error','full' ].includes(opts.capture) )
	  opts.capture = 'full';
      if(!opts.dst)
	  opts.dst = "buffer";
      
      const original = ticket?.errorInfo || null;
      const lastErr = ticket?.last?.res || null;
      let err = null;
      //console.warn('error', original,'last', lastErr);
      if(opts.which === 'original') {
	  err = original;
      }else if (opts.which === 'last') {
	  err = lastErr;
      }else {
	  err =  original || lastErr ||  null;
      }
      if(!opts.output)
	  opts.output = "buffer";

      if(opts.capture === 'message'){
	  err = err?.error?.message;
      }else if (opts.capture === 'error'){
	  err = err?.error;
      }
      
      writeExprDestination({ lib, expr, job, ticket, ctx, dst:opts.dst, value:err });

    return { status: "ok", detail: { op: "error.capture", dumped: true, step } };
  } catch (err2) {
      console.error(err2);
    return { status: "error", error: err2, detail: { op: "error.capture", step } };
  }
}


function writeExprDestination({ lib, expr, job, ticket, ctx, dst, value }) {

    const parsed = expr.parse(
        {
            job,
            ticket,
            ctx,
            env: lib.hash.get(lib, "_env"),
        },
        dst
    );

    const [src, prop] = lib.hash.expand(parsed, "src prop");
    //console.warn(`src/prop ${dst}`,src,prop);
    // This helper writes to a property path; it does not support rebinding `src`.
    // `isEmpty(prop)` allows 0 while rejecting empty/null paths.
    if (!src || lib.utils.isEmpty(prop)) {
        throw new Error(`error.capture: destination did not resolve to writable target '${dst}'`);
    }

    if (lib.dom.is(src)) {
        lib.dom.set(src, prop, value);
        return;
    }

    lib.hash.set(src, prop, value);
    return;
}
