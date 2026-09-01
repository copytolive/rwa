import { chromium } from 'playwright';

const base=(process.env.RWA_TEST_URL||'http://127.0.0.1:8080/rwa').replace(/\/$/,'');
const browser=await chromium.launch({headless:true});
const results=[];

async function run(viewport,name){
  const page=await browser.newPage({viewport});
  const pageErrors=[],consoleErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  const r=await page.goto(`${base}/renko/?symbol=SOL&historyPanelGate=1&ts=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});
  if(!r||r.status()<200||r.status()>=400)throw Error(`${name} HTTP ${r?.status()}`);
  await page.waitForFunction(()=>window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoTotalHistoryPanel?.version==='1.0.0-launch-visible'&&document.getElementById('totalHistoryPanel'),null,{timeout:90000});
  await page.waitForFunction(()=>document.documentElement.dataset.renkoHistoryPanelReady==='true'&&document.documentElement.dataset.renkoHistoryPanelProvider==='Binance Spot',null,{timeout:45000});
  const sol=await page.evaluate(()=>({symbol:document.getElementById('historySymbol')?.textContent,provider:document.getElementById('historyProvider')?.textContent,available:document.getElementById('historyAvailable')?.textContent,loaded:document.getElementById('historyLoaded')?.textContent,status:document.getElementById('historyStatus')?.textContent,earliest:Number(document.documentElement.dataset.renkoHistoryPanelEarliestMs),latest:Number(document.documentElement.dataset.renkoHistoryPanelLatestMs)}));
  if(!/SOLUSDT.*1s/.test(sol.symbol||'')||sol.provider!=='Binance Spot'||!(sol.earliest>0)||!(sol.latest>=sol.earliest)||!/FULL HISTORY AVAILABLE/.test(sol.status||'')||!/loaded/.test(sol.loaded||''))throw Error(`${name} SOL panel invalid ${JSON.stringify(sol)}`);

  await page.evaluate(()=>window.RWARenkoTotalHistory.jumpOrigin('XAUUSD'));
  await page.waitForFunction(()=>document.documentElement.dataset.renkoHistoryPanelProvider==='Dukascopy · XAU-USD'&&document.documentElement.dataset.renkoHistoryPanelReady==='true',null,{timeout:45000});
  const gold=await page.evaluate(()=>({symbol:document.getElementById('historySymbol')?.textContent,provider:document.getElementById('historyProvider')?.textContent,available:document.getElementById('historyAvailable')?.textContent,status:document.getElementById('historyStatus')?.textContent,earliest:Number(document.documentElement.dataset.renkoHistoryPanelEarliestMs),synthetic:document.documentElement.dataset.renkoHistoryPanelSynthetic}));
  const expected=Date.UTC(2003,4,5,0,1,3,421);
  if(!/GOLD.*1s/.test(gold.symbol||'')||gold.provider!=='Dukascopy · XAU-USD'||Math.abs(gold.earliest-expected)>3600000||!/FULL HISTORY AVAILABLE/.test(gold.status||'')||gold.synthetic!=='NO')throw Error(`${name} GOLD panel invalid ${JSON.stringify(gold)}`);

  await page.evaluate(()=>{RWARenkoTV.state.symbol='XAUTUSDT';RWARenkoTotalHistoryPanel.refresh()});
  await page.waitForFunction(()=>document.documentElement.dataset.renkoHistoryPanelProvider==='OKX Spot · PROVIDER NATIVE'&&document.documentElement.dataset.renkoHistoryPanelReady==='true'&&document.documentElement.dataset.renkoHistoryPanelAvailableTotal==='1005000',null,{timeout:30000});
  const xaut=await page.evaluate(()=>({symbol:document.getElementById('historySymbol')?.textContent,provider:document.getElementById('historyProvider')?.textContent,available:document.getElementById('historyAvailable')?.textContent,loaded:document.getElementById('historyLoaded')?.textContent,status:document.getElementById('historyStatus')?.textContent,total:Number(document.documentElement.dataset.renkoHistoryPanelAvailableTotal),synthetic:document.documentElement.dataset.renkoHistoryPanelSynthetic}));
  if(xaut.total!==1005000||xaut.synthetic!=='NO'||!/XAUT-USDT.*1s/.test(xaut.symbol||'')||xaut.provider!=='OKX Spot · PROVIDER NATIVE'||!/FULL HISTORY AVAILABLE.*NATIVE 1s.*SYNTHETIC NO/.test(xaut.status||''))throw Error(`${name} XAUT panel invalid ${JSON.stringify(xaut)}`);

  const rect=await page.locator('#totalHistoryPanel').boundingBox();if(!rect||rect.width<200||rect.height<25)throw Error(`${name} panel not visibly rendered`);
  const criticalConsole=consoleErrors.filter(x=>!/favicon|WebSocket connection .* failed|ERR_FAILED|Failed to load resource|Ping received after close/i.test(x));
  if(pageErrors.length||criticalConsole.length)throw Error(`${name} browser errors ${JSON.stringify({pageErrors,criticalConsole})}`);
  results.push({name,sol,gold,xaut,rect,status:'PASS'});await page.close();
}

try{
  await run({width:1900,height:1000},'desktop');
  await run({width:430,height:932},'mobile');
  console.log('RENKO_TOTAL_HISTORY_PANEL_PASS '+JSON.stringify(results));
} finally {
  await browser.close();
}
