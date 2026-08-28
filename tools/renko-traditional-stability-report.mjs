import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root=(process.env.RWA_TEST_URL||'http://127.0.0.1:8080/rwa').replace(/\/$/,'');
const mode=String(process.env.RENKO_TRADITIONAL_STABILITY_VIEWPORT||'desktop').toLowerCase()==='mobile'?'mobile':'desktop';
const out=process.env.RENKO_TRADITIONAL_STABILITY_OUT||`artifacts/traditional-stability-${mode}`;
const pairs=(process.env.RENKO_TRADITIONAL_STABILITY_PAIRS||'BTCUSDT,SOLUSDT,OPUSDT,PEPEUSDT,ZECUSDT').split(',').map(s=>s.trim()).filter(Boolean);
const viewport=mode==='mobile'?{width:390,height:844}:{width:1900,height:1000};
fs.mkdirSync(path.join(out,'screens'),{recursive:true});
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const page=await browser.newPage({viewport});
const errors=[];
page.on('pageerror',e=>errors.push(`pageerror:${e.message}`));
page.on('console',m=>{if(m.type()==='error'&&!/WebSocket connection .*?(closed before|Ping received after close)/i.test(m.text()))errors.push(`console:${m.text()}`)});
const near=(a,b)=>Math.abs(Number(a)-Number(b))<=Math.max(1e-12,Math.abs(Number(b))*1e-11);
async function snap(){return page.evaluate(()=>{const T=RWARenkoTV,s=T.state,b=s.base;return{symbol:s.symbol,status:s.status,method:T.settings.method,box:Number(s.box),input:Number(document.getElementById('traditionalBox')?.value),visibleBox:(document.getElementById('brickValue')?.textContent||'').trim(),anchor:Number(b?.anchor),total:Number(b?.totalBricks??s.confirmedTotal??0),rendered:Number(s.confirmed?.length||0),source:Number(s.closedBars?.length||0),lastSource:Number(b?.state?.lastSourceTime||0),exactOwn:Object.prototype.hasOwnProperty.call(T.settings,'_exactBox'),workerActive:!!window.RWARenkoATRFixed1s?.workerActive,fixed:document.documentElement.dataset.renkoTraditionalFixed||'',control:document.documentElement.dataset.renkoTraditionalStatus||''}})}
await page.goto(`${root}/renko/?symbol=SOL&traditionalStability=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>RWARenkoTV?.state?.status==='live'&&RWARenkoTraditionalControl?.version,null,{timeout:90000});
const results=[];
for(let i=0;i<pairs.length;i++){
  const symbol=pairs[i];
  await page.evaluate(async s=>{if(RWARenkoTV.state.symbol!==s)await RWARenkoTV.loadSymbol(s,{fit:false})},symbol);
  await page.waitForFunction(s=>RWARenkoTV?.state?.symbol===s&&RWARenkoTV?.state?.status==='live'&&document.documentElement.dataset.renkoTraditionalSymbol===s,symbol,{timeout:30000});
  const suggested=await page.locator('#traditionalBox').inputValue();
  await page.fill('#traditionalBox',suggested);await page.click('[data-apply-method="traditional"]');
  await page.waitForFunction(()=>RWARenkoTV?.settings?.method==='traditional'&&document.documentElement.dataset.renkoTraditionalStatus==='active',null,{timeout:10000});
  const first=await snap(),samples=[first],safe=symbol.replace(/[^A-Z0-9_-]/g,'_');
  await page.screenshot({path:path.join(out,'screens',`${String(i+1).padStart(2,'0')}-${safe}-before.png`),fullPage:true});
  const deadline=Date.now()+12000;while(Date.now()<deadline){await page.waitForTimeout(150);const s=await snap();samples.push(s);if(s.source>=first.source+3)break}
  const last=samples.at(-1);await page.screenshot({path:path.join(out,'screens',`${String(i+1).padStart(2,'0')}-${safe}-after.png`),fullPage:true});
  const boxStable=samples.every(s=>near(s.box,first.box)&&near(s.input,first.input)&&s.visibleBox===first.visibleBox),anchorStable=samples.every(s=>near(s.anchor,first.anchor)),totalMonotonic=samples.every((s,j)=>j===0||s.total>=samples[j-1].total),noBlank=samples.every(s=>s.total>0&&s.rendered>0),isolated=samples.every(s=>!s.exactOwn&&!s.workerActive&&s.method==='traditional'&&s.fixed==='true'),closesObserved=last.source>=first.source+3;
  const pass=boxStable&&anchorStable&&totalMonotonic&&noBlank&&isolated&&closesObserved&&first.control==='active';
  results.push({symbol,pass,boxStable,anchorStable,totalMonotonic,noBlank,isolated,closesObserved,first,last,sampleCount:samples.length,uniqueBoxes:[...new Set(samples.map(s=>s.box))],uniqueVisibleBoxes:[...new Set(samples.map(s=>s.visibleBox))],totalRange:[Math.min(...samples.map(s=>s.total)),Math.max(...samples.map(s=>s.total))]});
  console.log(symbol,pass?'PASS':'FAIL',`box=${first.box}`,`visible=${first.visibleBox}`,`total=${first.total}->${last.total}`,`source=${first.source}->${last.source}`);
}
await browser.close();
const report={schema:'renko-traditional-stability-browser-v1',mode,viewport,url:root,pairs,pass:results.every(r=>r.pass)&&errors.length===0,errors,results,generatedAt:new Date().toISOString()};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
if(!report.pass){console.error(JSON.stringify(report,null,2));process.exit(1)}
console.log(`RENKO_TRADITIONAL_STABILITY_${mode.toUpperCase()}_PASS ${results.length}/${results.length}`);
