import { chromium } from 'playwright';
const BASE=process.env.RENKO_TEST_BASE||'http://127.0.0.1:8080/';
const browser=await chromium.launch({headless:true});
const fail=m=>{throw new Error(m)};
async function openSymbol(base){
  const page=await browser.newPage({viewport:{width:1600,height:950}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${BASE}#research/renko/${base}`,{waitUntil:'domcontentloaded',timeout:45000});
  const h=await page.waitForSelector('iframe.rwa-research-legacy-frame',{timeout:30000}),f=await h.contentFrame();if(!f)fail(`${base}: iframe missing`);
  await f.waitForFunction(()=>window.RWARenkoV15?.version==='15.0.0'&&window.RWARenkoV15MethodProfiles?.version==='1.0.0',{timeout:70000});
  await f.waitForFunction(b=>window.RWARenkoV3?.state?.selected===`${b}USDT`&&window.RWARenkoV15?.state?.symbol===`${b}USDT`,base,{timeout:90000});
  await f.waitForFunction(()=>window.RWARenkoV15.state.ticks.length>0&&!window.RWARenkoV15.state.building,{timeout:90000});
  const state=await f.evaluate(()=>({v3:RWARenkoV3.state.selected,v15:RWARenkoV15.state.symbol,ticks:RWARenkoV15.state.ticks.length,bricks:RWARenkoV15.state.data.length,formation:RWARenkoV15.formationSource,confirmation:RWARenkoV15.confirmationRule,timeframe:RWARenkoV15.timeframeControl,history:RWARenkoV15.historySource,profile:document.querySelector('[data-v15-profile].active .v15-state')?.textContent||''}));
  if(state.v3!==`${base}USDT`||state.v15!==`${base}USDT`)fail(`${base}: route mismatch ${JSON.stringify(state)}`);
  if(state.formation!=='trade-events-only'||state.confirmation!=='every-trade-immediate'||state.timeframe!==false)fail(`${base}: tick-native contract mismatch ${JSON.stringify(state)}`);
  return{page,frame:f,state,errors};
}
const uniform=async(f,label)=>{const a=await f.evaluate(()=>RWARenkoV15.uniformAudit());if(!a.ok)fail(`${label}: non-uniform bodies ${JSON.stringify(a)}`);console.log('UNIFORM BODY PASS',label,JSON.stringify(a));return a};
try{
  for(const base of ['ETH','SOL','XRP']){const x=await openSymbol(base);console.log('SYMBOL TICK ROUTE PASS',base,JSON.stringify(x.state));await x.page.close()}
  const {page,frame:f,errors}=await openSymbol('BTC');

  const ui=await f.evaluate(()=>({height:document.querySelector('#v15BoxCard')?.getBoundingClientRect().height||999,hasResolution:!!document.querySelector('#v14Resolution,[id*=Resolution],select[name*=resolution]'),bodyText:document.body.innerText,mode:document.querySelector('#modePill')?.textContent||'',source:document.querySelector('#sourceText')?.textContent||''}));
  if(ui.height>130)fail(`BOX SIZE ASSIGNMENT METHOD too tall: ${ui.height}px`);
  if(ui.hasResolution||/\bRESOLUTION\b|1 minute|3 minutes|5 minutes|15 minutes|30 minutes|1 hour|4 hours|1 day/i.test(ui.bodyText))fail('Timeframe/resolution control still visible in RENKO V15');
  if(!/TICK/.test(ui.mode)||!/no timeframe/i.test(ui.source))fail(`Tick-native UI labels missing ${JSON.stringify(ui)}`);
  console.log('COMPACT TIMEFRAME-FREE UI PASS',JSON.stringify({height:ui.height,mode:ui.mode,source:ui.source}));

  const trad=f.locator('#v15TraditionalBox');await trad.fill('37.5');await f.waitForTimeout(900);if(await trad.inputValue()!=='37.5')fail('Traditional draft rewrote itself');
  await f.locator('#v15TraditionalWicks').uncheck();await f.locator('#v15TraditionalConfirm').selectOption('1');const t0=Date.now();await f.locator('[data-v15-apply="traditional"]').click();
  await f.waitForFunction(()=>window.RWARenkoV15.settings.method==='traditional'&&Math.abs(Number(window.RWARenkoV15.state.box)-37.5)<.011&&!window.RWARenkoV15.state.building,{timeout:60000});
  if(Date.now()-t0>6000)fail(`Traditional setup apply too slow: ${Date.now()-t0}ms`);await uniform(f,'TRADITIONAL 37.5');
  const formationA=await f.evaluate(()=>RWARenkoV15.state.data.slice(-80).map(x=>[x.open,x.close,x._dir,x._box]));
  await f.locator('#v15TraditionalConfirm').selectOption('2');await f.locator('[data-v15-apply="traditional"]').click();await f.waitForFunction(()=>Number(window.RWARenkoV15.settings.confirmBricks)===2&&!window.RWARenkoV15.state.building,{timeout:60000});
  const formationB=await f.evaluate(()=>RWARenkoV15.state.data.slice(-80).map(x=>[x.open,x.close,x._dir,x._box]));if(JSON.stringify(formationA)!==JSON.stringify(formationB))fail('Entry Confirm changed tick formation');

  const pct=f.locator('#v15Percentage');await pct.fill('0,25');await f.waitForTimeout(800);if(await pct.inputValue()!=='0,25')fail('Percentage draft rewrote itself');await f.locator('[data-v15-apply="percentage"]').click();
  await f.waitForFunction(()=>window.RWARenkoV15.settings.method==='percentage'&&Math.abs(Number(window.RWARenkoV15.settings.percentage)-.0025)<1e-12&&!window.RWARenkoV15.state.building,{timeout:60000});await uniform(f,'PERCENTAGE LTP');

  const atr=f.locator('#v15AtrLength');await atr.fill('21');await f.waitForTimeout(800);if(await atr.inputValue()!=='21')fail('ATR draft rewrote itself');await f.locator('[data-v15-apply="atr"]').click();
  await f.waitForFunction(()=>window.RWARenkoV15.settings.method==='atr'&&Number(window.RWARenkoV15.settings.atrLength)===21&&!window.RWARenkoV15.state.building,{timeout:60000});const aa=await uniform(f,'ATR SNAPSHOT');if(!(aa.box>0))fail('ATR active box missing');

  await f.waitForFunction(()=>!window.RWARenkoV15.state.loading&&!window.RWARenkoV15.state.building,{timeout:90000});const before=await f.evaluate(()=>({oldest:Number(RWARenkoV15.state.oldestAggId),ticks:RWARenkoV15.state.ticks.length,bricks:RWARenkoV15.state.data.length}));
  await f.evaluate(()=>RWARenkoV15.loadOlder(20,8));await f.waitForFunction(()=>!window.RWARenkoV15.state.loading&&!window.RWARenkoV15.state.building,{timeout:90000});const after=await f.evaluate(()=>({oldest:Number(RWARenkoV15.state.oldestAggId),ticks:RWARenkoV15.state.ticks.length,bricks:RWARenkoV15.state.data.length,diag:RWARenkoV15.diagnostics()}));
  if(!(after.oldest<before.oldest)||!(after.ticks>before.ticks))fail(`Tick history did not extend ${JSON.stringify({before,after})}`);if(after.diag.droppedLiveTrades!==0)fail(`Live tick loss detected ${JSON.stringify(after.diag)}`);if(!after.diag.audit?.ok)fail(`Final uniform audit failed ${JSON.stringify(after.diag.audit)}`);
  const fatal=errors.filter(x=>/RENKO V15|renko-v15/i.test(x));if(fatal.length)fail(fatal.slice(0,5).join(' | '));
  console.log('RENKO V15 FUNCTIONAL PASS',JSON.stringify({before,after,uiHeight:ui.height}));await page.close();
} finally {await browser.close()}
