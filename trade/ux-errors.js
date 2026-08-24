(()=>{
'use strict';
if(window.RWATradeFriendlyErrors)return;

function friendly(error){
  const raw=String(error?.cause?.message||error?.shortMessage||error?.details||error?.message||error||'Unknown error');
  const code=String(error?.code||error?.cause?.code||error?.info?.error?.code||'');
  if(code==='4001'||code==='ACTION_REJECTED'||/user rejected|user denied|ethers-user-denied|rejected the request/i.test(raw)){
    return 'Trading approval was canceled. No order was placed. Click Enable trading and approve the one-time request in your wallet.';
  }
  if(/signTypedData|eth_signTypedData_v4/i.test(raw)&&/reject|denied|cancel/i.test(raw)){
    return 'Trading approval was canceled. No order was placed. Click Enable trading and approve the one-time request in your wallet.';
  }
  if(/insufficient funds|insufficient margin/i.test(raw))return 'Not enough TESTNET balance for this action.';
  if(/agent|api wallet/i.test(raw)&&/required|not ready|not enabled|not configured/i.test(raw))return 'Enable trading once before placing orders.';
  const safe=raw.replace(/\s*\(action=.*$/s,'').replace(/\s*info=\{.*$/s,'').replace(/\s*payload=\{.*$/s,'').trim();
  return safe.length>220?`${safe.slice(0,217)}…`:safe;
}

function wrap(){
  const api=window.RWAExecutionAPI;
  if(!api?.agent||api.agent.__rwaFriendlyWrapped)return false;
  api.agent.__rwaFriendlyWrapped=true;
  for(const name of ['authorize','revoke']){
    const original=api.agent[name];
    if(typeof original!=='function')continue;
    api.agent[name]=async(...args)=>{
      try{return await original(...args)}catch(error){
        const next=new Error(friendly(error));
        next.code=String(error?.code||error?.cause?.code||error?.info?.error?.code||'');
        throw next;
      }
    };
  }
  return true;
}

window.RWATradeFriendlyErrors={friendly,wrap};
let tries=0;
const timer=setInterval(()=>{tries++;if(wrap()||tries>100)clearInterval(timer)},50);
window.addEventListener('rwa:execution-api-ready',wrap,{once:true});
})();
