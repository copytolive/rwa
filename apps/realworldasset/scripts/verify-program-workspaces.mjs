import fs from "node:fs";

const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const route = read("src/app/[...slug]/page.tsx");
const workspace = read("src/components/program-workspaces/ProgramWorkspaces.tsx");
const markets = read("src/components/markets-live/MarketsLiveWorkspace.tsx");
const trade = read("src/components/trade-live/TradeLiveWorkspace.tsx");
const tradeRoute = read("src/app/trade/[asset]/page.tsx");
const ops = read("src/lib/live-ops.ts");
const deposit = read("src/app/account/deposit/page.tsx");
const withdraw = read("src/app/account/withdraw/page.tsx");

const requirements = [
  [route.includes('path==="/markets"') && route.includes('<MarketsLiveWorkspace/>'), "markets_live_workspace"],
  [markets.includes('https://api.hyperliquid.xyz/info') && markets.includes('metaAndAssetCtxs') && markets.includes('live-feed-badge'), "markets_authoritative_public_feed"],
  [markets.includes('Successful responses:') && !markets.includes('Math.random('), "markets_real_tick_only"],
  [tradeRoute.includes('TradeLiveWorkspace') && trade.includes('metaAndAssetCtxs') && trade.includes('l2Book') && trade.includes('candleSnapshot'), "trade_authoritative_market_terminal"],
  [trade.includes('environment:"testnet"') && trade.includes('MAINNET LOCKED'), "trade_testnet_write_mainnet_lock"],
  [route.includes('path==="/intelligence"') && route.includes('kind="intelligence"'), "intelligence_workspace"],
  [route.includes('path==="/merchant/tokenization"') && route.includes('kind="tokenization"'), "tokenization_workspace"],
  [route.includes('path==="/account/api"') && route.includes('kind="api"'), "api_workspace"],
  [route.includes('path==="/account/billing"') && route.includes('kind="billing"'), "billing_workspace"],
  [route.includes('path==="/account/activity"') && route.includes('kind="activity"'), "activity_workspace"],
  [route.includes('<LiveOrdersWorkspace/>') && route.includes('<LiveOrdersWorkspace dispute/>'), "live_orders_and_refund"],
  [route.includes('<SellerOrdersWorkspace/>'), "seller_fulfillment"],
  [ops.includes('"/v1/orders"') && ops.includes("/refund-request"), "commerce_order_refund_api"],
  [ops.includes('"/v1/seller/orders"') && ops.includes("/status"), "seller_order_status_api"],
  [ops.includes("execution.account.state") && ops.includes("execution.account.fills"), "venue_account_evidence"],
  [ops.includes("depositMainnet") && ops.includes("withdrawMainnet"), "funds_write_adapter"],
  [ops.includes("mainnetReady") && workspace.includes('data-live-environment="mainnet"'), "mainnet_machine_gate"],
  [deposit.includes('mode="deposit"') && withdraw.includes('mode="withdraw"'), "fund_routes_live_adapter"],
  [workspace.includes("does not generate fake keys") && workspace.includes("No production mint permission"), "fail_closed_unconfigured_programs"],
  [workspace.includes("No browser-generated") && workspace.includes("Provider settlement is processed"), "no_fake_settlement"],
];

const failed = requirements.filter(([ok]) => !ok).map(([,name]) => name);
if (failed.length) {
  console.error("PROGRAM_WORKSPACE_GATE_FAIL", failed.join(","));
  process.exit(1);
}
console.log("PROGRAM_WORKSPACE_GATE_PASS", requirements.length);
console.log("MARKETS_SOURCE=HYPERLIQUID_META_AND_ASSET_CTXS");
console.log("TRADE_READS=MARKET_CONTEXT_L2_BOOK_CANDLE_SNAPSHOT");
console.log("TRADE_WRITES=HYPERLIQUID_TESTNET_ONLY");
