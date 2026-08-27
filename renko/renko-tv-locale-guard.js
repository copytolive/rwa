/* Locale safety for browser/runtime environments that expose POSIX locale tags
 * such as en-US@posix. ECMA-402 rejects those tags. Keep formatting alive by
 * retrying only RangeError failures with a standards-compliant en-US locale.
 */
(()=>{
'use strict';
if(window.RWARenkoLocaleGuard)return;
function wrap(proto,key){
  const native=proto[key];
  if(typeof native!=='function')return;
  Object.defineProperty(proto,key,{configurable:true,writable:true,value:function(locales,options){
    try{return native.call(this,locales,options)}
    catch(e){if(e instanceof RangeError)return native.call(this,'en-US',options);throw e}
  }});
}
wrap(Number.prototype,'toLocaleString');
wrap(Date.prototype,'toLocaleString');
window.RWARenkoLocaleGuard={version:'1.0.0',fallbackLocale:'en-US'};
})();
