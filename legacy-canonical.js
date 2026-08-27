(()=>{
'use strict';
/* RWA_LOCALE_FALLBACK_V2 */
(()=>{'use strict';const F='en-US';const NativeCanonical=Intl.getCanonicalLocales.bind(Intl);const cleanTag=t=>{if(t===undefined||t===null||t==='')return F;let s=String(t).trim();if(!s)return F;s=s.split('@',1)[0].replace(/_/g,'-');try{return NativeCanonical(s)[0]||F}catch{return F}};const defaultLocale=()=>{try{if(typeof navigator!=='undefined'){for(const x of [navigator.language,...(Array.isArray(navigator.languages)?navigator.languages:[])]){const c=cleanTag(x);if(c)return c}}}catch{}return F};const cleanLocales=l=>{if(l===undefined||l===null)return defaultLocale();if(Array.isArray(l)){const out=l.map(cleanTag).filter(Boolean);return out.length?out:[F]}return cleanTag(l)};const wrapProto=(proto,name)=>{const native=proto&&proto[name];if(typeof native!=='function')return;Object.defineProperty(proto,name,{configurable:true,writable:true,value:function(locales,...rest){const safe=cleanLocales(locales);try{return native.call(this,safe,...rest)}catch(e){if(e instanceof RangeError)return native.call(this,F,...rest);throw e}}})};wrapProto(Number.prototype,'toLocaleString');if(typeof BigInt!=='undefined')wrapProto(BigInt.prototype,'toLocaleString');for(const n of ['toLocaleString','toLocaleDateString','toLocaleTimeString'])wrapProto(Date.prototype,n);for(const name of ['NumberFormat','DateTimeFormat','Collator','PluralRules','RelativeTimeFormat','ListFormat','DisplayNames']){const Native=Intl[name];if(typeof Native!=='function')continue;function Safe(locales,...rest){const safe=cleanLocales(locales);try{return new Native(safe,...rest)}catch(e){if(e instanceof RangeError)return new Native(F,...rest)}}Object.setPrototypeOf(Safe,Native);Safe.prototype=Native.prototype;Object.defineProperty(Intl,name,{configurable:true,writable:true,value:Safe})}if(typeof Intl.Locale==='function'){const NativeLocale=Intl.Locale;function SafeLocale(tag,...rest){try{return new NativeLocale(cleanTag(tag),...rest)}catch(e){if(e instanceof RangeError)return new NativeLocale(F,...rest);throw e}}Object.setPrototypeOf(SafeLocale,NativeLocale);SafeLocale.prototype=NativeLocale.prototype;Object.defineProperty(Intl,'Locale',{configurable:true,writable:true,value:SafeLocale})}Object.defineProperty(Intl,'getCanonicalLocales',{configurable:true,writable:true,value:function(locales){try{if(Array.isArray(locales))return NativeCanonical(locales.map(cleanTag));return NativeCanonical(cleanTag(locales))}catch{return NativeCanonical(F)}}});window.__RWA_LOCALE_FALLBACK__=F;window.__RWA_SAFE_LOCALE__=defaultLocale()})();
window.RWALegacyCanonical={version:'8.0.0',canonical:'https://copytolive.github.io/rwa/',renkoStandalone:true,renkoController:'185'};
try{
  const u=new URL(location.href),p=u.pathname.replace(/\/+$/,'/'),base='/rwa/';
  const renkoPath=p.startsWith(base+'renko/')||p.startsWith('/renko/');
  if(renkoPath){
    document.documentElement.dataset.rwaRenkoStandalone='tick-native';
    if(!document.querySelector('link[data-renko-mobile-first-frame="185"]')){
      const css=document.createElement('link');css.rel='stylesheet';css.href='renko-v15-mobile-first-frame.css?v=185';css.dataset.renkoMobileFirstFrame='185';document.head.appendChild(css);
    }
    const boot=()=>{
      if(document.querySelector('script[data-renko-bootstrap="185"]')||document.documentElement.dataset.renkoMethodBootstrap==='185')return;
      const s=document.createElement('script');s.src='renko-v15-controller-bootstrap.js?v=185';s.async=false;s.dataset.renkoBootstrap='185';document.body.appendChild(s);
    };
    if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
    return;
  }
  if(u.searchParams.get('embed')==='1'){document.documentElement.dataset.rwaEmbedded='1';return;}
  if(p===base)return;
  let route='markets';
  if(p.startsWith(base+'trade/'))route='trade/'+(u.searchParams.get('coin')||'BTC').toUpperCase();
  else if(p.startsWith(base+'asset/'))route='asset/'+(u.searchParams.get('symbol')||'BTC').toUpperCase();
  else if(p.startsWith(base+'trader/'))route='trader/'+(u.searchParams.get('wallet')||'');
  else if(p.startsWith(base+'backtest/'))route='research/backtest/'+(u.searchParams.get('symbol')||'BTC').toUpperCase();
  else return;
  const target=new URL(base,location.origin);target.hash=route;location.replace(target.href);
}catch{}
})();