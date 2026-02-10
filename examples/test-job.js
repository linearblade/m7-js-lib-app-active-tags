export default {
    "name": "test-job",
    "require" : "jumjum",
    "enable" : true,
    "autorun" : "funz",
    

    "events": {
	"hover:on" : {
	    "enabled" : true,
	    "event": "pointerover",
	    "selector": "[data-button]",
	    "pipeline": "hover_on",
	    "options": { "capture": false, "passive": true }
	},
	"hover:off" : {
	    "event": "pointerout",
	    "selector": "[data-button]",
	    "pipeline": "hover_off",
	    "options": { "capture": false, "passive": true }
	}
    },
    
    "request_shape": {
	"headers": {
	    "X-Test": "yes"
	}
    },

    "request": "/api/test/default",

    "requests": {
	"delete": {
	    "url": "/api/test/delete",
	    "method": "post"
	}
    },

    "interval_shape": {
	"repeat": 7000,
	"allowOverlap": false
    },

    "interval": {
	"pipeline" : "interval"
    },

    "intervals": {
	"poll": {
	    "pipeline" : "interval2",
	    "repeat": 2000,
	    "allowOverlap": false
	}
    },

    "pipeline_shape": {
	"confirm": true
    },

    "pipeline": {
	"run": "foo:1,2,3 bar:${a},${b} far",
	"error" : "errOutput:whoopsie"
    },
    
    "pipelines": {
	"funz" : {
	    "run": [
		"confirm",
		"form.prepare",
		"form.collect",

		{
		    "op": "foo",
		    "args": {
			"mode": "test",

			"jobId": "${job:id}",

			"label": "running job ${job:id}",
			"rawTarget": "${target:}",          
			"rawMeta": "${buffer_meta:}"        ,
			"stringTarget": "t=${target:tagName}" ,
			"meta": {
			    "pipeline": "${ticket:pipelineKey}",
			    "targetTag": "tag=${target:tagName}"
			}
		    }
		},

		{
		    "op": "dom.patch",
		    "args": {
			"style.font-weight": "bold",
			"style.color": "red"
		    }
		},

		{
		    "op": "form.submit",
		    "args": {
			"contentType": "json"
		    }
		}
	    ],

	    "error": [
		{ "op": "error.dump", "args": { "throw": true } }
	    ]
	},
	"patch" :{
	    "run": [ "confirm", "form.prepare", "form.collect", {"op": "dom.patch", "args" : {"style.font-weight": "bold",	"style.color"      : "red"} },
		     {"op": "form.submit", "args": {"contentType": "json"} } ],
	    "error": [{"op": "error.dump", "args": {"throw":true} }]
	},
	"hover_on": {
	    "run": "hover_on hover_b",
	    "error": "errOutput"
	},
	
	"hover_off": {
	    "run": "hover_off",
	    "error": "errOutput"
	}
    }
}
