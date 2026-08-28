/* Production timeframe hard lock. Must run before renko-tv-app.js. */
(()=>{
'use strict';
const STORE='rwa_renko_tradingview_settings_v1';
try{const raw=JSON.parse(localStorage.getItem(STORE)||'{}')||{};raw.interval='1s';localStorage.setItem(STORE,JSON.stringify(raw))}catch{}
document.documentElement.dataset.fixedInterval='1s';
window.RENKO_FIXED_INTERVAL='1s';
window.RWARenkoFixed1s={version:'1.0.0',interval:'1s',selectorAllowed:false};
})();
