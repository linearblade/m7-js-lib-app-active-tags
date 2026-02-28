/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

const STOCK_FORM_JOB_NAME = "stock-form";
const TRADE_INTERVAL_NAME = "quote_tick";
const TRADE_EVENT_NAMES = Object.freeze(["buy_click", "sell_click"]);

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

function set_logged_out_session({ job, lib } = {}) {
    const ws = (job && job.ws) ? job.ws : {};
    if (lib && lib.hash) {
	lib.hash.set(ws, "session.loggedIn", false);
    }
    return true;
}

function get_doc({ job } = {}) {
    const root = job && job.e;
    if (root && root.ownerDocument) return root.ownerDocument;
    if (typeof document !== "undefined") return document;
    return null;
}

function resetUserDisplay({ job } = {}) {
    const doc = get_doc({ job });
    if (!doc) return true;

    const userEl = doc.querySelector(".tutorial-user-text");
    const balEl = doc.querySelector(".tutorial-user-balance");
    const stockEl = doc.querySelector(".tutorial-user-stock");

    if (userEl) userEl.textContent = "...";
    if (balEl) balEl.textContent = "Balance: $0.00";
    if (stockEl) stockEl.textContent = "Stock: 0";

    return true;
}

function get_stock_form_job({ AT } = {}) {
    if (!AT || typeof AT.toJob !== "function") return null;
    return AT.toJob(STOCK_FORM_JOB_NAME);
}

function resume_trading({ AT } = {}) {
    const stockJob = get_stock_form_job({ AT });
    if (!stockJob) return true;

    if (AT.intervals && typeof AT.intervals.on === "function") {
	AT.intervals.on(stockJob, TRADE_INTERVAL_NAME);
    }
    if (AT.events && typeof AT.events.on === "function") {
	for (const eventName of TRADE_EVENT_NAMES) {
	    AT.events.on(stockJob, eventName);
	}
    }

    return true;
}

function pause_trading({ AT } = {}) {
    const stockJob = get_stock_form_job({ AT });
    if (!stockJob) return true;

    if (AT.intervals && typeof AT.intervals.off === "function") {
	AT.intervals.off(stockJob, TRADE_INTERVAL_NAME);
    }
    if (AT.events && typeof AT.events.off === "function") {
	for (const eventName of TRADE_EVENT_NAMES) {
	    AT.events.off(stockJob, eventName);
	}
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
		    "@target.find:selector=.tutorial-user-balance,reset=true",
		    writeBalance,
		    "@target.find:selector=.tutorial-user-stock,reset=true",
		    writeStock,
		    "@target.classRemove:class=is-hidden,target=.tutorial-user-details",
		    "@target.classAdd:class=is-hidden,target=.tutorial-login-btn",
		    "@target.classRemove:class=is-hidden,target=.tutorial-logout-btn",
		    "@target.classRemove:class=is-hidden,target=#tutorial-buy-btn",
		    "@target.classRemove:class=is-hidden,target=#tutorial-sell-btn",
		    "@target.classRemove:class=is-hidden,target=#tutorial-stock-qty-field",
		    resume_trading,
		],
	      error: ["@error.dump"],
  },
    pipelines: {
	logout: {
	    run: [
		set_logged_out_session,
		"@target.classAdd:class=is-hidden,target=.tutorial-user-details",
		resetUserDisplay,
		"@target.classRemove:class=is-hidden,target=.tutorial-login-btn",
		"@target.classAdd:class=is-hidden,target=.tutorial-logout-btn",
		"@target.classAdd:class=is-hidden,target=#tutorial-buy-btn",
		"@target.classAdd:class=is-hidden,target=#tutorial-sell-btn",
		"@target.classAdd:class=is-hidden,target=#tutorial-stock-qty-field",
		pause_trading,
	    ],
	    error: ["@error.dump"],
	},
    },
  events: {
      login_click: {
	  event: "click",
	  selector: ".tutorial-login-btn",
	  pipeline: "default",
      },
      logout_click: {
	  event: "click",
	  selector: ".tutorial-logout-btn",
	  pipeline: "logout",
      },
  },

  env: {
    section: "header",
  },
};
