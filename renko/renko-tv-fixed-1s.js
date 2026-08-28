/* Production timeframe hard lock. Must run before renko-tv-app.js and the XAUT provider. */
(()=>{
'use strict';
const STORE='rwa_renko_tradingview_settings_v1';
try{const raw=JSON.parse(localStorage.getItem(STORE)||'{}')||{};raw.interval='1s';localStorage.setItem(STORE,JSON.stringify(raw))}catch{}
document.documentElement.dataset.fixedInterval='1s';
window.RENKO_FIXED_INTERVAL='1s';
/* OKX candlestick channels are served from /ws/v5/business. The XAUT adapter
 * intentionally keeps its provider declaration stable, while this pre-bootstrap
 * transport guard redirects only that exact endpoint before the adapter captures
 * window.WebSocket. */
const NativeWS=window.WebSocket;
if(typeof NativeWS==='function'&&!window.__RENKO_OKX_WS_BUSINESS_GUARD__){
  function GuardedWS(url,protocols){
    let target=String(url||'');
    if(target==='wss://ws.okx.com:8443/ws/v5/public')target='wss://ws.okx.com:8443/ws/v5/business';
    return protocols===undefined?new NativeWS(target):new NativeWS(target,protocols);
  }
  for(const k of ['CONNECTING','OPEN','CLOSING','CLOSED'])Object.defineProperty(GuardedWS,k,{value:NativeWS[k]});
  GuardedWS.prototype=NativeWS.prototype;
  window.WebSocket=GuardedWS;
  window.__RENKO_OKX_WS_BUSINESS_GUARD__={from:'wss://ws.okx.com:8443/ws/v5/public',to:'wss://ws.okx.com:8443/ws/v5/business'};
}
window.RWARenkoFixed1s={version:'1.1.0',interval:'1s',selectorAllowed:false,okxCandleWebSocket:'business'};
})();
