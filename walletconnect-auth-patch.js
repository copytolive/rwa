(()=>{
'use strict';
const KEY='rwa_wc_project_v1';
const session=()=>{try{return JSON.parse(localStorage.getItem('rwa_wallet_link_v1')||'null')}catch{return null}};
window.addEventListener('click',async e=>{
 const auth=e.target.closest?.('.signin,.mobile-wallet-auth,#connectWallet,#portfolioConnect,#tradeConnect');
 if(!auth)return;
 const s=session();
 if(s&&window.RWAWalletAuth?.isLoggedIn?.())return;
 if(window.ethereum)return;
 const id=localStorage.getItem(KEY);
 if(!id)return;
 e.preventDefault();e.stopImmediatePropagation();
 try{window.RWAAudit?.log?.('walletconnect.login.start',{});await window.RWAWalletConnect.connect(id)}catch(err){window.RWAAudit?.log?.('walletconnect.login.error',{message:String(err.message||err)});if(typeof toast==='function')toast(err.message||'WalletConnect failed')}
},true);
window.addEventListener('click',e=>{
 if(!e.target.closest?.('#walletLogout'))return;
 try{window.RWAWalletConnect?.disconnect?.();window.RWAAudit?.log?.('wallet.logout',{})}catch{}
},true);
})();