/* Surgical source-history request guard.
 * The base app historically serialized endTime=null as endTime=0 because
 * Number(null) === 0. Binance kline history must omit endTime when no cursor
 * was supplied. Loaded before renko-tv-app.js so the initial request is fixed
 * without changing Renko geometry or non-ATR methods.
 */
(()=>{
'use strict';
if(window.RWARenkoFetchGuard)return;
const nativeFetch=window.fetch.bind(window);
window.fetch=function(input,init){
  if(typeof input==='string'&&input.includes('/api/v3/klines?')){
    try{
      const u=new URL(input,location.href);
      if(u.searchParams.get('endTime')==='0'){
        u.searchParams.delete('endTime');
        input=u.toString();
      }
    }catch{}
  }
  return nativeFetch(input,init);
};
window.RWARenkoFetchGuard={version:'1.0.0',rule:'omit-null-kline-endTime-instead-of-zero'};
})();
