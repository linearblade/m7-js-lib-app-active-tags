/*
  //THIS 
(() => {
    console.warn('loading script config');
    //document.addEventListener("DOMContentLoaded", () => {
    //    lib.hash.set(
    //        window,
    //"ws.conf.jumjum",

    return {
	name: "jumjum",
	enable: {
            enabled: true,
            autorun: true
	},
	pipeline: {
            run: "foo",
            onError: "error.dump"
	}
    }
    //    );
    //});
})()

*/
/*
//OR this

{
        name: "jumjum",
        enable: {
            enabled: true,
            autorun: true
        },
        pipeline: {
            run: "foo",
            onError: "error.dump"
        }
    }

*/


//OR this

({
    name: "jumjum",
    enabled: true,
    autorun: true,
    pipeline: {
        run  : "foo",
        error: "error.dump"
    }
})

