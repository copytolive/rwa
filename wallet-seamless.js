(()=>{
'use strict';
if(window.RWAWalletSeamless)return;
let switching=false,last='';
const session=()=>window.RWAWalletAuth?.session?.();
const toast=t=>typeof window.toast==='function'?window.toast(t):console.log(t);
async function resync(accounts){
 const next=String(accounts?.[0]||'').toLowerCase();if(!next||switching)return;
 const active=String(session()?.wallet||'').toLowerCase();if(active===next){window.RWAExchangeCore?.refresh?.();return}
 switching=true;last=next;
 try{
  await new Promise(r=>setTimeout(r,40));
  const row=await window.RWAWalletAuth?.login?.();
  if(row?.wallet){toast(`Account active · ${row.wallet.slice(0,6)}…${row.wallet.slice(-4)}`);window.RWAExchangeCore?.refresh?.()}
 }catch(e){console.warn('RWA account sync',e)}finally{switching=false}
}
function attach(p){if(!p?.on||p.__rwaSeamless)return;p.__rwaSeamless=true;p.on('accountsChanged',resync);p.on('chainChanged',chain=>{window.dispatchEvent(new CustomEvent('rwa:wallet-chain',{detail:{chain}}));window.RWAExchangeCore?.refresh?.()})}
attach(window.ethereum);window.addEventListener('eip6963:announceProvider',e=>attach(e.detail?.provider));window.addEventListener('rwa:wallet-login',()=>{attach(window.RWAProvider);window.RWAExchangeCore?.refresh?.()});
window.RWAWalletSeamless={resync,attach,get switching(){return switching},get last(){return last}};
})();