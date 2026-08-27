import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/rwa/';
const factoryUrl=new URL('rwa-8-engines/',base).toString();
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({locale:'en-US',viewport:{width:1440,height:960}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(factoryUrl,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.RWA8Engines?.version==='2.1.0');
 assert.equal(await page.locator('#engineGrid .engine').count(),8,'eight engine cards required');
 assert.equal(await page.locator('#readiness .ready-row').count(),0,'readiness should wait for result');
 await page.click('#loadDemo');
 await page.setInputFiles('#evidenceFiles',{name:'company-registration.txt',mimeType:'text/plain',buffer:Buffer.from('verified-demo-evidence-p21')});
 await page.click('button.primary');await page.locator('#result').waitFor({state:'visible'});
 const first=JSON.parse(await page.locator('#resultJson').textContent());
 assert.match(first.passport.id,/^RWA-ID-/);assert.equal(first.registry.assets.length,1);assert.equal(first.maturity,'REGISTERED_RWA');assert.equal(first.ready.register,true);assert.equal(first.ready.verify,false);assert.equal(first.ready.finance,false);assert.equal(first.ready.trade,false);assert.equal(first.proof.proofs.length,1);assert.match(first.proof.proofs[0].contentSha256,/^[0-9a-f]{64}$/);assert.equal(first.factory.deployment.enabled,false);assert.equal(first.marketplace.listing.execution,'DISABLED');
 assert.equal(await page.locator('#readiness .ready-row').count(),6,'six maturity rows required');
 await page.click('#savePassport');await page.waitForFunction(()=>document.getElementById('northStarCount')?.textContent==='1');
 await page.click('#addAsset');const rows=page.locator('[data-asset-row]');assert.equal(await rows.count(),2);const second=rows.nth(1);await second.locator('[data-asset="assetType"]').selectOption({label:'Receivables / Invoice'});await second.locator('[data-asset="name"]').fill('Export invoice pool');await second.locator('[data-asset="declaredValue"]').fill('750000');await second.locator('[data-asset="currency"]').fill('USD');await page.click('button.primary');const multi=JSON.parse(await page.locator('#resultJson').textContent());assert.equal(multi.registry.assets.length,2,'multi-asset registry required');
 await page.selectOption('select[name="mode"]','FINANCE');await page.click('button.primary');const finance=JSON.parse(await page.locator('#resultJson').textContent());assert.equal(finance.ready.finance,false,'finance must fail closed without professional approvals');assert.equal(finance.factory.status,'BLOCKED');assert.ok(finance.blockers.includes('LICENSED_LEGAL_REVIEW_REQUIRED'));assert.ok(finance.blockers.includes('SANCTIONS_PEP_SCREENING_REQUIRED'));
 assert.deepEqual(errors,[],`factory page errors: ${errors.join(' | ')}`);
 const root=await context.newPage();const rootErrors=[];root.on('pageerror',e=>rootErrors.push(String(e)));await root.goto(base,{waitUntil:'domcontentloaded'});await root.locator('.institutional').waitFor({state:'visible',timeout:15000});assert.equal((await root.locator('.institutional').textContent()).trim(),'Create RWA');await root.click('.institutional');const iframe=root.locator('[data-global-rwa-factory] iframe');await iframe.waitFor({state:'attached',timeout:15000});assert.match(await iframe.getAttribute('src'),/rwa-8-engines\/\?embed=1/);assert.ok(await root.locator('[data-global-rwa-factory]').count()===1,'single internal factory mount required');
 console.log('P21_CREATE_RWA_BROWSER=PASS');console.log('P21_MULTI_ASSET_BROWSER=PASS');console.log('P21_EVIDENCE_HASH_BROWSER=PASS');console.log('P21_FAIL_CLOSED_FINANCE_BROWSER=PASS');console.log('P21_INTERNAL_EMBED_BROWSER=PASS');console.log('RWA_P21_BROWSER=PASS');
}finally{await browser.close()}
