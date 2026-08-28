import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base=(process.env.RWA_TEST_URL||'http://127.0.0.1:8080/rwa').replace(/\/$/,'');
const out=process.env.RENKO_XAUT_OUT||'artifacts/renko-xaut-provider';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function run(label,viewport){
  const page=await browser.newPage({viewport});
  const errors=[],consoleErrors=[],failed=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText||''}));
  const url=`${base}/renko/?symbol=XAUT&xautProviderProof=1&ts=${Date.now()}`;
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.RWARenkoTV?.state?.symbol==='XAUTUSDT'&&window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoTV?.state?.closedBars?.length>100&&Number(window.RWARenkoTV?.state?.lastPrice)>0&&document.documentElement.dataset.marketProvider==='gate-spot',{timeout:45000});
  const initial=await page.evaluate(()=>({
    symbol:window.RWARenkoTV.state.symbol,status:window.RWARenkoTV.state.status,interval:window.RWARenkoTV.settings.interval,
    source:window.RWARenkoTV.settings.source,bars:window.RWARenkoTV.state.closedBars.length,last:window.RWARenkoTV.state.lastPrice,
    tick:window.RWARenkoTV.state.tickSize,provider:window.RWARenkoXAUTProvider?.provider,providerStats:{...window.RWARenkoXAUTProvider?.stats},
    pair:document.getElementById('pairName')?.textContent,venue:document.querySelector('.pair-title span')?.textContent,
    feed:document.querySelector('#feedPill b')?.textContent,load:document.getElementById('tvLoadState')?.textContent
  }));
  async function selectInterval(interval){
    await page.selectOption('#intervalSelect',interval);
    await page.waitForFunction(i=>window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoTV?.settings?.interval===i&&window.RWARenkoTV?.state?.closedBars?.length>50,interval,{timeout:45000});
    await sleep(interval==='1s'?2500:700);
    return page.evaluate(()=>({interval:window.RWARenkoTV.settings.interval,bars:window.RWARenkoTV.state.closedBars.length,last:window.RWARenkoTV.state.lastPrice,status:window.RWARenkoTV.state.status,feed:document.querySelector('#feedPill b')?.textContent,providerStats:{...window.RWARenkoXAUTProvider?.stats}}));
  }
  const three=await selectInterval('3m');
  const oneSecond=await selectInterval('1s');
  const oneMinute=await selectInterval('1m');
  await page.screenshot({path:path.join(out,`${label}.png`),fullPage:true});
  const relevantFailures=failed.filter(x=>/XAUT|gateio|binance/i.test(x.url));
  const pass=response?.ok()&&initial.provider==='Gate Spot'&&initial.tick>0&&initial.last>0&&initial.bars>100&&three.status==='live'&&three.bars>50&&oneSecond.status==='live'&&oneSecond.bars>50&&oneMinute.status==='live'&&oneMinute.bars>50&&!errors.length;
  const result={label,viewport,url,httpStatus:response?.status(),initial,three,oneSecond,oneMinute,errors,consoleErrors,relevantFailures,pass};
  results.push(result);
  await page.close();
}

try{
  await run('desktop',{width:1900,height:1000});
  await run('mobile',{width:390,height:844});
}finally{await browser.close()}
const report={schema:'renko-xaut-gate-live-provider-v1',generatedAt:new Date().toISOString(),base,status:results.every(r=>r.pass)?'PASS':'FAIL',results};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_XAUT_PROVIDER_REPORT '+JSON.stringify(report));
if(report.status!=='PASS')process.exit(2);
