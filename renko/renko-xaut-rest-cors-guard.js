/* RENKO XAUT browser CORS guard.
 * OKX REST history-candles does not expose browser CORS for this origin.
 * Intercept only the XAUT-USDT 1s catch-up request before locale-guard captures
 * fetch. Return explicit unavailable status with NO market rows. The verified
 * same-origin provider-native OKX 1s pack remains bootstrap authority and the
 * official OKX candle1s WebSocket remains realtime. No synthesis, interpolation,
 * timeframe substitution, or upsampling occurs here.
 */
(()=>{
'use strict';
if(window.RWARenkoXAUTRestCorsGuard)return;
const nativeFetch=window.fetch.bind(window);
const REST_HOST='www.okx.com';
const REST_PATH='/api/v5/market/history-candles';
function urlOf(input){try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}}
function isBlockedXautCatchup(u){return !!u&&u.hostname===REST_HOST&&u.pathname===REST_PATH&&String(u.searchParams.get('instId')||'').toUpperCase()==='XAUT-USDT'&&String(u.searchParams.get('bar')||'').toLowerCase()==='1s'}
window.fetch=function(input,init){
  const u=urlOf(input);
  if(!isBlockedXautCatchup(u))return nativeFetch(input,init);
  return Promise.resolve(new Response(JSON.stringify({code:'RENKO_BROWSER_CORS_UNAVAILABLE',msg:'OKX browser REST catch-up disabled; verified provider-native pack + official candle1s WebSocket remain authoritative.',data:[]}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store','x-renko-xaut-rest-cors':'blocked-without-data'}}));
};
window.RWARenkoXAUTRestCorsGuard={version:'1.0.0',scope:'OKX Spot XAUT-USDT history-candles 1s only',returnsMarketRows:false,bootstrap:'provider-native-static-pack',realtime:'official-okx-candle1s-websocket'};
})();
