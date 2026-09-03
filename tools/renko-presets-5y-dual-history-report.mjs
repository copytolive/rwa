import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base=(process.env.RWA_TEST_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const mode=String(process.env.RENKO_PRESET5Y_VIEWPORT||'desktop').toLowerCase()==='mobile'?'mobile':'desktop';
const viewport=mode==='mobile'?{width:390,height:844}:{width:1900,height:1000};
const out=process.env.RENKO_PRESET5Y_OUT||`artifacts/renko-presets-5y-${mode}`;
const PRESETS=[1,10,100,1000,10000];
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

const pageErrors=[],consoleErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
page.on('console',m=>{if(m.type()==='error'&&!/WebSocket connection .*?(closed before|Ping received after close)/i.test(m.text()))consoleErrors.push(m.text())});
const approx=(a,b)=>Math.abs(Number(a)-Number(b))<=Math.max(1e-12,Math.abs(Number(b))*1e-10);

async function waitPreset(method,value){
  const sel=`[data-renko-preset="${method}"][data-value="${value}"]`;
  await page.locator(sel).click();
  await page.waitForFunction(({method,value,sel})=>{
    const b=document.querySelector(sel),T=window.RWARenkoTV;
    if(!b||!T||b.dataset.pending==='true')return false;
    if(method==='atr')return T.settings.method==='atr'&&Number(T.settings.atrLength)===value&&document.documentElement.dataset.atrControlStatus==='active';
    return T.settings.method==='traditional'&&Math.abs(Number(T.state.box)-value)<=Math.max(1e-12,Math.abs(value)*1e-10)&&document.documentElement.dataset.renkoTraditionalStatus==='active'&&!Object.prototype.hasOwnProperty.call(T.settings,'_exactBox');
  },{method,value,sel},{timeout:60000});
}

async function resetLive(range){
  await range.evaluate(e=>{e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.waitForFunction(()=>document.documentElement.dataset.renko5yStatus==='live',null,{timeout:5000});
}

async function physicalFiveYear(method){
  const value=10000;
  const range=page.locator('#renko5yRange');
  await resetLive(range);
  await waitPreset(method,value);
  await range.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const bb=await range.boundingBox();
  if(!bb)throw new Error(`${method}: 5Y slider has no physical bounding box`);
  const y=bb.y+bb.height/2,leftX=bb.x+4,rightX=bb.x+bb.width-4,max=Number(await range.getAttribute('max'));

  await page.mouse.click(leftX,y);const leftVal=Number(await range.inputValue());
  await page.mouse.click(rightX,y);const rightVal=Number(await range.inputValue());
  const maxX=leftVal>=rightVal?leftX:rightX,minX=leftVal>=rightVal?rightX:leftX;
  await page.mouse.click(minX,y);
  await page.waitForTimeout(30);

  const dragStarted=performance.now();
  await page.mouse.move(minX,y);await page.mouse.down();await page.mouse.move(maxX,y,{steps:24});await page.mouse.up();
  let sliderValue=Number(await range.inputValue()),dragReachedMax=sliderValue>=max-1,fallbackClick=false,keyboardFallback=false;
  if(!dragReachedMax){fallbackClick=true;await page.mouse.click(maxX,y);sliderValue=Number(await range.inputValue())}
  if(sliderValue<max-1){keyboardFallback=true;await range.focus();await page.keyboard.press('End');sliderValue=Number(await range.inputValue())}
  const physicalMoveMs=performance.now()-dragStarted;
  if(sliderValue<max-1)throw new Error(`${method}: physical 5Y move failed final=${sliderValue} max=${max}`);

  const readyStarted=performance.now();
  await page.waitForFunction(()=>document.documentElement.dataset.renko5yStatus==='ready',null,{timeout:90000});
  const readyWaitMs=performance.now()-readyStarted,wallMs=performance.now()-dragStarted;
  const r=await page.evaluate(method=>{
    const T=window.RWARenkoTV,d=document.documentElement.dataset;
    return {method,sliderValue:Number(document.getElementById('renko5yRange')?.value),maxDays:Number(d.renko5yMaxDays),ageDays:Number(d.renko5yAgeDays),loadMs:Number(d.renko5yLoadMs),bars:Number(d.renko5yBars),totalBricks:Number(d.renko5yTotalBricks),renderedBricks:Number(d.renko5yRenderedBricks),fixed1s:d.renko5yFixed1s,virtualized:d.renko5yVirtualized,status:d.renko5yStatus,label:document.getElementById('renko5yStatus')?.textContent||'',overlayVisible:!document.getElementById('renko5yOverlay')?.hidden,actualMethod:T.settings.method,atrLength:Number(T.settings.atrLength),boxSize:Number(T.settings.boxSize),stateBox:Number(T.state.box),exactOwn:Object.prototype.hasOwnProperty.call(T.settings,'_exactBox'),interval:T.settings.interval,selector:!!document.querySelector('#intervalSelect'),liveStatus:T.state.status,liveSymbol:T.state.symbol};
  },method);
  Object.assign(r,{leftVal,rightVal,dragReachedMax,fallbackClick,keyboardFallback,physicalMoveMs,readyWaitMs,wallMs});
  const methodPass=method==='atr'
    ? r.actualMethod==='atr'&&r.atrLength===10000&&r.exactOwn
    : r.actualMethod==='traditional'&&approx(r.stateBox,10000)&&!r.exactOwn;
  r.pass=r.status==='ready'&&r.fixed1s==='true'&&r.virtualized==='true'&&r.overlayVisible&&r.sliderValue>=r.maxDays-1&&r.ageDays>=r.maxDays-1&&r.bars>=10000&&r.totalBricks>=r.renderedBricks&&r.interval==='1s'&&!r.selector&&r.liveStatus==='live'&&methodPass;
  await page.screenshot({path:path.join(out,`${mode}-5y-${method}.png`),fullPage:true});
  if(!r.pass)throw new Error(`${method}: 5Y acceptance failed ${JSON.stringify(r)}`);
  return r;
}

let response=null,fatal='';
try{
  response=await page.goto(`${base}/renko/?symbol=BTCUSDT&preset5yDual=1&ts=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoPreset5Y?.version&&window.RWARenkoATRControl?.version&&window.RWARenkoTraditionalControl?.version,null,{timeout:90000});
  const ui=await page.evaluate(()=>({atr:[...document.querySelectorAll('[data-renko-preset="atr"]')].map(x=>Number(x.dataset.value)),traditional:[...document.querySelectorAll('[data-renko-preset="traditional"]')].map(x=>Number(x.dataset.value)),range:!!document.getElementById('renko5yRange')}));
  if(JSON.stringify(ui.atr)!==JSON.stringify(PRESETS)||JSON.stringify(ui.traditional)!==JSON.stringify(PRESETS)||!ui.range)throw new Error(`preset UI mismatch ${JSON.stringify(ui)}`);
  await page.waitForFunction(()=>document.documentElement.dataset.renkoPresetHistoryReady==='true',null,{timeout:60000});

  const histories={atr:await physicalFiveYear('atr'),traditional:await physicalFiveYear('traditional')};
  await resetLive(page.locator('#renko5yRange'));
  const report={schema:'renko-presets-five-values-dual-5y-browser-v1',generatedAt:new Date().toISOString(),base,mode,viewport,status:'PASS',httpStatus:response?.status()||null,contract:{presetValues:PRESETS,zeroMs:'preset interaction ACK is validated separately by the primary gate at <=1ms with 0ms measured long-task blocking',history:'physical native range movement to five calendar years; exact Binance fixed-1s bounded historical window; network/build wall time measured separately',methods:['atr','traditional']},ui,histories,pageErrors,consoleErrors};
  fs.writeFileSync(path.join(out,'dual-history-report.json'),JSON.stringify(report,null,2));
  console.log('RENKO_PRESETS_5Y_DUAL '+JSON.stringify({status:'PASS',mode,atrPhysicalSeconds:Number((histories.atr.physicalMoveMs/1000).toFixed(3)),atrLoadSeconds:Number((histories.atr.loadMs/1000).toFixed(3)),atrWallSeconds:Number((histories.atr.wallMs/1000).toFixed(3)),traditionalPhysicalSeconds:Number((histories.traditional.physicalMoveMs/1000).toFixed(3)),traditionalLoadSeconds:Number((histories.traditional.loadMs/1000).toFixed(3)),traditionalWallSeconds:Number((histories.traditional.wallMs/1000).toFixed(3)),ageDays:histories.atr.ageDays,bars:histories.atr.bars}));
}catch(e){
  fatal=String(e?.stack||e);console.error('RENKO_PRESETS_5Y_DUAL_FATAL',fatal);
  try{await page.screenshot({path:path.join(out,`${mode}-5y-dual-FAIL.png`),fullPage:true})}catch{}
  fs.writeFileSync(path.join(out,'dual-history-report.json'),JSON.stringify({schema:'renko-presets-five-values-dual-5y-browser-v1',generatedAt:new Date().toISOString(),base,mode,viewport,status:'FAIL',fatal,pageErrors,consoleErrors},null,2));
  await browser.close();process.exit(2);
}
await browser.close();
