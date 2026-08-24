import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const URL=process.env.RWA_RENKO_LIVE_URL||'https://narzulalistiqlal.github.io/rwa/renko/';
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:1365,height:768}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(URL,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.RWARenko?.source==='raw-trade-ticks-only',{timeout:20000});
  await page.waitForFunction(()=>window.RWARenko?.state?.tickCount>0,{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#feedPill b')?.textContent==='LIVE TICKS',{timeout:30000});
  const state=await page.evaluate(()=>({
    source:window.RWARenko.source,
    method:window.RWARenko.method,
    reversalBoxes:window.RWARenko.reversalBoxes,
    selected:window.RWARenko.state.selected,
    pairCount:window.RWARenko.state.symbols.length,
    tickCount:window.RWARenko.state.tickCount,
    brickCount:window.RWARenko.state.bricks.length,
    box:window.RWARenko.state.box,
    lastPrice:window.RWARenko.state.lastPrice,
    feed:document.querySelector('#feedPill b')?.textContent,
    width:document.documentElement.scrollWidth,
    innerWidth,
    canvas:document.querySelector('#renkoCanvas')?.getBoundingClientRect().toJSON()
  }));
  assert.equal(state.source,'raw-trade-ticks-only');
  assert.equal(state.method,'traditional-fixed-box');
  assert.equal(state.reversalBoxes,2);
  assert.ok(/USDT$/.test(state.selected));
  assert.ok(state.pairCount>10,`pair universe too small: ${state.pairCount}`);
  assert.ok(state.tickCount>0,'no raw ticks loaded');
  assert.ok(Number.isFinite(state.lastPrice)&&state.lastPrice>0,'no last trade price');
  assert.ok(Number.isFinite(state.box)&&state.box>0,'invalid fixed box');
  assert.equal(state.feed,'LIVE TICKS');
  assert.ok(state.width<=state.innerWidth+2,`live page horizontal overflow ${state.width}/${state.innerWidth}`);
  assert.ok(state.canvas?.width>500&&state.canvas?.height>300,'live Renko canvas not usable');
  assert.equal(errors.length,0,`live page errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ok:true,contract:'rwa-renko-live-pages-v1',url:URL,state},null,2));
  await context.close();
}finally{await browser.close()}
