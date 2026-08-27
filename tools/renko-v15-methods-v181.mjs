import { chromium } from 'playwright';
const BASE=process.env.RENKO_TEST_BASE||'http://127.0.0.1:8080/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1900,height:900}});
const fail=m=>{throw new Error(m)};
async function snap(){return page.evaluate(()=>({controller:window.RWARenkoV15MethodProfiles?.version,bootstrap:document.documentElement.dataset.renkoMethodBootstrap,method:RWARenkoV15.settings.method,box:Number(RWARenkoV15.state.box),bricks:RWARenkoV15.state.data.length,ticks:RWARenkoV15.state.ticks.length,ltp:Number(RWARenkoV15.state.ltpSnapshot),audit:RWARenkoV15.uniformAudit(),wickAudit:RWARenkoV15MethodProfiles?.wickAudit?.(),wicks:RWARenkoV15.settings.wicks!==false,traditional:Number(document.querySelector('#v15TraditionalBox')?.value),percentage:Number(document.querySelector('#v15Percentage')?.value),state:document.querySelector(`[data-v15-profile="${RWARenkoV15.settings.method}"] .v15-state`)?.textContent,historyState:document.querySelector('#v15BoxCard')?.dataset.historyState,historyDays:document.querySelector('#v15BoxCard')?.dataset.historyDays,historySource:document.querySelector('#v15BoxCard')?.dataset.historySource,historyTarget:Number(document.querySelector('#v15BoxCard')?.dataset.historyTarget),traditionalAuto:document.querySelector('#v15BoxCard')?.dataset.traditionalAuto}))}
async function apply(method){await page.locator(`[data-v15-apply="${method}"]`).click();await page.waitForFunction(m=>window.RWARenkoV15MethodProfiles?.version==='1.8.2'&&RWARenkoV15.settings.method===m&&document.querySelector(`[data-v15-profile="${m}"]`)?.classList.contains('active'),method,{timeout:15000});}
async function waitBricks(method,min,timeout=180000){try{await page.waitForFunction(({method,min})=>RWARenkoV15.settings.method===method&&!RWARenkoV15.state.building&&RWARenkoV15.state.data.length>=min,{method,min},{timeout});}catch{const s=await snap();fail(`${method} did not reach ${min} bricks: ${JSON.stringify(s)}`)}const s=await snap();if(!s.audit?.ok)fail(`${method} uniform audit failed ${JSON.stringify(s)}`);return s}
async function setWicks(method,on){const id=method==='atr'?'#v15AtrWicks':method==='traditional'?'#v15TraditionalWicks':'#v15PercentageWicks';const box=page.locator(id);if(await box.isChecked()!==on)await box.click();await page.waitForFunction(({method,on})=>RWARenkoV15.settings.method===method&&(RWARenkoV15.settings.wicks!==false)===on&&!RWARenkoV15.state.building,{method,on},{timeout:20000});return snap()}
try{
  await page.goto(`${BASE}renko/?symbol=SOL&qa=182`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.RWARenkoV15?.version==='15.1.0'&&window.RWARenkoV15MethodProfiles?.version==='1.8.2'&&document.documentElement.dataset.renkoMethodBootstrap==='182',null,{timeout:90000});
  await page.waitForFunction(()=>RWARenkoV15.state.symbol==='SOLUSDT'&&RWARenkoV15.state.ticks.length>0&&!RWARenkoV15.state.building,null,{timeout:90000});
  const boot=await snap();
  if(boot.historyTarget!==60)fail(`history target is not 60 ${JSON.stringify(boot)}`);
  if(boot.traditionalAuto!=='1')fail(`legacy Traditional default not marked auto ${JSON.stringify(boot)}`);
  if(!(boot.traditional>0&&boot.traditional<boot.ltp*.1))fail(`SOL Traditional default not symbol-scaled ${JSON.stringify(boot)}`);

  await apply('atr');
  const atr=await waitBricks('atr',1,30000);
  const atrOff=await setWicks('atr',false);
  if(!atrOff.wickAudit?.clean||atrOff.wickAudit?.count!==0)fail(`ATR WICKS OFF left wick excursions ${JSON.stringify(atrOff)}`);
  const atrOn=await setWicks('atr',true);
  if(!atrOn.wicks)fail(`ATR WICKS ON did not apply ${JSON.stringify(atrOn)}`);

  await apply('traditional');
  const traditional=await waitBricks('traditional',60,240000);
  if(!(traditional.box>0&&traditional.box<traditional.ltp*.1))fail(`Traditional box remained pathological ${JSON.stringify(traditional)}`);
  const tradOff=await setWicks('traditional',false);
  if(!tradOff.wickAudit?.clean||tradOff.wickAudit?.count!==0||tradOff.bricks<60)fail(`Traditional WICKS OFF failed/purged history ${JSON.stringify(tradOff)}`);
  const tradOn=await setWicks('traditional',true);
  if(!tradOn.wicks||tradOn.bricks<60)fail(`Traditional WICKS ON failed/purged history ${JSON.stringify(tradOn)}`);

  await page.locator('#v15Percentage').fill('1');
  await apply('percentage');
  const percentage=await waitBricks('percentage',60,240000);
  if(Math.abs(percentage.box-1)>0.15)fail(`Percentage 1% SOL box unexpected ${JSON.stringify(percentage)}`);
  const pctOff=await setWicks('percentage',false);
  if(!pctOff.wickAudit?.clean||pctOff.wickAudit?.count!==0||pctOff.bricks<60)fail(`Percentage WICKS OFF failed/purged history ${JSON.stringify(pctOff)}`);
  const pctOn=await setWicks('percentage',true);
  if(!pctOn.wicks||pctOn.bricks<60)fail(`Percentage WICKS ON failed/purged history ${JSON.stringify(pctOn)}`);

  await page.locator('#v15TraditionalBox').fill('100');
  await apply('traditional');
  await page.waitForFunction(()=>RWARenkoV15.settings.method==='traditional'&&Math.abs(Number(RWARenkoV15.settings.traditionalBox)-100)<.01,null,{timeout:15000});
  const manual100=await snap();
  if(Math.abs(manual100.box-100)>.02)fail(`manual Traditional 100 was not preserved ${JSON.stringify(manual100)}`);

  console.log('RENKO V15.14 SOL 60-BRICK + LIVE-WICKS PASS',JSON.stringify({boot,atr,atrOff,atrOn,traditional,tradOff,tradOn,percentage,pctOff,pctOn,manual100}));
} finally {await browser.close()}