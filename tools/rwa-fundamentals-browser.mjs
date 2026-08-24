import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.RWA_BASE_URL||'http://127.0.0.1:4173/';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

async function desktop(browser){
  const ctx=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await ctx.newPage();
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.RWAFundamentals,{timeout:15000});
  await page.waitForSelector('.rwa-fundamentals-trigger',{state:'visible',timeout:10000});
  const before=new URL(page.url()).pathname;
  await page.click('.rwa-fundamentals-trigger');
  await page.waitForFunction(()=>document.getElementById('rwaFundamentals')?.classList.contains('open'));
  const base=await page.evaluate(()=>({tabs:document.querySelectorAll('[data-rwa-fund-tab]').length,aria:document.getElementById('rwaFundamentals')?.getAttribute('aria-hidden'),body:document.getElementById('rwaFundBody')?.innerText||'',path:location.pathname}));
  assert.equal(base.tabs,9,'expected 9 fundamentals tabs');
  assert.equal(base.aria,'false');
  assert.equal(base.path,before,'opening fundamentals must not navigate');
  assert.match(base.body,/No verified income rights|Reviewer-backed RWA record|Local draft/i);

  await page.click('[data-rwa-fund-tab="income"]');
  const income0=await page.locator('#rwaFundBody').innerText();
  assert.match(income0,/Income|distribution/i);

  await page.evaluate(()=>{
    localStorage.setItem('rwa_asset_drafts_v2',JSON.stringify([{
      id:'browser-test-draft',name:'Browser Test Warehouse',type:'Logistics Warehouse',nav:1000,yield:8.5,location:'Test only',issuer:'Browser Test SPV',ownership:'https://github.com/',appraisal:'https://github.com/',legal:'https://github.com/',fundamentals:{schema:1,token:{symbol:'BTC',currency:'USD',supply:100000,holders:25,tokenized_value:100000000,tokenized_ownership:40},income:{type:'rental',frequency:'Monthly',ttm_per_token:80,current_yield:8.5,next_per_token:7,record_date:'2026-08-31',payment_date:'2026-09-15',coverage_ratio:1.3,evidence_url:'https://github.com/openai',history:[{period:'2026-06',amount_per_token:6.5},{period:'2026-07',amount_per_token:6.8}]},cashflow:{gross_income:1000000,opex:150000,debt_reserve_tax:200000,net_distributable:650000,distribution_paid:620000,reserve:30000},financials:{periods:[],evidence_url:''},valuation:{nav_per_token:1000,appraised_value:120000000,income_fair_value:1040,model_fair_value:1025,debt:30000000,evidence_url:'https://github.com/openai'},asset:{occupancy:96,cap_rate:8.7,ltv:25,dscr:1.84},calendar:[],audit:[]}
    }]));
  });
  await page.evaluate(()=>window.RWAFundamentals.open('BTC'));
  await page.waitForTimeout(100);
  const draft=await page.evaluate(()=>({status:document.getElementById('rwaFundStatus')?.textContent,body:document.getElementById('rwaFundBody')?.innerText||'',path:location.pathname}));
  assert.match(draft.status,/DRAFT/i,'local asset must remain explicitly unverified');
  assert.equal(draft.path,before);
  await page.click('[data-rwa-fund-tab="income"]');
  const income=await page.locator('#rwaFundBody').innerText();
  assert.match(income,/Rental distribution/i);
  assert.match(income,/Distribution history/i);
  assert.doesNotMatch(income,/Reviewer-backed RWA record/i);

  await page.evaluate(()=>window.RWAProductOS?.openCommand?.('asset BTC'));
  await page.waitForSelector('#rwaCommandLayer:not([hidden])',{timeout:5000});
  const assetCmd=page.locator('.rwa-command-item').filter({has:page.locator('span', {hasText:'ASSET'})}).last();
  assert.ok(await assetCmd.count(),'ASSET command must exist');
  await assetCmd.click();
  await page.waitForTimeout(100);
  assert.equal(new URL(page.url()).pathname,before,'ASSET command must stay on canonical root');
  assert.equal(await page.locator('#rwaFundamentals').getAttribute('aria-hidden'),'false');
  await page.click('.rwa-fund-close');
  assert.equal(await page.locator('#rwaFundamentals').getAttribute('aria-hidden'),'true');
  await ctx.close();
  return{tabs:base.tabs,draftStatus:draft.status,canonicalPath:before};
}

async function mobile(browser){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await ctx.newPage();
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.RWAFundamentals,{timeout:15000});
  await page.waitForSelector('.rwa-fundamentals-trigger',{state:'visible',timeout:10000});
  const path=new URL(page.url()).pathname;
  await page.click('.rwa-fundamentals-trigger');
  await page.waitForFunction(()=>document.getElementById('rwaFundamentals')?.classList.contains('open'));
  const box=await page.locator('#rwaFundamentals').boundingBox();
  assert.ok(box&&box.width<=391&&box.x>=-1,`mobile fundamentals overflow: ${JSON.stringify(box)}`);
  assert.equal(new URL(page.url()).pathname,path);
  assert.equal(await page.locator('[data-rwa-fund-tab]').count(),9);
  await page.click('[data-rwa-fund-tab="documents"]');
  await page.click('.rwa-fund-close');
  await page.waitForTimeout(80);
  assert.equal(await page.locator('#rwaFundamentals').getAttribute('aria-hidden'),'true');
  await ctx.close();
  return{width:box.width,path};
}

const browser=await chromium.launch({headless:true});
try{
  const d=await desktop(browser),m=await mobile(browser);
  console.log(JSON.stringify({ok:true,contract:'rwa-integrated-income-fundamentals-v1',desktop:d,mobile:m},null,2));
}finally{await browser.close()}
