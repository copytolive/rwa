import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const baseUrl=process.env.RENKO_BASE_URL||'http://127.0.0.1:4173/rwa/renko/';
const expectedSha=process.env.RENKO_EXPECTED_SHA||'';
const outDir=process.env.RENKO_OUTPUT_DIR||'artifacts/renko-wheel-pan-no-zoom';
await fs.mkdir(outDir,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1672,height:941}});
const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
const url=new URL(baseUrl);url.searchParams.set('gold','1');url.searchParams.set('wheelPanNoZoomProof','1');url.searchParams.set('cb',String(Date.now()));
await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:120000});
await page.waitForFunction(()=>document.querySelector('#chartHost canvas')&&window.RWARenkoTV?.state?.symbol==='XAUUSD'&&window.RWARenkoGoldTotalHistory&&window.RWARenkoGoldWheelPanLock?.version==='1.3.0-full-prepend-size-lock'&&document.documentElement.dataset.renkoGoldRecent==='true',{timeout:120000});
let deployedSha=null;if(baseUrl.startsWith('https://')){deployedSha=(await(await fetch(new URL('deployment-sha.txt?wheelProof=1',baseUrl))).text()).trim();if(expectedSha&&deployedSha!==expectedSha)throw new Error(`public SHA mismatch ${deployedSha} != ${expectedSha}`)}
await page.fill('#traditionalBox','10');await page.click('[data-apply-method="traditional"]');await page.waitForFunction(()=>window.RWARenkoTV?.settings?.method==='traditional'&&Math.abs(Number(window.RWARenkoTV?.state?.box)-10)<1e-9,{timeout:60000});
const box=await page.locator('#chartHost').boundingBox();if(!box)throw new Error('chartHost missing');
const getState=()=>page.evaluate(()=>{const ts=window.__RWARenkoChart?.timeScale?.(),o=ts?.options?.()||{},r=ts?.getVisibleLogicalRange?.(),H=window.RWARenkoGoldTotalHistory,T=window.RWARenkoTV;return{barSpacing:Number(o.barSpacing),logical:r?{from:Number(r.from),to:Number(r.to)}:null,width:r?Number(r.to)-Number(r.from):null,scrollPosition:Number(ts?.scrollPosition?.()),prepends:Number(H?.stats?.prepends||0),autoTriggers:Number(H?.stats?.autoTriggers||0),autoEdgeBars:Number(H?.autoEdgeBars),suppressedScrollEvents:Number(H?.stats?.suppressedScrollEvents||0),busy:!!H?.busy,oldestSecond:Math.floor(Number(T?.state?.closedBars?.[0]?.openTime||0)/1000),wheelStats:{...window.RWARenkoGoldWheelPanLock?.stats},wheelVersion:window.RWARenkoGoldWheelPanLock?.version,sizeLockSpacing:window.RWARenkoGoldWheelPanLock?.sizeLockSpacing??null,method:T?.settings?.method,box:Number(T?.state?.box),panOnly:document.documentElement.dataset.renkoGoldWheelPanOnly}});
const delta=(a,b)=>Math.abs(Number(a)-Number(b));
const assertScale=(before,after,label)=>{if(!(Number.isFinite(before.barSpacing)&&Number.isFinite(after.barSpacing)))throw new Error(`${label} non-finite spacing`);if(delta(before.barSpacing,after.barSpacing)>1e-9)throw new Error(`${label} visual brick spacing changed ${before.barSpacing} -> ${after.barSpacing}`)};
async function waitStableSpacing(stableMs=900,timeout=8000){let last=null,stableSince=Date.now(),started=Date.now(),samples=[];while(Date.now()-started<timeout){const s=await getState();samples.push(s.barSpacing);if(!Number.isFinite(last)||delta(last,s.barSpacing)>1e-9){last=s.barSpacing;stableSince=Date.now()}if(Date.now()-stableSince>=stableMs&&!s.busy)return{s,samples};await page.waitForTimeout(75)}throw new Error(`barSpacing/busy never stable ${JSON.stringify({samples:samples.slice(-30),state:await getState()})}`)}
async function liveStable(){await page.click('#tvLive');await page.waitForTimeout(80);return waitStableSpacing()}
const initial=await liveStable();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.45);await page.screenshot({path:path.join(outDir,'BEFORE.png'),fullPage:true});
const noWheelA=initial.s;await page.waitForTimeout(1200);const noWheelB=await getState();assertScale(noWheelA,noWheelB,'no-wheel baseline stability');
const candidates=[[-160,80],[-160,-80],[160,80],[160,-80]];let vector=null,bestScroll=0,calibration=[];
for(const [dx,dy] of candidates){const stable=await liveStable();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.45);const a=stable.s;await page.mouse.wheel(dx,dy);await page.waitForTimeout(1100);const b=await getState();assertScale(a,b,`calibration ${dx},${dy}`);const move=Number(b.logical?.from)-Number(a.logical?.from),scrollMove=Number(b.scrollPosition)-Number(a.scrollPosition);calibration.push({dx,dy,move,scrollMove,beforeSpacing:a.barSpacing,afterSpacing:b.barSpacing,beforeWidth:a.width,afterWidth:b.width,beforeFrom:a.logical?.from,afterFrom:b.logical?.from,beforeScroll:a.scrollPosition,afterScroll:b.scrollPosition,prependsBefore:a.prepends,prependsAfter:b.prepends,autoTriggersBefore:a.autoTriggers,autoTriggersAfter:b.autoTriggers,corrections:b.wheelStats.corrections});if(Number.isFinite(scrollMove)&&scrollMove<bestScroll){bestScroll=scrollMove;vector=[dx,dy]}}
if(!vector)throw new Error(`mixed/real wheel could not pan older by scroll position: ${JSON.stringify(calibration)}`);
await liveStable();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.45);
const rows=[];const start=(await getState()).prepends;
for(let cycle=1;cycle<=3;cycle++){
  const target=start+cycle,baseline=await getState();let triggered=false,lastProbe=baseline;
  for(let n=0;n<1800;n++){
    const s=await getState();lastProbe=s;if(s.prepends>=target){triggered=true;break}if(s.busy){await page.waitForTimeout(35);continue}
    await page.mouse.wheel(vector[0],vector[1]);
    if(n%12===0){await page.waitForTimeout(55);const mid=await getState();lastProbe=mid;assertScale(baseline,mid,`cycle ${cycle} wheel ${n}`)}else await page.waitForTimeout(18);
  }
  if(!triggered){await page.waitForTimeout(800);lastProbe=await getState();triggered=lastProbe.prepends>=target}
  if(!triggered)throw new Error(`back-scroll failed to prepend cycle ${cycle}: ${JSON.stringify({vector,calibration,baseline,lastProbe,target})}`);
  await page.waitForFunction(n=>!window.RWARenkoGoldTotalHistory.busy&&window.RWARenkoGoldTotalHistory.stats.prepends>=n,target,{timeout:180000});await page.waitForTimeout(1500);
  const after=await getState();assertScale(baseline,after,`cycle ${cycle} settled`);if(after.method!=='traditional'||delta(after.box,10)>1e-9)throw new Error(`Traditional 10 changed during scroll cycle ${cycle}`);if(after.panOnly!=='true'||after.wheelVersion!=='1.3.0-full-prepend-size-lock')throw new Error('wheel pan-only guard not active');rows.push({cycle,beforeSpacing:baseline.barSpacing,afterSpacing:after.barSpacing,beforeWidth:baseline.width,afterWidth:after.width,beforeScroll:baseline.scrollPosition,afterScroll:after.scrollPosition,prepends:after.prepends,autoTriggers:after.autoTriggers,corrections:after.wheelStats.corrections,maxBarSpacingDelta:after.wheelStats.maxBarSpacingDelta});
}
await page.screenshot({path:path.join(outDir,'AFTER.png'),fullPage:true});
const final=await getState();if(pageErrors.length)throw new Error(`page errors ${JSON.stringify(pageErrors)}`);const report={token:'RENKO_GOLD_WHEEL_PAN_NO_ZOOM_PASS',sha:deployedSha||expectedSha||null,baseUrl,traditionalBox:10,noWheelBaseline:{before:noWheelA.barSpacing,after:noWheelB.barSpacing,samples:initial.samples},vector,calibration,rows,final};await fs.writeFile(path.join(outDir,'report.json'),JSON.stringify(report,null,2));console.log(report.token,JSON.stringify(report));await browser.close();
