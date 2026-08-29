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
const localExact=/^https?:\/\/(127\.0\.0\.1|localhost)(?::|\/|$)/i.test(base);
if(localExact){
  await page.route('https://data-api.binance.vision/**',async route=>{
    try{
      const req=route.request(),headers={...req.headers()};delete headers.origin;delete headers.referer;
      const r=await fetch(req.url(),{method:req.method(),headers,signal:AbortSignal.timeout(30000)});
      const body=Buffer.from(await r.arrayBuffer());
      await route.fulfill({status:r.status,headers:{'content-type':r.headers.get('content-type')||'application/json','cache-control':'no-store','access-control-allow-origin':'*'},body});
    }catch{await route.abort('failed').catch(()=>{})}
  });
}

const pageErrors=[],consoleErrors=[],presetRows=[];
page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
page.on('console',m=>{if(m.type()==='error'&&!/WebSocket connection .*?(closed before|Ping received after close)/i.test(m.text()))consoleErrors.push(m.text())});
let response=null,fatal='';
const approx=(a,b)=>Math.abs(Number(a)-Number(b))<=Math.max(1e-12,Math.abs(Number(b))*1e-10);

async function waitPresetSettled(method,value){
  const sel=`[data-renko-preset="${method}"][data-value="${value}"]`;
  await page.waitForFunction(({method,value,sel})=>{
    const b=document.querySelector(sel),T=window.RWARenkoTV;
    if(!b||!T||b.dataset.pending==='true')return false;
    if(method==='atr')return T.settings.method==='atr'&&Number(T.settings.atrLength)===value&&document.documentElement.dataset.atrControlStatus==='active';
    return T.settings.method==='traditional'&&Math.abs(Number(T.state.box)-value)<=Math.max(1e-12,Math.abs(value)*1e-10)&&document.documentElement.dataset.renkoTraditionalStatus==='active';
  },{method,value,sel},{timeout:30000});
}

try{
  response=await page.goto(`${base}/renko/?symbol=BTCUSDT&preset5y=1&ts=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoPreset5Y?.version&&window.RWARenkoATRControl?.version&&window.RWARenkoTraditionalControl?.version,null,{timeout:90000});
  const ui=await page.evaluate(()=>({
    atr:[...document.querySelectorAll('[data-renko-preset="atr"]')].map(x=>Number(x.dataset.value)),
    traditional:[...document.querySelectorAll('[data-renko-preset="traditional"]')].map(x=>Number(x.dataset.value)),
    range:!!document.getElementById('renko5yRange'),
    percentageVisible:getComputedStyle(document.querySelector('.method[data-method="percentage"]')).display!=='none'
  }));
  if(JSON.stringify(ui.atr)!==JSON.stringify(P)||JSON.stringify(ui.traditional)!==JSON.stringify(P)||!ui.range||ui.percentageVisible)throw new Error(`preset UI mismatch ${JSON.stringify(ui)}`);
  await page.waitForFunction(()=>document.documentElement.dataset.renkoPresetHistoryReady==='true',null,{timeout:60000});

  for(const method of ['atr','traditional'])for(const value of P){
    const before=await page.evaluate(()=>({symbol:RWARenkoTV.state.symbol,generation:RWARenkoTV.state.generation}));
    const sel=`[data-renko-preset="${method}"][data-value="${value}"]`;
    await page.locator(sel).click();
    await waitPresetSettled(method,value);
    await page.waitForTimeout(80);
    const r=await page.evaluate(({method,value,before,sel})=>{
      const T=RWARenkoTV,b=document.querySelector(sel);
      return {method,value,symbol:T.state.symbol,generation:T.state.generation,ackMs:Number(document.documentElement.dataset.renkoPresetAckMs),ackClass:document.documentElement.dataset.renkoPresetAckClass,settleMs:Number(document.documentElement.dataset.renkoPresetSettleMs),blockingMs:Number(document.documentElement.dataset.renkoPresetBlockingMs),sourceBars:T.state.closedBars.length,interval:T.settings.interval,selector:!!document.querySelector('#intervalSelect'),actualMethod:T.settings.method,atrLength:Number(T.settings.atrLength),atrAppliedLength:Number(T.state.atrAppliedLength),box:Number(T.state.box),raw:Number(T.state.atrRaw??T.state.atr),exactOwn:Object.prototype.hasOwnProperty.call(T.settings,'_exactBox'),pending:b?.dataset.pending||'',settled:b?.dataset.settled||'',before};
    },{method,value,before,sel});
    r.pass=Number.isFinite(r.ackMs)&&r.ackMs<=1&&r.ackClass==='zero-ms-class'&&r.blockingMs===0&&r.pending!=='true'&&r.symbol===r.before.symbol&&r.generation===r.before.generation&&r.interval==='1s'&&!r.selector&&(method==='atr'?(r.actualMethod==='atr'&&r.atrLength===value&&r.sourceBars>=value&&r.raw>0&&r.box>0&&r.exactOwn):(r.actualMethod==='traditional'&&approx(r.box,value)&&!r.exactOwn));
    presetRows.push(r);
    if(!r.pass)throw new Error(`preset failed ${JSON.stringify(r)}`);
  }

  await page.locator('[data-renko-preset="atr"][data-value="10000"]').click();
  await waitPresetSettled('atr',10000);

  const range=page.locator('#renko5yRange');await range.scrollIntoViewIfNeeded();await page.waitForTimeout(100);
  const bb=await range.boundingBox();if(!bb)throw new Error('5Y slider has no physical bounding box');
  const y=bb.y+bb.height/2,leftX=bb.x+4,rightX=bb.x+bb.width-4,max=Number(await range.getAttribute('max'));
  await page.mouse.click(leftX,y);const leftVal=Number(await range.inputValue());
  await page.mouse.click(rightX,y);const rightVal=Number(await range.inputValue());
  const maxX=leftVal>=rightVal?leftX:rightX,minX=leftVal>=rightVal?rightX:leftX;
  await page.mouse.click(minX,y);await page.waitForTimeout(30);
  const dragStarted=Date.now();
  await page.mouse.move(minX,y);await page.mouse.down();await page.mouse.move(maxX,y,{steps:24});await page.mouse.up();
  let sliderValue=Number(await range.inputValue()),dragReachedMax=sliderValue>=max-1,fallbackClick=false,keyboardFallback=false;
  if(!dragReachedMax){fallbackClick=true;await page.mouse.click(maxX,y);sliderValue=Number(await range.inputValue())}
  if(sliderValue<max-1){keyboardFallback=true;await range.focus();await page.keyboard.press('End');sliderValue=Number(await range.inputValue())}
  const physicalMoveMs=Date.now()-dragStarted;
  if(sliderValue<max-1)throw new Error(`physical 5Y move failed left=${leftVal} right=${rightVal} final=${sliderValue} max=${max}`);
  const readyStarted=Date.now();
  await page.waitForFunction(()=>document.documentElement.dataset.renko5yStatus==='ready',null,{timeout:90000});
  const readyWaitMs=Date.now()-readyStarted,wallMs=Date.now()-dragStarted;
  const history=await page.evaluate(()=>({sliderValue:Number(document.getElementById('renko5yRange')?.value),maxDays:Number(document.documentElement.dataset.renko5yMaxDays),ageDays:Number(document.documentElement.dataset.renko5yAgeDays),loadMs:Number(document.documentElement.dataset.renko5yLoadMs),bars:Number(document.documentElement.dataset.renko5yBars),totalBricks:Number(document.documentElement.dataset.renko5yTotalBricks),renderedBricks:Number(document.documentElement.dataset.renko5yRenderedBricks),fixed1s:document.documentElement.dataset.renko5yFixed1s,virtualized:document.documentElement.dataset.renko5yVirtualized,status:document.documentElement.dataset.renko5yStatus,label:document.getElementById('renko5yStatus')?.textContent,overlayVisible:!document.getElementById('renko5yOverlay')?.hidden,source:RWARenkoTV.settings.source,method:RWARenkoTV.settings.method,atrLength:Number(RWARenkoTV.settings.atrLength),interval:RWARenkoTV.settings.interval,liveSymbol:RWARenkoTV.state.symbol,liveStatus:RWARenkoTV.state.status,liveGeneration:RWARenkoTV.state.generation}));
  Object.assign(history,{leftVal,rightVal,dragReachedMax,fallbackClick,keyboardFallback,physicalMoveMs,readyWaitMs,wallMs});
  history.pass=history.status==='ready'&&history.fixed1s==='true'&&history.virtualized==='true'&&history.overlayVisible&&history.sliderValue>=history.maxDays-1&&history.ageDays>=history.maxDays-1&&history.bars>=10000&&history.totalBricks>=history.renderedBricks&&history.interval==='1s'&&history.method==='atr'&&history.atrLength===10000&&history.liveStatus==='live';
  if(!history.pass)throw new Error(`5Y history failed ${JSON.stringify(history)}`);

  await page.screenshot({path:path.join(out,`${mode}-5y.png`),fullPage:true});
  await range.evaluate(e=>{e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.waitForFunction(()=>document.documentElement.dataset.renko5yStatus==='live',null,{timeout:5000});
  const stats=await page.evaluate(()=>RWARenkoPreset5Y.stats);
  const report={schema:'renko-presets-five-values-5y-browser-v6',generatedAt:new Date().toISOString(),base,mode,viewport,status:'PASS',httpStatus:response?.status()||null,contract:{presetValues:P,atrMeaning:'ATR length',traditionalMeaning:'fixed absolute box size',zeroMsMeaning:'interaction ACK <=1ms and measured long-task blocking 0ms; chart settle/network are reported separately',historyMeaning:'physical native-control input to virtualized exact Binance fixed-1s window; never fake continuous 5Y in-memory bars',maxHorizon:'5 calendar years',localExactData:localExact?'real data-api.binance.vision bytes relayed only to bypass localhost Origin CORS':'no relay; browser accesses public production source directly'},ui,presetRows,history,stats,pageErrors,consoleErrors};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log('RENKO_PRESETS_5Y '+JSON.stringify({status:'PASS',mode,presets:presetRows.length,ackMaxMs:Math.max(...presetRows.map(x=>x.ackMs)),settleMaxMs:Math.max(...presetRows.map(x=>x.settleMs)),blockingMaxMs:Math.max(...presetRows.map(x=>x.blockingMs)),fiveYearPhysicalMoveSeconds:Number((history.physicalMoveMs/1000).toFixed(3)),fiveYearLoadSeconds:Number((history.loadMs/1000).toFixed(3)),fiveYearWallSeconds:Number((history.wallMs/1000).toFixed(3)),fiveYearBars:history.bars,fiveYearBricks:history.totalBricks,dragReachedMax:history.dragReachedMax,fallbackClick:history.fallbackClick,keyboardFallback:history.keyboardFallback,pageErrors}));
}catch(e){
  fatal=String(e?.stack||e);console.error('RENKO_PRESETS_5Y_FATAL',fatal);
  try{const debug=await page.evaluate(()=>({status:window.RWARenkoTV?.state?.status,symbol:window.RWARenkoTV?.state?.symbol,generation:window.RWARenkoTV?.state?.generation,method:window.RWARenkoTV?.settings?.method,atrLength:Number(window.RWARenkoTV?.settings?.atrLength),atrAppliedLength:Number(window.RWARenkoTV?.state?.atrAppliedLength),box:Number(window.RWARenkoTV?.state?.box),atrRaw:Number(window.RWARenkoTV?.state?.atrRaw),atrControlStatus:document.documentElement.dataset.atrControlStatus,traditionalStatus:document.documentElement.dataset.renkoTraditionalStatus,presetAckMs:Number(document.documentElement.dataset.renkoPresetAckMs),presetSettleMs:Number(document.documentElement.dataset.renkoPresetSettleMs),presetBlockingMs:Number(document.documentElement.dataset.renkoPresetBlockingMs),sourceBars:Number(window.RWARenkoTV?.state?.closedBars?.length||0)}));fs.writeFileSync(path.join(out,'debug.json'),JSON.stringify(debug,null,2))}catch{}
  try{await page.screenshot({path:path.join(out,`${mode}-FAIL.png`),fullPage:true})}catch{}
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({schema:'renko-presets-five-values-5y-browser-v6',generatedAt:new Date().toISOString(),base,mode,viewport,status:'FAIL',fatal,presetRows,pageErrors,consoleErrors},null,2));
  await browser.close();process.exit(2);
}
await browser.close();
