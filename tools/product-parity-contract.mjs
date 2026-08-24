import {readFile} from 'node:fs/promises';
const read=p=>readFile(p,'utf8');
const [tradeHtml,tradeCfg,tradePro,margin,overlay,release,fund,hl,execCfg,rootHtml,quick,suiteUi,suiteCore,social,exec,worker,readiness]=await Promise.all([
  read('trade/index.html'),read('trade/config.js'),read('trade/terminal-pro.js'),read('trade/margin-runtime.js'),read('trade/chart-overlays.js'),read('trade/release-runtime.js'),read('trade/fund-modal.js'),read('trade/hyperliquid.js'),read('rwa-execution-config.json'),read('index.html'),read('quick-actions.js'),read('suite-ui.js'),read('suite-v2.js'),read('social-trade-monitor.js'),read('execution-api.js'),read('agent-worker/worker.mjs'),read('launch/readiness.json')
]);
const fail=[];const ok=(v,m)=>{if(!v)fail.push(m)};
// Trading UX comparable to modern social-first perpetual products.
ok(tradeHtml.includes('data-side-btn="BUY"')&&tradeHtml.includes('data-side-btn="SELL"'),'BUY/SELL segmented execution missing');
ok(tradeHtml.includes('data-type-btn="MARKET"')&&tradeHtml.includes('data-type-btn="LIMIT"'),'MARKET/LIMIT execution missing');
ok(tradeHtml.includes('priceChart')&&tradePro.includes('candleSnapshot'),'professional native chart missing');
ok(tradePro.includes('orders.trigger')&&tradePro.includes('orders.modify'),'position TP/SL or order modify missing');
ok(exec.includes("grouping:'normalTpsl'"),'atomic TP/SL entry missing');
ok(exec.includes("riskSigner:'agent-only-fail-closed-v1'"),'delegated one-click fail-closed signer missing');
ok(margin.includes('ISOLATED')&&margin.includes('CROSS')&&margin.includes('api.risk.setLeverage'),'isolated/cross margin control missing');
ok(overlay.includes('RWAChartTradeOverlay')&&overlay.includes('ENTRY')&&overlay.includes('orderKind'),'chart position/order overlays missing');
ok(release.includes('emergencyExit')&&release.includes('reduceOnly:true'),'emergency reduce-only exit missing');
ok(tradeCfg.includes("version:'1.5.0'")&&tradeCfg.includes("status==='READY_FOR_MAINNET'"),'machine-gated trade release missing');
// Production funds must exist but remain behind the exact same machine + wallet gate and master signer.
ok(exec.includes("productionGate:'machine-wallet-gate-v1'")&&exec.includes('requireProductionGate'),'execution-owner production gate missing');
ok(exec.includes('async function depositMainnet')&&exec.includes('async function withdrawMainnet'),'master-only mainnet funds API missing');
ok(exec.includes('await requireProductionGate()')&&exec.includes('await mainExchange(false)')&&exec.includes('withdraw3'),'mainnet withdrawal is not machine-gated master-wallet execution');
ok(exec.includes("confirmText).trim()!=='DEPOSIT'")&&exec.includes("confirmText).trim()!=='WITHDRAW'"),'high-security funding confirmations missing');
ok(exec.includes('wallet_switchEthereumChain')&&exec.includes('usdc.transfer(f.bridgeAddress'),'native Arbitrum USDC deposit path missing');
ok(execCfg.includes('native-arbitrum-usdc-bridge2')&&execCfg.includes('machine-gated-master-wallet-only'),'production funding route config missing');
ok(fund.includes("type:'claimDrip'")&&fund.includes('depositMainnet'),'TESTNET claim + MAINNET deposit modal split missing');
ok(hl.includes('api.funds.depositMainnet')&&hl.includes('api.funds.withdrawMainnet'),'trade client does not expose machine-gated funds');
ok(release.includes('mainnetDepositBtn')&&release.includes('Withdraw USDC'),'mainnet deposit/withdraw controls missing');
// Social/discovery/account UX.
ok(suiteUi.includes('Leaderboard')&&suiteUi.includes('Copy')&&suiteUi.includes('Watch & Alerts')&&suiteUi.includes('Portfolio')&&suiteUi.includes('Feed'),'social suite surface incomplete');
ok(suiteCore.includes('VERIFIED BY HYPERLIQUID')&&suiteCore.includes('userFillsByTime'),'venue-backed trader performance missing');
ok(suiteCore.includes('startCopy')&&suiteCore.includes('orders.market'),'copy execution path missing');
ok(social.includes('rwa:followed-trader-position')&&social.includes('Notification.requestPermission'),'followed trader live alerts missing');
ok(social.includes("'Notification'in window"),'notification capability guard missing');
ok(quick.includes("openTab('watch')")&&quick.includes('navigator.share')&&quick.includes("new URL('trade/'"),'market quick actions missing');
ok(rootHtml.includes('quick-actions.js?v=1'),'quick actions not loaded on root product');
// Security/operations invariants.
ok(!margin.includes('ExchangeClient')&&!overlay.includes('ExchangeClient')&&!quick.includes('ExchangeClient')&&!social.includes('ExchangeClient'),'UI enhancement created a write client');
ok(exec.includes("hardening:'single-write-path-v1'"),'browser single-write contract missing');
ok(worker.includes("u.pathname==='/healthz'")&&worker.includes("u.pathname==='/readyz'"),'24/7 worker health endpoints missing');
const launch=JSON.parse(readiness);ok(launch.engineering_ready===true,'machine engineering gate is not ready');
ok(launch.mainnet_ready===false||launch.status==='READY_FOR_MAINNET','invalid launch gate state');
if(fail.length){console.error(JSON.stringify({ok:false,contract:'rwa-social-trading-parity-v2',fail},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,contract:'rwa-social-trading-parity-v2',trade:'one-click+atomic-tpsl+margin+overlays+master-funds',social:'leaderboard+copy+feed+follow-alerts',security:'single-write+machine-wallet-gated-mainnet'},null,2));
