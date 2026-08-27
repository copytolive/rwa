import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const BASE=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/rwa/';
const markets=[['BTC',100000,1.1,900000000,false],['ONDO',1.25,3.5,12000000,true],['PAXG',3400,-1.2,5000000,true]].map(([base,price,change,vol,rwa])=>({base,symbol:`${base}USDT`,price,change,vol,rwa}));
const info={symbols:markets.map(x=>({symbol:x.symbol,baseAsset:x.base,quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true}))};
const tickers=markets.map(x=>({symbol:x.symbol,lastPrice:String(x.price),openPrice:String(x.price/(1+x.change/100)),priceChangePercent:String(x.change),highPrice:String(x.price*1.04),lowPrice:String(x.price*.96),quoteVolume:String(x.vol)}));
const klines=Array.from({length:120},(_,i)=>{const o=1+i*.001,c=o+(i%2?.004:-.003);return [Date.now()-(120-i)*900000,String(o),String(Math.max(o,c)+.006),String(Math.min(o,c)-.006),String(c),'1000']});
async function mocks(context){
 await context.route('**/api/v3/exchangeInfo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(info)}));
 await context.route('**/api/v3/ticker/24hr*',r=>{const u=new URL(r.request().url());const s=u.searchParams.get('symbol');const body=s?(tickers.find(x=>x.symbol===s)||tickers[0]):tickers;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
 await context.route('**/api/v3/klines*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(klines)}));
 await context.route('https://s3.tradingview.com/**',r=>r.abort());
 await context.route('https://api.hyperliquid.xyz/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await context.route('https://api.hyperliquid-testnet.xyz/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
}
async function waitReady(page){
 await page.waitForFunction(()=>window.RWASuperApp?.version==='5.0.0',{timeout:20000});
 await page.waitForFunction(()=>window.RWAPersistentMarketRouterV2?.version==='2.0.0',{timeout:10000});
}
async function layoutSnapshot(page){return page.evaluate(()=>{const l=document.querySelector('.layout'),r=l?.getBoundingClientRect();const st=l?getComputedStyle(l):null;return{same:window.__rwaLayoutRef?window.__rwaLayoutRef===l:(window.__rwaLayoutRef=l,true),connected:!!l?.isConnected,display:st?.display,visibility:st?.visibility,opacity:st?.opacity,w:r?.width||0,h:r?.height||0,hash:location.hash,path:location.pathname}})}
async function assertMarket(page,label){const s=await layoutSnapshot(page);assert.equal(s.path,'/rwa/',`${label}: escaped pathname`);assert.ok(s.connected,`${label}: layout disconnected`);assert.equal(s.same,true,`${label}: market layout DOM replaced`);assert.notEqual(s.display,'none',`${label}: market hidden`);assert.notEqual(s.visibility,'hidden',`${label}: market invisible`);assert.ok(Number(s.opacity)!==0,`${label}: market opacity zero`);assert.ok(s.w>150&&s.h>150,`${label}: market geometry collapsed ${s.w}x${s.h}`);return s}
const browser=await chromium.launch({headless:true});
try{
 for(const cfg of [{name:'desktop',viewport:{width:1440,height:960}},{name:'mobile',viewport:{width:390,height:844},isMobile:true,hasTouch:true}]){
  const context=await browser.newContext({...cfg,locale:'en-US',serviceWorkers:'block'});await mocks(context);const page=await context.newPage();
  await page.goto(BASE+'#markets',{waitUntil:'domcontentloaded',timeout:30000});await waitReady(page);await page.waitForTimeout(800);await assertMarket(page,`${cfg.name}:root`);
  const routes=['intelligence','assets','research','portfolio','institutional','asset/ONDO'];
  for(const r of routes){
   const before=await layoutSnapshot(page);
   await page.evaluate(route=>window.RWASuperApp.navigate(route),r);
   // Immediate assertion catches leave-then-remount flicker.
   const immediate=await layoutSnapshot(page);assert.equal(immediate.same,true,`${cfg.name}:${r}: immediate DOM replaced`);assert.notEqual(immediate.display,'none',`${cfg.name}:${r}: immediate market hidden`);
   await page.waitForTimeout(r==='portfolio'?500:160);
   const after=await assertMarket(page,`${cfg.name}:${r}`);
   assert.ok(after.hash.startsWith('#markets/'),`${cfg.name}:${r}: not canonical market context ${after.hash}`);
   assert.equal(before.same,true);
  }
  await page.evaluate(()=>window.RWASuperApp.navigate('assets'));await page.waitForTimeout(120);
  await page.evaluate(()=>window.RWASuperApp.navigate('research'));await page.waitForTimeout(120);
  assert.equal(locationHash(await page.url()),'#markets/research');
  await page.goBack();await page.waitForTimeout(180);await assertMarket(page,`${cfg.name}:back`);assert.equal(locationHash(await page.url()),'#markets/assets',`${cfg.name}: Back failed`);
  await page.goForward();await page.waitForTimeout(180);await assertMarket(page,`${cfg.name}:forward`);assert.equal(locationHash(await page.url()),'#markets/research',`${cfg.name}: Forward failed`);
  await context.close();
 }
 console.log('PERSISTENT_MARKET_ROUTER_V2_BROWSER=PASS');
}finally{await browser.close()}
function locationHash(u){return new URL(u).hash}
