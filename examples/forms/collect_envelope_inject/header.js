/*
 * Copyright (c) 2026 m7.org
 * License: MTL-10 (see LICENSE.md)
 */

function dummy_login({ buffer, job, lib } = {}) {
    const ws = (job && job.ws) ? job.ws : {};
    const wsLoginName = (lib && lib.hash) ? lib.hash.get(ws, "session.loginame") : undefined;
    const wsDisplayName = (lib && lib.hash) ? lib.hash.get(ws, "session.displayname") : undefined;
    const wsBal = Number(lib && lib.hash ? lib.hash.get(ws, "portfolio.balance") : undefined);
    const wsStock = Number(lib && lib.hash ? lib.hash.get(ws, "portfolio.stock") : undefined);

    const loginame = wsLoginName || "test_user";
    const displayname = wsDisplayName || "Test User";

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

    return true;
}

function writeUser(ctx) {
    const { buffer, ticket, job } = ctx;
    const payload = buffer.get();
    const displayName = payload.displayname;
    const target = ticket && ticket.target ? ticket.target : job.e;
    target.textContent = displayName;
    return true;
}

function writeBalance({buffer, ticket} = {}){
    const bal = buffer.get().balance;
    ticket.target.textContent = `Balance: $${Number(bal).toFixed(2)}`;
    return true;
}

function writeStock({buffer, ticket} = {}){
    const stock = Number(buffer.get().stock || 0);
    ticket.target.textContent = `Stock: ${stock}`;
    return true;
}

function revealUserDetails({ ticket } = {}) {
    if (ticket && ticket.target && ticket.target.classList) {
        ticket.target.classList.remove("is-hidden");
    }
    return true;
}

function hideLoginButton({ ticket } = {}) {
    if (ticket && ticket.target && ticket.target.classList) {
        ticket.target.classList.add("is-hidden");
    }
    return true;
}

export default {
    name: "header",
    enabled: true,
    autorun: false,
    pipeline: {
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
