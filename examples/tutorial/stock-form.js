function pull_quote({ job, buffer, lib } = {}) {
  const ws = (job && job.ws) ? job.ws : {};

  const currentPrice = Number(lib.hash.get(ws, "ticker.price"));
  const basePrice =
    Number.isFinite(currentPrice) && currentPrice > 0
      ? currentPrice
      : 184.52;

  // Simulate changing market metrics each run.
  const change = Number(((Math.random() * 4) - 2).toFixed(2));
  const nextPrice = Number(Math.max(0.01, basePrice + change).toFixed(2));
  const vol = Math.floor(5000 + Math.random() * 95000);

  // Persist rolling ticker price in workspace for the next tick.
  lib.hash.set(ws, "ticker.price", nextPrice);

  if (buffer && typeof buffer.set === "function") {
    buffer.set(
      {
        status: 1,
        data: { price: nextPrice, change, vol },
      },
      { source: "pull_quote" }
    );
  }

  return true;
}

function write_quote({ job, buffer } = {}) {
  const quote = (buffer && typeof buffer.get === "function")
    ? buffer.get()
    : null;

  const price = Number(quote && quote.price);
  const change = Number(quote && quote.change);
  const vol = Number(quote && quote.vol);

  const root = job && job.e;
  if (!root || typeof root.querySelector !== "function") return true;

  const priceEl = root.querySelector("#tutorial-stock-price");
  const changeEl = root.querySelector("#tutorial-stock-change");
  const volEl = root.querySelector("#tutorial-stock-vol");

  if (priceEl && Number.isFinite(price)) {
    priceEl.textContent = `$${price.toFixed(2)}`;
  }

  if (changeEl && Number.isFinite(change)) {
    const sign = change >= 0 ? "+" : "";
    changeEl.textContent = `${sign}${change.toFixed(2)}`;
    changeEl.style.color = change >= 0 ? "#89d899" : "#ef8f8f";
  }

  if (volEl && Number.isFinite(vol)) {
    volEl.textContent = vol.toLocaleString();
  }

  return true;
}

function set_ctx_error(ctx, message) {
  if (ctx && typeof ctx === "object") {
    ctx.error = message;
  }
}

function get_header_job({ AT } = {}) {
  if (!AT || typeof AT.toJob !== "function") return null;
  return AT.toJob("header");
}

function sync_header_portfolio({ headerJob, balance, stock } = {}) {
  const root = headerJob && headerJob.e;
  if (!root || typeof root.querySelector !== "function") return;

  const balEl = root.querySelector(".tutorial-user-balance");
  const stockEl = root.querySelector(".tutorial-user-stock");

  if (balEl) balEl.textContent = `Balance: $${Number(balance).toFixed(2)}`;
  if (stockEl) stockEl.textContent = `Stock: ${Number(stock)}`;
}

function require_logged_in({ lib, ctx, AT } = {}) {
  const headerJob = get_header_job({ AT });
  if (!headerJob) {
    set_ctx_error(ctx, "Header job unavailable. Please refresh.");
    return false;
  }

  const loggedIn = !!lib.hash.get(headerJob, "ws.session.loggedIn");
  if (!loggedIn) {
    set_ctx_error(ctx, "Please login before trading.");
    return false;
  }

  return true;
}

function get_trade_inputs({ job, lib, ctx, AT } = {}) {
  const headerJob = get_header_job({ AT });
  if (!headerJob) {
    set_ctx_error(ctx, "Header job unavailable. Please refresh.");
    return null;
  }

  const form = job && job.e;
  const qtyEl = form && typeof form.querySelector === "function"
    ? form.querySelector("#tutorial-stock-qty")
    : null;

  const qty = Math.floor(Number(qtyEl ? qtyEl.value : 0));
  if (!Number.isFinite(qty) || qty <= 0) {
    set_ctx_error(ctx, "Quantity must be a positive number.");
    return null;
  }

  const price = Number(lib.hash.get(job, "ws.ticker.price"));
  if (!Number.isFinite(price) || price <= 0) {
    set_ctx_error(ctx, "Ticker price unavailable. Wait for quote update.");
    return null;
  }

  const balanceRaw = Number(lib.hash.get(headerJob, "ws.portfolio.balance"));
  const stockRaw = Number(lib.hash.get(headerJob, "ws.portfolio.stock"));
  const balance = Number.isFinite(balanceRaw) ? balanceRaw : 0;
  const stock = Number.isFinite(stockRaw) ? stockRaw : 0;

  return { headerJob, qty, price, balance, stock };
}

function buy_stock({ job, lib, ctx, AT } = {}) {
  const state = get_trade_inputs({ job, lib, ctx, AT });
  if (!state) return false;

  const cost = Number((state.qty * state.price).toFixed(2));
  if (state.balance < cost) {
    set_ctx_error(
      ctx,
      `Insufficient balance. Need $${cost.toFixed(2)}, have $${state.balance.toFixed(2)}.`
    );
    return false;
  }

  const nextBalance = Number((state.balance - cost).toFixed(2));
  const nextStock = state.stock + state.qty;

  lib.hash.set(state.headerJob.ws, "portfolio.balance", nextBalance);
  lib.hash.set(state.headerJob.ws, "portfolio.stock", nextStock);
  sync_header_portfolio({ headerJob: state.headerJob, balance: nextBalance, stock: nextStock });

  set_ctx_error(ctx, null);
  return true;
}

function sell_stock({ job, lib, ctx, AT } = {}) {
  const state = get_trade_inputs({ job, lib, ctx, AT });
  if (!state) return false;

  if (state.stock < state.qty) {
    set_ctx_error(
      ctx,
      `Insufficient stock. Trying to sell ${state.qty}, available ${state.stock}.`
    );
    return false;
  }

  const proceeds = Number((state.qty * state.price).toFixed(2));
  const nextBalance = Number((state.balance + proceeds).toFixed(2));
  const nextStock = state.stock - state.qty;

  lib.hash.set(state.headerJob.ws, "portfolio.balance", nextBalance);
  lib.hash.set(state.headerJob.ws, "portfolio.stock", nextStock);
  sync_header_portfolio({ headerJob: state.headerJob, balance: nextBalance, stock: nextStock });

  set_ctx_error(ctx, null);
  return true;
}

function alert_ctx_error({ ctx } = {}) {
  const msg = (ctx && typeof ctx.error === "string" && ctx.error.trim())
    ? ctx.error.trim()
    : "Trade request failed.";

  if (typeof window !== "undefined" && typeof window.alert === "function") {
    window.alert(msg);
  }

  return true;
}

export default {
  name: "stock-form",
  require: "header",
  enabled: true,
  autorun: false,

  // Basic pipeline placeholders for tutorial progression.
  pipelines: {
    quote_tick: {
      run: [
        pull_quote,
        "buffer.traverse:data",
        write_quote,
      ],
      error: ["error.dump"],
    },
    buy: {
      run: [
        require_logged_in,
        buy_stock,
      ],
      error: [alert_ctx_error, "error.dump"],
    },
    sell: {
      run: [
        require_logged_in,
        sell_stock,
      ],
      error: [alert_ctx_error, "error.dump"],
    },
  },

  // Wire buttons to named pipelines.
  events: {
    buy_click: {
      event: "click",
      selector: "#tutorial-buy-btn",
      pipeline: "buy",
    },
    sell_click: {
      event: "click",
      selector: "#tutorial-sell-btn",
      pipeline: "sell",
    },
  },

  intervals: {
    quote_tick: {
      repeat: 2000,
      pipeline: "quote_tick",
      allowOverlap: false,
      onError: "continue",
    },
  },

  // Placeholder request definitions for later steps.
  requests: {
    quote: {
      url: "/api/tutorial/quote",
      method: "GET",
    },
    order: {
      url: "/api/tutorial/order",
      method: "POST",
      headers: {
        "X-Tutorial": "active-tags",
      },
    },
  },

  env: {
    symbol: "M7X",
  },
};
