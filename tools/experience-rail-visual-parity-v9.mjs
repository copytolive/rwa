import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const BASE=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/rwa/';
const OUT=process.env.RWA_PROOF_DIR||'proof/experience-rail-v9';
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
  await page.waitForTimeout(550);
}

async function state(page,label){
  const s=await page.evaluate(label=>{
    const rail=document.getElementById('rwaExperienceRail');
    const rr=rail.getBoundingClientRect();
    const buttons=[...rail.querySelectorAll('[data-rwa-level]')].map(b=>{const r=b.getBoundingClientRect(),c=getComputedStyle(b);return{level:b.dataset.rwaLevel,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,active:b.classList.contains('active'),outlineWidth:c.outlineWidth,outlineStyle:c.outlineStyle,boxShadow:c.boxShadow,borderRadius:c.borderRadius}});
    const c=getComputedStyle(rail);
    return{label,hash:location.hash,scrollY,innerWidth,clientWidth:document.documentElement.clientWidth,rail:{x:rr.x,y:rr.y,w:rr.width,h:rr.height,right:rr.right,paddingLeft:c.paddingLeft,paddingRight:c.paddingRight,columnGap:c.columnGap,rowGap:c.rowGap},buttons};
  },label);
  assert.equal(s.buttons.length,3,`${label}: expected three workflow items`);
  const widths=s.buttons.map(x=>x.w),max=Math.max(...widths),min=Math.min(...widths);
  assert.ok(max-min<1.01,`${label}: unequal widths ${JSON.stringify(widths)}`);
  assert.ok(Math.abs(s.buttons[0].x-s.rail.x)<1.01,`${label}: Discovery does not touch left rail edge ${JSON.stringify(s)}`);
  assert.ok(Math.abs(s.buttons[2].right-s.rail.right)<1.01,`${label}: Action does not touch right rail edge ${JSON.stringify(s)}`);
  assert.ok(Math.abs(s.buttons[0].w-s.rail.w/3)<1.01,`${label}: Discovery is not exact one-third`);
  assert.ok(Math.abs(s.buttons[1].w-s.rail.w/3)<1.01,`${label}: Analysis is not exact one-third`);
  assert.ok(Math.abs(s.buttons[2].w-s.rail.w/3)<1.01,`${label}: Action is not exact one-third`);
  assert.equal(parseFloat(s.rail.paddingLeft)||0,0,`${label}: rail left padding is not zero`);
  assert.equal(parseFloat(s.rail.paddingRight)||0,0,`${label}: rail right padding is not zero`);
  assert.equal(parseFloat(s.rail.columnGap)||0,0,`${label}: rail column gap is not zero`);
  for(const b of s.buttons){assert.equal(parseFloat(b.outlineWidth)||0,0,`${label}: ${b.level} focus outline changes visual width`);assert.equal(parseFloat(b.borderRadius)||0,0,`${label}: ${b.level} rounded box changes edge perception`)}
  return s;
}

function stable(base,next){
  assert.ok(Math.abs(next.rail.x-base.rail.x)<1.01,`${next.label}: rail x shifted`);
  assert.ok(Math.abs(next.rail.w-base.rail.w)<1.01,`${next.label}: rail width shifted`);
  for(let i=0;i<3;i++){
    for(const k of ['x','y','w','h','right'])assert.ok(Math.abs(next.buttons[i][k]-base.buttons[i][k])<1.01,`${next.label}: ${next.buttons[i].level} ${k} shifted ${base.buttons[i][k]} -> ${next.buttons[i][k]}`);
  }
}

async function run(viewport,name){
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport,serviceWorkers:'block'});await mocks(ctx);
    const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e.message||e)));
    await p.goto(BASE,{waitUntil:'domcontentloaded'});await ready(p);
    const report=[];const base=await state(p,`${name}-00-markets`);report.push(base);await p.screenshot({path:`${OUT}/${name}-00-markets.png`});
    const steps=[
      ['01-analysis',()=>p.locator('#rwaExperienceRail [data-rwa-level="analysis"]').click()],
      ['02-action',()=>p.locator('#rwaExperienceRail [data-rwa-level="action"]').click()],
      ['03-intelligence',()=>p.locator('[data-v5-route="intelligence"]').first().click()],
      ['04-assets',()=>p.locator('[data-v5-route="assets"]').first().click()],
      ['05-research',()=>p.locator('[data-v5-route="research"]').first().click()],
      ['06-portfolio',()=>p.locator('[data-v5-route="portfolio"]').first().click()],
      ['07-institutional',()=>p.locator('[data-v5-route="institutional"]').first().click()],
      ['08-discovery',()=>p.locator('#rwaExperienceRail [data-rwa-level="discovery"]').click()]
    ];
    for(const [suffix,click] of steps){await click();await p.waitForTimeout(suffix.includes('portfolio')?900:500);const s=await state(p,`${name}-${suffix}`);stable(base,s);report.push(s);await p.screenshot({path:`${OUT}/${name}-${suffix}.png`});}
    assert.equal(errors.length,0,`runtime errors: ${errors.join(' | ')}`);
    await ctx.close();return report;
  }finally{await browser.close()}
}

await fs.mkdir(OUT,{recursive:true});
const report={wide2048:await run({width:2048,height:1129},'2048'),desktop1600:await run({width:1600,height:1000},'1600')};
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log('EXPERIENCE_RAIL_EDGE_TO_EDGE=PASS');
console.log('EXPERIENCE_RAIL_VISUAL_EQUAL_THIRDS=PASS');
console.log('EXPERIENCE_RAIL_NO_FOCUS_EXPANSION=PASS');
console.log('EXPERIENCE_RAIL_2048_PARITY=PASS');
console.log('EXPERIENCE_RAIL_V9_REPORT',JSON.stringify(report));
