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

async function ready(page){
  await page.waitForFunction(()=>window.RWASuperApp?.version==='5.0.0'&&document.getElementById('rwaExperienceRail'),{timeout:20000});
  await page.waitForFunction(()=>window.RWAMarketPerformanceGuard?.version==='1.3.4'&&[...document.querySelectorAll('link[rel="stylesheet"]')].some(x=>(x.getAttribute('href')||'').includes('persistent-market-operability-patch-v1.css?v=11')),{timeout:10000});
  await page.waitForTimeout(450);
}

async function chromeState(page,label){
  const s=await page.evaluate((label)=>{
    const rect=e=>{const r=e?.getBoundingClientRect();return r&&{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right}};
    const visible=e=>!!e&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&Number(getComputedStyle(e).opacity||1)>.01;
    const top=document.querySelector('.topbar'),rail=document.getElementById('rwaExperienceRail'),chart=document.querySelector('.chart-wrap');
    const workspace=[document.getElementById('rwaSuperWorkspace'),document.getElementById('suite')].find(e=>visible(e));
    const tr=rect(top),rr=rect(rail),wr=rect(workspace);
    const px=rr?Math.min(innerWidth-12,rr.r-12):0,py=rr?Math.max(1,Math.min(innerHeight-1,rr.y+rr.h/2)):0;
    const probe=rr?document.elementFromPoint(px,py):null;
    const css=[...document.querySelectorAll('link[rel="stylesheet"]')].map(x=>x.getAttribute('href')||'');
    return{label,vw:innerWidth,path:location.pathname,hash:location.hash,scrollY,topVisible:visible(top),railVisible:visible(rail),chartVisible:visible(chart),sameChart:chart===window.__chromeChartNode,top:tr,rail:rr,workspace:wr,workspacePosition:workspace?getComputedStyle(workspace).position:null,probeInsideRail:!!probe?.closest?.('#rwaExperienceRail'),cssV11:css.some(x=>x.includes('persistent-market-operability-patch-v1.css?v=11'))};
  },label);
  assert.equal(s.path,'/rwa/',`${label}: escaped /rwa/`);
  assert.equal(s.topVisible,true,`${label}: topbar disappeared`);
  assert.equal(s.railVisible,true,`${label}: workflow rail disappeared`);
  assert.equal(s.chartVisible,true,`${label}: chart disappeared`);
  assert.equal(s.sameChart,true,`${label}: chart DOM was replaced`);
  assert.equal(s.cssV11,true,`${label}: V11 operability CSS not loaded`);
  assert.ok(s.top&&Math.abs(s.top.y)<=1.5&&s.top.h>=47,`${label}: topbar not fixed at viewport top ${JSON.stringify(s.top)}`);
  assert.ok(s.rail&&Math.abs(s.rail.y-48)<=2&&s.rail.h>=35,`${label}: workflow rail not fixed below header ${JSON.stringify({top:s.top,rail:s.rail,scrollY:s.scrollY})}`);
  assert.equal(s.probeInsideRail,true,`${label}: workflow rail is covered`);
  if(s.workspace&&s.workspacePosition==='fixed'&&s.vw>=1200)assert.ok(s.workspace.y>=s.rail.b-2,`${label}: workspace overlaps global chrome`);
  return s;
}

const browser=await chromium.launch({headless:true});
try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},serviceWorkers:'block'});await mocks(ctx);const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e.message||e)));
  await p.goto(BASE,{waitUntil:'domcontentloaded'});await ready(p);await p.evaluate(()=>window.__chromeChartNode=document.querySelector('.chart-wrap'));
  const report=[];report.push(await chromeState(p,'markets-initial'));
  for(const route of ['intelligence','assets','research','portfolio','institutional']){await p.locator(`[data-v5-route="${route}"]`).first().click();await p.waitForTimeout(route==='portfolio'?850:300);report.push(await chromeState(p,`topnav-${route}`))}
  for(const level of ['discovery','analysis']){await p.locator(`#rwaExperienceRail [data-rwa-level="${level}"]`).click();await p.waitForTimeout(450);report.push(await chromeState(p,`rail-${level}`))}
  await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(120);
  const actionBefore=await chromeState(p,'action-before-click');
  const actionButtonBefore=await p.locator('#rwaExperienceRail [data-rwa-level="action"]').boundingBox();
  await p.locator('#rwaExperienceRail [data-rwa-level="action"]').click();await p.waitForTimeout(1200);
  const action=await chromeState(p,'rail-action');report.push(action);
  const actionButtonAfter=await p.locator('#rwaExperienceRail [data-rwa-level="action"]').boundingBox();
  assert.ok(Math.abs(action.scrollY-actionBefore.scrollY)<=1,`Action moved root viewport: before=${actionBefore.scrollY} after=${action.scrollY}`);
  assert.equal(action.hash,'#trade/BTC','Action did not open the Trade route');
  assert.ok(actionButtonBefore&&actionButtonAfter&&Math.abs(actionButtonAfter.y-actionButtonBefore.y)<=1,`Action control moved vertically: before=${JSON.stringify(actionButtonBefore)} after=${JSON.stringify(actionButtonAfter)}`);
  await p.evaluate(()=>window.scrollTo(0,Math.min(document.documentElement.scrollHeight-700,700)));await p.waitForTimeout(200);report.push(await chromeState(p,'root-scroll'));
  assert.equal(errors.length,0,`runtime errors: ${errors.join(' | ')}`);
  console.log('GLOBAL_TOPBAR_PERSISTENCE=PASS');
  console.log('EXPERIENCE_RAIL_PERSISTENCE=PASS');
  console.log('ACTION_VIEWPORT_STABILITY=PASS');
  console.log('WORKSPACE_NEVER_COVERS_GLOBAL_CHROME=PASS');
  console.log('GLOBAL_CHROME_ALL_CLICK_TARGETS=PASS');
  console.log('GLOBAL_CHROME_REPORT',JSON.stringify(report));await ctx.close();

  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});await mocks(mobile);const m=await mobile.newPage();await m.goto(BASE,{waitUntil:'domcontentloaded'});await ready(m);await m.evaluate(()=>window.__chromeChartNode=document.querySelector('.chart-wrap'));
  for(const route of ['intelligence','assets','research','portfolio','institutional']){await m.evaluate(r=>window.RWASuperApp.navigate(r),route);await m.waitForTimeout(route==='portfolio'?800:250);const s=await m.evaluate(()=>{const t=document.querySelector('.topbar')?.getBoundingClientRect(),c=document.querySelector('.chart-wrap');return{top:t&&{y:t.y,h:t.height},display:t&&getComputedStyle(document.querySelector('.topbar')).display,same:c===window.__chromeChartNode}});assert.ok(s.top&&Math.abs(s.top.y)<=1.5&&s.top.h>=54,`${route}: mobile header disappeared`);assert.notEqual(s.display,'none',`${route}: mobile header display none`);assert.equal(s.same,true,`${route}: mobile chart replaced`)}
  console.log('MOBILE_GLOBAL_HEADER_PERSISTENCE=PASS');await mobile.close();
}finally{await browser.close()}
