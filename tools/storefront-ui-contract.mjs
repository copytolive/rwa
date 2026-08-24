import {readFile} from 'node:fs/promises';
const read=p=>readFile(p,'utf8');
const [registryText,storefront,safety,draftUi,draftCss,homeCommerce,homeCss,uiCss,quick,tradePolish,tradeCss,tradeCfg,assetsText]=await Promise.all([
  read('rwa-commerce-registry.json'),read('rwa-storefront.js'),read('rwa-storefront-safety-patch.js'),read('rwa-store-draft-ui.js'),read('rwa-store-draft-ui.css'),read('rwa-home-commerce.js'),read('rwa-home-commerce.css'),read('rwa-ui-pro.css'),read('quick-actions.js'),read('trade/ui-polish.js'),read('trade/ui-polish.css'),read('trade/config.js'),read('rwa-assets.json')
]);
const registry=JSON.parse(registryText),assets=JSON.parse(assetsText),fail=[];const ok=(v,m)=>{if(!v)fail.push(m)};
const stores=Array.isArray(registry.stores)?registry.stores:[],tokens=stores.map(x=>String(x.token||'').toLowerCase()),addresses=stores.map(x=>String(x.physical_store?.full_address||'').trim().toLowerCase()).filter(Boolean);
ok(registry.policy==='ONE_TOKEN_ONE_PHYSICAL_STORE_V1','one-token-one-store policy missing');
ok(registry.rules?.one_token_one_physical_store===true,'registry does not enforce one token : one physical store');
ok(registry.rules?.verified_store_required_for_live_commerce===true,'verified physical store requirement missing');
ok(registry.rules?.verified_asset_required_for_live_token_store===true,'verified RWA asset requirement missing');
ok(Array.isArray(registry.rules?.physical_store_evidence_required)&&registry.rules.physical_store_evidence_required.length>=6,'physical-store evidence contract incomplete');
ok(Array.isArray(registry.stores),'store registry malformed');
ok(new Set(tokens).size===tokens.length,'duplicate token mapping found in physical-store registry');
ok(new Set(addresses).size===addresses.length,'one physical store address is mapped to multiple tokens');
ok(Array.isArray(assets.verified),'RWA asset registry malformed');
ok(storefront.includes("policy:'ONE_TOKEN_ONE_PHYSICAL_STORE_V1'"),'storefront policy marker missing');
ok(storefront.includes('verifiedStore(s)&&verifiedAsset(s.token)'),'live store must require physical-store + RWA asset verification');
ok(storefront.includes('Shopping cart')&&storefront.includes('Checkout activates with backend + verified store'),'cart / backend-gated checkout UI missing');
ok(storefront.includes('data-mobile-nav="shop"')&&storefront.includes('rwaCommandLayer'),'mobile Shop navigation or command palette missing');
ok(storefront.includes('Trade token')&&storefront.includes('trade/?coin='),'store-to-token trading route missing');
ok(safety.includes("runtime:'preview-no-fake-price-trade-v1'")&&safety.includes('Trade after verification')&&safety.includes('Price pending'),'honest preview hardening missing');
ok(draftUi.includes("policy:'ONE_TOKEN_ONE_PHYSICAL_STORE_V1'")&&draftUi.includes('Physical store identity'),'physical-store onboarding UI missing');
ok(draftUi.includes('One physical store cannot be reused by another token'),'local one-store-one-token collision guard missing');
ok(draftUi.includes("status:'UNVERIFIED_LOCAL_DRAFT'"),'store drafts must remain unverified');
ok(draftCss.includes('.rwa-store-form')&&draftCss.includes('@media(max-width:680px)'),'responsive physical-store onboarding CSS missing');
ok(homeCommerce.includes("runtime:'landing-commerce-surface-v1'")&&homeCommerce.includes('Open Physical Stores')&&homeCommerce.includes('Verification Rules'),'commerce-first landing banner missing');
ok(homeCss.includes('.rwa-commerce-banner')&&homeCss.includes('@media(max-width:760px)'),'responsive commerce landing CSS missing');
const uiRuntime=storefront+safety+draftUi+homeCommerce+tradePolish;
ok(!/api\.hyperliquid(?:-testnet)?\.xyz\/exchange|['"]\/exchange['"]/.test(uiRuntime),'commerce UI must not create an exchange write route');
ok(!uiRuntime.includes('ExchangeClient'),'commerce UI must not instantiate exchange clients');
ok(uiCss.includes('.rwa-shop-screen')&&uiCss.includes('@media(max-width:680px)'),'responsive storefront CSS missing');
ok(quick.includes("loadScript('rwa-storefront.js?v=1')")&&quick.includes("loadScript('rwa-storefront-safety-patch.js?v=1')")&&quick.includes("loadScript('rwa-store-draft-ui.js?v=1')")&&quick.includes("loadScript('rwa-home-commerce.js?v=1')")&&quick.includes("runtime:'premium-shell-storefront-v1'"),'root shell does not load the complete storefront UI stack');
ok(tradeCfg.includes("import './ui-polish.js?v=1'"),'trade shell does not load UI polish runtime');
ok(tradePolish.includes('rwa-store-link')&&tradePolish.includes('../?shop=1'),'trade-to-store navigation missing');
ok(tradeCss.includes('.order{position:sticky')&&tradeCss.includes('.rwa-trade-mobile-store'),'desktop sticky order / mobile store polish missing');
if(fail.length){console.error(JSON.stringify({ok:false,contract:'rwa-physical-commerce-ui-v3',fail},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,contract:'rwa-physical-commerce-ui-v3',policy:registry.policy,liveStores:registry.stores.length,verifiedAssets:assets.verified.length,frontend:'desktop+mobile+landing+shop+cart+command-palette+physical-store-onboarding',checkout:'BACKEND_GATED'},null,2));
