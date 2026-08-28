/* TradingView Percentage (LTP) runtime lock.
 * Official observable rule: Percentage box is derived from the LTP at the
 * moment the symbol is loaded, then remains fixed across the historical rebuild.
 */
(()=>{
'use strict';
if(window.RWARenkoPercentageLTP)return;
const E=window.RWARenkoTVEngine;if(!E?.build||!E?.percentageLtpStableRound)return;
const originalBuild=E.build.bind(E),snapshots=new Map();
function tv(){return window.RWARenkoTV||null}
function snapshotFor(T){if(!T)return NaN;const symbol=String(T.state?.symbol||'');if(!symbol)return NaN;if(snapshots.has(symbol))return snapshots.get(symbol);const p=Number(T.state?.lastPrice);if(p>0){snapshots.set(symbol,p);T.state.percentageLtpSnapshot=p;return p}return NaN}
E.build=function(bars,settings={},tickSize=0){
  if(String(settings?.method||'').toLowerCase()!=='percentage')return originalBuild(bars,settings,tickSize);
  const T=tv(),ltp=Number(settings._percentageLtpSnapshot)||snapshotFor(T),pct=Math.max(.000001,Number(settings.percentage)||.01);
  if(!(ltp>0))return originalBuild(bars,settings,tickSize);
  const box=E.percentageLtpStableRound(ltp*pct,tickSize);
  const out=originalBuild(bars,{...settings,_exactBox:box},tickSize);out.percentageLtpSnapshot=ltp;out.percentageLtpPercent=pct;return out;
};
function stamp(){const T=tv();if(!T)return;const p=snapshotFor(T);if(p>0){T.state.percentageLtpSnapshot=p;document.documentElement.dataset.percentageLtpSnapshot=String(p)}}
window.addEventListener('renko:tv-ready',stamp,{once:true});
let lastSymbol='';setInterval(()=>{const T=tv();if(!T||T.state.status!=='live')return;const s=String(T.state.symbol||'');if(s&&s!==lastSymbol){lastSymbol=s;const p=Number(T.state.lastPrice);if(p>0){snapshots.set(s,p);T.state.percentageLtpSnapshot=p;document.documentElement.dataset.percentageLtpSnapshot=String(p)}}},250);
window.RWARenkoPercentageLTP={version:'1.0.0',rule:'symbol-load-ltp-fixed-across-rebuild',snapshotFor,get snapshots(){return new Map(snapshots)}};
})();