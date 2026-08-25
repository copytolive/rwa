(()=>{
'use strict';
/* RWA_LOCALE_FALLBACK_V1 */
(()=>{'use strict';const F='en-US';let broken=false;try{new Intl.NumberFormat().format(1);new Intl.DateTimeFormat().format(new Date())}catch(e){broken=e instanceof RangeError}if(!broken)return;const wrap=(proto,name)=>{const native=proto&&proto[name];if(typeof native!=='function')return;Object.defineProperty(proto,name,{configurable:true,writable:true,value:function(locales,...rest){try{return native.call(this,locales,...rest)}catch(e){if(e instanceof RangeError&&(locales===undefined||locales===null))return native.call(this,F,...rest);throw e}}})};wrap(Number.prototype,'toLocaleString');if(typeof BigInt!=='undefined')wrap(BigInt.prototype,'toLocaleString');for(const n of ['toLocaleString','toLocaleDateString','toLocaleTimeString'])wrap(Date.prototype,n);for(const name of ['NumberFormat','DateTimeFormat']){const Native=Intl[name];if(typeof Native!=='function')continue;function Safe(locales,...rest){try{return new Native(locales,...rest)}catch(e){if(e instanceof RangeError&&(locales===undefined||locales===null))return new Native(F,...rest);throw e}}Object.setPrototypeOf(Safe,Native);Safe.prototype=Native.prototype;Object.defineProperty(Intl,name,{configurable:true,writable:true,value:Safe})}window.__RWA_LOCALE_FALLBACK__=F})();
window.RWALegacyCanonical={version:'5.0.0',canonical:'https://copytolive.github.io/rwa/'};
try{
  const u=new URL(location.href),p=u.pathname.replace(/\/+$/,'/'),base='/rwa/';
  // Embedded legacy engines are allowed only inside the canonical Super App workspace.
  // Never redirect an iframe carrying ?embed=1 or it would recurse back into /rwa/.
  if(u.searchParams.get('embed')==='1'){document.documentElement.dataset.rwaEmbedded='1';return;}
  if(p===base)return;
  let route='markets';
  if(p.startsWith(base+'trade/'))route='trade/'+(u.searchParams.get('coin')||'BTC').toUpperCase();
  else if(p.startsWith(base+'asset/'))route='asset/'+(u.searchParams.get('symbol')||'BTC').toUpperCase();
  else if(p.startsWith(base+'trader/'))route='trader/'+(u.searchParams.get('wallet')||'');
  else if(p.startsWith(base+'backtest/'))route='research/backtest/'+(u.searchParams.get('symbol')||'BTC').toUpperCase();
  else if(p.startsWith(base+'renko/'))route='research/renko/'+(u.searchParams.get('symbol')||'BTC').toUpperCase();
  else return;
  const target=new URL(base,location.origin);target.hash=route;location.replace(target.href);
}catch{}
})();
