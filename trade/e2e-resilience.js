(()=>{
'use strict';
if(window.RWATradeE2EResilience)return;

const MARKER='e2e-read-backoff-v1';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const text=error=>String(error?.cause?.message||error?.shortMessage||error?.details||error?.message||error||'');
const retryable=error=>/Execution info HTTP 429|HTTP 429|rate.?limit|too many requests/i.test(text(error));

async function retryRead(fn,{attempts=10,baseMs=1200,maxMs=12000}={}){
  let last;
  for(let attempt=0;attempt<attempts;attempt++){
    try{return await fn()}
    catch(error){
      last=error;
      if(!retryable(error)||attempt===attempts-1)throw error;
      const delay=Math.min(maxMs,baseMs*Math.pow(1.7,attempt));
      window.dispatchEvent(new CustomEvent('rwa:e2e-read-backoff',{detail:{attempt:attempt+1,delay,marker:MARKER}}));
      await sleep(delay);
    }
  }
  throw last||new Error('TESTNET read retry exhausted');
}

function wrapMethod(target,name){
  if(!target||typeof target[name]!=='function')return false;
  const current=target[name];
  if(current.__rwaE2EResilient)return true;
  const wrapped=async(...args)=>retryRead(()=>current.apply(target,args));
  wrapped.__rwaE2EResilient=true;
  wrapped.__rwaOriginal=current;
  target[name]=wrapped;
  return true;
}

function install(){
  const api=window.RWAExecutionAPI;
  if(!api||api.__rwaE2EResilienceInstalled)return false;
  api.__rwaE2EResilienceInstalled=true;
  wrapMethod(api,'info');
  wrapMethod(api.account,'state');
  wrapMethod(api.account,'fills');
  wrapMethod(api.orders,'open');
  wrapMethod(api.orders,'history');
  return true;
}

window.RWATradeE2EResilience={version:'1.0.0',marker:MARKER,retryRead,install};
let tries=0;
const timer=setInterval(()=>{
  tries++;
  if(install()||tries>160)clearInterval(timer);
},50);
window.addEventListener('rwa:execution-api-ready',install,{once:true});
})();
