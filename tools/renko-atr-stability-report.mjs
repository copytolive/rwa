import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root=(process.env.RWA_TEST_URL||'http://127.0.0.1:8080/rwa').replace(/\/$/,'');
const mode=process.env.RENKO_ATR_STABILITY_VIEWPORT||'desktop';
const out=process.env.RENKO_ATR_STABILITY_OUT||`artifacts/atr-stability-${mode}`;
const pairs=(process.env.RENKO_ATR_STABILITY_PAIRS||'BTCUSDT,SOLUSDT,OPUSDT,PEPEUSDT,ZECUSDT').split(',').map(s=>s.trim()).filter(Boolean);
const viewport=mode==='mobile'?{width:390,height:844}:{width:1900,height:1000};
fs.mkdirSync(path.join(out,'screens'),{recursive:true});

const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport,deviceScaleFactor:1});
const page=await ctx.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(`pageerror:${e.message}`));
page.on('console',m=>{if(m.type()==='error')errors.push(`console:${m.text()}`)});

const results=[];
const near=(a,b)=>Math.abs(Number(a)-Number(b))<=Math.max(1e-12,Math.abs(Number(b))*1e-11);
async function snap(){return page.evaluate(()=>{const T=window.RWARenkoTV;const b=T?.state?.base;return{symbol:T?.state?.symbol,status:T?.state?.status,method:T?.settings?.method,length:Number(T?.settings?.atrLength),box:Number(T?.state?.box),exact:Number(T?.settings?._exactBox),atr:Number(T?.state?.atr),anchor:Number(b?.anchor),total:Number(b?.totalBricks??T?.state?.confirmedTotal??0),rendered:Number(T?.state?.confirmed?.length||0),source:Number(T?.state?.closedBars?.length||0),lastSource:Number(b?.state?.lastSourceTime||0),stable:document.documentElement.dataset.renkoAtrStableBox,control:document.documentElement.dataset.atrControlStatus}})}

await page.goto(`${root}/renko/?symbol=SOL&stability=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoATRControl?.version&&window.RWARenkoTV?.launchPairs?.length===50,null,{timeout:90000});

for(let i=0;i<pairs.length;i++){
  const symbol=pairs[i];
  await page.evaluate(async s=>{if(RWARenkoTV.state.symbol!==s)await RWARenkoTV.loadSymbol(s,{fit:false})},symbol);
  await page.waitForFunction(s=>window.RWARenkoTV?.state?.symbol===s&&window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoTV?.state?.closedBars?.length>=100,symbol,{timeout:30000});
  await page.locator('#atrLength').fill('100');
  await page.locator('[data-apply-method="atr"]').click();
  await page.waitForFunction(s=>document.documentElement.dataset.atrControlStatus==='active'&&document.documentElement.dataset.atrControlSymbol===s&&Number(window.RWARenkoTV?.settings?._exactBox)>0,symbol,{timeout:15000});
  const first=await snap();
  const samples=[first];
  const deadline=Date.now()+12000;
  while(Date.now()<deadline){
    await page.waitForTimeout(150);
    const s=await snap();samples.push(s);
    if(s.source>=first.source+3)break;
  }
  const last=samples.at(-1);
  const boxStable=samples.every(s=>near(s.box,first.box)&&near(s.exact,first.exact)&&near(s.atr,first.atr));
  const anchorStable=samples.every(s=>near(s.anchor,first.anchor));
  const totalMonotonic=samples.every((s,j)=>j===0||s.total>=samples[j-1].total);
  const exactActive=first.stable==='true'&&first.control==='active'&&first.method==='atr'&&first.length===100&&first.exact>0;
  const closesObserved=last.source>=first.source+3;
  const noBlank=samples.every(s=>s.rendered>0&&s.total>0);
  const pass=boxStable&&anchorStable&&totalMonotonic&&exactActive&&closesObserved&&noBlank;
  const safe=symbol.replace(/[^A-Z0-9_-]/g,'_');
  await page.screenshot({path:path.join(out,'screens',`${String(i+1).padStart(2,'0')}-${safe}-stable.png`),fullPage:true});
  results.push({symbol,pass,boxStable,anchorStable,totalMonotonic,exactActive,closesObserved,noBlank,first,last,sampleCount:samples.length,minTotal:Math.min(...samples.map(x=>x.total)),maxTotal:Math.max(...samples.map(x=>x.total)),uniqueBoxes:[...new Set(samples.map(x=>x.box))]});
  console.log(symbol,pass?'PASS':'FAIL',`box=${first.box}`,`total=${first.total}->${last.total}`,`source=${first.source}->${last.source}`);
}
await browser.close();
const report={schema:'renko-atr-stability-real-browser-v2-single-live-session',mode,viewport,url:root,pairs,pass:results.every(r=>r.pass)&&errors.length===0,errors,results,generatedAt:new Date().toISOString()};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
if(!report.pass){console.error(JSON.stringify(report,null,2));process.exit(1)}
console.log(`RENKO_ATR_STABILITY_${mode.toUpperCase()}_PASS ${results.length}/${results.length}`);
