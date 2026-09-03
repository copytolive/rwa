import { chromium } from 'playwright';
const BASE=process.env.RENKO_TEST_BASE||'http://127.0.0.1:8080/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:950}});
const fatal=[];
page.on('pageerror',e=>fatal.push(String(e)));
const near=(a,b,t=.02)=>Math.abs(Number(a)-Number(b))<=Math.max(t,Math.abs(Number(b))*1e-8);
const fail=m=>{throw new Error(m)};
try{
  await page.goto(`${BASE}#research/renko/BTC`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(1800);
  const handle=await page.waitForSelector('iframe.rwa-research-legacy-frame',{timeout:30000});
  const frame=await handle.contentFrame();
  if(!frame)fail('RENKO iframe missing');
  await frame.waitForFunction(()=>window.RWARenkoV13?.version==='13.0.0'&&window.RWARenkoV13MethodProfiles?.version==='1.0.0',{timeout:60000});
  await frame.waitForFunction(()=>window.RWARenkoV13.state.symbol==='BTCUSDT'&&window.RWARenkoV13.state.data.length>0&&!window.RWARenkoV13.state.building,{timeout:90000});
  await page.waitForTimeout(1200);
  if(!(await handle.evaluate(el=>el.isConnected)))fail('Parent shell replaced RENKO iframe after startup');
  if(await page.locator('iframe.rwa-research-legacy-frame').count()!==1)fail('RENKO iframe duplicated');

  const trad=frame.locator('#v13TraditionalBox');
  await trad.fill('37.5');
  await frame.waitForTimeout(1500);
  if(await trad.inputValue()!=='37.5')fail(`Traditional draft rewrote itself: ${await trad.inputValue()}`);
  await frame.locator('#v13TraditionalWicks').uncheck();
  await frame.locator('#v13TraditionalConfirm').selectOption('1');
  await frame.locator('[data-v13-apply="traditional"]').click();
  await frame.waitForFunction(()=>window.RWARenkoV13.settings.method==='traditional'&&Math.abs(Number(window.RWARenkoV13.state.box)-37.5)<.011,{timeout:60000});
  const tradState=await frame.evaluate(()=>({box:RWARenkoV13.state.box,method:RWARenkoV13.settings.method,wicks:RWARenkoV13.settings.wicks,confirm:RWARenkoV13.settings.confirmBricks,sig:RWARenkoV13.state.data.slice(-40).map(x=>[x.close,x._dir,x._box])}));
  if(!near(tradState.box,37.5,.011)||tradState.method!=='traditional'||tradState.wicks!==false||tradState.confirm!==1)fail(`Traditional Apply mismatch ${JSON.stringify(tradState)}`);

  await frame.locator('#v13TraditionalConfirm').selectOption('2');
  await frame.locator('[data-v13-apply="traditional"]').click();
  await frame.waitForFunction(()=>Number(window.RWARenkoV13.settings.confirmBricks)===2&&!window.RWARenkoV13.state.building,{timeout:60000});
  const sig2=await frame.evaluate(()=>RWARenkoV13.state.data.slice(-40).map(x=>[x.close,x._dir,x._box]));
  if(JSON.stringify(sig2)!==JSON.stringify(tradState.sig))fail('Entry Confirm changed confirmed brick formation');

  const atrLen=frame.locator('#v13AtrLength'),atrFactor=frame.locator('#v13AtrFactor');
  await atrLen.fill('21');await atrFactor.fill('0.5');await frame.waitForTimeout(1200);
  if(await atrLen.inputValue()!=='21'||await atrFactor.inputValue()!=='0.5')fail('ATR draft rewrote itself');
  await frame.locator('[data-v13-apply="atr"]').click();
  await frame.waitForFunction(()=>window.RWARenkoV13.settings.method==='atr'&&Number(window.RWARenkoV13.settings.atrLength)===21&&Math.abs(Number(window.RWARenkoV13.settings.atrFactor)-.5)<1e-12&&!window.RWARenkoV13.state.building,{timeout:60000});
  const atr=await frame.evaluate(()=>({box:RWARenkoV13.state.box,atr:RWARenkoV13.state.atrValue,factor:RWARenkoV13.settings.atrFactor,tick:RWARenkoV13.state.tickSize,ok:RWARenkoV13MethodProfiles.verify('atr')}));
  if(!atr.ok||!(atr.box>0)||!(atr.atr>0))fail(`ATR Apply mismatch ${JSON.stringify(atr)}`);

  const pct=frame.locator('#v13Percentage');await pct.fill('0,25');await frame.waitForTimeout(1200);
  if(await pct.inputValue()!=='0,25')fail(`Percentage draft rewrote itself: ${await pct.inputValue()}`);
  await frame.locator('[data-v13-apply="percentage"]').click();
  await frame.waitForFunction(()=>window.RWARenkoV13.settings.method==='percentage'&&Math.abs(Number(window.RWARenkoV13.settings.percentage)-.0025)<1e-12&&!window.RWARenkoV13.state.building,{timeout:60000});
  const pctState=await frame.evaluate(()=>({rule:RWARenkoV13.percentageRule,ok:RWARenkoV13MethodProfiles.verify('percentage'),box:RWARenkoV13.state.box,last:RWARenkoV13.state.tailState?.lastClose}));
  if(!pctState.ok||pctState.rule!=='confirmed-renko-level-times-percent')fail(`Percentage formation mismatch ${JSON.stringify(pctState)}`);

  await trad.fill('20');await frame.locator('#v13TraditionalWicks').check();await frame.locator('#v13TraditionalConfirm').selectOption('2');await frame.locator('[data-v13-apply="traditional"]').click();
  await frame.waitForFunction(()=>window.RWARenkoV13.settings.method==='traditional'&&Math.abs(Number(window.RWARenkoV13.state.box)-20)<.02&&!window.RWARenkoV13.state.building,{timeout:60000});
  const before=await frame.evaluate(()=>({oldest:Number(RWARenkoV13.state.oldestAggId),ticks:RWARenkoV13.state.ticks.length,bricks:RWARenkoV13.state.data.length,diag:RWARenkoV13.diagnostics()}));
  await frame.evaluate(()=>RWARenkoV13.loadOlder(50,12));
  await frame.waitForFunction(()=>!window.RWARenkoV13.state.loading&&!window.RWARenkoV13.state.building,{timeout:90000});
  const after=await frame.evaluate(()=>({oldest:Number(RWARenkoV13.state.oldestAggId),ticks:RWARenkoV13.state.ticks.length,bricks:RWARenkoV13.state.data.length,diag:RWARenkoV13.diagnostics()}));
  if(!(after.oldest<before.oldest)||!(after.ticks>before.ticks))fail(`Older history did not expand ${JSON.stringify({before,after})}`);
  if(after.diag.droppedLiveTrades!==0)fail(`Live trades dropped: ${after.diag.droppedLiveTrades}`);
  if(!(after.diag.pendingLive>=0&&after.diag.processedLiveTrades>=0))fail('Lossless diagnostics invalid');

  const result=await frame.evaluate(()=>({runtime:RWARenkoV13.version,profiles:RWARenkoV13MethodProfiles.version,setup:RWARenkoV13MethodProfiles.setupContract,input:RWARenkoV13MethodProfiles.inputContract,formation:RWARenkoV13.formation,liveDrain:RWARenkoV13.liveDrain,rebuild:RWARenkoV13.rebuildRule,percentage:RWARenkoV13.percentageRule,bricks:RWARenkoV13.state.data.length,ticks:RWARenkoV13.state.ticks.length,oldest:RWARenkoV13.state.oldestAggId}));
  console.log('RENKO V13 FUNCTIONAL PASS',JSON.stringify(result));
  const v13fatal=fatal.filter(x=>/RENKO V13|renko-v13/i.test(x));if(v13fatal.length)fail(`V13 browser errors: ${v13fatal.slice(0,5).join(' | ')}`);
} finally {await browser.close()}
