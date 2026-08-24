import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const URL=process.env.RWA_RENKO_LIVE_URL||'https://narzulalistiqlal.github.io/rwa/renko/';
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(URL,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.RWARenkoV6?.version==='6.0.0'&&window.RWARenkoV3?.state?.symbols?.length>=500,{timeout:30000});
  await page.waitForFunction(()=>window.RWARenkoV3?.state?.tickCount>0&&Number.isFinite(window.RWARenkoV3?.state?.lastPrice),{timeout:30000});
  await page.waitForFunction(()=>String(document.querySelector('#feedPill b')?.textContent||'').startsWith('LIVE'),{timeout:30000});
  const before=await page.evaluate(()=>({id:window.RWARenkoV3.state.lastTradeId,ticks:window.RWARenkoV3.state.tickCount,time:window.RWARenkoV3.state.lastTickTime}));
  await page.waitForFunction(b=>window.RWARenkoV3.state.tickCount>b.ticks||window.RWARenkoV3.state.lastTradeId!==b.id||window.RWARenkoV3.state.lastTickTime>b.time,before,{timeout:30000});
  await page.waitForFunction(()=>window.RWARenkoV6?.state?.bricks?.length>=50,{timeout:60000});
  await page.waitForTimeout(400);
  const initial=await page.evaluate(()=>({version:window.RWARenkoV6.version,mode:window.RWARenkoV6.mode,source:window.RWARenkoV6.historicalSource,raw:window.RWARenkoV6.rawAudit,pairs:window.RWARenkoV6.state.selectedUniverseCount,rows:document.querySelectorAll('.pair-row').length,history:document.querySelector('#fastHistoryCount')?.textContent,coverage:document.querySelector('#fastHistoryCoverage')?.textContent,status:document.querySelector('#fastArchiveStatus')?.textContent,display:document.querySelector('#lazyHistoryCanvas')?.style.display,rect:document.querySelector('#lazyHistoryCanvas')?.getBoundingClientRect().toJSON(),feed:document.querySelector('#feedPill b')?.textContent,sourceText:document.querySelector('#sourceText')?.textContent}));
  assert.equal(initial.version,'6.0.0');assert.equal(initial.mode,'tradingview-compatible-lazy-50');assert.equal(initial.source,'binance-1m-close');assert.equal(initial.raw,'binance-vision-individual-trades');assert.ok(initial.pairs>=500);assert.equal(initial.rows,500);assert.match(String(initial.history),/50 BRICKS VISIBLE/i);assert.match(String(initial.coverage),/50-BRICK WINDOW/i);assert.match(String(initial.status),/50 BRICKS READY|50 CACHED BRICKS/i);assert.notEqual(initial.display,'none');assert.ok(initial.rect?.width>700&&initial.rect?.height>250);assert.match(String(initial.feed),/^LIVE/);assert.match(String(initial.sourceText),/1m CLOSE/);
  const old=await page.evaluate(()=>({bars:window.RWARenkoV6.state.bars.length,offset:window.RWARenkoV6.state.offset}));
  await page.click('#historyPrev');
  await page.waitForFunction(o=>window.RWARenkoV6.state.offset>o.offset||window.RWARenkoV6.state.bars.length>o.bars,old,{timeout:20000});
  const older=await page.evaluate(()=>({bars:window.RWARenkoV6.state.bars.length,offset:window.RWARenkoV6.state.offset,history:document.querySelector('#fastHistoryCount')?.textContent}));assert.ok(older.offset>0||older.bars>old.bars);assert.match(String(older.history),/50 BRICKS VISIBLE/i);
  await page.click('#historyLive');await page.waitForTimeout(100);const live=await page.evaluate(()=>({mode:window.RWARenkoV6.state.mode,display:document.querySelector('#lazyHistoryCanvas')?.style.display,coverage:document.querySelector('#fastHistoryCoverage')?.textContent}));assert.equal(live.mode,'live');assert.equal(live.display,'none');assert.match(String(live.coverage),/LIVE RAW @TRADE/i);
  assert.equal(errors.length,0,errors.join(' | '));
  console.log(JSON.stringify({ok:true,url:URL,before,initial,old,older,live},null,2));
}finally{await browser.close()}
