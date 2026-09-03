import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const BASE=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/rwa/';
const OUT=process.env.RWA_PROOF_DIR||'proof/experience-rail-v8';
const markets=[['BTC',80058.85,2.10,1.16e9,false],['ONDO',1.25,3.5,12e6,true],['PAXG',3400,-1.2,5e6,true]].map(([base,price,change,vol,rwa])=>({base,symbol:`${base}USDT`,price,change,vol,rwa}));
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
  await page.waitForFunction(()=>[...document.querySelectorAll('link[rel="stylesheet"]')].some(x=>(x.getAttribute('href')||'').includes('persistent-market-operability-patch-v1.css')),{timeout:10000});
  await page.waitForTimeout(500);
}

async function measure(page,label){
  const state=await page.evaluate((label)=>{
    const rail=document.getElementById('rwaExperienceRail');
    const buttons=[...rail.querySelectorAll('[data-rwa-level]')].map(b=>{const r=b.getBoundingClientRect();return{level:b.dataset.rwaLevel,x:r.x,y:r.y,w:r.width,h:r.height,active:b.classList.contains('active')}});
    const rr=rail.getBoundingClientRect();
    return{label,hash:location.hash,scrollY,innerWidth,clientWidth:document.documentElement.clientWidth,rail:{x:rr.x,y:rr.y,w:rr.width,h:rr.height},buttons};
  },label);
  const widths=state.buttons.map(x=>x.w),max=Math.max(...widths),min=Math.min(...widths);
  assert.ok(max-min<1.01,`${label}: rail columns not equal ${JSON.stringify(state.buttons)}`);
  assert.ok(state.buttons.every(x=>x.w>0),`${label}: zero-width workflow item`);
  return state;
}

function assertStable(base,next){
  assert.equal(next.buttons.length,3,`${next.label}: workflow items missing`);
  for(let i=0;i<3;i++){
    assert.ok(Math.abs(next.buttons[i].w-base.buttons[i].w)<1.01,`${next.label}: ${next.buttons[i].level} width shifted ${base.buttons[i].w} -> ${next.buttons[i].w}`);
    assert.ok(Math.abs(next.buttons[i].x-base.buttons[i].x)<1.01,`${next.label}: ${next.buttons[i].level} x shifted ${base.buttons[i].x} -> ${next.buttons[i].x}`);
    assert.ok(Math.abs(next.buttons[i].y-base.buttons[i].y)<1.01,`${next.label}: ${next.buttons[i].level} y shifted ${base.buttons[i].y} -> ${next.buttons[i].y}`);
    assert.ok(Math.abs(next.buttons[i].h-base.buttons[i].h)<1.01,`${next.label}: ${next.buttons[i].level} height shifted ${base.buttons[i].h} -> ${next.buttons[i].h}`);
  }
  assert.ok(Math.abs(next.rail.w-base.rail.w)<1.01,`${next.label}: rail width shifted ${base.rail.w} -> ${next.rail.w}`);
}

await fs.mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},serviceWorkers:'block'});await mocks(ctx);
  const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e.message||e)));
  await p.goto(BASE,{waitUntil:'domcontentloaded'});await ready(p);
  const base=await measure(p,'00-markets');
  await p.screenshot({path:`${OUT}/00-markets.png`});
  const report=[base];

  const steps=[
    ['01-analysis',async()=>p.locator('#rwaExperienceRail [data-rwa-level="analysis"]').click()],
    ['02-action',async()=>p.locator('#rwaExperienceRail [data-rwa-level="action"]').click()],
    ['03-intelligence',async()=>p.locator('[data-v5-route="intelligence"]').first().click()],
    ['04-assets',async()=>p.locator('[data-v5-route="assets"]').first().click()],
    ['05-research',async()=>p.locator('[data-v5-route="research"]').first().click()],
    ['06-portfolio',async()=>p.locator('[data-v5-route="portfolio"]').first().click()],
    ['07-institutional',async()=>p.locator('[data-v5-route="institutional"]').first().click()],
    ['08-discovery',async()=>p.locator('#rwaExperienceRail [data-rwa-level="discovery"]').click()]
  ];
  for(const [label,click] of steps){
    await click();await p.waitForTimeout(label.includes('portfolio')?900:500);
    const s=await measure(p,label);assertStable(base,s);report.push(s);await p.screenshot({path:`${OUT}/${label}.png`});
  }
  assert.equal(errors.length,0,`runtime errors: ${errors.join(' | ')}`);
  await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
  console.log('EXPERIENCE_RAIL_EQUAL_WIDTH=PASS');
  console.log('EXPERIENCE_RAIL_ZERO_LAYOUT_SHIFT=PASS');
  console.log('ANALYSIS_ACTION_SAME_GEOMETRY=PASS');
  console.log('EXPERIENCE_RAIL_REPORT',JSON.stringify(report));
  await ctx.close();
}finally{await browser.close()}
