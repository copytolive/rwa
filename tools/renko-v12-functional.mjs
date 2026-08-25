import { chromium } from 'playwright';

const BASE=process.env.RENKO_TEST_BASE||'http://127.0.0.1:8080/rwa/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:950}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});

const fail=m=>{throw new Error(m)};
const near=(a,b,t=1e-8)=>Math.abs(Number(a)-Number(b))<=Math.max(t,Math.abs(Number(b))*1e-8);

try{
  await page.goto(`${BASE}#research/renko/BTC`,{waitUntil:'domcontentloaded',timeout:45000});
  const frameHandle=await page.waitForSelector('iframe.rwa-research-legacy-frame',{timeout:30000});
  const frame=await frameHandle.contentFrame();
  if(!frame)fail('RENKO iframe missing');

  await frame.waitForFunction(()=>window.RWARenkoV12?.version==='12.1.0'&&window.RWARenkoV12MethodProfiles?.version==='2.1.0',{timeout:60000});
  await frame.waitForFunction(()=>window.RWARenkoV12?.state?.symbol==='BTCUSDT'&&Number.isFinite(Number(window.RWARenkoV12.state.box)),{timeout:60000});

  // Input regression: a draft must never rewrite itself while the user is typing.
  const trad=frame.locator('#v12TraditionalBox');
  await trad.fill('37.5');
  await frame.waitForTimeout(1800);
  if(await trad.inputValue()!=='37.5')fail(`Traditional draft rewrote itself: ${await trad.inputValue()}`);
  const tradPanel=frame.locator('[data-v12-profile="traditional"]');
  if(!(await tradPanel.classList?.catch?.(()=>null))){/* locator API compatibility */}
  const tradState=await tradPanel.locator('.v12-profile-state').textContent();
  if(!String(tradState).includes('CHANGED'))fail(`Traditional dirty state missing: ${tradState}`);

  await frame.locator('#v12TraditionalWicks').uncheck();
  await frame.locator('#v12TraditionalConfirm').selectOption('1');
  await frame.locator('[data-v12-apply="traditional"]').click();
  await frame.waitForFunction(()=>window.RWARenkoV12.settings.method==='traditional'&&Math.abs(Number(window.RWARenkoV12.settings.traditionalBox)-37.5)<1e-9&&window.RWARenkoV12.settings.wicks===false&&Number(window.RWARenkoV12.settings.confirmBricks)===1&&Number(window.RWARenkoV12.state.box)>0,{timeout:60000});
  const tradResult=await frame.evaluate(()=>({box:RWARenkoV12.state.box,method:RWARenkoV12.settings.method}));
  if(!near(tradResult.box,37.5,.011))fail(`Traditional active box incorrect: ${tradResult.box}`);

  // Percentage accepts dot/comma style numeric input and applies independently.
  const pct=frame.locator('#v12Percentage');
  await pct.fill('0,25');
  await frame.waitForTimeout(1200);
  if(await pct.inputValue()!=='0,25')fail(`Percentage draft rewrote itself: ${await pct.inputValue()}`);
  await frame.locator('[data-v12-apply="percentage"]').click();
  await frame.waitForFunction(()=>window.RWARenkoV12.settings.method==='percentage'&&Math.abs(Number(window.RWARenkoV12.settings.percentage)-0.0025)<1e-12&&Number(window.RWARenkoV12.state.box)>0,{timeout:60000});

  // ATR profile must remain separate and commit its own length.
  const atr=frame.locator('#v12AtrLength');
  await atr.fill('21');
  await frame.waitForTimeout(1200);
  if(await atr.inputValue()!=='21')fail(`ATR draft rewrote itself: ${await atr.inputValue()}`);
  await frame.locator('[data-v12-apply="atr"]').click();
  await frame.waitForFunction(()=>window.RWARenkoV12.settings.method==='atr'&&Number(window.RWARenkoV12.settings.atrLength)===21&&Number(window.RWARenkoV12.state.box)>0,{timeout:60000});

  // Use a deterministic fixed box for history-depth acceptance.
  await trad.fill('20');
  await frame.locator('#v12TraditionalWicks').check();
  await frame.locator('#v12TraditionalConfirm').selectOption('2');
  await frame.locator('[data-v12-apply="traditional"]').click();
  await frame.waitForFunction(()=>window.RWARenkoV12.settings.method==='traditional'&&Math.abs(Number(window.RWARenkoV12.state.box)-20)<0.02,{timeout:60000});
  await frame.waitForFunction(()=>Number(window.RWARenkoV12.state.oldestAggId)>0&&window.RWARenkoV12.state.data.length>0,{timeout:60000});

  const before=await frame.evaluate(()=>({oldest:Number(RWARenkoV12.state.oldestAggId),ticks:RWARenkoV12.state.ticks.length,bricks:RWARenkoV12.state.data.length}));
  await frame.evaluate(()=>RWARenkoV12.loadOlder(80,24));
  await frame.waitForFunction(()=>!window.RWARenkoV12.state.loading&&!window.RWARenkoV12.state.building,{timeout:90000});
  const after=await frame.evaluate(()=>({oldest:Number(RWARenkoV12.state.oldestAggId),ticks:RWARenkoV12.state.ticks.length,bricks:RWARenkoV12.state.data.length,contract:RWARenkoV12.historyContract}));
  if(!(after.oldest<before.oldest))fail(`History oldestAggId did not move backward: ${before.oldest} -> ${after.oldest}`);
  if(!(after.ticks>before.ticks))fail(`History ticks did not increase: ${before.ticks} -> ${after.ticks}`);
  if(!(after.bricks>before.bricks))fail(`Visible confirmed history did not gain bricks: ${before.bricks} -> ${after.bricks}`);
  if(after.contract!=='continuous-contiguous-backfill-v2')fail(`Wrong history contract: ${after.contract}`);

  // Actual chart navigation button must initiate additional older loading.
  const old2=after.oldest;
  await frame.locator('#tvPanOlder').click();
  await frame.waitForFunction(old=>Number(window.RWARenkoV12.state.oldestAggId)<old,old2,{timeout:90000});

  const result=await frame.evaluate(()=>({profile:RWARenkoV12MethodProfiles.version,inputContract:RWARenkoV12MethodProfiles.inputContract,runtime:RWARenkoV12.version,history:RWARenkoV12.historyContract,bricks:RWARenkoV12.state.data.length,ticks:RWARenkoV12.state.ticks.length,oldest:RWARenkoV12.state.oldestAggId}));
  console.log('RENKO V12 FUNCTIONAL PASS',JSON.stringify(result));
  if(errors.length)console.log('Non-fatal browser console errors:',errors.slice(0,12));
} finally {
  await browser.close();
}
