import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base=(process.env.RWA_TEST_URL||'http://127.0.0.1:8080/rwa').replace(/\/$/,'');
const mode=String(process.env.RENKO_TRADITIONAL_VIEWPORT||'desktop').toLowerCase()==='mobile'?'mobile':'desktop';
const viewport=mode==='mobile'?{width:390,height:844}:{width:1900,height:1000};
const out=process.env.RENKO_TRADITIONAL_OUT||`artifacts/renko-traditional-${mode}`;
fs.mkdirSync(path.join(out,'screens'),{recursive:true});
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const page=await browser.newPage({viewport});
const errors=[],consoleErrors=[];
page.on('pageerror',e=>errors.push(String(e?.message||e)));
page.on('console',m=>{if(m.type()==='error'&&!/WebSocket connection .*?(closed before|Ping received after close)/i.test(m.text()))consoleErrors.push(m.text())});
const response=await page.goto(`${base}/renko/?symbol=SOL&traditionalControl=1&ts=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoTV?.launchPairs?.length===50&&window.RWARenkoTraditionalControl?.version&&window.RWARenkoATRControl?.version,null,{timeout:90000});
const symbols=await page.evaluate(()=>[...RWARenkoTV.launchPairs]);
const rows=[];
for(let i=0;i<symbols.length;i++){
  const symbol=symbols[i];
  await page.evaluate(async s=>{if(RWARenkoTV.state.symbol!==s)await RWARenkoTV.loadSymbol(s,{fit:false})},symbol);
  await page.waitForFunction(s=>RWARenkoTV?.state?.symbol===s&&RWARenkoTV?.state?.status==='live'&&RWARenkoTV?.state?.closedBars?.length>=100&&document.documentElement.dataset.renkoTraditionalSymbol===s,symbol,{timeout:30000});
  await page.fill('#atrLength','14');
  await page.click('[data-apply-method="atr"]');
  await page.waitForFunction(s=>RWARenkoTV?.state?.symbol===s&&RWARenkoTV?.settings?.method==='atr'&&Number(RWARenkoTV?.settings?._exactBox)>0,symbol,{timeout:15000});
  const prepared=await page.evaluate(()=>({value:document.getElementById('traditionalBox')?.value||'',source:document.documentElement.dataset.renkoTraditionalBoxSource||''}));
  await page.fill('#traditionalBox',prepared.value);
  await page.click('[data-apply-method="traditional"]');
  await page.waitForFunction(s=>RWARenkoTV?.state?.symbol===s&&RWARenkoTV?.settings?.method==='traditional'&&document.documentElement.dataset.renkoTraditionalStatus==='active'&&document.documentElement.dataset.renkoTraditionalNoAtrExact==='true',symbol,{timeout:10000});
  const row=await page.evaluate(symbol=>{
    const T=RWARenkoTV,s=T.state,E=T.engine,box=Number(s.box),tick=Number(s.tickSize),input=Number(document.getElementById('traditionalBox')?.value),visible=(document.getElementById('brickValue')?.textContent||'').trim(),parseVisible=v=>Number(String(v).replace(/,/g,'')),total=Number(s.base?.totalBricks??s.confirmedTotal??s.confirmed?.length??0),audit=E.audit(s.confirmed),precision=Number(document.documentElement.dataset.renkoPricePrecision||0),required=Number(T.precisionFor?.(s.lastPrice,tick,box)||0),ratio=tick>0?box/tick:NaN;
    return {symbol,actual:s.symbol,status:s.status,method:T.settings.method,box,tick,input,visible,visiblePositive:parseVisible(visible)>0,total,rendered:Number(s.confirmed?.length||0),audit,interval:T.settings.interval,selector:!!document.querySelector('#intervalSelect'),exactOwn:Object.prototype.hasOwnProperty.call(T.settings,'_exactBox'),workerActive:!!window.RWARenkoATRFixed1s?.workerActive,profile:window.RWARenkoTraditionalControl?.profiles?.[symbol]||null,source:document.documentElement.dataset.renkoTraditionalBoxSource||'',fixed:document.documentElement.dataset.renkoTraditionalFixed||'',precision,required,precisionPass:precision>=required,tickMultiple:Number.isFinite(ratio)&&Math.abs(ratio-Math.round(ratio))<=1e-6};
  },symbol);
  const tol=Math.max(1e-12,Math.abs(row.box)*1e-10);
  row.pass=row.actual===symbol&&row.status==='live'&&row.method==='traditional'&&row.box>0&&row.tick>0&&row.box+tol>=row.tick&&Math.abs(row.input-row.box)<=tol&&row.visiblePositive&&row.total>0&&row.rendered>0&&row.audit.continuation&&row.audit.reversal&&row.interval==='1s'&&!row.selector&&!row.exactOwn&&!row.workerActive&&row.fixed==='true'&&row.precisionPass&&row.tickMultiple;
  rows.push(row);
  await page.screenshot({path:path.join(out,'screens',`${String(i+1).padStart(2,'0')}-${symbol}-traditional.png`),fullPage:true});
}
const report={schema:'renko-traditional-50pair-browser-v1',generatedAt:new Date().toISOString(),base,mode,viewport,httpStatus:response?.status(),count:rows.length,passCount:rows.filter(r=>r.pass).length,status:response?.ok()&&rows.length===50&&rows.every(r=>r.pass)&&!errors.length?'PASS':'FAIL',contract:'Traditional uses a positive minimum-tick-safe absolute box, pair-aware fixed suggestions are frozen per symbol, user Apply owns the saved per-symbol box, ATR _exactBox never leaks into Traditional, XAUT ATR worker stays dormant on the 50 Binance launch pairs, fixed 1s remains permanent, and tiny-price boxes remain visibly positive.',rows,errors,consoleErrors};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_TRADITIONAL_50PAIR '+JSON.stringify({status:report.status,mode,count:report.count,passCount:report.passCount,failed:rows.filter(r=>!r.pass).map(r=>({symbol:r.symbol,box:r.box,tick:r.tick,total:r.total,visible:r.visible,source:r.source,exact:r.exactOwn,worker:r.workerActive})),errors}));
await browser.close();
if(report.status!=='PASS')process.exit(2);
