import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const BASE=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/rwa/';
const OUT=process.env.RWA_PROOF_DIR||'proof/action-zero-flicker-v11';
const markets=[['BTC',79258,1.06,1.17e9,false],['ONDO',1.25,3.5,12e6,true],['PAXG',3400,-1.2,5e6,true]].map(([base,price,change,vol,rwa])=>({base,symbol:`${base}USDT`,price,change,vol,rwa}));
const info={symbols:markets.map(x=>({symbol:x.symbol,baseAsset:x.base,quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true}))};
const tickers=markets.map(x=>({symbol:x.symbol,lastPrice:String(x.price),openPrice:String(x.price/(1+x.change/100)),priceChangePercent:String(x.change),highPrice:String(x.price*1.04),lowPrice:String(x.price*.96),quoteVolume:String(x.vol)}));
const klines=Array.from({length:180},(_,i)=>[Date.now()-(180-i)*9e5,'1','1.02','.98',String(1+(i%2?.004:-.003)),'1000']);

async function mocks(context){
  await context.route('**/api/v3/exchangeInfo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(info)}));
  await context.route('**/api/v3/ticker/24hr*',r=>{const u=new URL(r.request().url()),s=u.searchParams.get('symbol');return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(s?(tickers.find(x=>x.symbol===s)||tickers[0]):tickers)})});
  await context.route('**/api/v3/klines*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(klines)}));
  await context.route('https://s3.tradingview.com/**',r=>r.abort());
  await context.route('https://api.hyperliquid.xyz/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await context.route('https://api.hyperliquid-testnet.xyz/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
}

async function ready(page){
  await page.waitForFunction(()=>window.RWASuperApp?.version==='5.0.0'&&document.getElementById('rwaExperienceRail'),{timeout:20000});
  await page.waitForFunction(()=>[...document.querySelectorAll('link[rel="stylesheet"]')].some(x=>(x.getAttribute('href')||'').includes('persistent-market-operability-patch-v1.css?v=11')),{timeout:12000});
  await page.waitForTimeout(350);
}

async function geometry(page){
  return page.evaluate(()=>{
    const rect=el=>{if(!el)return null;const r=el.getBoundingClientRect(),c=getComputedStyle(el);return{x:r.x,w:r.width,right:r.right,display:c.display}};
    const visible=x=>x&&x.display!=='none'&&x.w>0;
    const right=rect(document.querySelector('.right'));
    const workspace=rect(document.getElementById('rwaSuperWorkspace'));
    const suite=rect(document.getElementById('suite'));
    return{level:document.documentElement.dataset.rwaLevel||'',route:document.documentElement.dataset.rwaRoute||'',layout:rect(document.querySelector('.layout')),left:rect(document.querySelector('.left')),main:rect(document.querySelector('.main')),right,workspace,suite,context:visible(workspace)?workspace:visible(suite)?suite:visible(right)?right:null};
  });
}

async function armSampler(page,label,duration=850){
  await page.evaluate(({label,duration})=>{
    const rect=el=>{if(!el)return null;const r=el.getBoundingClientRect(),c=getComputedStyle(el);return{x:r.x,w:r.width,right:r.right,display:c.display}};
    const visible=x=>x&&x.display!=='none'&&x.w>0;
    const samples=[];window.__rwaNoFlickerSamples=samples;
    const start=performance.now();
    const take=()=>{
      const right=rect(document.querySelector('.right'));
      const workspace=rect(document.getElementById('rwaSuperWorkspace'));
      const suite=rect(document.getElementById('suite'));
      const context=visible(workspace)?workspace:visible(suite)?suite:visible(right)?right:null;
      const layout=rect(document.querySelector('.layout')),left=rect(document.querySelector('.left')),main=rect(document.querySelector('.main'));
      samples.push({label,t:performance.now()-start,level:document.documentElement.dataset.rwaLevel||'',route:document.documentElement.dataset.rwaRoute||'',contextWidth:context?.w||0,contextX:context?.x??-1,layoutWidth:layout?.w||0,layoutRight:layout?.right||0,leftWidth:left?.w||0,mainWidth:main?.w||0});
      if(performance.now()-start<duration)requestAnimationFrame(take);
    };
    requestAnimationFrame(take);
  },{label,duration});
}

async function collectSampler(page){return page.evaluate(()=>window.__rwaNoFlickerSamples||[])}

function assertNoFlicker(samples,baseline,label){
  assert.ok(samples.length>=8,`${label}: too few animation-frame samples (${samples.length})`);
  const badContext=samples.filter(s=>Math.abs(s.contextWidth-baseline.context.w)>1.01);
  const badLayout=samples.filter(s=>Math.abs(s.layoutWidth-baseline.layout.w)>1.01||Math.abs(s.layoutRight-baseline.layout.right)>1.01);
  const badLeft=samples.filter(s=>Math.abs(s.leftWidth-baseline.left.w)>1.01);
  const badMain=samples.filter(s=>Math.abs(s.mainWidth-baseline.main.w)>1.01);
  assert.equal(badContext.length,0,`${label}: context flickered ${JSON.stringify(badContext.slice(0,8))}`);
  assert.equal(badLayout.length,0,`${label}: layout flickered ${JSON.stringify(badLayout.slice(0,8))}`);
  assert.equal(badLeft.length,0,`${label}: left width flickered ${JSON.stringify(badLeft.slice(0,8))}`);
  assert.equal(badMain.length,0,`${label}: main width flickered ${JSON.stringify(badMain.slice(0,8))}`);
  assert.ok(samples.every(s=>s.contextWidth>=439),`${label}: context collapsed below 439px`);
}

async function transition(page,baseline,from,to,name){
  await armSampler(page,`${name}-${from}-to-${to}`);
  await page.locator(`#rwaExperienceRail [data-rwa-level="${to}"]`).click();
  await page.waitForTimeout(900);
  const samples=await collectSampler(page);
  assertNoFlicker(samples,baseline,`${name}:${from}->${to}`);
  const end=await geometry(page);
  assert.ok(end.context&&Math.abs(end.context.w-baseline.context.w)<1.01,`${name}:${to} settled context width ${end.context?.w}`);
  await page.screenshot({path:`${OUT}/${name}-${from}-to-${to}.png`});
  return{from,to,samples,end};
}

async function run(viewport,name){
  const browser=await chromium.launch({headless:true});
  try{
    const context=await browser.newContext({viewport,serviceWorkers:'block'});await mocks(context);
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
    await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});await ready(page);
    await page.locator('#rwaExperienceRail [data-rwa-level="analysis"]').click();await page.waitForTimeout(450);
    const baseline=await geometry(page);
    assert.ok(baseline.context,`${name}: missing Analysis context`);
    assert.ok(Math.abs(baseline.context.w-440)<1.01,`${name}: Analysis context is ${baseline.context.w}, expected 440`);
    await page.screenshot({path:`${OUT}/${name}-analysis-baseline.png`});
    const transitions=[];
    transitions.push(await transition(page,baseline,'analysis','action',name));
    transitions.push(await transition(page,baseline,'action','discovery',name));
    transitions.push(await transition(page,baseline,'discovery','analysis',name));
    transitions.push(await transition(page,baseline,'analysis','action',name+'-repeat'));
    assert.equal(errors.length,0,`${name}: runtime errors ${errors.join(' | ')}`);
    await context.close();
    return{viewport,baseline,transitions};
  }finally{await browser.close()}
}

await fs.mkdir(OUT,{recursive:true});
const report={wide2048:await run({width:2048,height:1129},'2048'),desktop1600:await run({width:1600,height:1000},'1600')};
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log('ACTION_ZERO_FLICKER_V11=PASS');
console.log('ANALYSIS_ACTION_FIRST_FRAME_440=PASS');
console.log('DISCOVERY_ANALYSIS_ACTION_EVERY_FRAME_PARITY=PASS');
console.log('ACTION_ZERO_FLICKER_REPORT',JSON.stringify(report));