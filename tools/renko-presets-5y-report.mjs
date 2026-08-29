import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base=(process.env.RWA_TEST_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const mode=String(process.env.RENKO_PRESET5Y_VIEWPORT||'desktop').toLowerCase()==='mobile'?'mobile':'desktop';
const viewport=mode==='mobile'?{width:390,height:844}:{width:1900,height:1000};
const out=process.env.RENKO_PRESET5Y_OUT||`artifacts/renko-presets-5y-${mode}`;
const P=[1,10,100,1000,10000];
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const page=await browser.newPage({viewport});
const pageErrors=[],consoleErrors=[],presetRows=[];
page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
page.on('console',m=>{if(m.type()==='error'&&!/WebSocket connection .*?(closed before|Ping received after close)/i.test(m.text()))consoleErrors.push(m.text())});
let response=null,fatal='';
try{
  response=await page.goto(`${base}/renko/?symbol=BTC&preset5y=1&ts=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoPreset5Y?.version&&window.RWARenkoATRControl?.version&&window.RWARenkoTraditionalControl?.version,null,{timeout:90000});
  const ui=await page.evaluate(()=>({atr:[...document.querySelectorAll('[data-renko-preset="atr"]')].map(x=>Number(x.dataset.value)),traditional:[...document.querySelectorAll('[data-renko-preset="traditional"]')].map(x=>Number(x.dataset.value)),range:!!document.getElementById('renko5yRange'),percentageVisible:getComputedStyle(document.querySelector('.method[data-method="percentage"]')).display!=='none'}));
  if(JSON.stringify(ui.atr)!==JSON.stringify(P)||JSON.stringify(ui.traditional)!==JSON.stringify(P)||!ui.range||ui.percentageVisible)throw new Error(`preset UI mismatch ${JSON.stringify(ui)}`);
  await page.waitForFunction(()=>document.documentElement.dataset.renkoPresetHistoryReady==='true',null,{timeout:45000});
  for(const method of ['atr','traditional'])for(const value of P){
    const before=await page.evaluate(()=>({symbol:RWARenkoTV.state.symbol,generation:RWARenkoTV.state.generation}));
    await page.locator(`[data-renko-preset="${method}"][data-value="${value}"]`).click();
    if(method==='atr')await page.waitForFunction(v=>RWARenkoTV.settings.method==='atr'&&Number(RWARenkoTV.settings.atrLength)===v&&Number(RWARenkoTV.state.atrAppliedLength)===v&&document.documentElement.dataset.atrControlStatus==='active',value,{timeout:15000});
    else await page.waitForFunction(v=>RWARenkoTV.settings.method==='traditional'&&Math.abs(Number(RWARenkoTV.state.box)-v)<=Math.max(1e-12,Math.abs(v)*1e-10)&&document.documentElement.dataset.renkoTraditionalStatus==='active',value,{timeout:15000});
    await page.waitForTimeout(80);
    const r=await page.evaluate(({method,value,before})=>({method,value,symbol:RWARenkoTV.state.symbol,generation:RWARenkoTV.state.generation,ackMs:Number(document.documentElement.dataset.renkoPresetAckMs),ackClass:document.documentElement.dataset.renkoPresetAckClass,settleMs:Number(document.documentElement.dataset.renkoPresetSettleMs),blockingMs:Number(document.documentElement.dataset.renkoPresetBlockingMs),sourceBars:RWARenkoTV.state.closedBars.length,interval:RWARenkoTV.settings.interval,selector:!!document.querySelector('#intervalSelect'),actualMethod:RWARenkoTV.settings.method,atrLength:Number(RWARenkoTV.settings.atrLength),box:Number(RWARenkoTV.state.box),raw:Number(RWARenkoTV.state.atrRaw??RWARenkoTV.state.atr),exactOwn:Object.prototype.hasOwnProperty.call(RWARenkoTV.settings,'_exactBox'),before}),{method,value,before});
    r.pass=Number.isFinite(r.ackMs)&&r.ackMs<=1&&r.ackClass==='zero-ms-class'&&r.blockingMs===0&&r.symbol===r.before.symbol&&r.generation===r.before.generation&&r.interval==='1s'&&!r.selector&&(method==='atr'?(r.actualMethod==='atr'&&r.atrLength===value&&r.sourceBars>=value&&r.raw>0&&r.box>0&&r.exactOwn):(r.actualMethod==='traditional'&&Math.abs(r.box-value)<=Math.max(1e-12,Math.abs(value)*1e-10)&&!r.exactOwn));
    presetRows.push(r);if(!r.pass)throw new Error(`preset failed ${JSON.stringify(r)}`);
  }
  // Use the deepest ATR preset for the 5Y window so the historical loader is
  // forced to prove >=10,000 exact one-second bars at the far edge.
  await page.locator('[data-renko-preset="atr"][data-value="10000"]').click();
  await page.waitForFunction(()=>RWARenkoTV.settings.method==='atr'&&Number(RWARenkoTV.settings.atrLength)===10000&&document.documentElement.dataset.atrControlStatus==='active',null,{timeout:15000});
  const t0=Date.now();
  await page.evaluate(()=>{const r=document.getElementById('renko5yRange');r.value=r.max;r.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.waitForFunction(()=>document.documentElement.dataset.renko5yStatus==='ready',null,{timeout:60000});
  const wallMs=Date.now()-t0;
  const history=await page.evaluate(()=>({maxDays:Number(document.documentElement.dataset.renko5yMaxDays),ageDays:Number(document.documentElement.dataset.renko5yAgeDays),loadMs:Number(document.documentElement.dataset.renko5yLoadMs),bars:Number(document.documentElement.dataset.renko5yBars),totalBricks:Number(document.documentElement.dataset.renko5yTotalBricks),renderedBricks:Number(document.documentElement.dataset.renko5yRenderedBricks),fixed1s:document.documentElement.dataset.renko5yFixed1s,virtualized:document.documentElement.dataset.renko5yVirtualized,status:document.documentElement.dataset.renko5yStatus,label:document.getElementById('renko5yStatus')?.textContent,overlayVisible:!document.getElementById('renko5yOverlay')?.hidden,source:RWARenkoTV.settings.source,method:RWARenkoTV.settings.method,atrLength:Number(RWARenkoTV.settings.atrLength),interval:RWARenkoTV.settings.interval,liveSymbol:RWARenkoTV.state.symbol,liveStatus:RWARenkoTV.state.status,liveGeneration:RWARenkoTV.state.generation}));
  history.wallMs=wallMs;
  history.pass=history.status==='ready'&&history.fixed1s==='true'&&history.virtualized==='true'&&history.overlayVisible&&history.ageDays>=history.maxDays-1&&history.bars>=10000&&history.totalBricks>=history.renderedBricks&&history.interval==='1s'&&history.method==='atr'&&history.atrLength===10000&&history.liveStatus==='live';
  if(!history.pass)throw new Error(`5Y history failed ${JSON.stringify(history)}`);
  await page.screenshot({path:path.join(out,`${mode}-5y.png`),fullPage:true});
  await page.evaluate(()=>{const r=document.getElementById('renko5yRange');r.value='0';r.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.waitForFunction(()=>document.documentElement.dataset.renko5yStatus==='live',null,{timeout:5000});
  const stats=await page.evaluate(()=>RWARenkoPreset5Y.stats);
  const report={schema:'renko-presets-five-values-5y-browser-v1',generatedAt:new Date().toISOString(),base,mode,viewport,status:'PASS',httpStatus:response?.status()||null,contract:{presetValues:P,atrMeaning:'ATR length',traditionalMeaning:'fixed absolute box size',zeroMsMeaning:'interaction ACK <=1ms and measured long-task blocking 0ms; chart settle/network are reported separately',historyMeaning:'virtualized exact Binance fixed-1s window navigation, never fake continuous 5Y in-memory bars',maxHorizon:'5 calendar years'},ui,presetRows,history,stats,pageErrors,consoleErrors};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log('RENKO_PRESETS_5Y '+JSON.stringify({status:'PASS',mode,presets:presetRows.length,ackMaxMs:Math.max(...presetRows.map(x=>x.ackMs)),settleMaxMs:Math.max(...presetRows.map(x=>x.settleMs)),blockingMaxMs:Math.max(...presetRows.map(x=>x.blockingMs)),fiveYearLoadSeconds:Number((history.loadMs/1000).toFixed(3)),fiveYearWallSeconds:Number((history.wallMs/1000).toFixed(3)),fiveYearBars:history.bars,fiveYearBricks:history.totalBricks,pageErrors}));
}catch(e){fatal=String(e?.stack||e);console.error('RENKO_PRESETS_5Y_FATAL',fatal);try{await page.screenshot({path:path.join(out,`${mode}-FAIL.png`),fullPage:true})}catch{}fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({schema:'renko-presets-five-values-5y-browser-v1',generatedAt:new Date().toISOString(),base,mode,viewport,status:'FAIL',fatal,presetRows,pageErrors,consoleErrors},null,2));await browser.close();process.exit(2)}
await browser.close();
