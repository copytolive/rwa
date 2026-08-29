import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base=(process.env.RWA_TEST_URL||'http://127.0.0.1:8080/rwa').replace(/\/$/,'');
const mode=String(process.env.RENKO_HISTORY10X_VIEWPORT||'desktop').toLowerCase()==='mobile'?'mobile':'desktop';
const viewport=mode==='mobile'?{width:390,height:844}:{width:1900,height:1000};
const out=process.env.RENKO_HISTORY10X_OUT||`artifacts/renko-history10x-${mode}`;
const ATR=[1,2,3,5,8,13,21,34,55,89], MULT=[1,2,3,4,5,6,7,8,9,10];
fs.mkdirSync(path.join(out,'screens'),{recursive:true});
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const page=await browser.newPage({viewport});
const pageErrors=[],consoleErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
page.on('console',m=>{if(m.type()==='error'&&!/WebSocket connection .*?(closed before|Ping received after close)/i.test(m.text()))consoleErrors.push(m.text())});
const response=await page.goto(`${base}/renko/?symbol=SOL&history10x=1&ts=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>RWARenkoTV?.state?.status==='live'&&RWARenkoTV?.launchPairs?.length===50&&RWARenkoATRControl?.version&&RWARenkoTraditionalControl?.version&&RWARenkoConfirmedCountGuard?.version&&RWARenkoBrickBudget?.version,null,{timeout:90000});
const symbols=await page.evaluate(()=>[...RWARenkoTV.launchPairs]);
const atrRows=[],traditionalRows=[],pairs=[];
for(let i=0;i<symbols.length;i++){
  const symbol=symbols[i];
  await page.evaluate(async s=>{if(RWARenkoTV.state.symbol!==s)await RWARenkoTV.loadSymbol(s,{fit:false})},symbol);
  await page.waitForFunction(s=>RWARenkoTV?.state?.symbol===s&&RWARenkoTV?.state?.status==='live'&&RWARenkoTV?.state?.closedBars?.length>=100,symbol,{timeout:30000});
  const a=[];
  for(const length of ATR){
    await page.fill('#atrLength',String(length));
    await page.click('[data-apply-method="atr"]');
    await page.waitForFunction(({s,n})=>RWARenkoTV?.state?.symbol===s&&RWARenkoTV?.settings?.method==='atr'&&Number(RWARenkoTV?.state?.atrAppliedLength)===n&&document.documentElement.dataset.atrControlStatus==='active'&&document.documentElement.dataset.renkoAtrStableBox==='true',{s:symbol,n:length},{timeout:10000});
    const r=await page.evaluate(({s,n})=>{const T=RWARenkoTV,x=T.state,b=x.base||{},raw=Number(x.atrRaw),box=Number(x.box),exact=Number(T.settings._exactBox),tol=Math.max(1e-12,Math.abs(raw)*1e-10),total=Number(b.totalBricks??x.confirmedTotal??x.confirmed?.length??0),rendered=Number(x.confirmed?.length||0),data=Number(x.confirmedData?.length||0),limit=Number(b.renderLimit||0),visible=Number(String(document.getElementById('brickCount')?.textContent||'').replace(/[^0-9-]/g,''))||0;return{symbol:s,length:n,actual:x.symbol,method:T.settings.method,sourceBars:x.closedBars.length,historySatisfied:!!x.atrHistorySatisfied,historySourceCount:Number(x.atrHistorySourceCount)||0,total,visible,guardTotal:Number(RWARenkoConfirmedCountGuard.total())||0,rendered,data,limit,truncated:!!b.truncated,raw,box,exact,rawBox:Number.isFinite(raw)&&raw>0&&Math.abs(raw-box)<=tol,exactRaw:Number.isFinite(exact)&&exact>0&&Math.abs(raw-exact)<=tol,empty:getComputedStyle(document.getElementById('chartEmpty')).display,canvas:document.querySelectorAll('#chartHost canvas').length,worker:!!RWARenkoATRFixed1s?.workerActive,entries:Number(RWARenkoATRFixed1s?.entryCount)||0,interval:T.settings.interval,selector:!!document.querySelector('#intervalSelect')}} ,{s:symbol,n:length});
    r.totalPass=r.total>0&&r.visible===r.total&&r.guardTotal===r.total&&r.rendered>0&&r.data===r.rendered&&r.total>=r.rendered&&(!r.limit||r.rendered<=r.limit);
    r.pass=r.actual===symbol&&r.method==='atr'&&r.sourceBars>=100&&r.historySatisfied&&r.historySourceCount>=length&&r.rawBox&&r.exactRaw&&r.totalPass&&r.empty==='none'&&r.canvas>0&&!r.worker&&r.entries===0&&r.interval==='1s'&&!r.selector;
    atrRows.push(r);a.push(r);
  }
  const tick=await page.evaluate(()=>Number(RWARenkoTV.state.tickSize));
  const boxes=MULT.map(m=>Number((tick*m).toPrecision(15)));
  if(new Set(boxes.map(String)).size!==10)throw new Error(`${symbol}: Traditional 10 values are not distinct`);
  const t=[];
  for(let j=0;j<boxes.length;j++){
    const requested=boxes[j];
    await page.fill('#traditionalBox',String(requested));
    await page.click('[data-apply-method="traditional"]');
    await page.waitForFunction(s=>RWARenkoTV?.state?.symbol===s&&RWARenkoTV?.settings?.method==='traditional'&&document.documentElement.dataset.renkoTraditionalStatus==='active'&&document.documentElement.dataset.renkoTraditionalNoAtrExact==='true',symbol,{timeout:10000});
    const r=await page.evaluate(({s,requested,index})=>{const T=RWARenkoTV,x=T.state,b=x.base||{},box=Number(x.box),tick=Number(x.tickSize),input=Number(document.getElementById('traditionalBox')?.value),tol=Math.max(1e-12,Math.abs(box)*1e-10),total=Number(b.totalBricks??x.confirmedTotal??x.confirmed?.length??0),rendered=Number(x.confirmed?.length||0),data=Number(x.confirmedData?.length||0),limit=Number(b.renderLimit||0),visible=Number(String(document.getElementById('brickCount')?.textContent||'').replace(/[^0-9-]/g,''))||0,ratio=tick>0?box/tick:NaN;return{symbol:s,index,requested,actual:x.symbol,method:T.settings.method,sourceBars:x.closedBars.length,total,visible,guardTotal:Number(RWARenkoConfirmedCountGuard.total())||0,rendered,data,limit,truncated:!!b.truncated,box,tick,input,requestPass:Math.abs(box-requested)<=tol,inputPass:Math.abs(input-box)<=tol,tickPass:Number.isFinite(ratio)&&Math.abs(ratio-Math.round(ratio))<=1e-6,empty:getComputedStyle(document.getElementById('chartEmpty')).display,canvas:document.querySelectorAll('#chartHost canvas').length,worker:!!RWARenkoATRFixed1s?.workerActive,entries:Number(RWARenkoATRFixed1s?.entryCount)||0,interval:T.settings.interval,selector:!!document.querySelector('#intervalSelect'),exactOwn:Object.prototype.hasOwnProperty.call(T.settings,'_exactBox')}} ,{s:symbol,requested,index:j+1});
    r.totalPass=r.total>0&&r.visible===r.total&&r.guardTotal===r.total&&r.rendered>0&&r.data===r.rendered&&r.total>=r.rendered&&(!r.limit||r.rendered<=r.limit);
    r.pass=r.actual===symbol&&r.method==='traditional'&&r.sourceBars>=100&&r.box>0&&r.tick>0&&r.requestPass&&r.inputPass&&r.tickPass&&r.totalPass&&r.empty==='none'&&r.canvas>0&&!r.worker&&r.entries===0&&r.interval==='1s'&&!r.selector&&!r.exactOwn;
    traditionalRows.push(r);t.push(r);
  }
  const pass=a.every(r=>r.pass)&&t.every(r=>r.pass);
  pairs.push({index:i+1,symbol,atrPass:a.filter(r=>r.pass).length,traditionalPass:t.filter(r=>r.pass).length,pass});
  if(i===0||(i+1)%10===0||i===symbols.length-1)await page.screenshot({path:path.join(out,'screens',`${String(i+1).padStart(2,'0')}-${symbol}.png`),fullPage:true});
}
const counts={pairs:pairs.length,pairPass:pairs.filter(r=>r.pass).length,atrCases:atrRows.length,atrPass:atrRows.filter(r=>r.pass).length,traditionalCases:traditionalRows.length,traditionalPass:traditionalRows.filter(r=>r.pass).length,totalCases:atrRows.length+traditionalRows.length,totalPass:atrRows.filter(r=>r.pass).length+traditionalRows.filter(r=>r.pass).length};
const status=response?.ok()&&symbols.length===50&&pairs.every(r=>r.pass)&&atrRows.length===500&&atrRows.every(r=>r.pass)&&traditionalRows.length===500&&traditionalRows.every(r=>r.pass)&&!pageErrors.length?'PASS':'FAIL';
const report={schema:'renko-50pair-full-total-history-10x-v1',generatedAt:new Date().toISOString(),base,mode,viewport,status,contract:'Every one of the 50 launch pairs physically applies 10 ATR lengths and 10 distinct Traditional minimum-tick multiples. For every case the visible CONFIRMED value must equal the full engine total, while the bounded rendered tail remains nonblank, internally consistent, fixed at 1s, and the XAUT deep worker stays dormant.',values:{atr:ATR,traditionalTickMultipliers:MULT},counts,pairs,atrRows,traditionalRows,pageErrors,consoleErrors};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_HISTORY_TOTAL_10X '+JSON.stringify({status,mode,counts,failedPairs:pairs.filter(r=>!r.pass).map(r=>r.symbol),failedAtr:atrRows.filter(r=>!r.pass).slice(0,10),failedTraditional:traditionalRows.filter(r=>!r.pass).slice(0,10),pageErrors}));
await browser.close();
if(status!=='PASS')process.exit(2);
