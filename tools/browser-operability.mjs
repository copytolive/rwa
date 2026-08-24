import {chromium} from 'playwright';

const BASE=process.env.RWA_LIVE_BASE||'https://narzulalistiqlal.github.io/rwa/';
const browser=await chromium.launch({headless:true});
const failures=[];
const check=(ok,msg)=>{if(!ok)failures.push(msg)};

async function pageFor(viewport){
  const context=await browser.newContext({viewport,permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  return{context,page,errors};
}
async function visible(page,selector,timeout=10000){try{await page.locator(selector).first().waitFor({state:'visible',timeout});return true}catch{return false}}
async function noOverflow(page,label){const m=await page.evaluate(()=>({w:innerWidth,sw:document.documentElement.scrollWidth}));check(m.sw<=m.w+3,`${label}: horizontal overflow ${m.sw}>${m.w}`)}

// Desktop root: live social feed, Hub navigation and formerly-placeholder market actions must be real controls.
{
  const {context,page,errors}=await pageFor({width:1440,height:1000});
  await page.goto(`${BASE}?browser-smoke=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(1600);
  check(await visible(page,'[data-rwa-trade-now]'), 'root desktop: Trade Perps action not injected');
  check(await visible(page,'#rwaLiveTradeFeed',12000),'root desktop: venue-backed social trade feed not injected');
  check(await visible(page,'#rwaTradeFeedRefresh',12000),'root desktop: social trade refresh missing');
  if(await visible(page,'#rwaTradeFeedRefresh',2000))await page.locator('#rwaTradeFeedRefresh').click();
  const watch=page.locator('.instrument-actions button').filter({hasText:'Watch'}).first();
  check(await watch.isVisible().catch(()=>false),'root desktop: Watch action missing');
  if(await watch.isVisible().catch(()=>false)){
    await watch.click();
    check(await visible(page,'#suite',15000),'root desktop: Watch did not open Hub');
    check(await page.locator('[data-suite-panel="watch"]').evaluate(e=>e.classList.contains('active')).catch(()=>false),'root desktop: Watch panel not active');
    check(await visible(page,'#rwaSocialNotify',12000),'root desktop: social notification controls missing');
    check(await visible(page,'#rwaNotifySave',12000),'root desktop: social notification save control missing');
    if(await visible(page,'#rwaNotifySave',2000))await page.locator('#rwaNotifySave').click();
  }
  const close=page.locator('[data-suite-close]').first();if(await close.isVisible().catch(()=>false))await close.click();
  const trade=page.locator('[data-rwa-trade-now]').first();
  const href=await trade.evaluate(()=>location.href).catch(()=>BASE);
  check(href.startsWith('http'),'root desktop: page location invalid');
  await noOverflow(page,'root desktop');
  check(errors.length===0,`root desktop: uncaught JS error(s): ${errors.join(' | ')}`);
  await context.close();
}

// Trade desktop: deep-link, order controls, modals, chart interval, margin and locked fund controls.
{
  const {context,page,errors}=await pageFor({width:1440,height:1100});
  await page.goto(`${BASE}trade/?coin=BTC&side=SELL&type=LIMIT&usd=50&leverage=2&browser-smoke=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(1800);
  check(await visible(page,'#priceChart'),'trade desktop: chart missing');
  check(await visible(page,'#marketPickerBtn'),'trade desktop: market picker missing');
  check(await visible(page,'#marginModeControl',12000),'trade desktop: margin selector missing');
  check(await visible(page,'#chartTradeOverlay',12000),'trade desktop: chart overlay missing');
  check(await visible(page,'#mainnetDepositBtn',12000),'trade desktop: mainnet deposit control missing');
  check(await page.locator('#mainnetDepositBtn').isDisabled().catch(()=>false),'trade desktop: mainnet deposit must remain disabled while TESTNET/launch-locked');
  check(await page.locator('#withdrawBtn').isDisabled().catch(()=>false),'trade desktop: withdrawal must remain disabled while TESTNET/launch-locked');
  check(await page.locator('[data-side-btn="SELL"]').evaluate(e=>e.classList.contains('active')).catch(()=>false),'trade desktop: SELL deep-link not applied');
  check(await page.locator('[data-type-btn="LIMIT"]').evaluate(e=>e.classList.contains('active')).catch(()=>false),'trade desktop: LIMIT deep-link not applied');
  check((await page.locator('#orderUsd').inputValue().catch(()=>''))==='50','trade desktop: USD deep-link not applied');
  check((await page.locator('#leverage').inputValue().catch(()=>''))==='2','trade desktop: leverage deep-link not applied');

  await page.locator('#marketPickerBtn').click();
  check(await visible(page,'#marketPickerModal.open'),'trade desktop: market picker modal did not open');
  await page.locator('[data-close-modal="marketPickerModal"]').click();
  await page.locator('#riskSettingsBtn').click();
  check(await visible(page,'#riskModal.open'),'trade desktop: risk modal did not open');
  await page.locator('[data-close-modal="riskModal"]').click();
  await page.locator('[data-margin-mode="cross"]').click();
  check(await page.locator('[data-margin-mode="cross"]').evaluate(e=>e.classList.contains('active')).catch(()=>false),'trade desktop: cross margin button not operable');
  await page.locator('[data-margin-mode="isolated"]').click();
  check(await page.locator('[data-margin-mode="isolated"]').evaluate(e=>e.classList.contains('active')).catch(()=>false),'trade desktop: isolated margin button not operable');
  await page.locator('[data-interval="1h"]').click();
  check(await page.locator('[data-interval="1h"]').evaluate(e=>e.classList.contains('active')).catch(()=>false),'trade desktop: chart interval not operable');
  await noOverflow(page,'trade desktop');
  check(errors.length===0,`trade desktop: uncaught JS error(s): ${errors.join(' | ')}`);
  await context.close();
}

// Mobile: critical surfaces must fit and stay actionable without horizontal scrolling.
for(const [name,path] of [['root mobile',''],['trade mobile','trade/?side=BUY&type=MARKET&usd=25']]){
  const {context,page,errors}=await pageFor({width:390,height:844});
  await page.goto(`${BASE}${path}${path.includes('?')?'&':'?'}browser-smoke=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(1700);
  if(name==='root mobile'){
    check(await visible(page,'.mobile-tabs'),'root mobile: bottom navigation missing');
    const social=page.locator('[data-mobile-nav="social"]').first();
    check(await social.isVisible().catch(()=>false),'root mobile: Social navigation missing');
    if(await social.isVisible().catch(()=>false)){
      await social.click();
      check(await visible(page,'#rwaLiveTradeFeed',12000),'root mobile: live trader feed missing from Social');
    }
    const hub=page.locator('[data-mobile-nav="hub"]').first();check(await hub.isVisible().catch(()=>false),'root mobile: Hub navigation missing');
    if(await hub.isVisible().catch(()=>false)){await hub.click();check(await visible(page,'#suite',15000),'root mobile: Hub did not open')}
  }else{
    check(await visible(page,'.mobile-trade-bar'),'trade mobile: fixed trade bar missing');
    check(await visible(page,'#marginModeControl',12000),'trade mobile: margin selector missing');
    check(await visible(page,'#priceChart'),'trade mobile: chart missing');
    check(await visible(page,'#mainnetDepositBtn',12000),'trade mobile: mainnet deposit control missing');
    check(await page.locator('#mainnetDepositBtn').isDisabled().catch(()=>false),'trade mobile: mainnet funding must stay locked in public beta');
  }
  await noOverflow(page,name);
  check(errors.length===0,`${name}: uncaught JS error(s): ${errors.join(' | ')}`);
  await context.close();
}

await browser.close();
if(failures.length){console.error(JSON.stringify({ok:false,contract:'rwa-browser-operability-v3',failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,contract:'rwa-browser-operability-v3',desktop:['root actions','venue social feed','notification settings','trade controls','modals','margin','chart','locked funds'],mobile:['social feed','root hub','trade bar','margin','chart','locked funds','no horizontal overflow']},null,2));
