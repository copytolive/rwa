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
  await page.addInitScript(()=>{try{localStorage.setItem('rwa_renko_tradingview_settings_v1',JSON.stringify({interval:'1m',source:'close',method:'atr',atrLength:14}))}catch{}});
  const url=`${base}/renko/?symbol=XAUT&fixed1sProviderProof=1&ts=${Date.now()}`;
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.RWARenkoTV?.state?.symbol==='XAUTUSDT'&&window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoTV?.settings?.interval==='1s'&&window.RWARenkoTV?.state?.closedBars?.length>100&&Number(window.RWARenkoTV?.state?.lastPrice)>0&&document.documentElement.dataset.marketProvider==='okx-spot',null,{timeout:60000});
  await sleep(1200);
  const initial=await page.evaluate(()=>({
    symbol:window.RWARenkoTV.state.symbol,status:window.RWARenkoTV.state.status,interval:window.RWARenkoTV.settings.interval,
    fixedInterval:window.RENKO_FIXED_INTERVAL,source:window.RWARenkoTV.settings.source,bars:window.RWARenkoTV.state.closedBars.length,
    last:window.RWARenkoTV.state.lastPrice,tick:window.RWARenkoTV.state.tickSize,provider:window.RWARenkoXAUTProvider?.provider,
    providerFixedInterval:window.RWARenkoXAUTProvider?.fixedInterval,providerIntervals:[...(window.RWARenkoXAUTProvider?.intervals||[])],
    providerStats:{...window.RWARenkoXAUTProvider?.stats},intervalSelectorExists:!!document.querySelector('#intervalSelect'),
    intervalSelectCount:document.querySelectorAll('select#intervalSelect').length,pair:document.getElementById('pairName')?.textContent,
    venue:document.querySelector('.pair-title span')?.textContent,feed:document.querySelector('#feedPill b')?.textContent,
    currentInterval:document.getElementById('currentInterval')?.textContent,mode:document.getElementById('modePill')?.textContent,
    persisted:localStorage.getItem('rwa_renko_tradingview_settings_v1')
  }));
  const mutationLock=await page.evaluate(()=>{window.RWARenkoTV.settings.interval='1d';return window.RWARenkoTV.settings.interval});
  await page.selectOption('#sourceSelect','ohlc');
  await sleep(500);
  const ohlc=await page.evaluate(()=>({source:window.RWARenkoTV.settings.source,interval:window.RWARenkoTV.settings.interval,box:window.RWARenkoTV.state.box,confirmed:window.RWARenkoTV.state.confirmed.length}));
  await page.selectOption('#sourceSelect','close');
  await page.fill('#traditionalBox','5');await page.click('[data-apply-method="traditional"]');await sleep(250);
  const traditional=await page.evaluate(()=>({method:window.RWARenkoTV.settings.method,interval:window.RWARenkoTV.settings.interval,box:window.RWARenkoTV.state.box}));
  await page.fill('#percentageValue','1');await page.click('[data-apply-method="percentage"]');await sleep(250);
  const percentage=await page.evaluate(()=>({method:window.RWARenkoTV.settings.method,interval:window.RWARenkoTV.settings.interval,box:window.RWARenkoTV.state.box}));
  const beforeRevision=await page.evaluate(()=>Number(window.RWARenkoTV.state.closedBars.at(-1)?.closeTime)||0);
  await page.waitForFunction(r=>Number(window.RWARenkoTV?.state?.closedBars?.at(-1)?.closeTime)>r,beforeRevision,{timeout:15000});
  const afterClose=await page.evaluate(()=>({interval:window.RWARenkoTV.settings.interval,status:window.RWARenkoTV.state.status,lastEventAt:window.RWARenkoTV.state.lastEventAt,bars:window.RWARenkoTV.state.closedBars.length}));
  await page.screenshot({path:path.join(out,`${label}.png`),fullPage:true});
  const relevantFailures=failed.filter(x=>/XAUT|okx|binance/i.test(x.url));
  const pass=!!response?.ok()&&initial.provider==='OKX Spot'&&initial.providerFixedInterval==='1s'&&initial.providerIntervals.join(',')==='1s'&&initial.interval==='1s'&&initial.fixedInterval==='1s'&&!initial.intervalSelectorExists&&initial.intervalSelectCount===0&&initial.tick>0&&initial.last>0&&initial.bars>100&&mutationLock==='1s'&&ohlc.source==='ohlc'&&ohlc.interval==='1s'&&traditional.method==='traditional'&&traditional.interval==='1s'&&percentage.method==='percentage'&&percentage.interval==='1s'&&afterClose.interval==='1s'&&afterClose.status==='live'&&!errors.length;
  results.push({label,viewport,url,httpStatus:response?.status(),initial,mutationLock,ohlc,traditional,percentage,afterClose,errors,consoleErrors,relevantFailures:relevantFailures.slice(0,50),pass});
  await page.close();
}

try{await run('desktop',{width:1900,height:1000});await run('mobile',{width:390,height:844})}finally{await browser.close()}
const report={schema:'renko-xaut-okx-fixed-1s-live-provider-v1',generatedAt:new Date().toISOString(),base,status:results.every(r=>r.pass)?'PASS':'FAIL',contract:'No timeframe selector exists. Runtime interval is permanently fixed to 1s across persisted stale settings, direct mutation, source changes, method changes and later live closes.',results};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_XAUT_PROVIDER_REPORT '+JSON.stringify(report));
if(report.status!=='PASS')process.exit(2);
