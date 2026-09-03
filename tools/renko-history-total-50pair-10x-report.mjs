import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base=(process.env.RWA_TEST_URL||'http://127.0.0.1:8080/rwa').replace(/\/$/,'');
const mode=String(process.env.RENKO_HISTORY10X_VIEWPORT||'desktop').toLowerCase()==='mobile'?'mobile':'desktop';
const viewport=mode==='mobile'?{width:390,height:844}:{width:1900,height:1000};
const out=process.env.RENKO_HISTORY10X_OUT||`artifacts/renko-history10x-${mode}`;
const ATR=[100,150,200,250,300,350,400,500,600,800], MULT=[1,2,3,4,5,6,7,8,9,10];
fs.mkdirSync(path.join(out,'screens'),{recursive:true});
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const page=await browser.newPage({viewport});
const pageErrors=[],consoleErrors=[],atrRows=[],traditionalRows=[],pairs=[];
let response=null,current={stage:'boot',symbol:'',value:null};
page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
page.on('console',m=>{if(m.type()==='error'&&!/WebSocket connection .*?(closed before|Ping received after close)/i.test(m.text()))consoleErrors.push(m.text())});
const counts=()=>({pairs:pairs.length,pairPass:pairs.filter(r=>r.pass).length,atrCases:atrRows.length,atrPass:atrRows.filter(r=>r.pass).length,traditionalCases:traditionalRows.length,traditionalPass:traditionalRows.filter(r=>r.pass).length,totalCases:atrRows.length+traditionalRows.length,totalPass:atrRows.filter(r=>r.pass).length+traditionalRows.filter(r=>r.pass).length});
const write=(status,fatal='')=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({schema:'renko-50pair-full-total-history-10x-v4',generatedAt:new Date().toISOString(),base,mode,viewport,status,httpStatus:response?.status?.()||null,contract:'Every one of the 50 launch pairs applies 10 distinct ATR lengths and 10 distinct Traditional minimum-tick multiples through the production runtime controllers. For every case the visible CONFIRMED value must exactly equal the full mathematical engine total, including legitimate zero-brick cases. A zero total may display the chart empty-state; any positive total must display the chart normally. The bounded rendered tail must exactly match that total when the total is below the render cap, otherwise it remains capped and nonblank. Fixed 1s remains permanent and the XAUT deep worker stays dormant on these 50 Binance launch pairs.',values:{atr:ATR,traditionalTickMultipliers:MULT},counts:counts(),current,pairs,atrRows,traditionalRows,pageErrors,consoleErrors,fatal},null,2));
const fullTotalPass=r=>Number.isFinite(r.total)&&r.total>=0&&r.visible===r.total&&r.guardTotal===r.total&&r.rendered>=0&&r.data===r.rendered&&r.total>=r.rendered&&(!r.limit||r.rendered<=r.limit)&&(r.total===0?r.rendered===0:r.rendered>0)&&(r.limit&&r.total>r.limit?r.rendered===r.limit:r.rendered===r.total);
const visualPass=r=>r.canvas>0&&(r.total===0?(r.empty==='grid'||r.empty==='none'):r.empty==='none');
try{
  response=await page.goto(`${base}/renko/?symbol=SOL&history10x=1&ts=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>RWARenkoTV?.state?.status==='live'&&RWARenkoTV?.launchPairs?.length===50&&RWARenkoATRControl?.version&&RWARenkoTraditionalControl?.version&&RWARenkoConfirmedCountGuard?.version&&RWARenkoBrickBudget?.version,null,{timeout:90000});
  const symbols=await page.evaluate(()=>[...RWARenkoTV.launchPairs]);
  for(let i=0;i<symbols.length;i++){
    const symbol=symbols[i];current={stage:'switch',symbol,value:null};console.log(`HISTORY10X_PAIR ${i+1}/50 ${symbol}`);
    await page.evaluate(async s=>{if(RWARenkoTV.state.symbol!==s)await RWARenkoTV.loadSymbol(s,{fit:false})},symbol);
    await page.waitForFunction(s=>RWARenkoTV?.state?.symbol===s&&RWARenkoTV?.state?.status==='live'&&RWARenkoTV?.state?.closedBars?.length>=900,symbol,{timeout:30000});
    const a=[];
    for(const length of ATR){
      current={stage:'atr',symbol,value:length};console.log(`HISTORY10X_ATR symbol=${symbol} length=${length}`);
      const ok=await page.evaluate(async n=>await RWARenkoATRControl.applyLocal(n,'history10x-matrix'),length);
      if(!ok)throw new Error(`${symbol}: ATR ${length} controller returned false`);
      await page.waitForFunction(({s,n})=>RWARenkoTV?.state?.symbol===s&&RWARenkoTV?.settings?.method==='atr'&&Number(RWARenkoTV?.settings?.atrLength)===n&&Number(RWARenkoTV?.state?.atrAppliedLength)===n&&RWARenkoTV?.state?.atrHistorySatisfied===true&&Number(RWARenkoTV?.state?.atrRaw)>0&&Number(RWARenkoTV?.state?.box)>0,{s:symbol,n:length},{timeout:5000});
      const r=await page.evaluate(({s,n})=>{const T=RWARenkoTV,x=T.state,b=x.base||{},raw=Number(x.atrRaw),box=Number(x.box),exact=Number(T.settings._exactBox),tol=Math.max(1e-12,Math.abs(raw)*1e-10),total=Number(b.totalBricks??x.confirmedTotal??x.confirmed?.length??0),rendered=Number(x.confirmed?.length||0),data=Number(x.confirmedData?.length||0),limit=Number(b.renderLimit||0),visible=Number(String(document.getElementById('brickCount')?.textContent||'').replace(/[^0-9-]/g,''))||0;return{symbol:s,length:n,actual:x.symbol,method:T.settings.method,sourceBars:x.closedBars.length,historySatisfied:!!x.atrHistorySatisfied,historySourceCount:Number(x.atrHistorySourceCount)||0,total,visible,guardTotal:Number(RWARenkoConfirmedCountGuard.total())||0,rendered,data,limit,truncated:!!b.truncated,raw,box,exact,rawBox:Number.isFinite(raw)&&raw>0&&Math.abs(raw-box)<=tol,exactRaw:Number.isFinite(exact)&&exact>0&&Math.abs(raw-exact)<=tol,empty:getComputedStyle(document.getElementById('chartEmpty')).display,canvas:document.querySelectorAll('#chartHost canvas').length,worker:!!RWARenkoATRFixed1s?.workerActive,entries:Number(RWARenkoATRFixed1s?.entryCount)||0,interval:T.settings.interval,selector:!!document.querySelector('#intervalSelect')}} ,{s:symbol,n:length});
      r.totalPass=fullTotalPass(r);r.visualPass=visualPass(r);
      r.zeroTotalExpected=r.total===0;
      r.pass=r.actual===symbol&&r.method==='atr'&&r.sourceBars>=800&&r.historySatisfied&&r.historySourceCount>=length&&r.rawBox&&r.exactRaw&&r.totalPass&&r.visualPass&&!r.worker&&r.entries===0&&r.interval==='1s'&&!r.selector;
      atrRows.push(r);a.push(r);if(!r.pass)throw new Error(`${symbol}: ATR ${length} full-total assertion failed ${JSON.stringify(r)}`);
    }
    const tick=await page.evaluate(()=>Number(RWARenkoTV.state.tickSize));
    const boxes=MULT.map(m=>Number((tick*m).toPrecision(15)));
    if(new Set(boxes.map(String)).size!==10)throw new Error(`${symbol}: Traditional 10 values are not distinct`);
    const t=[];
    for(let j=0;j<boxes.length;j++){
      const requested=boxes[j];current={stage:'traditional',symbol,value:requested};console.log(`HISTORY10X_TRAD symbol=${symbol} index=${j+1} box=${requested}`);
      const ok=await page.evaluate(box=>RWARenkoTraditionalControl.activate(box,'history10x-matrix',false,false),requested);
      if(!ok)throw new Error(`${symbol}: Traditional ${requested} controller returned false`);
      await page.waitForFunction(s=>RWARenkoTV?.state?.symbol===s&&RWARenkoTV?.settings?.method==='traditional'&&document.documentElement.dataset.renkoTraditionalStatus==='active'&&document.documentElement.dataset.renkoTraditionalNoAtrExact==='true',symbol,{timeout:5000});
      const r=await page.evaluate(({s,requested,index})=>{const T=RWARenkoTV,x=T.state,b=x.base||{},box=Number(x.box),tick=Number(x.tickSize),input=Number(document.getElementById('traditionalBox')?.value),tol=Math.max(1e-12,Math.abs(box)*1e-10),total=Number(b.totalBricks??x.confirmedTotal??x.confirmed?.length??0),rendered=Number(x.confirmed?.length||0),data=Number(x.confirmedData?.length||0),limit=Number(b.renderLimit||0),visible=Number(String(document.getElementById('brickCount')?.textContent||'').replace(/[^0-9-]/g,''))||0,ratio=tick>0?box/tick:NaN;return{symbol:s,index,requested,actual:x.symbol,method:T.settings.method,sourceBars:x.closedBars.length,total,visible,guardTotal:Number(RWARenkoConfirmedCountGuard.total())||0,rendered,data,limit,truncated:!!b.truncated,box,tick,input,requestPass:Math.abs(box-requested)<=tol,inputPass:Math.abs(input-box)<=tol,tickPass:Number.isFinite(ratio)&&Math.abs(ratio-Math.round(ratio))<=1e-6,empty:getComputedStyle(document.getElementById('chartEmpty')).display,canvas:document.querySelectorAll('#chartHost canvas').length,worker:!!RWARenkoATRFixed1s?.workerActive,entries:Number(RWARenkoATRFixed1s?.entryCount)||0,interval:T.settings.interval,selector:!!document.querySelector('#intervalSelect'),exactOwn:Object.prototype.hasOwnProperty.call(T.settings,'_exactBox')}} ,{s:symbol,requested,index:j+1});
      r.totalPass=fullTotalPass(r);r.visualPass=visualPass(r);
      r.zeroTotalExpected=r.total===0;
      r.pass=r.actual===symbol&&r.method==='traditional'&&r.sourceBars>=800&&r.box>0&&r.tick>0&&r.requestPass&&r.inputPass&&r.tickPass&&r.totalPass&&r.visualPass&&!r.worker&&r.entries===0&&r.interval==='1s'&&!r.selector&&!r.exactOwn;
      traditionalRows.push(r);t.push(r);if(!r.pass)throw new Error(`${symbol}: Traditional ${requested} full-total assertion failed ${JSON.stringify(r)}`);
    }
    const pass=a.every(r=>r.pass)&&t.every(r=>r.pass);pairs.push({index:i+1,symbol,atrPass:a.filter(r=>r.pass).length,traditionalPass:t.filter(r=>r.pass).length,pass,zeroTotalCases:[...a,...t].filter(r=>r.zeroTotalExpected).length});
    if(i===0||(i+1)%10===0||i===symbols.length-1)await page.screenshot({path:path.join(out,'screens',`${String(i+1).padStart(2,'0')}-${symbol}.png`),fullPage:true});
    // Keep the next symbol load on the ATR path; no extra matrix case is counted.
    await page.evaluate(()=>{const T=RWARenkoTV;T.settings.method='atr';T.settings.atrLength=100;delete T.settings._exactBox});
    write('IN_PROGRESS');
  }
  current={stage:'complete',symbol:'',value:null};
  const c=counts(),status=response?.ok()&&symbols.length===50&&pairs.every(r=>r.pass)&&c.atrCases===500&&c.atrPass===500&&c.traditionalCases===500&&c.traditionalPass===500&&!pageErrors.length?'PASS':'FAIL';
  write(status);
  console.log('RENKO_HISTORY_TOTAL_10X '+JSON.stringify({status,mode,counts:c,zeroTotalCases:[...atrRows,...traditionalRows].filter(r=>r.zeroTotalExpected).length,failedPairs:pairs.filter(r=>!r.pass).map(r=>r.symbol),pageErrors}));
  await browser.close();
  if(status!=='PASS')process.exit(2);
}catch(e){
  const fatal=String(e?.stack||e);console.error('RENKO_HISTORY_TOTAL_10X_FATAL',JSON.stringify({mode,current,fatal}));
  try{await page.screenshot({path:path.join(out,'screens',`FAIL-${current.symbol||'unknown'}-${String(current.stage)}.png`),fullPage:true})}catch{}
  write('FAIL',fatal);
  await browser.close();process.exit(2);
}
