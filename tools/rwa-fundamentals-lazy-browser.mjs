import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.RWA_BASE_URL||'http://127.0.0.1:4173/';

async function mount(page){
  await page.addStyleTag({url:new URL('rwa-fundamentals.css?v=1',BASE).href});
  await page.addScriptTag({url:new URL('rwa-fundamentals.js?v=1',BASE).href});
  await page.waitForFunction(()=>!!window.RWAFundamentals,{timeout:10000});
}

async function exercise(browser,viewport,mobile=false){
  const ctx=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
  const page=await ctx.newPage();
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  const before=new URL(page.url()).pathname;
  await mount(page);
  await page.evaluate(()=>window.RWAFundamentals.open('BTC'));
  await page.waitForFunction(()=>document.getElementById('rwaFundamentals')?.classList.contains('open'));
  const state=await page.evaluate(()=>({
    tabs:document.querySelectorAll('[data-rwa-fund-tab]').length,
    aria:document.getElementById('rwaFundamentals')?.getAttribute('aria-hidden'),
    path:location.pathname,
    body:document.getElementById('rwaFundBody')?.innerText||''
  }));
  assert.equal(state.tabs,9,'expected 9 fundamentals tabs');
  assert.equal(state.aria,'false');
  assert.equal(state.path,before,'lazy fundamentals must stay on canonical root');
  assert.match(state.body,/No verified income rights|Reviewer-backed RWA record|Local draft/i);
  await page.click('[data-rwa-fund-tab="documents"]');
  assert.match(await page.locator('#rwaFundBody').innerText(),/Documents|evidence/i);
  const box=await page.locator('#rwaFundamentals').boundingBox();
  assert.ok(box,'fundamentals panel must be visible');
  if(mobile)assert.ok(box.width<=viewport.width+1&&box.x>=-1,`mobile fundamentals overflow ${JSON.stringify(box)}`);
  await page.click('.rwa-fund-close');
  await page.waitForTimeout(50);
  assert.equal(await page.locator('#rwaFundamentals').getAttribute('aria-hidden'),'true');
  await ctx.close();
  return{viewport,tabs:state.tabs,path:before,width:box.width};
}

const browser=await chromium.launch({headless:true});
try{
  const desktop=await exercise(browser,{width:1440,height:900});
  const mobile=await exercise(browser,{width:390,height:844},true);
  console.log('RWA_FUNDAMENTALS_LAZY_DESKTOP=PASS');
  console.log('RWA_FUNDAMENTALS_LAZY_MOBILE=PASS');
  console.log(JSON.stringify({ok:true,desktop,mobile}));
}finally{await browser.close()}
