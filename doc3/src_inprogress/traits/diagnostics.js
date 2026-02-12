export const diagnosticTraits = {
    nonFatal(){
        let trace = this.stackTrace(3);
        if(arguments.length){
            console.error(arguments[0]);
            if (arguments.length>1)
                console.error(lib.args.slice(arguments,1));
        }

        //console.error(arguments,trace);
    },
    
    error(text){
        let trace = this.stackTrace(3);
        if(arguments.length){
            console.error(arguments[0]);
            if (arguments.length>1)
                console.error(lib.args.slice(arguments,1));
        }
        //console.error(arguments,trace);
        throw Error(trace);
    },
    warn(text){
        let trace = this.stackTrace(3);
        console.warn(arguments,trace);
        //console.warn(`${text}\n${trace}\n`);
    },


    
    parseStackLine(stackLine) {
	//const pattern = /at\s+(\S+)\s+\(eval\s+at\s+(\S+)\s+\(([^:]+):(\d+):(\d+)\),\s*<([^:]+):(\d+):(\d+)>\)/;
	const pattern = /at\s+(\S+)\s+\((\S+)\s+at\s+(\S+)\s+\(([^\)]+)\)\,([^:]+)\:(\d+)\:(\d+)/;
	const match = stackLine.match(pattern);
	if (match) {
            return {
		functionName: match[1],
		evalFunctionName: match[2],
		filePath: match[3],
		line: parseInt(match[4]),
		column: parseInt(match[5]),
		callerFilePath: match[6],
		callerLine: parseInt(match[7]),
		callerColumn: parseInt(match[8])
            };
	} else {
            return null;
	}
    },
    stackTrace(index=2) {
	// Create an Error object to capture the stack trace
	const stack = new Error().stack;
	//console.log(stack);
	// Extract the stack trace as an array of strings
	const stackLines = stack.split('\n');

	// The caller's line number is in the third line of the stack trace
	// The first line is the Error message, the second line is where the Error was created
	const callerLine = stackLines[index].trim();
	//console.log('stack line');
	//console.warn(callerLine);
	//console.log('end stack line');
	return (callerLine);
	let parsed = this.parseStackLine(callerLine.trim());
	if(!parsed)return {};
	console.warn(parsed);
	return {
	    file:parsed.callerFilePath,
	    line: parsed.callerLine
	};
	// Extract the line number from the caller's stack trace line
	//const lineNumber = callerLine.trim().split(':')[1];

	return lineNumber;
    }
};

export default diagnosticTraits;
