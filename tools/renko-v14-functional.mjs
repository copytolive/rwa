import { chromium } from 'playwright';
const BASE=process.env.RENKO_TEST_BASE||'http://127.0.0.1:8080/';
const browser=await chromium.launch({headless:true});
const fail=m=>{throw new Error(m)};
const uniform=data=>{if(!data?.length)return{ok:true,count:0,maxError:0};const box=Number(data[0]._box),tol=Math.max(.00000001,Math.abs(box)*1e-8);let maxError=0;for(const b of data){const body=Math.abs(Number(b.close)-Number(b.open)),e=Math.max(Math.abs(body-box),Math.abs(Number(b._box)-box));maxError=Math.max(maxError,e);if(e>tol)return{ok:false,count:data.length,box,maxError,bad:b}}return{ok:true,count:data.length,box,maxError}};
async function openSymbol(base){
  const page=await browser.newPage({viewport:{width:1600,height:950}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${BASE}#research/renko/${base}`,{waitUntil:'domcontentloaded',timeout:45000});
  const h=await page.waitForSelector('iframe.rwa-research-legacy-frame',{timeout:30000}),f=await h.contentFrame();if(!f)fail(`${base}: iframe missing`);
  await f.waitForFunction(()=>window.RWARenkoV14&&window.RWARenkoV14MethodProfiles,{timeout:60000});
  await f.waitForFunction(b=>window.RWARenkoV3?.state?.selected===`${b}USDT`&&window.RWARenkoV14?.state?.symbol===`${b}USDT`,base,{timeout:90000});
  await f.waitForFunction(()=>window.RWARenkoV14.state.bars.length>0&&window.RWARenkoV14.state.tickSize>0&&!window.RWARenkoV14.state.building,{timeout:90000});
  await f.waitForTimeout(500);
  const state=await f.evaluate(()=>({v3:RWARenkoV3.state.selected,v14:RWARenkoV14.state.symbol,bars:RWARenkoV14.state.bars.length,bricks:RWARenkoV14.state.data.length,ltp:RWARenkoV14.state.ltpSnapshot,rule:RWARenkoV14.percentageRule,realtime:RWARenkoV14.realtimeBehavior,atrRule:RWARenkoV14.atrRule,profileState:document.querySelector('[data-v14-profile="atr"] .v14-profile-state')?.textContent||''}));
  if(state.v3!==`${base}USDT`||state.v14!==`${base}USDT`)fail(`${base}: routing mismatch ${JSON.stringify(state)}`);
  if(!(state.ltp>0))fail(`${base}: LTP snapshot missing`);
  if(state.rule!=='symbol-load-ltp-fixed-across-bars'||state.realtime!=='projection-until-source-bar-closes')fail(`${base}: parity contract mismatch`);
  if(state.profileState==='ERROR')fail(`${base}: false startup profile ERROR`);
  return{page,frame:f,state,errors};
}
async function assertUniform(f,label){const data=await f.evaluate(()=>RWARenkoV14.state.data.map(x=>({open:x.open,close:x.close,_box:x._box,_dir:x._dir})));const a=uniform(data);if(!a.ok)fail(`${label}: non-uniform confirmed brick body ${JSON.stringify(a)}`);const box=await f.evaluate(()=>Number(RWARenkoV14.state.box));if(data.length&&Math.abs(Number(a.box)-box)>Math.max(.00000001,Math.abs(box)*1e-8))fail(`${label}: brick box differs from active box ${JSON.stringify({brickBox:a.box,box})}`);console.log('UNIFORM BODY PASS',label,JSON.stringify({count:a.count,box,maxError:a.maxError}))}
try{
  for(const base of ['ETH','SOL','XRP']){const x=await openSymbol(base);console.log('SYMBOL ROUTE PASS',base,JSON.stringify(x.state));await x.page.close()}
  const {page,frame:f,errors}=await openSymbol('BTC');

  const trad=f.locator('#v14TraditionalBox');await trad.fill('37.5');await f.waitForTimeout(1300);if(await trad.inputValue()!=='37.5')fail('Traditional draft rewrote itself');
  await f.locator('#v14TraditionalWicks').uncheck();await f.locator('#v14TraditionalConfirm').selectOption('1');await f.locator('[data-v14-apply="traditional"]').click();
  await f.waitForFunction(()=>window.RWARenkoV14.settings.method==='traditional'&&Math.abs(Number(window.RWARenkoV14.state.box)-37.5)<.011&&!window.RWARenkoV14.state.building,{timeout:60000});
  await assertUniform(f,'TRADITIONAL 37.5');
  const formationA=await f.evaluate(()=>RWARenkoV14.state.data.slice(-60).map(x=>[x.open,x.close,x._dir,x._box]));
  await f.locator('#v14TraditionalConfirm').selectOption('2');await f.locator('[data-v14-apply="traditional"]').click();await f.waitForFunction(()=>Number(window.RWARenkoV14.settings.confirmBricks)===2&&!window.RWARenkoV14.state.building,{timeout:60000});
  const formationB=await f.evaluate(()=>RWARenkoV14.state.data.slice(-60).map(x=>[x.open,x.close,x._dir,x._box]));if(JSON.stringify(formationA)!==JSON.stringify(formationB))fail('Entry Confirm changed Renko formation');

  const pct=f.locator('#v14Percentage');await pct.fill('1');await f.waitForTimeout(700);if(await pct.inputValue()!=='1')fail('Percentage draft rewrote itself');await f.locator('[data-v14-apply="percentage"]').click();
  await f.waitForFunction(()=>window.RWARenkoV14.settings.method==='percentage'&&Math.abs(Number(window.RWARenkoV14.settings.percentage)-.01)<1e-12&&!window.RWARenkoV14.state.building,{timeout:60000});
  const p=await f.evaluate(()=>({box:RWARenkoV14.state.box,ltp:RWARenkoV14.state.ltpSnapshot,tick:RWARenkoV14.state.tickSize,ok:RWARenkoV14MethodProfiles.verify('percentage')}));if(!p.ok||!(p.box>0)||!(p.ltp>0))fail(`Percentage LTP Apply mismatch ${JSON.stringify(p)}`);
  await assertUniform(f,'PERCENTAGE LTP');

  const atr=f.locator('#v14AtrLength');await atr.fill('14');await f.waitForTimeout(700);if(await atr.inputValue()!=='14')fail('ATR draft rewrote itself');await f.locator('[data-v14-apply="atr"]').click();await f.waitForFunction(()=>window.RWARenkoV14.settings.method==='atr'&&Number(window.RWARenkoV14.settings.atrLength)===14&&!window.RWARenkoV14.state.building,{timeout:60000});
  const a=await f.evaluate(()=>({box:RWARenkoV14.state.box,atr:RWARenkoV14.state.atrValue,rule:RWARenkoV14.atrRule,ok:RWARenkoV14MethodProfiles.verify('atr'),profileState:document.querySelector('[data-v14-profile="atr"] .v14-profile-state')?.textContent||''}));if(!a.ok||!(a.box>0)||!(a.atr>0)||a.profileState==='ERROR')fail(`ATR Apply mismatch ${JSON.stringify(a)}`);
  if(a.rule!=='latest-completed-wilder-atr-snapshot-fixed-across-chart')fail(`ATR rule mismatch ${a.rule}`);
  await assertUniform(f,'ATR SNAPSHOT');

  await f.locator('#v14Source').selectOption('close');await f.locator('#v14Resolution').selectOption('1m');await f.waitForFunction(()=>window.RWARenkoV14.settings.source==='close'&&window.RWARenkoV14.settings.resolution==='1m'&&!window.RWARenkoV14.state.building,{timeout:90000});
  const before=await f.evaluate(()=>({first:Number(RWARenkoV14.state.bars[0]?.[0]),bars:RWARenkoV14.state.bars.length,bricks:RWARenkoV14.state.data.length}));await f.evaluate(()=>RWARenkoV14.loadOlder(2));await f.waitForFunction(()=>!window.RWARenkoV14.state.loading&&!window.RWARenkoV14.state.building,{timeout:90000});const after=await f.evaluate(()=>({first:Number(RWARenkoV14.state.bars[0]?.[0]),bars:RWARenkoV14.state.bars.length,bricks:RWARenkoV14.state.data.length,projection:RWARenkoV14.state.projection.length,contract:{pct:RWARenkoV14.percentageRule,real:RWARenkoV14.realtimeBehavior,source:RWARenkoV14.historicalConfirmation,atr:RWARenkoV14.atrRule}}));if(!(after.first<before.first)||!(after.bars>before.bars))fail(`History did not extend ${JSON.stringify({before,after})}`);
  await assertUniform(f,'ATR AFTER HISTORY BACKFILL');
  if(after.contract.pct!=='symbol-load-ltp-fixed-across-bars'||after.contract.real!=='projection-until-source-bar-closes'||after.contract.atr!=='latest-completed-wilder-atr-snapshot-fixed-across-chart')fail('Final parity contracts missing');
  const fatal=errors.filter(x=>/RENKO V14|renko-v14/i.test(x));if(fatal.length)fail(fatal.slice(0,5).join(' | '));
  console.log('RENKO V14.2 FUNCTIONAL PASS',JSON.stringify(after));await page.close();
} finally {await browser.close()}
