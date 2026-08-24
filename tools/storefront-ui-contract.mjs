import {readFile} from 'node:fs/promises';
const read=p=>readFile(p,'utf8');
const [registryText,storefront,uiCss,quick,tradePolish,tradeCss,tradeCfg,assetsText]=await Promise.all([
  read('rwa-commerce-registry.json'),read('rwa-storefront.js'),read('rwa-ui-pro.css'),read('quick-actions.js'),read('trade/ui-polish.js'),read('trade/ui-polish.css'),read('trade/config.js'),read('rwa-assets.json')
]);
const registry=JSON.parse(registryText),assets=JSON.parse(assetsText),fail=[];const ok=(v,m)=>{if(!v)fail.push(m)};
ok(registry.policy==='ONE_TOKEN_ONE_PHYSICAL_STORE_V1','one-token-one-store policy missing');
ok(registry.rules?.one_token_one_physical_store===true,'registry does not enforce one token : one physical store');
ok(registry.rules?.verified_store_required_for_live_commerce===true,'verified physical store requirement missing');
ok(registry.rules?.verified_asset_required_for_live_token_store===true,'verified RWA asset requirement missing');
ok(Array.isArray(registry.rules?.physical_store_evidence_required)&&registry.rules.physical_store_evidence_required.length>=6,'physical-store evidence contract incomplete');
ok(Array.isArray(registry.stores),'store registry malformed');
ok(Array.isArray(assets.verified),'RWA asset registry malformed');
ok(storefront.includes("policy:'ONE_TOKEN_ONE_PHYSICAL_STORE_V1'"),'storefront policy marker missing');
ok(storefront.includes('verifiedStore(s)&&verifiedAsset(s.token)'),'live store must require physical-store + RWA asset verification');
ok(storefront.includes('Shopping cart')&&storefront.includes('Checkout activates with backend + verified store'),'cart / backend-gated checkout UI missing');
ok(storefront.includes('data-mobile-nav="shop"')&&storefront.includes('rwaCommandLayer'),'mobile Shop navigation or command palette missing');
ok(storefront.includes('Trade token')&&storefront.includes('trade/?coin='),'store-to-token trading route missing');
ok(!/api\.hyperliquid(?:-testnet)?\.xyz\/exchange|['"]\/exchange['"]/.test(storefront),'storefront must not create an exchange write route');
ok(!storefront.includes('ExchangeClient'),'storefront must not instantiate exchange clients');
ok(uiCss.includes('.rwa-shop-screen')&&uiCss.includes('@media(max-width:680px)'),'responsive storefront CSS missing');
ok(quick.includes("loadScript('rwa-storefront.js?v=1')")&&quick.includes("runtime:'premium-shell-storefront-v1'"),'root shell does not load storefront runtime');
ok(tradeCfg.includes("import './ui-polish.js?v=1'"),'trade shell does not load UI polish runtime');
ok(tradePolish.includes('rwa-store-link')&&tradePolish.includes('../?shop=1'),'trade-to-store navigation missing');
ok(tradeCss.includes('.order{position:sticky')&&tradeCss.includes('.rwa-trade-mobile-store'),'desktop sticky order / mobile store polish missing');
if(fail.length){console.error(JSON.stringify({ok:false,contract:'rwa-physical-commerce-ui-v1',fail},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,contract:'rwa-physical-commerce-ui-v1',policy:registry.policy,liveStores:registry.stores.length,verifiedAssets:assets.verified.length,frontend:'desktop+mobile+shop+cart+command-palette',checkout:'BACKEND_GATED'},null,2));
