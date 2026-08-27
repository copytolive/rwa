import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/rwa/';
const markets=[['BTC',100000,1.1,9e8,false],['ONDO',1.25,3.5,12e6,true],['PAXG',3400,-1.2,5e6,true]].map(([base,price,change,vol,rwa])=>({base,symbol:`${base}USDT`,price,change,vol,rwa}));
const info={symbols:markets.map(x=>({symbol:x.symbol,baseAsset:x.base,quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true}))};
const tickers=markets.map(x=>({symbol:x.symbol,lastPrice:String(x.price),openPrice:String(x.price/(1+x.change/100)),priceChangePercent:String(x.change),highPrice:String(x.price*1.04),lowPrice:String(x.price*.96),quoteVolume:String(x.vol)}));
const klines=Array.from({length:160},(_,i)=>[Date.now()-(160-i)*9e5,'1','1.02','.98',String(1+(i%2?.004:-.003)),'1000']);

async function mocks(context){
  await context.route('**/api/v3/exchangeInfo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(info)}));
  await context.route('**/api/v3/ticker/24hr*',r=>{const u=new URL(r.request().url());const s=u.searchParams.get('symbol');return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(s?(tickers.find(x=>x.symbol===s)||tickers[0]):tickers)})});
  await context.route('**/api/v3/klines*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(klines)}));
  await context.route('https://s3.tradingview.com/**',r=>r.abort());
  await context.route('https://api.hyperliquid.xyz/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await context.route('https://api.hyperliquid-testnet.xyz/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
}
async function ready(page){await page.waitForFunction(()=>window.RWASuperApp?.version==='5.0.0'&&window.RWAMarketPerformanceGuard?.persistent_market_workspaces==='css-core-router-v3',{timeout:20000});await page.waitForTimeout(500)}
async function go(page,route,wait=350){
  await page.evaluate(r=>window.RWASuperApp.navigate(r),route);
  await page.waitForFunction(r=>(document.documentElement.dataset.rwaRoute||'')===r,route,{timeout:10000});
  await page.waitForTimeout(wait);
}
async function geometry(page,route){
  return page.evaluate((route)=>{
    const layout=document.querySelector('.layout'),chart=document.querySelector('.chart-wrap'),right=document.querySelector('.right'),workspace=document.getElementById('rwaSuperWorkspace'),suite=document.getElementById('suite');
    const visible=e=>e&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;
    const active=visible(workspace)?workspace:visible(suite)?suite:visible(right)?right:null;
    const box=e=>{if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,position:s.position,display:s.display}};
    return{route:document.documentElement.dataset.rwaRoute||'',same:chart===window.__persistentChartNode,layoutDisplay:layout&&getComputedStyle(layout).display,chart:box(chart),layout:box(layout),right:box(right),workspace:box(workspace),suite:box(suite),active:box(active),activePosition:active&&getComputedStyle(active).position,hash:location.hash,path:location.pathname}
  },route)
}
async function assertPersistent(page,route,{mobile=false}={}){
  const g=await geometry(page,route);
  assert.equal(g.path,'/rwa/',`${route}: escaped canonical path`);
  assert.equal(g.route,route,`${route}: route state mismatch ${g.route}`);
  assert.equal(g.same,true,`${route}: chart DOM was replaced`);
  assert.notEqual(g.layoutDisplay,'none',`${route}: market layout disappeared`);
  assert.ok(g.chart?.w>(mobile?240:420)&&g.chart?.h>180,`${route}: candlestick not human-usable ${JSON.stringify(g.chart)}`);
  assert.equal(g.activePosition,'fixed',`${route}: context is not a dock/sheet ${JSON.stringify(g)}`);
  assert.ok(g.active?.w>250&&g.active?.h>180,`${route}: context surface missing ${JSON.stringify(g.active)}`);
  if(!mobile)assert.ok(Math.abs(g.active.w-440)<1.1,`${route}: desktop context width ${g.active.w} != 440`);
  return g
}

const browser=await chromium.launch({headless:true});
try{
  const desktop=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});await mocks(desktop);const p=await desktop.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e.message||e)));await p.goto(BASE,{waitUntil:'domcontentloaded'});await ready(p);await p.evaluate(()=>window.__persistentChartNode=document.querySelector('.chart-wrap'));
  for(const route of ['intelligence','assets','research','portfolio','institutional']){await go(p,route,route==='portfolio'?900:350);const g=await assertPersistent(p,route);assert.equal(g.hash,`#${route}`,`${route}: unexpected hash ${g.hash}`)}
  await go(p,'asset/ONDO',400);await assertPersistent(p,'asset/ONDO');
  await go(p,'institutional',350);const issuer=p.getByRole('button',{name:/Start issuer workspace/i});if(await issuer.count()){await issuer.click();await p.waitForTimeout(900);const g=await geometry(p,'institutional');assert.equal(g.same,true,'issuer: chart DOM replaced');assert.notEqual(g.layoutDisplay,'none','issuer: market layout disappeared');assert.equal(g.activePosition,'fixed','issuer: suite not docked')}
  assert.equal(errors.length,0,`desktop runtime errors: ${errors.join(' | ')}`);await desktop.close();

  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});await mocks(mobile);const m=await mobile.newPage();const merr=[];m.on('pageerror',e=>merr.push(String(e.message||e)));await m.goto(BASE,{waitUntil:'domcontentloaded'});await ready(m);await m.evaluate(()=>window.__persistentChartNode=document.querySelector('.chart-wrap'));
  for(const route of ['intelligence','assets','research','portfolio','institutional']){await go(m,route,route==='portfolio'?900:350);const g=await assertPersistent(m,route,{mobile:true});assert.ok(g.active.y>40,`${route}: sheet replaced full market instead of preserving chart ${JSON.stringify(g.active)}`);assert.ok(g.active.y<700,`${route}: sheet inaccessible ${JSON.stringify(g.active)}`)}
  assert.equal(merr.length,0,`mobile runtime errors: ${merr.join(' | ')}`);await mobile.close();

  console.log('MARKET_SHELL_NEVER_LEAVES=PASS');
  console.log('CANDLESTICK_CONTEXT_PERSISTENT=PASS');
  console.log('DESKTOP_CONTEXT_DOCK_440=PASS');
  console.log('MOBILE_CONTEXT_SHEET=PASS');
  console.log('PERSISTENT_MARKET_SHELL_V3_BROWSER=PASS');
}finally{await browser.close()}
