import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE=(process.env.RWA_TEST_URL||'https://copytolive.github.io/rwa/').replace(/\/$/,'');
const OUT=path.resolve('artifacts/renko-production-report');
const TARGET_VISIBLE=46;
const FIRST_FRAME_LIMIT_MS=1000;
await fs.mkdir(OUT,{recursive:true});

const browser=await chromium.launch({headless:true});
const results=[];

async function runViewport(label,viewport){
  const context=await browser.newContext({viewport,deviceScaleFactor:1});
  const page=await context.newPage();
  const url=`${BASE}/renko/?symbol=SOL&productionReport=1&ts=${Date.now()}`;
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.RWARenkoV15&&window.RWARenkoV15MethodProfiles?.version==='1.9.0'&&window.RWARenkoFirstFrame?.version==='1.2.0'&&document.documentElement.dataset.renkoMethodBootstrap==='186'&&RWARenkoV15.state?.symbol==='SOLUSDT'&&RWARenkoV15.state.ticks?.length>0&&!RWARenkoV15.state.building,null,{timeout:90000});

  const snap=async(method,wallMs=null,seedMode='none')=>page.evaluate(({method,wallMs,target,limit,seedMode})=>{
    const data=window.RWARenkoV15?.state?.data||[],card=document.querySelector('#v15BoxCard'),meta=document.querySelector('#tvBrickMeta')?.textContent||'';
    const visibleMatch=meta.match(/([\d,.]+)\s+visible/i),visible=visibleMatch?Number(visibleMatch[1].replace(/,/g,'')):Math.min(data.length,target);
    const inputWaitMs=Number(card?.dataset.inputWaitMs||NaN),firstFrameMs=Number(card?.dataset.firstFrameMs||card?.dataset.applyMs||NaN),instantSource=card?.dataset.instantSource||null,exactHistory=card?.dataset.exactHistory||null;
    const instrument=document.querySelector('.instrument'),stats=document.querySelector('.stats'),a=instrument?.getBoundingClientRect?.(),b=stats?.getBoundingClientRect?.();
    const layoutNoOverlap=!!a&&!!b&&(a.width===0||b.width===0||a.right<=b.left+.5||b.right<=a.left+.5||a.bottom<=b.top+.5||b.bottom<=a.top+.5);
    const baseMethod=method.startsWith('atr')?'atr':method.split('-')[0],activeState=document.querySelector(`[data-v15-profile="${baseMethod}"] .v15-state`)?.textContent||'',liveLabel=document.querySelector('#tvLoadState')?.textContent||'';
    const notLoading=!/loading|history|queued/i.test(`${activeState} ${liveLabel}`),sourceOk=seedMode==='exact'?(instantSource==='deploy-seed'&&card?.dataset.seedExactBox==='1'&&exactHistory==='1'):seedMode==='seed'?instantSource==='deploy-seed':true;
    const immediate=visible>=target&&data.length>=target&&inputWaitMs===0&&Number(wallMs)<=limit&&firstFrameMs<=limit&&sourceOk&&layoutNoOverlap&&notLoading;
    const head=data.slice(0,8).map(x=>[Number(x.open),Number(x.close),Number(x.high),Number(x.low)]),tail=data.slice(-8).map(x=>[Number(x.open),Number(x.close),Number(x.high),Number(x.low)]);
    return {method,wallMs,bricks:data.length,visible,box:Number(window.RWARenkoV15?.state?.box),tickSize:Number(window.RWARenkoV15?.state?.tickSize),atrValue:Number(window.RWARenkoV15?.state?.atrValue),atrLength:Number(window.RWARenkoV15?.settings?.atrLength),ltp:Number(window.RWARenkoV15?.state?.ltpSnapshot),inputWaitMs,applyMs:Number(card?.dataset.applyMs||NaN),firstFrameMs,firstFrameSource:card?.dataset.firstFrameSource||null,firstFrameSeedBox:Number(card?.dataset.firstFrameSeedBox||NaN),firstFrameRequestedBox:Number(card?.dataset.firstFrameRequestedBox||NaN),firstFramePreload:card?.dataset.firstFramePreload||null,firstFrameSeedCount:Number(card?.dataset.firstFrameSeedCount||0),firstFrameVisibleReady:card?.dataset.firstFrameVisibleReady||null,seedExactBox:card?.dataset.seedExactBox||null,historyState:card?.dataset.historyState||null,instantSource,exactHistory,atrSizingContract:card?.dataset.atrSizingContract||null,historyDowngradeBlocked:card?.dataset.historyDowngradeBlocked||null,layoutNoOverlap,instrumentRect:a?{left:a.left,top:a.top,right:a.right,bottom:a.bottom,width:a.width,height:a.height}:null,statsRect:b?{left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:b.width,height:b.height}:null,activeState,liveLabel,notLoading,meta,signature:JSON.stringify({box:Number(window.RWARenkoV15?.state?.box),count:data.length,head,tail}),passImmediateScreen:immediate};
  },{method,wallMs,target:TARGET_VISIBLE,limit:FIRST_FRAME_LIMIT_MS,seedMode});

  async function apply(method,selector,value){return page.evaluate(({method,selector,value})=>new Promise((resolve,reject)=>{const input=document.querySelector(selector),button=document.querySelector(`[data-v15-apply="${method}"]`);if(!input||!button)return reject(new Error(`missing ${method} controls`));const start=performance.now(),timer=setTimeout(()=>{window.removeEventListener('renko:v15-method-applied',on);reject(new Error(`${method} apply timeout`))},3000);const on=e=>{if(e.detail?.method!==method)return;clearTimeout(timer);window.removeEventListener('renko:v15-method-applied',on);resolve(performance.now()-start)};window.addEventListener('renko:v15-method-applied',on);input.focus();input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));button.click()}),{method,selector,value})}

  async function setWicks(method,selector,checked){return page.evaluate(({method,selector,checked})=>new Promise((resolve,reject)=>{const input=document.querySelector(selector);if(!input)return reject(new Error(`missing ${method} wicks control`));const start=performance.now(),timer=setTimeout(()=>{window.removeEventListener('renko:v15-method-applied',on);reject(new Error(`${method} wicks timeout`))},3000);const on=e=>{if(e.detail?.method!==method)return;clearTimeout(timer);window.removeEventListener('renko:v15-method-applied',on);resolve(performance.now()-start)};window.addEventListener('renko:v15-method-applied',on);input.checked=checked;input.dispatchEvent(new Event('change',{bubbles:true}))}),{method,selector,checked})}
  const wickExcursions=()=>page.evaluate(()=>{const a=window.RWARenkoV15?.state?.data||[];return a.filter(x=>Number(x.high)>Math.max(Number(x.open),Number(x.close))+1e-10||Number(x.low)<Math.min(Number(x.open),Number(x.close))-1e-10).length});

  const boot=await snap('boot');
  const atr14Wall=await apply('atr','#v15AtrLength','14'),atr14=await snap('atr-14',atr14Wall,'none');await page.screenshot({path:path.join(OUT,`${label}-atr-14.png`),fullPage:true});
  const atr140Wall=await apply('atr','#v15AtrLength','140'),atr140=await snap('atr-140',atr140Wall,'none');await page.screenshot({path:path.join(OUT,`${label}-atr-140.png`),fullPage:true});
  const atrChanged=atr14.atrLength===14&&atr140.atrLength===140&&atr14.box!==atr140.box&&atr14.signature!==atr140.signature&&atr14.passImmediateScreen&&atr140.passImmediateScreen;
  const traditionalWall=await apply('traditional','#v15TraditionalBox','1'),traditional=await snap('traditional-1',traditionalWall,'exact');await page.screenshot({path:path.join(OUT,`${label}-traditional-1.png`),fullPage:true});
  const wicksOnExcursions=await wickExcursions(),wicksOffWall=await setWicks('traditional','#v15TraditionalWicks',false),wicksOffExcursions=await wickExcursions();await page.screenshot({path:path.join(OUT,`${label}-traditional-wicks-off.png`),fullPage:true});
  const wicksOnWall=await setWicks('traditional','#v15TraditionalWicks',true),wicksRestoredExcursions=await wickExcursions();await page.screenshot({path:path.join(OUT,`${label}-traditional-wicks-on.png`),fullPage:true});
  const wicks={onExcursions:wicksOnExcursions,offExcursions:wicksOffExcursions,restoredExcursions:wicksRestoredExcursions,offWallMs:wicksOffWall,onWallMs:wicksOnWall,pass:wicksOnExcursions>0&&wicksOffExcursions===0&&wicksRestoredExcursions>0};
  const percentageWall=await apply('percentage','#v15Percentage','10'),percentage=await snap('percentage-10',percentageWall,'seed');await page.screenshot({path:path.join(OUT,`${label}-percentage-10.png`),fullPage:true});
  const pctExpected=Math.round((Math.abs(percentage.ltp)*.10)/percentage.tickSize)*percentage.tickSize,percentageFormulaOk=Math.abs(percentage.box-pctExpected)<=Math.max(percentage.tickSize*.51,Math.abs(pctExpected)*1e-9,1e-10);
  const row={label,viewport,url,boot,atr14,atr140,atrChanged,traditional,wicks,percentage,percentageFormulaOk,pass:boot.passImmediateScreen&&atrChanged&&traditional.passImmediateScreen&&wicks.pass&&percentage.passImmediateScreen&&percentageFormulaOk};results.push(row);await context.close();
}

try{await runViewport('desktop',{width:1900,height:1000});await runViewport('mobile',{width:390,height:844})}finally{await browser.close()}

const report={generatedAt:new Date().toISOString(),url:`${BASE}/renko/`,targetVisible:TARGET_VISIBLE,firstFrameLimitMs:FIRST_FRAME_LIMIT_MS,requiredInputWaitMs:0,requiredAtrChange:'14-to-140-must-change-box-and-geometry',requiredExactSeedFor:['traditional'],requiredPercentageLtpRule:'LTP x percentage rounded only to nearest exchange minimum tick',requiredPercentageFirstFrameSource:'deploy-tick-seed; preview allowed while exact background is non-blocking',requiredWicksToggle:true,requiredNoOverlap:true,requiredNoLoadingAfterApply:true,status:results.every(r=>r.pass)?'PASS':'FAIL',results};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_PRODUCTION_SCREENSHOT_REPORT',JSON.stringify(report));
if(report.status!=='PASS')process.exitCode=2;
