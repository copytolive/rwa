(()=>{
'use strict';
if(window.RWATradeFriendlyErrors)return;

const RETRY_MARKER='info-429-backoff-v1';

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function retryAfterMs(response,attempt){
  const raw=String(response?.headers?.get?.('retry-after')||'').trim();
  if(raw){
    const seconds=Number(raw);
    if(Number.isFinite(seconds)&&seconds>=0)return Math.min(15000,Math.max(500,seconds*1000));
    const when=Date.parse(raw);
    if(Number.isFinite(when))return Math.min(15000,Math.max(500,when-Date.now()));
  }
  return Math.min(10000,700*Math.pow(2,attempt));
}
function isInfoRead(input,init){
  const url=String(input instanceof Request?input.url:input||'');
  const method=String(init?.method||(input instanceof Request?input.method:'GET')||'GET').toUpperCase();
  return method==='POST'&&/^https:\/\/api\.hyperliquid(?:-testnet)?\.xyz\/info(?:\?|$)/i.test(url);
}
function installInfoRetry(){
  if(window.__rwaInfoRetryInstalled)return true;
  const nativeFetch=window.fetch?.bind(window);
  if(typeof nativeFetch!=='function')return false;
  window.__rwaInfoRetryInstalled=true;
  window.fetch=async function(input,init){
    if(!isInfoRead(input,init))return nativeFetch(input,init);
    const requestTemplate=input instanceof Request?input.clone():null;
    let response=null;
    for(let attempt=0;attempt<6;attempt++){
      const retryInput=requestTemplate?requestTemplate.clone():input;
      response=await nativeFetch(retryInput,init);
      if(response.status!==429)return response;
      if(attempt===5)return response;
      const delay=retryAfterMs(response,attempt);
      try{response.body?.cancel?.()}catch{}
      window.dispatchEvent(new CustomEvent('rwa:info-rate-limit',{detail:{attempt:attempt+1,delay,marker:RETRY_MARKER}}));
      await sleep(delay);
    }
    return response;
  };
  return true;
}

function friendly(error){
  const raw=String(error?.cause?.message||error?.shortMessage||error?.details||error?.message||error||'Unknown error');
  const code=String(error?.code||error?.cause?.code||error?.info?.error?.code||'');
  if(code==='4001'||code==='ACTION_REJECTED'||/user rejected|user denied|ethers-user-denied|rejected the request/i.test(raw)){
    return 'Trading approval was canceled. No order was placed. Click Enable trading and approve the one-time request in your wallet.';
  }
  if(/signTypedData|eth_signTypedData_v4/i.test(raw)&&/reject|denied|cancel/i.test(raw)){
    return 'Trading approval was canceled. No order was placed. Click Enable trading and approve the one-time request in your wallet.';
  }
  if(/Execution info HTTP 429|HTTP 429|rate.?limit/i.test(raw)){
    return 'TESTNET data service is temporarily rate-limited. RWA will back off automatically; wait a few seconds and run the verification again if needed.';
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

installInfoRetry();
window.RWATradeFriendlyErrors={friendly,wrap,installInfoRetry,rateLimitRetry:RETRY_MARKER};
let tries=0;
const timer=setInterval(()=>{tries++;installInfoRetry();if(wrap()||tries>100)clearInterval(timer)},50);
window.addEventListener('rwa:execution-api-ready',()=>{installInfoRetry();wrap()},{once:true});
})();
