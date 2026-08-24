import {readFile,access} from 'node:fs/promises';

const html=await readFile('trade/index.html','utf8');
const app=await readFile('trade/app.js','utf8');
const pro=await readFile('trade/terminal-pro.js','utf8');
const exec=await readFile('execution-api.js','utf8');
const cfg=await readFile('trade/config.js','utf8');
const fail=[];
const check=(ok,msg)=>{if(!ok)fail.push(msg)};

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const seen=new Set(),dupes=new Set();
for(const id of ids){if(seen.has(id))dupes.add(id);seen.add(id)}
check(dupes.size===0,`duplicate DOM ids: ${[...dupes].join(', ')}`);

const required=[
  'walletBtn','fundBtn','enableTradingBtn','revokeAgentBtn','coin','marketPrice','priceChart','asks','bids','tape',
  'side','orderType','orderUsd','leverage','limitPrice','tp','sl','tradeBtn','equity','pnl','position','positionsBody',
  'ordersBody','fillsBody','refreshBtn','cancelAllBtn','withdrawBtn','preflightBtn','marketPickerModal','riskModal','positionModal',
  'riskSettingsBtn','killSwitchBtn','mobileBuy','mobileSell','toast'
];
for(const id of required)check(seen.has(id),`missing required UI id: ${id}`);

const refs=[...app.matchAll(/\$\('([^']+)'\)/g),...pro.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
const dynamicAllowed=new Set(['tradeE2E','tradeE2ERows','tradeE2EStatus','tradeE2EResult','tradeE2ERun','tradeE2EPublish','tradeE2EClear']);
for(const id of new Set(refs))check(seen.has(id)||dynamicAllowed.has(id),`JS references missing DOM id: ${id}`);

for(const m of html.matchAll(/data-close-modal="([^"]+)"/g))check(seen.has(m[1]),`modal close target missing: ${m[1]}`);

const cssLinks=[...html.matchAll(/<link[^>]+href="([^"?]+\.css)(?:\?[^" ]*)?"/g)].map(m=>m[1]);
for(const href of cssLinks){const p=href.startsWith('./')?`trade/${href.slice(2)}`:href;try{await access(p)}catch{fail.push(`missing stylesheet: ${p}`)}}

check(html.includes("frame-src 'none'"),'CSP frame-src must remain none');
check(!html.includes('<iframe'),'trade page must not embed third-party iframes');
check(html.includes('terminal-pro.js?v=1'),'professional terminal module not loaded');
check(pro.includes('candleSnapshot'),'native candle chart missing');
check(pro.includes('orders.market')&&pro.includes('reduceOnly:true'),'reduce-only partial close missing');
check(pro.includes('orders.trigger'),'post-entry TP/SL control missing');
check(pro.includes('orders.modify'),'open-order modify missing');
check(!pro.includes('ExchangeClient'),'professional UI must not create a write client');
check(!/api\.hyperliquid(?:-testnet)?\.xyz\/exchange|['"]\/exchange['"]/.test(pro),'professional UI must not call exchange write endpoint directly');
check(exec.includes("hardening:'single-write-path-v1'"),'single write path hardening missing');
check(exec.includes("riskSigner:'agent-only-fail-closed-v1'"),'delegated fail-closed signer missing');
check(exec.includes("grouping:'normalTpsl'"),'atomic bracket execution missing');
check(cfg.includes('mainnetEnabled: false'),'PUBLIC TESTNET BETA must keep mainnet locked');

const controls=[...html.matchAll(/<(button|input|select|textarea)\b[^>]*>/g)].map(m=>m[0]);
check(controls.length>=45,`unexpectedly small interactive surface: ${controls.length} controls`);
check(html.includes('data-side-btn="BUY"')&&html.includes('data-side-btn="SELL"'),'BUY/SELL controls missing');
check(html.includes('data-type-btn="MARKET"')&&html.includes('data-type-btn="LIMIT"'),'MARKET/LIMIT controls missing');
check(html.includes('data-close-fraction="0.25"')&&html.includes('data-close-fraction="0.5"')&&html.includes('data-close-fraction="1"'),'partial-close controls missing');

if(fail.length){console.error(JSON.stringify({ok:false,fail},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,ids:ids.length,controls:controls.length,js_refs:new Set(refs).size,contract:'rwa-trade-ui-operability-v1'},null,2));
