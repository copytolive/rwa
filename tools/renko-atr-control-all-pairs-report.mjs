import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base=(process.env.RWA_TEST_URL||'http://127.0.0.1:8080/rwa').replace(/\/$/,'');
const mode=String(process.env.RENKO_ATR_VIEWPORT||'desktop').toLowerCase()==='mobile'?'mobile':'desktop';
const viewport=mode==='mobile'?{width:390,height:844}:{width:1900,height:1000};
const out=process.env.RENKO_ATR_CONTROL_OUT||`artifacts/renko-atr-control-${mode}`;
fs.mkdirSync(path.join(out,'screens'),{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport});
const errors=[],consoleErrors=[],failed=[];
page.on('pageerror',e=>errors.push(String(e?.message||e)));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText||''}));
const response=await page.goto(`${base}/renko/?symbol=SOL&atrControl=1&ts=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoTV?.launchPairs?.length===50&&window.RWARenkoATRControl?.version&&window.RWARenkoATRFixed1s?.version,null,{timeout:90000});
const symbols=await page.evaluate(()=>[...RWARenkoTV.launchPairs]);
const rows=[];
for(let i=0;i<symbols.length;i++){
  const symbol=symbols[i];
  await page.evaluate(async symbol=>{if(RWARenkoTV.state.symbol!==symbol)await RWARenkoTV.loadSymbol(symbol,{fit:false})},symbol);
  await page.waitForFunction(symbol=>RWARenkoTV?.state?.symbol===symbol&&RWARenkoTV?.state?.status==='live'&&RWARenkoTV?.state?.closedBars?.length>=100,symbol,{timeout:20000});
  await page.fill('#traditionalBox','1');
  await page.click('[data-apply-method="traditional"]');
  await page.waitForFunction(()=>RWARenkoTV?.settings?.method==='traditional',null,{timeout:5000});
  await page.fill('#atrLength','100');
  await page.click('[data-apply-method="atr"]');
  await page.waitForFunction(symbol=>document.documentElement.dataset.atrControlStatus==='active'&&document.documentElement.dataset.atrControlSymbol===symbol&&Number(document.documentElement.dataset.atrAppliedLength)===100&&document.documentElement.dataset.renkoAtrStableBox==='true'&&RWARenkoTV?.settings?.method==='atr'&&Number(RWARenkoTV?.settings?.atrLength)===100&&Number(RWARenkoTV?.state?.atrAppliedLength)===100,symbol,{timeout:15000});
  const row=await page.evaluate(symbol=>{
    const T=RWARenkoTV,s=T.state,raw=Number(s.atrRaw),box=Number(s.box),exact=Number(T.settings._exactBox),tol=Math.max(1e-12,Math.abs(raw)*1e-10);
    return {symbol,actualSymbol:s.symbol,status:s.status,method:T.settings.method,length:Number(T.settings.atrLength),appliedLength:Number(s.atrAppliedLength),historySatisfied:!!s.atrHistorySatisfied,sourceCount:Number(s.atrHistorySourceCount)||0,rawAtr:raw,box,exactBox:exact,rawEqualsBox:Number.isFinite(raw)&&raw>0&&Number.isFinite(box)&&Math.abs(raw-box)<=tol,exactEqualsRaw:Number.isFinite(exact)&&Math.abs(raw-exact)<=tol,badge:document.querySelector('.method[data-method="atr"] .method-title span')?.textContent||'',input:document.getElementById('atrLength')?.value||'',controlStatus:document.documentElement.dataset.atrControlStatus||'',stableBox:document.documentElement.dataset.renkoAtrStableBox||'',workerActive:!!window.RWARenkoATRFixed1s?.workerActive,entryCount:Number(window.RWARenkoATRFixed1s?.entryCount)||0,exactBoxOwn:Object.prototype.hasOwnProperty.call(T.settings,'_exactBox'),interval:T.settings.interval,selectorExists:!!document.querySelector('#intervalSelect'),loadText:document.getElementById('tvLoadState')?.textContent||''};
  },symbol);
  row.pass=row.actualSymbol===symbol&&row.status==='live'&&row.method==='atr'&&row.length===100&&row.appliedLength===100&&row.historySatisfied&&row.sourceCount>=100&&row.rawEqualsBox&&row.exactEqualsRaw&&row.badge.includes('ACTIVE')&&row.input==='100'&&row.controlStatus==='active'&&row.stableBox==='true'&&!row.workerActive&&row.entryCount===0&&row.exactBoxOwn&&row.interval==='1s'&&!row.selectorExists;
  rows.push(row);
  await page.screenshot({path:path.join(out,'screens',`${String(i+1).padStart(2,'0')}-${symbol}-atr100.png`),fullPage:true});
}
const report={schema:'renko-atr-control-50pair-browser-v2-stable-box',generatedAt:new Date().toISOString(),base,mode,viewport,httpStatus:response?.status(),count:rows.length,passCount:rows.filter(r=>r.pass).length,status:response?.ok()&&rows.length===50&&rows.every(r=>r.pass)&&!errors.length?'PASS':'FAIL',contract:'Physical ATR Apply must work for length 100 on every non-XAUT launch pair using that pair own fixed-1s Binance bars. The resulting raw ATR must be frozen as _exactBox until the next symbol or explicit Apply so 1s closes cannot rewrite the full historical chart. XAUT deep-matrix worker remains idle on these pairs.',rows,errors,consoleErrors,requestFailures:failed.slice(0,50)};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_ATR_CONTROL_50PAIR '+JSON.stringify({status:report.status,mode,count:report.count,passCount:report.passCount,failed:rows.filter(r=>!r.pass).map(r=>r.symbol),errors}));
await browser.close();
if(report.status!=='PASS')process.exit(2);
