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
  await page.waitForFunction(()=>window.RWARenkoV15&&window.RWARenkoV15MethodProfiles&&window.RWARenkoFirstFrame&&document.documentElement.dataset.renkoMethodBootstrap==='185'&&RWARenkoV15.state?.symbol==='SOLUSDT'&&RWARenkoV15.state.ticks?.length>0&&!RWARenkoV15.state.building,null,{timeout:90000});

  const snap=async(method,wallMs=null)=>page.evaluate(({method,wallMs,target,limit})=>{
    const data=window.RWARenkoV15?.state?.data||[];
    const card=document.querySelector('#v15BoxCard');
    const meta=document.querySelector('#tvBrickMeta')?.textContent||'';
    const visibleMatch=meta.match(/([\d,.]+)\s+visible/i);
    const visible=visibleMatch?Number(visibleMatch[1].replace(/,/g,'')):Math.min(data.length,target);
    const inputWaitMs=Number(card?.dataset.inputWaitMs||NaN),firstFrameMs=Number(card?.dataset.firstFrameMs||NaN),instantSource=card?.dataset.instantSource||null;
    const immediate=visible>=target&&data.length>=target&&inputWaitMs===0&&Number(wallMs)<=limit&&instantSource==='deploy-seed';
    return {
      method,
      wallMs,
      bricks:data.length,
      visible,
      box:Number(window.RWARenkoV15?.state?.box),
      ltp:Number(window.RWARenkoV15?.state?.ltpSnapshot),
      inputWaitMs,
      applyMs:Number(card?.dataset.applyMs||NaN),
      firstFrameMs,
      firstFrameSource:card?.dataset.firstFrameSource||null,
      firstFrameSeedBox:Number(card?.dataset.firstFrameSeedBox||NaN),
      firstFrameRequestedBox:Number(card?.dataset.firstFrameRequestedBox||NaN),
      firstFramePreload:card?.dataset.firstFramePreload||null,
      firstFrameSeedCount:Number(card?.dataset.firstFrameSeedCount||0),
      firstFrameVisibleReady:card?.dataset.firstFrameVisibleReady||null,
      historyState:card?.dataset.historyState||null,
      instantSource,
      exactHistory:card?.dataset.exactHistory||null,
      liveLabel:document.querySelector('#tvLoadState')?.textContent||null,
      meta,
      passImmediateScreen:immediate,
    };
  },{method,wallMs,target:TARGET_VISIBLE,limit:FIRST_FRAME_LIMIT_MS});

  async function apply(method,selector,value){
    return page.evaluate(({method,selector,value})=>new Promise((resolve,reject)=>{
      const input=document.querySelector(selector);
      const button=document.querySelector(`[data-v15-apply="${method}"]`);
      if(!input||!button)return reject(new Error(`missing ${method} controls`));
      const start=performance.now();
      const timer=setTimeout(()=>{window.removeEventListener('renko:v15-method-applied',on);reject(new Error(`${method} apply timeout`));},3000);
      const on=e=>{
        if(e.detail?.method!==method)return;
        clearTimeout(timer);
        window.removeEventListener('renko:v15-method-applied',on);
        resolve(performance.now()-start);
      };
      window.addEventListener('renko:v15-method-applied',on);
      input.focus();
      input.value=value;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      button.click();
    }),{method,selector,value});
  }

  const boot=await snap('boot');
  const traditionalWall=await apply('traditional','#v15TraditionalBox','1');
  const traditional=await snap('traditional-1',traditionalWall);
  await page.screenshot({path:path.join(OUT,`${label}-traditional-1.png`),fullPage:true});

  const percentageWall=await apply('percentage','#v15Percentage','10');
  const percentage=await snap('percentage-10',percentageWall);
  await page.screenshot({path:path.join(OUT,`${label}-percentage-10.png`),fullPage:true});

  const row={label,viewport,url,boot,traditional,percentage,pass:traditional.passImmediateScreen&&percentage.passImmediateScreen};
  results.push(row);
  await context.close();
}

try{
  await runViewport('desktop',{width:1900,height:1000});
  await runViewport('mobile',{width:390,height:844});
} finally {
  await browser.close();
}

const report={
  generatedAt:new Date().toISOString(),
  url:`${BASE}/renko/`,
  targetVisible:TARGET_VISIBLE,
  firstFrameLimitMs:FIRST_FRAME_LIMIT_MS,
  requiredSource:'deploy-seed',
  requiredInputWaitMs:0,
  status:results.every(r=>r.pass)?'PASS':'FAIL',
  results,
};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_PRODUCTION_SCREENSHOT_REPORT',JSON.stringify(report));
if(report.status!=='PASS')process.exitCode=2;
