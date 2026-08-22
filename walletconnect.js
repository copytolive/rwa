(()=>{
'use strict';
if(window.RWAWalletConnect)return;
let app=null,booting=null;
const KEY='rwa_wc_project_v1',SESSION='rwa_wallet_link_v1';
const toast=t=>typeof window.toast==='function'?window.toast(t):console.log(t);
async function init(projectId){
 if(app)return app;if(booting)return booting;
 booting=(async()=>{
  const [{createAppKit},{EthersAdapter},{mainnet,arbitrum}]=await Promise.all([
   import('https://esm.sh/@reown/appkit@1.8.16'),
   import('https://esm.sh/@reown/appkit-adapter-ethers@1.8.16'),
   import('https://esm.sh/@reown/appkit@1.8.16/networks')
  ]);
  app=createAppKit({adapters:[new EthersAdapter()],networks:[arbitrum,mainnet],projectId,metadata:{name:'RWA Markets',description:'RWA Markets wallet-only trading network',url:location.origin,icons:[]},features:{analytics:false,email:false,socials:[]},allWallets:'SHOW',themeMode:'dark'});
  const sync=()=>{try{const p=app.getWalletProvider?.()||app.getProviders?.()?.eip155;if(p)window.RWAProvider=p}catch{}};
  app.subscribeProvider?.(s=>{if(s?.provider){window.RWAProvider=s.provider}});app.subscribeProviders?.(s=>{if(s?.eip155)window.RWAProvider=s.eip155});sync();
  return app;
 })();
 try{return await booting}finally{booting=null}
}
async function waitProvider(a,timeout=120000){
 const now=a.getWalletProvider?.()||a.getProviders?.()?.eip155;if(now)return now;
 return new Promise((resolve,reject)=>{let done=false;const timer=setTimeout(()=>{if(!done){done=true;reject(Error('Wallet connection timed out'))}},timeout);const fn=s=>{const p=s?.provider||s?.eip155||a.getWalletProvider?.()||a.getProviders?.()?.eip155;if(p&&!done){done=true;clearTimeout(timer);resolve(p)}};a.subscribeProvider?.(fn);a.subscribeProviders?.(fn)});
}
async function connect(projectId=localStorage.getItem(KEY)||''){
 if(!projectId)throw Error('Reown Project ID is required');localStorage.setItem(KEY,projectId);
 const a=await init(projectId);await a.open({view:'Connect',namespace:'eip155'});const p=await waitProvider(a);window.RWAProvider=p;
 const accounts=await p.request({method:'eth_accounts'});const address=String(accounts?.[0]||'').toLowerCase();if(!/^0x[a-f0-9]{40}$/.test(address))throw Error('Wallet address unavailable');
 const ts=Date.now(),message=`RWA Network wallet login\nWallet: ${address}\nTime: ${ts}`;
 const {BrowserProvider}=await import('https://esm.sh/ethers@6.15.0');const signer=await new BrowserProvider(p).getSigner();const signature=await signer.signMessage(message);
 localStorage.setItem(SESSION,JSON.stringify({wallet:address,message,signature,ts,via:'walletconnect'}));sessionStorage.setItem('rwa_wallet_just_logged_in','1');toast('WalletConnect login verified');location.reload();
}
async function disconnect(){try{await app?.adapter?.connectionControllerClient?.disconnect?.()}catch{}window.RWAProvider=null}
async function restore(){const id=localStorage.getItem(KEY);if(!id)return;try{const a=await init(id);if(a.getIsConnected?.()){const p=a.getWalletProvider?.()||a.getProviders?.()?.eip155;if(p)window.RWAProvider=p}}catch(e){console.warn('WalletConnect restore unavailable',e)}}
window.RWAWalletConnect={connect,disconnect,restore};restore();
})();