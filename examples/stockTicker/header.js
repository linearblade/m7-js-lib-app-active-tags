//no need to export, just link directly to the config.
/**
   simulate login success response. like username etc with a status wrapper, possibly some meta information
   */
function dummy_login({ buffer, job, lib } = {}) {
    console.warn('dummy login');

    const ws = (job && job.ws) ? job.ws : {};
    const wsLoginName = (lib && lib.hash) ? lib.hash.get(ws, "session.loginame") : undefined;
    const wsDisplayName = (lib && lib.hash) ? lib.hash.get(ws, "session.displayname") : undefined;
    const wsBal = Number(lib && lib.hash ? lib.hash.get(ws, "portfolio.balance") : undefined);
    const wsStock = Number(lib && lib.hash ? lib.hash.get(ws, "portfolio.stock") : undefined);

    const loginame = wsLoginName || "test_user";
    const displayname = wsDisplayName || "Test User";

    // Initialize workspace balances once for this job session.
    if (lib && lib.hash && !Number.isFinite(wsBal)) {
	lib.hash.set(ws, "portfolio.balance", 1000);
    }
    if (lib && lib.hash && !Number.isFinite(wsStock)) {
	lib.hash.set(ws, "portfolio.stock", 0);
    }
    if (lib && lib.hash) {
	lib.hash.set(ws, "session.loginame", loginame);
	lib.hash.set(ws, "session.displayname", displayname);
	lib.hash.set(ws, "session.loggedIn", true);
    }

    const balance = Number(lib && lib.hash ? lib.hash.get(ws, "portfolio.balance") : 1000) || 1000;
    const stock = Number(lib && lib.hash ? lib.hash.get(ws, "portfolio.stock") : 0) || 0;

    // Set a fake successful login payload on the ticket buffer.
    if (buffer && typeof buffer.set === "function") {
	buffer.set(
	    {
		status: 1,
		data: {
		    loginame,
		    displayname,
		    balance,
		    stock,
		},
	    },
	    { source: "dummy_login" }
		);
    }

    // Return explicit continue signal for the VM.
    return true;
}
/**
   writes the displayname to the current target. Dom patch wontwork b/c its legacy style. we'll go back and doll up the builtins after we write the demo and other stuff
*/
function writeUser(ctx) {
    console.log(ctx);
    const { buffer, ticket, job } = ctx;
    const payload =buffer.get()
    const displayName = payload.displayname;
    const target = ticket?.target || job.e;
    target.textContent = displayName;

    return true;
}

function writeBalance({buffer,ticket,job}){
    const bal = buffer.get().balance;
    ticket.target.textContent = `Balance: $${Number(bal).toFixed(2)}`;
    return true;
}

function writeStock({buffer,ticket,job}){
    const stock = Number(buffer.get().stock || 0);
    ticket.target.textContent = `Stock: ${stock}`;
    return true;
}

function revealUserDetails({ ticket }) {
    if (ticket && ticket.target && ticket.target.classList) {
	ticket.target.classList.remove("is-hidden");
    }
    return true;
}

function hideLoginButton({ ticket }) {
    if (ticket && ticket.target && ticket.target.classList) {
	ticket.target.classList.add("is-hidden");
    }
    return true;
}

export default {
  name: "header",
  enabled: true,
  autorun: false,


  // Keep a minimal default pipeline so this config is explicit and extensible.
    pipeline: {
	//login, move the target pointer (check builtins/target/index) 
		run: [
		    dummy_login,
		    "@buffer.traverse:data",
		    "@target.find:.tutorial-user-text",
		    writeUser,
		    "target.reset",
		    "target.find:.tutorial-user-balance",
		    writeBalance,
		    "target.reset",
		    "target.find:.tutorial-user-stock",
		    writeStock,
		    "target.reset",
		    "target.find:.tutorial-user-details",
		    revealUserDetails,
		    "target.reset",
		    "target.find:.tutorial-login-btn",
		     hideLoginButton,
		],
	      error: ["@error.dump"],
  },
    pipelines: {

    },
  events: {
      login_click: {
	  event: "click",
	  selector: ".tutorial-login-btn",
	  pipeline: "default",
      }
  },

  env: {
    section: "header",
  },
};
