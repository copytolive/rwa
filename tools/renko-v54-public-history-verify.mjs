import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const url=`https://narzulalistiqlal.github.io/rwa/renko/?verify54=${Date.now()}`;
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.RWARenko?.version==='5.3.0'&&window.RWARenkoV5Auto?.version==='5.4.0',{timeout:30000});
  await page.waitForFunction(()=>window.RWARenkoV3?.state?.symbols?.length>=500,{timeout:30000});
  await page.waitForFunction(()=>String(document.querySelector('#feedPill b')?.textContent||'').startsWith('LIVE'),{timeout:30000});
  await page.evaluate(()=>{const i=document.querySelector('#brickSize');if(i)i.value='100';document.querySelector('#applyBrick')?.click()});
  for(let i=0;i<24;i++){
    const s=await page.evaluate(()=>({count:window.RWARenkoV5Auto?.state?.previewCount||0,status:document.querySelector('#archiveStatus')?.textContent,progress:document.querySelector('#archiveProgressText')?.textContent,history:document.querySelector('#v5HistoryCount')?.textContent,legacy:document.querySelector('#historyCount')?.textContent,coverage:document.querySelector('#v5HistoryCoverage')?.textContent}));
    console.log('history-check',i,s);if(s.count>0)break;await page.waitForTimeout(5000);
  }
  await page.waitForFunction(()=>window.RWARenkoV5Auto?.state?.previewCount>0,{timeout:30000});await page.waitForTimeout(1000);
  const s=await page.evaluate(()=>({count:window.RWARenkoV5Auto.state.previewCount,ticks:window.RWARenkoV5Auto.state.previewTicks,first:window.RWARenkoV5Auto.state.previewFirst,last:window.RWARenkoV5Auto.state.previewLast,mode:window.RWARenkoV5Auto.state.mode,history:document.querySelector('#v5HistoryCount')?.textContent,legacy:document.querySelector('#historyCount')?.textContent,coverage:document.querySelector('#v5HistoryCoverage')?.textContent,state:document.querySelector('#v5HistoryState')?.textContent,display:document.querySelector('#archivePreview')?.style.display,rect:document.querySelector('#archivePreview')?.getBoundingClientRect().toJSON(),pairs:document.querySelectorAll('.pair-row').length}));
  assert.ok(s.count>0);assert.ok(s.ticks>0);assert.ok(s.first>0);assert.ok(s.last>=s.first);assert.match(String(s.history),/historical bricks/i);assert.notEqual(s.history,'0 historical bricks');assert.notEqual(s.display,'none');assert.ok(s.rect?.width>700&&s.rect?.height>250);assert.equal(s.pairs,500);
  await page.click('#historyLive');await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.RWARenkoV5Auto.state.mode),'live');
  await page.click('#historyAll');await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.RWARenkoV5Auto.state.mode),'all');
  assert.equal(errors.length,0,errors.join(' | '));console.log(JSON.stringify({ok:true,url,s},null,2));
}finally{await browser.close()}
