import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE=(process.env.RWA_TEST_URL||'https://copytolive.github.io/rwa').replace(/\/$/,'');
const OUT=path.resolve('artifacts/renko-atr-screenshot-matrix');
const VALUES=[14,140,500,6000,10000];
await fs.mkdir(OUT,{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e?.message||e)));
page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|WebSocket connection|Invalid language tag: en-US@posix/i.test(m.text()))errors.push(m.text())});

const url=`${BASE}/renko/?symbol=SOL&atrMatrix=1&ts=${Date.now()}`;
await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>window.RWARenkoTV?.version==='1.0.0'&&window.RWARenkoATRParity?.version==='3.0.0'&&window.RWARenkoTV?.state?.closedBars?.length>=100&&window.RWARenkoTV?.state?.box>0&&document.querySelector('#tvLoadState')?.textContent?.includes('LIVE'),null,{timeout:60000});

const results=[];
for(const length of VALUES){
  const started=Date.now();
  await page.locator('#atrLength').fill(String(length));
  await page.locator('[data-apply-method="atr"]').click();
  await page.waitForFunction(n=>{
    const tv=window.RWARenkoTV;
    return tv?.settings?.method==='atr'&&tv?.settings?.atrLength===n&&tv?.state?.atrLastApply?.length===n&&document.documentElement.dataset.atrAppliedLength===String(n)&&document.documentElement.dataset.atrChartRebuilt==='true'&&tv?.state?.box>0&&tv?.state?.confirmed?.length>0&&(n<1000||tv?.state?.atrHistorySatisfied===true);
  },length,{timeout:length>=6000?180000:60000});
  await page.waitForTimeout(500);
  const metric=await page.evaluate(n=>({
    length:n,
    method:RWARenkoTV.settings.method,
    atrLength:RWARenkoTV.settings.atrLength,
    atr:RWARenkoTV.state.atr,
    box:RWARenkoTV.state.box,
    confirmed:RWARenkoTV.state.confirmed.length,
    sourceBars:RWARenkoTV.state.closedBars.length,
    historySatisfied:RWARenkoTV.state.atrHistorySatisfied,
    coverageText:document.querySelector('#tvCoverage')?.textContent||'',
    loadText:document.querySelector('#tvLoadState')?.textContent||'',
    badgeText:document.querySelector('.method[data-method="atr"] .method-title span')?.textContent||'',
    appliedLength:document.documentElement.dataset.atrAppliedLength,
    chartRebuilt:document.documentElement.dataset.atrChartRebuilt,
    chartChanged:document.documentElement.dataset.atrChartChanged,
  }),length);
  metric.elapsedMs=Date.now()-started;
  results.push(metric);
  await page.screenshot({path:path.join(OUT,`atr-${length}.png`),fullPage:false});
}

await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({url,values:VALUES,results,errors},null,2));
console.log(JSON.stringify({values:VALUES,results,errors},null,2));
if(errors.length)console.error('Browser errors:',errors);
await context.close();
await browser.close();
