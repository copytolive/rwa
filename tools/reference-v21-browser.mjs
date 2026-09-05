import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.RWA_UI_URL||'http://127.0.0.1:4173/rwa/';
const proof=process.env.RWA_UI_PROOF_DIR||'proof/reference-v21';
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
const failures=[];
const snapshots={};
const fail=(message,detail=null)=>failures.push({message,detail});

async function certify(width,height,name){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'});
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:50000});
  await page.waitForFunction(()=>window.RWAReferenceParityV21?.version==='2.1.0',{timeout:50000});
  await page.waitForFunction(()=>window.RWAReferenceParityV21Visual?.version==='1.0.1'&&window.RWAReferenceParityV21Visual?.applied===true,{timeout:50000});
  await page.waitForFunction(()=>window.RWAReferenceParityV21Seal?.version==='1.0.0'&&window.RWAReferenceParityV21Seal?.applied===true,{timeout:50000});
  await page.waitForFunction(()=>{const a=window.RWAReferenceParityV21?.audit?.();return a?.chartState==='live'&&a?.bars>=30&&a?.bookBids>=5&&a?.bookAsks>=5},{timeout:45000});
  await page.waitForFunction(()=>{const s=window.RWAReferenceParityV21Seal?.audit?.();return s?.applied===true&&s?.overlay===false&&s?.indicatorHidden===true&&s?.lineHidden===true&&s?.canvasZ>=108},{timeout:10000});
  const a=await page.evaluate(()=>{
    const audit=window.RWAReferenceParityV21.audit();
    const seal=window.RWAReferenceParityV21Seal.audit();
    const c=document.querySelector('#rwaV21Chart');const r=c?.getBoundingClientRect();
    const ind=document.querySelector('#rwaRefIndicatorOverlay');const line=document.querySelector('#rwaRefLineChart');
    return {audit,seal,visual:{version:window.RWAReferenceParityV21Visual?.version||'',applied:window.RWAReferenceParityV21Visual?.applied===true,indicatorHidden:ind?.hidden===true,lineHidden:line?.hidden===true},canvas:r?{x:r.x,y:r.y,width:r.width,height:r.height,display:getComputedStyle(c).display,zIndex:Number.parseInt(getComputedStyle(c).zIndex,10)||0}:null,mode:document.body.dataset.v5MobileMode||'',overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
  });
  snapshots[name]=a;
  if(a.audit.version!=='2.1.0')fail(name+' wrong V21 version',a.audit.version);
  if(a.audit.chartState!=='live'||a.audit.bars<30)fail(name+' real candlestick history not live',a.audit);
  if(a.audit.bookBids<5||a.audit.bookAsks<5)fail(name+' live order book not populated',a.audit);
  if(a.audit.mainnetReady!==false)fail(name+' mainnet must remain fail-closed',a.audit.mainnetReady);
  if(!a.visual.applied||!a.visual.indicatorHidden||!a.visual.lineHidden)fail(name+' clean-candle default not applied',a.visual);
  if(!a.seal.applied||a.seal.overlay||a.seal.canvasZ<108||a.seal.mode!=='clean-candles')fail(name+' sealed clean-candle layering not applied',a.seal);
  if(!a.canvas||a.canvas.display==='none'||a.canvas.width<300||a.canvas.height<(width<=680?250:300)||a.canvas.zIndex<108)fail(name+' V21 chart canvas geometry/layer invalid',a.canvas);
  if(a.overflow>2)fail(name+' horizontal overflow',a.overflow);
  await page.screenshot({path:`${proof}/${name}.png`,fullPage:false});

  if(width>680){
    const style=page.locator('[data-ref-chart-style]');
    if(await style.count()){
      await style.click();
      try{await page.waitForFunction(()=>{const s=window.RWAReferenceParityV21Seal?.audit?.();return s?.lineHidden===false&&s?.overlay===true&&s?.canvasZ<100},{timeout:5000})}catch{fail(name+' line-chart interaction did not lower sealed canvas',await page.evaluate(()=>window.RWAReferenceParityV21Seal?.audit?.()))}
      await style.click();
      try{await page.waitForFunction(()=>{const s=window.RWAReferenceParityV21Seal?.audit?.();return s?.lineHidden===true&&s?.overlay===false&&s?.canvasZ>=108},{timeout:5000})}catch{fail(name+' candle-chart restore did not reseal canvas',await page.evaluate(()=>window.RWAReferenceParityV21Seal?.audit?.()))}
    }else fail(name+' chart-style control missing');

    const indicators=page.locator('[data-final-indicators]');
    if(await indicators.count()){
      await indicators.click();
      const sma=page.locator('.rwa-ref-indicator-menu [data-final-indicator-set="sma20"]');
      if(await sma.count())await sma.click();else fail(name+' SMA indicator menu action missing');
      try{await page.waitForFunction(()=>{const s=window.RWAReferenceParityV21Seal?.audit?.();return s?.indicatorHidden===false&&s?.overlay===true&&s?.canvasZ<100},{timeout:5000})}catch{fail(name+' indicator interaction did not lower sealed canvas',await page.evaluate(()=>window.RWAReferenceParityV21Seal?.audit?.()))}
      await indicators.click();
      const off=page.locator('.rwa-ref-indicator-menu [data-final-indicator-set="none"]');
      if(await off.count())await off.click();else fail(name+' indicator-off menu action missing');
      try{await page.waitForFunction(()=>{const s=window.RWAReferenceParityV21Seal?.audit?.();return s?.indicatorHidden===true&&s?.overlay===false&&s?.canvasZ>=108},{timeout:5000})}catch{fail(name+' indicator-off restore did not reseal canvas',await page.evaluate(()=>window.RWAReferenceParityV21Seal?.audit?.()))}
    }else fail(name+' visible Indicators control missing');
  }
  if(width<=680){
    const tabs=await page.locator('.rwa-v5-mobile-worktabs [data-v5-mobile-mode]').evaluateAll(xs=>xs.map(x=>x.dataset.v5MobileMode));
    if(JSON.stringify(tabs)!==JSON.stringify(['chart','book','trade','feed']))fail(name+' mobile upper tabs mismatch',tabs);
    const bottom=await page.locator('.mobile-tabs [data-v5-mobile-nav]').count();
    if(bottom!==5)fail(name+' mobile bottom nav mismatch',bottom);
  }
  if(errors.length)fail(name+' page errors',errors);
  await ctx.close();
}

try{
  await certify(1672,941,'reference-v21-desktop');
  await certify(390,844,'reference-v21-mobile-390');
  await certify(430,932,'reference-v21-mobile-430');
}catch(e){fail('unexpected failure',String(e?.stack||e))}
await browser.close();
const out={ok:failures.length===0,contract:'rwa-reference-parity-v21-real-data-clean-candles-sealed',base,failures,snapshots};
await writeFile(`${proof}/reference-v21-result.json`,JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
if(!out.ok)process.exit(1);
