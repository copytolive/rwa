import {chromium} from 'playwright';
const BASE=process.env.RWA_LIVE_BASE||'https://narzulalistiqlal.github.io/rwa/';
const browser=await chromium.launch({headless:true});
const fail=[];const check=(v,m)=>{if(!v)fail.push(m)};
async function test(viewport,label){
  const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e?.message||e)));
  await page.goto(`${BASE}?storefront-smoke=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForTimeout(1900);
  check(await page.locator('#rwaCommerceBanner').isVisible().catch(()=>false),`${label}: commerce landing banner missing`);
  check((await page.locator('#rwaCommerceBanner').textContent().catch(()=>''))?.includes('Trade the token. Shop the physical store.'),`${label}: commerce-first product message missing`);
  check((await page.locator('.filter[data-filter="rwa"]').textContent().catch(()=>''))==='RWA-linked',`${label}: public RWA market filter is not distinguished from store tokens`);
  if(label==='mobile')check((await page.locator('#mobileRwaCount').evaluate(e=>e.previousElementSibling?.textContent||'').catch(()=>''))==='RWA-LINKED',`${label}: mobile RWA-linked metric label missing`);
  if(label==='desktop'){
    const intelligence=page.locator('.topnav button').filter({hasText:'Intelligence'}).first();check(await intelligence.isVisible().catch(()=>false),'desktop: Intelligence navigation missing');if(await intelligence.isVisible().catch(()=>false)){await intelligence.click();await page.locator('#suite').waitFor({state:'visible',timeout:10000}).catch(()=>{});check(await page.locator('[data-suite-panel="intel"]').evaluate(e=>e.classList.contains('active')).catch(()=>false),'desktop: Intelligence navigation did not open Intelligence panel');const close=page.locator('[data-suite-close]').first();if(await close.isVisible().catch(()=>false))await close.click()}
    const assets=page.locator('.topnav button').filter({hasText:'Assets'}).first();check(await assets.isVisible().catch(()=>false),'desktop: Assets navigation missing');if(await assets.isVisible().catch(()=>false)){await assets.click();await page.locator('#suite').waitFor({state:'visible',timeout:10000}).catch(()=>{});check(await page.locator('[data-suite-panel="rwa"]').evaluate(e=>e.classList.contains('active')).catch(()=>false),'desktop: Assets navigation did not open RWA panel');const close=page.locator('[data-suite-close]').first();if(await close.isVisible().catch(()=>false))await close.click()}
  }
  check(await page.locator('[data-rwa-shop]').first().isVisible().catch(()=>false),`${label}: Shop navigation missing`);
  const shop=page.locator('[data-rwa-shop]').first();
  if(await shop.isVisible().catch(()=>false)){
    await shop.click();check(await page.locator('#rwaShopScreen.open').isVisible().catch(()=>false),`${label}: storefront did not open`);
    check(await page.locator('.rwa-store-card').count().catch(()=>0)>=1,`${label}: store blueprint cards missing`);
    check((await page.locator('.rwa-live-guard').textContent().catch(()=>''))?.includes('UI blueprints'),`${label}: preview/live guard missing`);
    check(await page.locator('.rwa-store-card .rwa-store-actions button:disabled').count().catch(()=>0)>=1,`${label}: preview token trade must be disabled`);
    const openStore=page.locator('.rwa-store-card [data-open-store]').first();
    check(await openStore.isVisible().catch(()=>false),`${label}: Open store detail action missing`);
    if(await openStore.isVisible().catch(()=>false)){
      await openStore.click();await page.locator('#rwaStoreDetailLayer.open').waitFor({state:'visible',timeout:6000}).catch(()=>{});
      check(await page.locator('#rwaStoreDetailLayer.open').isVisible().catch(()=>false),`${label}: physical-store detail did not open`);
      const detailText=await page.locator('#rwaStoreDetailBody').textContent().catch(()=>''),detailTrade=page.locator('#rwaStoreDetailBody .rwa-store-detail-actions .primary');
      check(detailText.includes('1 token = 1 physical store'),`${label}: store detail model missing`);
      check(detailText.includes('Store evidence'),`${label}: store evidence section missing`);
      check(detailText.includes('Store products'),`${label}: store product section missing`);
      check(detailText.includes('UI PREVIEW'),`${label}: preview store detail must remain unverified`);
      check(await detailTrade.isDisabled().catch(()=>false),`${label}: preview store detail trade must remain disabled`);
      await page.locator('#rwaStoreDetailClose').click();check(!(await page.locator('#rwaStoreDetailLayer').evaluate(e=>e.classList.contains('open')).catch(()=>true)),`${label}: physical-store detail did not close`);
    }
    const search=page.locator('#rwaShopSearch');await search.fill('Retail');check((await search.inputValue().catch(()=>''))==='Retail',`${label}: storefront search lost typed value`);check(await search.evaluate(e=>document.activeElement===e).catch(()=>false),`${label}: storefront search lost focus`);await search.fill('');
    await page.locator('[data-shop-tab="products"]').click();check(await page.locator('.rwa-product-card').count().catch(()=>0)>=1,`${label}: product grid missing`);check((await page.locator('.rwa-product-card .rwa-product-price b').first().textContent().catch(()=>''))==='Price pending',`${label}: preview product must not show a fabricated price`);check(await page.locator('.rwa-product-card [data-add-cart]:disabled').count().catch(()=>0)>=1,`${label}: preview products must not enter live cart`);
    await page.locator('#rwaCommandOpen').click();check(await page.locator('#rwaCommandLayer.open').isVisible().catch(()=>false),`${label}: command palette did not open`);await page.keyboard.press('Escape');await page.locator('#rwaShopClose').click()
  }
  if(label==='desktop'){
    await page.evaluate(async()=>{const s=await window.RWAQuickActions?.loadSuite?.();s?.open?.('rwa')});
    await page.locator('#rwaPhysicalStoreDraft').waitFor({state:'visible',timeout:12000}).catch(()=>{});check(await page.locator('#rwaPhysicalStoreDraft').isVisible().catch(()=>false),'desktop: physical-store onboarding card missing');
    if(await page.locator('#rwaPhysicalStoreDraft').isVisible().catch(()=>false)){
      await page.locator('#rwaStoreToken').fill('STORE-UI');await page.locator('#rwaStoreName').fill('UI Validation Store');await page.locator('#rwaStoreAddress').fill('Validation address only');await page.locator('#rwaStorePhoto').fill('https://example.com/store.jpg');await page.locator('#rwaStoreBusiness').fill('https://example.com/business');await page.locator('#rwaStoreMerchant').fill('https://example.com/merchant');await page.locator('#saveRwaPhysicalStore').click();
      check((await page.locator('#rwaStoreDraftStatus').textContent().catch(()=>''))?.includes('Valid latitude and longitude'),'desktop: physical-store draft validation did not fail closed on missing geo');
      await page.locator('#rwaStoreLat').fill('-6.2');await page.locator('#rwaStoreLng').fill('106.816666');await page.locator('#saveRwaPhysicalStore').click();check((await page.locator('#rwaStoreDraftStatus').textContent().catch(()=>''))?.includes('saved locally'),'desktop: valid physical-store draft was not saved as local unverified draft');
      await page.locator('#openRwaStorefront').click();await page.locator('#rwaShopScreen.open').waitFor({state:'visible',timeout:8000}).catch(()=>{});check(await page.locator('[data-local-store-token="STORE-UI"]').isVisible().catch(()=>false),'desktop: local physical-store draft is not visible in storefront');check(await page.locator('[data-local-store-token="STORE-UI"] button:disabled').count().catch(()=>0)>=1,'desktop: local physical-store draft trade must remain disabled');
      const viewLocal=page.locator('[data-local-store-token="STORE-UI"] [data-view-store-detail]');check(await viewLocal.isVisible().catch(()=>false),'desktop: local store detail action missing');if(await viewLocal.isVisible().catch(()=>false)){await viewLocal.click();await page.locator('#rwaStoreDetailLayer.open').waitFor({state:'visible',timeout:5000}).catch(()=>{});const localText=await page.locator('#rwaStoreDetailBody').textContent().catch(()=>''),localTrade=page.locator('#rwaStoreDetailBody .rwa-store-detail-actions .primary');check(localText.includes('LOCAL UNVERIFIED DRAFT'),'desktop: local store detail must remain unverified');check(localText.includes('UI Validation Store'),'desktop: local store detail did not preserve store identity');check(await localTrade.isDisabled().catch(()=>false),'desktop: local draft detail trading must remain disabled');await page.locator('#rwaStoreDetailClose').click()}
      await page.locator('#rwaShopClose').click();
    }
  }
  const overflow=await page.evaluate(()=>({w:innerWidth,sw:document.documentElement.scrollWidth}));check(overflow.sw<=overflow.w+3,`${label}: horizontal overflow ${overflow.sw}>${overflow.w}`);check(errors.length===0,`${label}: uncaught JS error(s): ${errors.join(' | ')}`);await context.close()
}
await test({width:1440,height:1000},'desktop');await test({width:390,height:844},'mobile');
{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e?.message||e)));await page.goto(`${BASE}trade/?storefront-smoke=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForTimeout(1700);check(await page.locator('.rwa-store-link').isVisible().catch(()=>false),'trade mobile: Physical Stores nav link missing');check(await page.locator('.rwa-trade-commerce-strip').isVisible().catch(()=>false),'trade mobile: RWA commerce strip missing');check(await page.locator('.rwa-trade-mobile-store').isVisible().catch(()=>false),'trade mobile: floating store action missing');const overflow=await page.evaluate(()=>({w:innerWidth,sw:document.documentElement.scrollWidth}));check(overflow.sw<=overflow.w+3,`trade mobile: horizontal overflow ${overflow.sw}>${overflow.w}`);check(errors.length===0,`trade mobile: uncaught JS error(s): ${errors.join(' | ')}`);await context.close()
}
await browser.close();if(fail.length){console.error(JSON.stringify({ok:false,contract:'rwa-storefront-browser-v7',fail},null,2));process.exit(1)}console.log(JSON.stringify({ok:true,contract:'rwa-storefront-browser-v7',surfaces:['desktop shell navigation','commerce landing','RWA-linked vs store-token labels','desktop storefront','mobile storefront','physical-store detail','honest preview states','search focus','physical-store draft create + detail bridge','trade mobile commerce link','command palette']},null,2));
