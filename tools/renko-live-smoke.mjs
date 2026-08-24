import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const URL=process.env.RWA_RENKO_LIVE_URL||'https://narzulalistiqlal.github.io/rwa/renko/';
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:1365,height:768}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(URL,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.RWARenko?.version==='5.0.0'&&window.RWARenko?.source==='raw-trade-ticks-only',{timeout:25000});
  await page.waitForFunction(()=>window.RWARenkoV3?.state?.symbols?.length>=500,{timeout:30000});
  await page.waitForFunction(()=>window.RWARenkoV3?.state?.tickCount>0&&Number.isFinite(window.RWARenkoV3?.state?.lastPrice),{timeout:30000});
  await page.waitForFunction(()=>String(document.querySelector('#feedPill b')?.textContent||'').startsWith('LIVE'),{timeout:30000});
  const before=await page.evaluate(()=>({id:window.RWARenkoV3.state.lastTradeId,tickCount:window.RWARenkoV3.state.tickCount,lastPrice:window.RWARenkoV3.state.lastPrice,lastTickTime:window.RWARenkoV3.state.lastTickTime,bricks:window.RWARenkoV3.state.bricks.length}));
  await page.waitForFunction(b=>window.RWARenkoV3.state.lastTradeId!==b.id||window.RWARenkoV3.state.tickCount>b.tickCount||window.RWARenkoV3.state.lastTickTime>b.lastTickTime,before,{timeout:30000});
  await page.click('#historyAll');await page.waitForTimeout(100);
  const state=await page.evaluate(()=>({
    version:window.RWARenko.version,
    source:window.RWARenko.source,
    method:window.RWARenko.method,
    reversalBoxes:window.RWARenko.reversalBoxes,
    universe:window.RWARenko.universe,
    history:window.RWARenko.history,
    historyScope:window.RWARenko.historyScope,
    historyMode:window.RWARenkoV3.state.historyMode,
    selected:window.RWARenkoV3.state.selected,
    pairCount:window.RWARenkoV3.state.symbols.length,
    renderedRows:document.querySelectorAll('.pair-row').length,
    tickCount:window.RWARenkoV3.state.tickCount,
    brickCount:window.RWARenkoV3.state.bricks.length,
    renderedBrickCount:window.RWARenkoV3.state.renderSlice?.a?.length,
    renderStart:window.RWARenkoV3.state.renderSlice?.start,
    renderEnd:window.RWARenkoV3.state.renderSlice?.end,
    renderAll:window.RWARenkoV3.state.renderSlice?.all,
    box:window.RWARenkoV3.state.box,
    lastPrice:window.RWARenkoV3.state.lastPrice,
    lastTradeId:window.RWARenkoV3.state.lastTradeId,
    lastTickTime:window.RWARenkoV3.state.lastTickTime,
    historyCoverage:document.querySelector('#historyCoverage')?.textContent,
    archiveStatus:document.querySelector('#archiveStatus')?.textContent,
    archiveButton:document.querySelector('#archiveLoad')?.textContent,
    historyCount:document.querySelector('#historyCount')?.textContent,
    feed:document.querySelector('#feedPill b')?.textContent,
    health:document.querySelector('#tickHealth')?.textContent,
    width:document.documentElement.scrollWidth,
    innerWidth,
    canvas:document.querySelector('#renkoCanvas')?.getBoundingClientRect().toJSON(),
    archivebar:document.querySelector('.archivebar')?.getBoundingClientRect().toJSON()
  }));
  assert.equal(state.version,'5.0.0');
  assert.equal(state.source,'raw-trade-ticks-only');
  assert.equal(state.method,'traditional-fixed-box');
  assert.equal(state.reversalBoxes,2);
  assert.equal(state.history,'raw-tick-lifetime-archives');
  assert.match(state.historyScope,/oldest-available-binance-vision-raw-trade-to-live/);
  assert.equal(state.historyMode,'all');
  assert.ok(state.pairCount>=500,`live crypto universe below 500: ${state.pairCount}`);
  assert.equal(state.renderedRows,500,'live default market list must expose top 500');
  assert.ok(state.tickCount>before.tickCount||state.lastTradeId!==before.id||state.lastTickTime>before.lastTickTime,'live raw trade did not advance');
  assert.ok(Number.isFinite(state.lastPrice)&&state.lastPrice>0,'no live last trade price');
  assert.ok(Number.isFinite(state.box)&&state.box>0,'invalid fixed box');
  assert.equal(state.renderStart,0,'ALL HISTORY must start at first loaded brick');
  assert.equal(state.renderEnd,state.brickCount,'ALL HISTORY must end at latest loaded brick');
  assert.equal(state.renderedBrickCount,state.brickCount,'ALL HISTORY must expose every loaded brick');
  assert.equal(state.renderAll,true);
  assert.match(String(state.archiveButton),/TOTAL TICK HISTORY/);
  assert.match(String(state.historyCount),/bricks/i);
  assert.match(String(state.feed),/^LIVE/);
  assert.ok(state.width<=state.innerWidth+2,`live page horizontal overflow ${state.width}/${state.innerWidth}`);
  assert.ok(state.canvas?.width>500&&state.canvas?.height>250,'live Renko canvas not usable');
  assert.ok(state.archivebar?.width>500,'live total tick history controls missing');

  const archive=await page.evaluate(async()=>{
    const url='https://data.binance.vision/data/spot/monthly/trades/BTCUSDT/BTCUSDT-trades-2017-08.zip';
    const w=new Worker(`archive-worker-v5.js?v=${Date.now()}`);
    return await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('live archive worker timeout')),120000);w.onmessage=e=>{if(e.data?.type==='archiveurltest'){clearTimeout(t);w.terminate();resolve(e.data)}else if(e.data?.type==='error'){clearTimeout(t);w.terminate();reject(Error(e.data.message))}};w.onerror=e=>reject(Error(e.message));w.postMessage({type:'archiveurltest',box:100,url})});
  });
  assert.equal(archive.ok,true);assert.ok(archive.rows>1000);assert.equal(archive.ticks,archive.rows);assert.ok(archive.bricks>0);
  assert.equal(errors.length,0,`live page errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ok:true,contract:'rwa-renko-live-pages-v5-top500-moving-raw-ticks-lifetime-archive',url:URL,before,state,archive},null,2));
  await context.close();
}finally{await browser.close()}
