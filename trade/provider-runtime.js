const providers=[];
const seen=new Set();
function adopt(provider,info={}){
  if(!provider?.request||seen.has(provider))return;
  seen.add(provider);providers.push({provider,info});
  if(!window.RWAProvider)window.RWAProvider=provider;
  if(!window.ethereum){try{window.ethereum=provider}catch{}}
  window.dispatchEvent(new CustomEvent('rwa:wallet-provider',{detail:{count:providers.length,name:info?.name||'Wallet'}}));
}
function boot(){
  if(window.ethereum?.request)adopt(window.ethereum,{name:'Injected wallet'});
  for(const p of window.ethereum?.providers||[])adopt(p,{name:p?.isMetaMask?'MetaMask':p?.isCoinbaseWallet?'Coinbase Wallet':'Injected wallet'});
  window.addEventListener('eip6963:announceProvider',e=>adopt(e?.detail?.provider,e?.detail?.info||{}));
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  setTimeout(()=>window.dispatchEvent(new Event('eip6963:requestProvider')),250);
}
window.RWAProviderRuntime={version:'1.0.0',providers:()=>providers.map(x=>({name:x.info?.name||'Wallet',rdns:x.info?.rdns||'',uuid:x.info?.uuid||''})),provider:()=>window.RWAProvider||window.ethereum||providers[0]?.provider||null,adopt};
boot();
