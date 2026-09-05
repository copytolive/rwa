window.RWA_CONFIG = {
  meta: {
    name: "RWA Terminal",
    reference: "screenshot-to-code compatible prototype",
    version: "0.1.0"
  },
  market: {
    symbol: "RWAus",
    subtitle: "Real Estate US",
    price: "$1.1428",
    change: "+2.35%",
    marketCap: "$512.84M",
    volume: "$38.62M",
    liquidity: "$14.27M",
    holders: "24,671"
  },
  slots: {
    navTrade:      { label: "Trade",      system: "router",          action: "open-trade",      target: "/trade",      enabled: true },
    navDiscover:   { label: "Discover",   system: "router",          action: "open-discover",   target: "/discover",   enabled: true },
    navPortfolio:  { label: "Portfolio",  system: "portfolio",       action: "open-portfolio",  target: "/portfolio",  enabled: true },
    navAnalytics:  { label: "Analytics",  system: "analytics",       action: "open-analytics",  target: "/analytics",  enabled: true },
    navRewards:    { label: "Rewards",    system: "rewards",         action: "open-rewards",    target: "/rewards",    enabled: true },
    navMore:       { label: "More",       system: "router",          action: "open-more",       target: "#more",        enabled: true },
    chart1m:       { label: "1m",         system: "chart",           action: "timeframe",       target: "1m",           enabled: true },
    chart5m:       { label: "5m",         system: "chart",           action: "timeframe",       target: "5m",           enabled: true },
    chart15m:      { label: "15m",        system: "chart",           action: "timeframe",       target: "15m",          enabled: true },
    chart1h:       { label: "1h",         system: "chart",           action: "timeframe",       target: "1h",           enabled: true },
    chart4h:       { label: "4h",         system: "chart",           action: "timeframe",       target: "4h",           enabled: true },
    chart1d:       { label: "D",          system: "chart",           action: "timeframe",       target: "1d",           enabled: true },
    indicators:    { label: "Indicators", system: "chart",           action: "open-indicators", target: "indicators",   enabled: true },
    templates:     { label: "Templates",  system: "chart",           action: "open-templates",  target: "templates",    enabled: true },
    tradeBuy:      { label: "Buy",        system: "trade-execution", action: "set-side",        target: "buy",          enabled: true },
    tradeSell:     { label: "Sell",       system: "trade-execution", action: "set-side",        target: "sell",         enabled: true },
    orderMarket:   { label: "Market",     system: "trade-execution", action: "order-type",      target: "market",       enabled: true },
    orderLimit:    { label: "Limit",      system: "trade-execution", action: "order-type",      target: "limit",        enabled: true },
    orderStop:     { label: "Stop",       system: "trade-execution", action: "order-type",      target: "stop",         enabled: true },
    submitOrder:   { label: "Buy RWAus",  system: "trade-execution", action: "submit-order",    target: "preview-only", enabled: true },
    alertButton:   { label: "Alerts",     system: "alerts",          action: "open-alerts",     target: "/alerts",      enabled: true },
    watchlist:     { label: "Watchlist",  system: "watchlist",       action: "open-watchlist",  target: "watchlist",    enabled: true },
    feed:          { label: "Feed",       system: "social-feed",     action: "open-feed",       target: "feed",         enabled: true },
    postIdea:      { label: "Post an idea",system: "social-feed",     action: "post-idea",       target: "composer",     enabled: true },
    wallet:        { label: "0xE88d…F3D3",system: "wallet",          action: "open-wallet",     target: "wallet",       enabled: true },
    mobileHome:    { label: "Home",       system: "router",          action: "mobile-home",     target: "/",            enabled: true },
    mobileMarkets: { label: "Markets",    system: "router",          action: "mobile-markets",  target: "/markets",     enabled: true },
    mobileTrade:   { label: "Trade",      system: "router",          action: "mobile-trade",    target: "/trade",       enabled: true },
    mobilePortfolio:{label:"Portfolio",   system: "portfolio",       action: "mobile-portfolio",target: "/portfolio",   enabled: true },
    mobileProfile: { label: "Profile",    system: "profile",         action: "mobile-profile",  target: "/profile",     enabled: true }
  }
};

// Replace these adapters with each real system. The prototype never sends a real order.
window.RWA_ADAPTERS = window.RWA_ADAPTERS || {
  router(payload)          { console.info("[router]", payload); },
  chart(payload)           { console.info("[chart]", payload); },
  portfolio(payload)       { console.info("[portfolio]", payload); },
  analytics(payload)       { console.info("[analytics]", payload); },
  rewards(payload)         { console.info("[rewards]", payload); },
  alerts(payload)          { console.info("[alerts]", payload); },
  watchlist(payload)       { console.info("[watchlist]", payload); },
  "social-feed"(payload)  { console.info("[social-feed]", payload); },
  wallet(payload)          { console.info("[wallet]", payload); },
  profile(payload)         { console.info("[profile]", payload); },
  "trade-execution"(payload) {
    console.info("[trade-execution: PREVIEW ONLY]", payload);
    window.dispatchEvent(new CustomEvent("rwa:trade-preview", { detail: payload }));
  }
};
