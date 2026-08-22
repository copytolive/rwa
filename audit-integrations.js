(()=>{
'use strict';
if(window.RWAAuditIntegrations)return;
const original=Storage.prototype.setItem;
const safe=(s,d)=>{try{return JSON.parse(s)||d}catch{return d}};
function audit(type,details={}){try{window.RWAAudit?.log?.(type,details)}catch{}}
Storage.prototype.setItem=function(k,v){
 const old=this.getItem(k);original.call(this,k,v);
 try{
  if(/^rwa_audit_v2:/.test(k))return;
  if(k==='rwa_profile_local_v1'&&old!==v)audit('profile.update',{});
  if(k==='rwa_copy_v1'&&old!==v)audit('copy.rules.update',safe(v,{}));
  if(k==='rwa_copy_queue_v1'&&old!==v){const a=safe(old,[]),b=safe(v,[]);if(b.length>a.length)audit('copy.signal.arrive',{count:b.length-a.length,latest:b[0]?.id||null})}
  if(k==='rwa_alerts_v1'&&old!==v){const a=safe(old,[]),b=safe(v,[]);if(b.length>a.length)audit('alert.create',{count:b.length-a.length,symbol:b[0]?.symbol,type:b[0]?.type});for(const x of b)if(x.triggered&&!a.find(y=>String(y.id)===String(x.id)&&y.triggered))audit('alert.trigger',{id:x.id,symbol:x.symbol,type:x.type,threshold:x.threshold})}
  if(k==='rwa_asset_drafts_v1'&&old!==v)audit('rwa.draft.update',{count:safe(v,[]).length});
 }catch{}
};
function loginAudit(){try{const s=safe(localStorage.getItem('rwa_wallet_link_v1'),null);if(!s?.wallet||!s?.ts)return;const mark=`rwa_login_audit_seen:${s.wallet.toLowerCase()}`,seen=Number(localStorage.getItem(mark)||0);if(Number(s.ts)>seen){audit('wallet.login',{via:s.via||'injected',sessionTs:s.ts});original.call(localStorage,mark,String(s.ts))}}catch{}}
window.addEventListener('click',e=>{const el=e.target.closest?.('#walletLogout,.signin,.mobile-wallet-auth');if(!el)return;try{const s=safe(localStorage.getItem('rwa_wallet_link_v1'),null);if(s?.wallet&&window.RWAWalletAuth?.isLoggedIn?.())audit('wallet.logout',{via:s.via||'injected'})}catch{}},true);
setTimeout(loginAudit,100);window.RWAAuditIntegrations={log:audit};
})();