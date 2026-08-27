import { chromium } from 'playwright';
const BASE=process.env.RENKO_TEST_BASE||'http://127.0.0.1:8080/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1900,height:900}});
const fail=m=>{throw new Error(m)};
async function snap(){return page.evaluate(()=>({controller:window.RWARenkoV15MethodProfiles?.version,bootstrap:document.documentElement.dataset.renkoMethodBootstrap,method:RWARenkoV15.settings.method,box:Number(RWARenkoV15.state.box),bricks:RWARenkoV15.state.data.length,ticks:RWARenkoV15.state.ticks.length,ltp:Number(RWARenkoV15.state.ltpSnapshot),audit:RWARenkoV15.uniformAudit(),traditional:Number(document.querySelector('#v15TraditionalBox')?.value),percentage:Number(document.querySelector('#v15Percentage')?.value),state:document.querySelector(`[data-v15-profile="${RWARenkoV15.settings.method}"] .v15-state`)?.textContent,historyState:document.querySelector('#v15BoxCard')?.dataset.historyState,historySource:document.querySelector('#v15BoxCard')?.dataset.historySource,traditionalAuto:document.querySelector('#v15BoxCard')?.dataset.traditionalAuto}))}
async function apply(method){await page.locator(`[data-v15-apply="${method}"]`).click();await page.waitForFunction(m=>window.RWARenkoV15MethodProfiles?.version==='1.8.1'&&RWARenkoV15.settings.method===m&&document.querySelector(`[data-v15-profile="${m}"]`)?.classList.contains('active'),method,{timeout:15000});}
async function waitBricks(method,min,timeout=120000){try{await page.waitForFunction(({method,min})=>RWARenkoV15.settings.method===method&&!RWARenkoV15.state.building&&RWARenkoV15.state.data.length>=min,{method,min},{timeout});}catch{const s=await snap();fail(`${method} did not reach ${min} bricks: ${JSON.stringify(s)}`)}const s=await snap();if(!s.audit?.ok)fail(`${method} uniform audit failed ${JSON.stringify(s)}`);return s}
try{
  await page.goto(`${BASE}renko/?symbol=SOL&qa=181`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.RWARenkoV15?.version==='15.1.0'&&window.RWARenkoV15MethodProfiles?.version==='1.8.1'&&document.documentElement.dataset.renkoMethodBootstrap==='181',null,{timeout:90000});
  await page.waitForFunction(()=>RWARenkoV15.state.symbol==='SOLUSDT'&&RWARenkoV15.state.ticks.length>0&&!RWARenkoV15.state.building,null,{timeout:90000});
  const boot=await snap();
  if(boot.traditionalAuto!=='1')fail(`legacy Traditional default not marked auto ${JSON.stringify(boot)}`);
  if(!(boot.traditional>0&&boot.traditional<boot.ltp*.1))fail(`SOL Traditional default not symbol-scaled ${JSON.stringify(boot)}`);

  await apply('atr');
  const atr=await waitBricks('atr',1,30000);

  await apply('traditional');
  const traditional=await waitBricks('traditional',1,120000);
  if(!(traditional.box>0&&traditional.box<traditional.ltp*.1))fail(`Traditional box remained pathological ${JSON.stringify(traditional)}`);

  await page.locator('#v15Percentage').fill('1');
  await apply('percentage');
  const percentage=await waitBricks('percentage',12,150000);
  if(Math.abs(percentage.box-1)>0.11)fail(`Percentage 1% SOL box unexpected ${JSON.stringify(percentage)}`);

  await page.locator('#v15TraditionalBox').fill('100');
  await apply('traditional');
  await page.waitForFunction(()=>RWARenkoV15.settings.method==='traditional'&&Math.abs(Number(RWARenkoV15.settings.traditionalBox)-100)<.01,null,{timeout:15000});
  const manual100=await snap();
  if(Math.abs(manual100.box-100)>.02)fail(`manual Traditional 100 was not preserved ${JSON.stringify(manual100)}`);

  console.log('RENKO V15.13 SOL THREE-METHOD VISIBLE HISTORY PASS',JSON.stringify({boot,atr,traditional,percentage,manual100}));
} finally {await browser.close()}