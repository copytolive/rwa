import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE=(process.env.RWA_TEST_URL||'https://copytolive.github.io/rwa/').replace(/\/$/,'');
const OUT=path.resolve('artifacts/renko-production-report');
const TARGET_VISIBLE=46;
await fs.mkdir(OUT,{recursive:true});

const browser=await chromium.launch({headless:true});
const results=[];

async function runViewport(label,viewport){
  const context=await browser.newContext({viewport,deviceScaleFactor:1});
  const page=await context.newPage();
  const url=`${BASE}/renko/?symbol=SOL&productionReport=1&ts=${Date.now()}`;
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.RWARenkoV15&&window.RWARenkoV15MethodProfiles&&RWARenkoV15.state?.symbol==='SOLUSDT'&&RWARenkoV15.state.ticks?.length>0&&!RWARenkoV15.state.building,null,{timeout:90000});

  const snap=async(method,wallMs=null)=>page.evaluate(({method,wallMs,target})=>{
    const range=window.RWARenkoV15?.chart?.timeScale?.().getVisibleLogicalRange?.()||null;
    const data=window.RWARenkoV15?.state?.data||[];
    const meta=document.querySelector('#tvBrickMeta')?.textContent||'';
    const visibleMatch=meta.match(/([\d,.]+)\s+visible/i);
    const visible=visibleMatch?Number(visibleMatch[1].replace(/,/g,'')):Math.min(data.length,target);
    return {
      method,
      wallMs,
      bricks:data.length,
      visible,
      box:Number(window.RWARenkoV15?.state?.box),
      ltp:Number(window.RWARenkoV15?.state?.ltpSnapshot),
      inputWaitMs:Number(document.querySelector('#v15BoxCard')?.dataset.inputWaitMs||NaN),
      applyMs:Number(document.querySelector('#v15BoxCard')?.dataset.applyMs||NaN),
      historyState:document.querySelector('#v15BoxCard')?.dataset.historyState||null,
      instantSource:document.querySelector('#v15BoxCard')?.dataset.instantSource||null,
      exactHistory:document.querySelector('#v15BoxCard')?.dataset.exactHistory||null,
      liveLabel:document.querySelector('#tvLoadState')?.textContent||null,
      meta,
      logicalRange:range,
      passImmediateScreen:visible>=target&&data.length>=target,
    };
  },{method,wallMs,target:TARGET_VISIBLE});

  async function apply(method,selector,value){
    return page.evaluate(({method,selector,value})=>new Promise((resolve,reject)=>{
      const input=document.querySelector(selector);
      const button=document.querySelector(`[data-v15-apply="${method}"]`);
      if(!input||!button)return reject(new Error(`missing ${method} controls`));
      const start=performance.now();
      const timer=setTimeout(()=>{window.removeEventListener('renko:v15-method-applied',on);reject(new Error(`${method} apply timeout`));},10000);
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
  status:results.every(r=>r.pass)?'PASS':'FAIL',
  results,
};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_PRODUCTION_SCREENSHOT_REPORT',JSON.stringify(report));
