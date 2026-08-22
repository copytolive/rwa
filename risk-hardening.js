(()=>{
'use strict';
if(window.RWARiskHardening)return;

function activeTestnet(order){if(typeof order?.testnet==='boolean')return order.testnet;const a=document.getElementById('tradeTestnet'),b=document.getElementById('opsTestnet');if(a)return !!a.checked;if(b)return !!b.checked;return true}
function install(){
  if(!window.RWARisk||window.RWARisk.__hardened)return false;
  const base=window.RWARisk.check.bind(window.RWARisk);
  window.RWARisk.check=async order=>{
    const api=window.RWAExecutionAPI;
    if(api?.risk?.check)return api.risk.check(order||{},activeTestnet(order));
    if(order?.reduceOnly)return base(order);
    const refresh=window.RWARisk.refresh?.bind(window.RWARisk);if(refresh)await refresh();
    const cfg=window.RWARisk.cfg?.()||{};
    const live=window.__rwaRiskLive||{};
    const requested=Number(order?.leverage||1);
    if(Number(cfg.maxLeverage)>0&&requested>Number(cfg.maxLeverage))throw Error(`Requested leverage ${requested}x exceeds max ${cfg.maxLeverage}x`);
    if(Number(cfg.maxLeverage)>0&&Number(live.lev||0)>Number(cfg.maxLeverage))throw Error(`Account leverage ${Number(live.lev).toFixed(1)}x exceeds max ${cfg.maxLeverage}x`);
    return base(order);
  };
  window.RWARisk.__hardened=true;
  return true;
}

const timer=setInterval(()=>{if(install())clearInterval(timer)},100);
setTimeout(()=>clearInterval(timer),10000);
window.RWARiskHardening={install};
})();
