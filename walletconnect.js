(()=>{
'use strict';
if(window.RWAWalletConnect)return;
let app=null,booting=null;
const KEY='rwa_wc_project_v1';
async function init(projectId){
 if(app)return app;if(booting)return booting;
 booting=(async()=>{
  const [{createAppKit},{EthersAdapter},{mainnet,arbitrum}]=await Promise.all([
   import('https://esm.sh/@reown/appkit@1.8.23'),
   import('https://esm.sh/@reown/appkit-adapter-ethers@1.8.23'),
   import('https://esm.sh/@reown/appkit@1.8.23/networks')
  ]);
  app=createAppKit({adapters:[new EthersAdapter()],networks:[arbitrum,mainnet],projectId,metadata:{name:'RWA Markets',description:'RWA Markets wallet-only trading network',url:location.origin,icons:[]},features:{analytics:false,email:false,socials:[]},allWallets:'SHOW',themeMode:'dark'});
  const sync=s=>{const p=s?.provider||s?.eip155||app.getWalletProvider?.()||app.getProviders?.()?.eip155;if(p){window.RWAProvider=p;window.RWAWalletAuth?.attach?.(p)}};
  app.subscribeProvider?.(sync);app.subscribeProviders?.(sync);sync();return app
 })();try{return await booting}finally{booting=null}
}
async function waitProvider(a,timeout=120000){const now=a.getWalletProvider?.()||a.getProviders?.()?.eip155;if(now)return now;return new Promise((resolve,reject)=>{let done=false;const timer=setTimeout(()=>{if(!done){done=true;reject(Error('Wallet connection timed out'))}},timeout);const fn=s=>{const p=s?.provider||s?.eip155||a.getWalletProvider?.()||a.getProviders?.()?.eip155;if(p&&!done){done=true;clearTimeout(timer);resolve(p)}};a.subscribeProvider?.(fn);a.subscribeProviders?.(fn)})}
async function connect(projectId=localStorage.getItem(KEY)||''){if(!projectId)throw Error('Reown Project ID is required');localStorage.setItem(KEY,projectId);const a=await init(projectId);await a.open({view:'Connect',namespace:'eip155'});const p=await waitProvider(a);window.RWAProvider=p;window.RWAWalletAuth?.attach?.(p);return p}
async function disconnect(){try{await app?.adapter?.connectionControllerClient?.disconnect?.()}catch{}window.RWAProvider=null}
async function restore(){const id=localStorage.getItem(KEY);if(!id)return null;try{const a=await init(id);if(a.getIsConnected?.()){const p=a.getWalletProvider?.()||a.getProviders?.()?.eip155;if(p){window.RWAProvider=p;window.RWAWalletAuth?.attach?.(p);return p}}}catch(e){console.warn('WalletConnect restore unavailable',e)}return null}
window.RWAWalletConnect={version:'4.0.0',connect,disconnect,restore};restore();
})();