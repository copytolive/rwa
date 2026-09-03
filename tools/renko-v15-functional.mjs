import { chromium } from 'playwright';
const BASE=process.env.RENKO_TEST_BASE||'http://127.0.0.1:8080/';
const browser=await chromium.launch({headless:true});
const fail=m=>{throw new Error(m)};
const near=(a,b,t=.02)=>Math.abs(Number(a)-Number(b))<=Math.max(t,Math.abs(Number(b))*1e-8);
async function openSymbol(base){
  const page=await browser.newPage({viewport:{width:1600,height:950}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${BASE}#research/renko/${base}`,{waitUntil:'domcontentloaded',timeout:45000});
  const h=await page.waitForSelector('iframe.rwa-research-legacy-frame',{timeout:30000}),f=await h.contentFrame();if(!f)fail(`${base}: iframe missing`);
  await f.waitForFunction(()=>window.RWARenkoV15?.version==='15.1.0'&&window.RWARenkoV15MethodProfiles?.version==='1.2.0',{timeout:70000});
  await f.waitForFunction(b=>window.RWARenkoV3?.state?.selected===`${b}USDT`&&window.RWARenkoV15?.state?.symbol===`${b}USDT`,base,{timeout:90000});
  await f.waitForFunction(()=>window.RWARenkoV15.state.ticks.length>0&&!window.RWARenkoV15.state.building,{timeout:90000});
  const state=await f.evaluate(()=>({v3:RWARenkoV3.state.selected,v15:RWARenkoV15.state.symbol,ticks:RWARenkoV15.state.ticks.length,bricks:RWARenkoV15.state.data.length,formation:RWARenkoV15.formationSource,confirmation:RWARenkoV15.confirmationRule,timeframe:RWARenkoV15.timeframeControl,history:RWARenkoV15.historySource,atrSizing:RWARenkoV15.atrSizing,profileVersion:RWARenkoV15MethodProfiles.version,switchContract:RWARenkoV15MethodProfiles.switchContract}));
  if(state.v3!==`${base}USDT`||state.v15!==`${base}USDT`)fail(`${base}: route mismatch ${JSON.stringify(state)}`);
  if(state.formation!=='trade-events-only'||state.confirmation!=='every-trade-immediate'||state.timeframe!==false||state.atrSizing!=='wilder-absolute-trade-move-no-timeframe')fail(`${base}: fully tick-native contract mismatch ${JSON.stringify(state)}`);
  if(state.profileVersion!=='1.2.0'||state.switchContract!=='latest-click-wins-retry-after-background-rebuild')fail(`${base}: method controller contract mismatch ${JSON.stringify(state)}`);
  return{page,frame:f,state,errors};
}
const uniform=async(f,label)=>{const a=await f.evaluate(()=>RWARenkoV15.uniformAudit());if(!a.ok)fail(`${label}: non-uniform bodies ${JSON.stringify(a)}`);console.log('UNIFORM BODY PASS',label,JSON.stringify(a));return a};
const signature=f=>f.evaluate(()=>JSON.stringify(RWARenkoV15.state.data.slice(-60).map(x=>[Number(x.open),Number(x.close),Number(x._box),Number(x._dir)])));
const activeMethod=f=>f.evaluate(()=>document.querySelector('[data-v15-profile].active')?.dataset.v15Profile||'');
try{
  for(const base of ['ETH','SOL','XRP']){const x=await openSymbol(base);console.log('SYMBOL TICK ROUTE PASS',base,JSON.stringify(x.state));await x.page.close()}
  const {page,frame:f,errors}=await openSymbol('BTC');

  const ui=await f.evaluate(()=>({height:document.querySelector('#v15BoxCard')?.getBoundingClientRect().height||999,hasResolution:!!document.querySelector('#v14Resolution,[id*=Resolution],select[name*=resolution]'),bodyText:document.body.innerText,mode:document.querySelector('#modePill')?.textContent||'',source:document.querySelector('#sourceText')?.textContent||''}));
  if(ui.height>110)fail(`BOX SIZE ASSIGNMENT METHOD too tall: ${ui.height}px`);
  if(ui.hasResolution||/\bRESOLUTION\b|1 minute|3 minutes|5 minutes|15 minutes|30 minutes|1 hour|4 hours|1 day/i.test(ui.bodyText))fail('Timeframe/resolution control still visible');
  if(!/TICK/.test(ui.mode)||!/no timeframe/i.test(ui.source))fail(`Tick-native UI labels missing ${JSON.stringify(ui)}`);

  // Traditional must win even while an older-history background rebuild is active.
  const trad=f.locator('#v15TraditionalBox');await trad.fill('37.5');await f.locator('#v15TraditionalWicks').uncheck();await f.locator('#v15TraditionalConfirm').selectOption('1');
  const sigAtr0=await signature(f);
  await f.evaluate(()=>{void RWARenkoV15.loadOlder(20,8)});
  await f.waitForTimeout(35);
  const t0=Date.now();await f.locator('[data-v15-apply="traditional"]').click();
  await f.waitForFunction(()=>window.RWARenkoV15.settings.method==='traditional'&&Math.abs(Number(window.RWARenkoV15.state.box)-37.5)<.011&&!window.RWARenkoV15.state.building&&document.querySelector('#v15BoxCard')?.dataset.lastApplied==='traditional',{timeout:90000});
  if(Date.now()-t0>15000)fail(`Traditional race apply too slow: ${Date.now()-t0}ms`);
  if(await activeMethod(f)!=='traditional')fail('Traditional engine switched but ACTIVE badge did not');
  const tradState=await f.evaluate(()=>({method:RWARenkoV15.settings.method,box:RWARenkoV15.state.box,wicks:RWARenkoV15.settings.wicks,confirm:RWARenkoV15.settings.confirmBricks,label:document.querySelector('#v11MethodLabel')?.textContent,contract:RWARenkoV15MethodProfiles.chartImpactContract}));
  if(tradState.method!=='traditional'||!near(tradState.box,37.5,.011)||tradState.wicks!==false||tradState.confirm!==1||!/TRADITIONAL/i.test(tradState.label)||tradState.contract!=='apply-rebuilds-entire-tick-renko-history')fail(`Traditional did not fully apply ${JSON.stringify(tradState)}`);
  await uniform(f,'TRADITIONAL 37.5');const sigTrad=await signature(f);if(sigTrad===sigAtr0)fail('Traditional Apply did not change Renko chart geometry');

  // Entry Confirm is independent: signal policy changes, brick geometry does not.
  await f.locator('#v15TraditionalConfirm').selectOption('2');await f.locator('[data-v15-apply="traditional"]').click();
  await f.waitForFunction(()=>Number(window.RWARenkoV15.settings.confirmBricks)===2&&!window.RWARenkoV15.state.building&&document.querySelector('#v15BoxCard')?.dataset.lastApplied==='traditional',{timeout:60000});
  const sigTradConfirm2=await signature(f);if(sigTradConfirm2!==sigTrad)fail('Entry Confirm incorrectly changed brick formation');

  // Percentage must become ACTIVE and rebuild the chart using its own saved profile.
  const pct=f.locator('#v15Percentage');await pct.fill('0,25');await f.locator('#v15PercentageWicks').check();await f.locator('#v15PercentageConfirm').selectOption('1');await f.locator('[data-v15-apply="percentage"]').click();
  await f.waitForFunction(()=>window.RWARenkoV15.settings.method==='percentage'&&Math.abs(Number(window.RWARenkoV15.settings.percentage)-.0025)<1e-12&&!window.RWARenkoV15.state.building&&document.querySelector('#v15BoxCard')?.dataset.lastApplied==='percentage',{timeout:90000});
  if(await activeMethod(f)!=='percentage')fail('Percentage ACTIVE badge did not move');
  const pctState=await f.evaluate(()=>({box:RWARenkoV15.state.box,wicks:RWARenkoV15.settings.wicks,confirm:RWARenkoV15.settings.confirmBricks,verified:RWARenkoV15MethodProfiles.verify('percentage')}));
  if(!pctState.verified||pctState.wicks!==true||pctState.confirm!==1||!(pctState.box>0))fail(`Percentage did not fully apply ${JSON.stringify(pctState)}`);
  await uniform(f,'PERCENTAGE 0.25%');const sigPct=await signature(f);if(sigPct===sigTradConfirm2)fail('Percentage Apply did not change Renko chart geometry');

  // ATR must also switch back cleanly and use its own saved length/wicks/confirm profile.
  const atr=f.locator('#v15AtrLength');await atr.fill('21');await f.locator('#v15AtrWicks').check();await f.locator('#v15AtrConfirm').selectOption('2');await f.locator('[data-v15-apply="atr"]').click();
  await f.waitForFunction(()=>window.RWARenkoV15.settings.method==='atr'&&Number(window.RWARenkoV15.settings.atrLength)===21&&!window.RWARenkoV15.state.building&&document.querySelector('#v15BoxCard')?.dataset.lastApplied==='atr',{timeout:90000});
  if(await activeMethod(f)!=='atr')fail('ATR ACTIVE badge did not move back');
  const atrState=await f.evaluate(()=>({atr:RWARenkoV15.state.atrValue,sizing:RWARenkoV15.atrSizing,box:RWARenkoV15.state.box,wicks:RWARenkoV15.settings.wicks,confirm:RWARenkoV15.settings.confirmBricks,verified:RWARenkoV15MethodProfiles.verify('atr')}));
  if(!atrState.verified||atrState.sizing!=='wilder-absolute-trade-move-no-timeframe'||!(atrState.atr>0)||atrState.wicks!==true||atrState.confirm!==2)fail(`ATR did not fully apply ${JSON.stringify(atrState)}`);
  await uniform(f,'TICK ATR 21');const sigAtr=await signature(f);if(sigAtr===sigPct)fail('ATR Apply did not change Renko chart geometry');

  // Rapid conflicting clicks: latest click must win, none may be silently dropped.
  await trad.fill('25');await f.locator('[data-v15-apply="percentage"]').click();await f.waitForTimeout(15);await f.locator('[data-v15-apply="traditional"]').click();
  await f.waitForFunction(()=>window.RWARenkoV15.settings.method==='traditional'&&Math.abs(Number(window.RWARenkoV15.state.box)-25)<.011&&!window.RWARenkoV15.state.building&&document.querySelector('#v15BoxCard')?.dataset.lastApplied==='traditional',{timeout:90000});
  if(await activeMethod(f)!=='traditional')fail('Latest-click-wins failed: Traditional did not remain ACTIVE');
  const rapid=await f.evaluate(()=>({method:RWARenkoV15.settings.method,box:RWARenkoV15.state.box,seq:document.querySelector('#v15BoxCard')?.dataset.applySeq,controller:RWARenkoV15MethodProfiles.switchContract}));
  if(rapid.method!=='traditional'||!near(rapid.box,25,.011)||!rapid.seq)fail(`Rapid method switch failed ${JSON.stringify(rapid)}`);await uniform(f,'LATEST CLICK TRADITIONAL 25');

  await f.waitForFunction(()=>!window.RWARenkoV15.state.loading&&!window.RWARenkoV15.state.building,{timeout:90000});const before=await f.evaluate(()=>({oldest:Number(RWARenkoV15.state.oldestAggId),ticks:RWARenkoV15.state.ticks.length,bricks:RWARenkoV15.state.data.length}));
  await f.evaluate(()=>RWARenkoV15.loadOlder(20,8));await f.waitForFunction(()=>!window.RWARenkoV15.state.loading&&!window.RWARenkoV15.state.building,{timeout:90000});const after=await f.evaluate(()=>({oldest:Number(RWARenkoV15.state.oldestAggId),ticks:RWARenkoV15.state.ticks.length,bricks:RWARenkoV15.state.data.length,diag:RWARenkoV15.diagnostics()}));
  if(!(after.oldest<before.oldest)||!(after.ticks>before.ticks))fail(`Tick history did not extend ${JSON.stringify({before,after})}`);if(after.diag.droppedLiveTrades!==0)fail(`Live tick loss detected ${JSON.stringify(after.diag)}`);if(!after.diag.audit?.ok)fail(`Final uniform audit failed ${JSON.stringify(after.diag.audit)}`);
  const fatal=errors.filter(x=>/RENKO V15|renko-v15/i.test(x));if(fatal.length)fail(fatal.slice(0,5).join(' | '));
  console.log('RENKO V15.2 METHOD + CHART FUNCTIONAL PASS',JSON.stringify({tradState,pctState,atrState,rapid,before,after,uiHeight:ui.height}));await page.close();
} finally {await browser.close()}
