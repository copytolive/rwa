import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE=(process.env.RWA_TEST_URL||'https://copytolive.github.io/rwa/').replace(/\/$/,'');
const OUT=path.resolve(process.env.RENKO_PRODUCTION_OUT||'artifacts/renko-production-report');
const APPLY_LIMIT_MS=1000;
const TARGET_VISIBLE=46;
await fs.mkdir(OUT,{recursive:true});

const launchOptions={headless:true};
if(process.env.CHROMIUM_EXECUTABLE_PATH)launchOptions.executablePath=process.env.CHROMIUM_EXECUTABLE_PATH;
const browser=await chromium.launch(launchOptions);
const results=[];

const closeEnough=(a,b,tick=0)=>Math.abs(Number(a)-Number(b))<=Math.max(Number(tick)*0.51,Math.abs(Number(b))*1e-9,1e-12);

async function runViewport(label,viewport){
  const context=await browser.newContext({viewport,deviceScaleFactor:1});
  const page=await context.newPage();
  const pageErrors=[];
  const consoleErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  const url=`${BASE}/renko/?symbol=SOL&productionReport=1&ts=${Date.now()}`;
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  const httpStatus=response?.status()||0;
  await page.waitForFunction(()=>{
    const T=window.RWARenkoTV;
    return !!T&&window.RWARenkoATRControl?.version==='1.4.0-zero-safe'&&window.RWARenkoTraditionalControl?.version==='2.1.0-first-frame'&&window.RWARenkoPercentageLTP?.version==='1.0.0'&&window.RWARenkoConfirmedCountGuard?.version==='1.0.0'&&T.state?.symbol==='SOLUSDT'&&T.state?.status==='live'&&Number(T.state?.tickSize)>0&&Number(T.state?.lastPrice)>0&&(T.state?.closedBars?.length||0)>0;
  },null,{timeout:90000});

  const snapshot=async(method,wallMs=null,extra={})=>page.evaluate(({method,wallMs,limit,target})=>{
    const T=window.RWARenkoTV,s=T?.state||{},set=T?.settings||{},guard=window.RWARenkoConfirmedCountGuard;
    const total=Number(guard?.total?.()??s.base?.totalBricks??s.confirmed?.length??0),rendered=Number(s.confirmed?.length||0),visibleText=document.getElementById('brickCount')?.textContent||'',visible=Number(String(visibleText).replace(/[^0-9-]/g,''));
    const instrument=document.querySelector('.instrument'),stats=document.querySelector('.stats'),a=instrument?.getBoundingClientRect?.(),b=stats?.getBoundingClientRect?.();
    const layoutNoOverlap=!!a&&!!b&&(a.width===0||b.width===0||a.right<=b.left+.5||b.right<=a.left+.5||a.bottom<=b.top+.5||b.bottom<=a.top+.5);
    const chartEmpty=document.getElementById('chartEmpty'),chartEmptyHidden=!chartEmpty||chartEmpty.classList.contains('hide')||getComputedStyle(chartEmpty).display==='none'||getComputedStyle(chartEmpty).visibility==='hidden';
    const liveLabel=document.getElementById('tvLoadState')?.textContent||'';
    const noTimeframeSelector=!document.querySelector('#timeframeSelect,[name="timeframe"],[data-timeframe],select[id*="interval" i],select[id*="timeframe" i]');
    const exactOwned=Object.prototype.hasOwnProperty.call(set,'_exactBox');
    const exactBox=Number(set._exactBox);
    const workerActive=!!window.RWARenkoATRFixed1s?.workerActive;
    const basic=Number(s.tickSize)>0&&Number(s.lastPrice)>0&&Number(s.box)>0&&set.interval==='1s'&&noTimeframeSelector&&layoutNoOverlap&&s.status==='live'&&Number.isFinite(total)&&total>=0&&Number.isFinite(visible)&&visible===total&&(total===0?rendered===0:rendered>0)&&chartEmptyHidden&&!/loading|queued/i.test(liveLabel);
    return {method,wallMs,applyWithinLimit:wallMs===null||Number(wallMs)<=limit,httpState:s.status,symbol:s.symbol,interval:set.interval,source:set.source,currentMethod:set.method,atrLength:Number(set.atrLength),box:Number(s.box),atr:Number(s.atr),atrRaw:Number(s.atrRaw),atrZeroFallback:!!s.atrZeroFallback,tickSize:Number(s.tickSize),lastPrice:Number(s.lastPrice),percentageLtpSnapshot:Number(s.percentageLtpSnapshot),confirmedTotal:total,confirmedRendered:rendered,confirmedVisible:visible,projection:Number(s.projection?.length||0),sourceBars:Number(s.closedBars?.length||0),historyPages:Number(s.historyPages||0),exactOwned,exactBox,workerActive,layoutNoOverlap,chartEmptyHidden,noTimeframeSelector,liveLabel,basicPass:basic,target};
  },{method,wallMs,limit:APPLY_LIMIT_MS,target:TARGET_VISIBLE}).then(x=>({...x,...extra}));

  const screenshot=async name=>{await page.waitForTimeout(60);await page.screenshot({path:path.join(OUT,`${label}-${name}.png`),fullPage:true})};

  const boot=await snapshot('boot');
  await screenshot('boot');

  async function applyAtr(length){
    const start=await page.evaluate(()=>performance.now());
    const ok=await page.evaluate(n=>window.RWARenkoATRControl.applyLocal(n,'production-report'),length);
    const wallMs=await page.evaluate(started=>performance.now()-started,start);
    const snap=await snapshot(`atr-${length}`,wallMs,{controllerOk:ok});
    const raw=Number.isFinite(Number(snap.atrRaw))?Number(snap.atrRaw):Number(snap.atr);
    const rawEqBox=raw>0&&Number(snap.box)>0&&closeEnough(raw,snap.box,snap.tickSize*1e-6);
    const zeroFallback=raw===0&&snap.atrZeroFallback===true&&Number(snap.tickSize)>0&&closeEnough(snap.box,snap.tickSize,snap.tickSize*1e-6);
    const stableExact=snap.exactOwned&&Number(snap.exactBox)>0&&closeEnough(snap.exactBox,snap.box,snap.tickSize*1e-6);
    snap.pass=ok===true&&snap.basicPass&&snap.currentMethod==='atr'&&snap.atrLength===length&&(rawEqBox||zeroFallback)&&stableExact&&!snap.workerActive&&snap.applyWithinLimit;
    snap.rawAtr=raw;snap.rawAtrEqualsBox=rawEqBox;snap.zeroAtrMinTickFallback=zeroFallback;snap.stableExactBox=stableExact;
    return snap;
  }

  const atr14=await applyAtr(14);await screenshot('atr-14');
  const atr140=await applyAtr(140);await screenshot('atr-140');
  const atrChanged=atr14.pass&&atr140.pass&&!closeEnough(atr14.box,atr140.box,Math.min(atr14.tickSize,atr140.tickSize)*1e-6);

  const traditionalStart=await page.evaluate(()=>performance.now());
  const traditionalPrepare=await page.evaluate(()=>{
    const T=window.RWARenkoTV,C=window.RWARenkoTraditionalControl,r=C.resolve(T),ok=C.activate(r.box,'production-report',false,true);return{ok,box:r.box,source:r.source,profile:r.profile||null};
  });
  const traditionalWall=await page.evaluate(started=>performance.now()-started,traditionalStart);
  const traditional=await snapshot('traditional',traditionalWall,{prepare:traditionalPrepare});
  const tp=traditionalPrepare.profile||{};
  const tickMultiple=traditional.tickSize>0&&Math.abs(traditional.box/traditional.tickSize-Math.round(traditional.box/traditional.tickSize))<=1e-7;
  const traditionalTargetPass=tp.targetAttainable===false
    ? closeEnough(traditional.box,traditional.tickSize,traditional.tickSize*1e-6)&&Number(tp.maxAtMinTick)<TARGET_VISIBLE&&tp.limited===true
    : Number(tp.expectedBricks)>=TARGET_VISIBLE&&traditional.confirmedTotal>=TARGET_VISIBLE;
  traditional.pass=traditionalPrepare.ok===true&&traditional.basicPass&&traditional.currentMethod==='traditional'&&!traditional.exactOwned&&tickMultiple&&traditionalTargetPass&&!traditional.workerActive&&traditional.applyWithinLimit;
  traditional.tickMultiple=tickMultiple;traditional.targetPass=traditionalTargetPass;
  await screenshot('traditional');

  // Exercise the real production source and WICKS UI. OHLC guarantees that a
  // directional excursion is observable when source candles contain one.
  await page.selectOption('#sourceSelect','ohlc');
  await page.waitForTimeout(50);
  const wickExcursions=()=>page.evaluate(()=>{const a=window.RWARenkoTV?.state?.confirmed||[];return a.filter(x=>Number(x.high)>Math.max(Number(x.open),Number(x.close))+1e-12||Number(x.low)<Math.min(Number(x.open),Number(x.close))-1e-12).length});
  const onExcursions=await wickExcursions();
  const offStart=await page.evaluate(()=>performance.now());
  await page.uncheck('#wicksToggle');await page.waitForTimeout(30);
  const offWallMs=await page.evaluate(started=>performance.now()-started,offStart),offExcursions=await wickExcursions();
  await screenshot('traditional-wicks-off');
  const onStart=await page.evaluate(()=>performance.now());
  await page.check('#wicksToggle');await page.waitForTimeout(30);
  const onWallMs=await page.evaluate(started=>performance.now()-started,onStart),restoredExcursions=await wickExcursions();
  await screenshot('traditional-wicks-on');
  const wicks={onExcursions,offExcursions,restoredExcursions,offWallMs,onWallMs,pass:onExcursions>0&&offExcursions===0&&restoredExcursions>0&&offWallMs<=APPLY_LIMIT_MS&&onWallMs<=APPLY_LIMIT_MS};

  const percentageStart=await page.evaluate(()=>performance.now());
  const percentageSetup=await page.evaluate(()=>{
    const T=window.RWARenkoTV;window.RWARenkoATRControl.clearStable('production-report-percentage');T.settings.method='percentage';T.settings.percentage=.10;T.rebuild({fit:true});return{ltp:Number(T.state.percentageLtpSnapshot||T.state.lastPrice),box:Number(T.state.box),tick:Number(T.state.tickSize),exactOwned:Object.prototype.hasOwnProperty.call(T.settings,'_exactBox')};
  });
  const percentageWall=await page.evaluate(started=>performance.now()-started,percentageStart);
  const percentage=await snapshot('percentage-10',percentageWall,{setup:percentageSetup});
  const pctExpected=await page.evaluate(()=>{const T=window.RWARenkoTV,E=T.engine,ltp=Number(T.state.percentageLtpSnapshot||T.state.lastPrice);return E.percentageLtpStableRound(ltp*.10,T.state.tickSize)});
  const percentageFormulaOk=closeEnough(percentage.box,pctExpected,percentage.tickSize);
  percentage.expectedBox=pctExpected;percentage.formulaOk=percentageFormulaOk;
  percentage.pass=percentage.basicPass&&percentage.currentMethod==='percentage'&&!percentage.exactOwned&&percentageFormulaOk&&!percentage.workerActive&&percentage.applyWithinLimit;
  await screenshot('percentage-10');

  // Restore the user-facing production default state for the screenshot/report.
  await page.evaluate(()=>{const T=window.RWARenkoTV;T.settings.source='close';T.settings.wicks=true;document.getElementById('sourceSelect').value='close';document.getElementById('wicksToggle').checked=true;T.rebuild({fit:true})});

  const row={label,viewport,url,httpStatus,boot,atr14,atr140,atrChanged,traditional,wicks,percentage,percentageFormulaOk,pageErrors,consoleErrors,pass:httpStatus===200&&boot.basicPass&&atrChanged&&traditional.pass&&wicks.pass&&percentage.pass&&pageErrors.length===0&&consoleErrors.length===0};
  results.push(row);
  await context.close();
}

try{
  await runViewport('desktop',{width:1900,height:1000});
  await runViewport('mobile',{width:390,height:844});
}finally{
  await browser.close();
}

const report={
  schema:'renko-current-production-browser-v3-zero-safe',
  generatedAt:new Date().toISOString(),
  url:`${BASE}/renko/`,
  targetVisible:TARGET_VISIBLE,
  applyLimitMs:APPLY_LIMIT_MS,
  contract:{runtime:'RWARenkoTV 3.1 current production API',fixedInterval:'1s',atr:'positive raw Wilder ATR equals box; mathematically zero Wilder ATR falls back to exchange minimum tick; runtime-only stable exact lock',traditional:'fixed absolute min-tick-normalized box; >=46 first-frame when attainable, otherwise exactly one min tick/no fake sub-tick',percentage:'internal LTP x percentage regression, rounded to exchange tick; hidden UI remains hidden',wicks:'real production toggle, verified off=0 excursions and on restores excursions',layout:'instrument/stats do not overlap',legacyV15HarnessRequired:false},
  status:results.every(r=>r.pass)?'PASS':'FAIL',
  results
};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_PRODUCTION_SCREENSHOT_REPORT',JSON.stringify(report));
if(report.status!=='PASS')process.exitCode=2;