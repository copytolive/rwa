import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const URL=process.env.RWA_RENKO_LIVE_URL||'https://narzulalistiqlal.github.io/rwa/renko/';
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:1365,height:768}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(URL,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.RWARenko?.version==='2.0.0'&&window.RWARenko?.source==='raw-trade-ticks-only',{timeout:25000});
  await page.waitForFunction(()=>window.RWARenko?.state?.symbols?.length>=500,{timeout:30000});
  await page.waitForFunction(()=>window.RWARenko?.state?.tickCount>0&&Number.isFinite(window.RWARenko?.state?.lastPrice),{timeout:30000});
  await page.waitForFunction(()=>String(document.querySelector('#feedPill b')?.textContent||'').startsWith('LIVE'),{timeout:30000});
  const before=await page.evaluate(()=>({id:window.RWARenko.state.lastTradeId,tickCount:window.RWARenko.state.tickCount,lastPrice:window.RWARenko.state.lastPrice,lastTickTime:window.RWARenko.state.lastTickTime}));
  await page.waitForFunction(b=>window.RWARenko.state.lastTradeId!==b.id||window.RWARenko.state.tickCount>b.tickCount||window.RWARenko.state.lastTickTime>b.lastTickTime,before,{timeout:30000});
  const state=await page.evaluate(()=>({
    version:window.RWARenko.version,
    source:window.RWARenko.source,
    method:window.RWARenko.method,
    reversalBoxes:window.RWARenko.reversalBoxes,
    universe:window.RWARenko.universe,
    selected:window.RWARenko.state.selected,
    pairCount:window.RWARenko.state.symbols.length,
    renderedRows:document.querySelectorAll('.pair-row').length,
    tickCount:window.RWARenko.state.tickCount,
    brickCount:window.RWARenko.state.bricks.length,
    box:window.RWARenko.state.box,
    lastPrice:window.RWARenko.state.lastPrice,
    lastTradeId:window.RWARenko.state.lastTradeId,
    lastTickTime:window.RWARenko.state.lastTickTime,
    feed:document.querySelector('#feedPill b')?.textContent,
    health:document.querySelector('#tickHealth')?.textContent,
    width:document.documentElement.scrollWidth,
    innerWidth,
    canvas:document.querySelector('#renkoCanvas')?.getBoundingClientRect().toJSON()
  }));
  assert.equal(state.version,'2.0.0');
  assert.equal(state.source,'raw-trade-ticks-only');
  assert.equal(state.method,'traditional-fixed-box');
  assert.equal(state.reversalBoxes,2);
  assert.ok(state.pairCount>=500,`live crypto universe below 500: ${state.pairCount}`);
  assert.equal(state.renderedRows,500,'live default market list must expose top 500');
  assert.ok(state.tickCount>before.tickCount||state.lastTradeId!==before.id||state.lastTickTime>before.lastTickTime,'live raw trade did not advance');
  assert.ok(Number.isFinite(state.lastPrice)&&state.lastPrice>0,'no live last trade price');
  assert.ok(Number.isFinite(state.box)&&state.box>0,'invalid fixed box');
  assert.match(String(state.feed),/^LIVE/);
  assert.ok(state.width<=state.innerWidth+2,`live page horizontal overflow ${state.width}/${state.innerWidth}`);
  assert.ok(state.canvas?.width>500&&state.canvas?.height>300,'live Renko canvas not usable');
  assert.equal(errors.length,0,`live page errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ok:true,contract:'rwa-renko-live-pages-v2-top500-moving-ticks',url:URL,before,state},null,2));
  await context.close();
}finally{await browser.close()}
