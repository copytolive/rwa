(()=>{
'use strict';
if(window.RWAAuditHooks)return;
const SESSION='rwa_wallet_link_v1';
const seenAlerts=new Set(),seenCopy=new Set();
const parse=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??d}catch{return d}};
const session=()=>parse(SESSION,null);
const log=(type,details={})=>window.RWAAudit?.log?.(type,details);
function bootLogin(){
 const s=session();if(!s?.wallet||!s?.ts)return;
 const k=`rwa_audit_login_seen:${String(s.wallet).toLowerCase()}`,last=Number(localStorage.getItem(k)||0);
 if(Number(s.ts)>last){log('wallet.login',{via:s.via||'injected',signedAt:Number(s.ts)});localStorage.setItem(k,String(s.ts))}
}
function snapshot(){
 for(const a of parse('rwa_alerts_v1',[])){
  if(!a?.triggered)continue;const id=String(a.id||`${a.symbol}-${a.type}-${a.threshold}`);if(seenAlerts.has(id))continue;seenAlerts.add(id);log('alert.triggered',{id:a.id,symbol:a.symbol,type:a.type,threshold:a.threshold,triggeredAt:a.triggeredAt||Date.now()})
 }
 for(const q of parse('rwa_copy_queue_v1',[])){
  const id=String(q.id||'');if(!id||seenCopy.has(id))continue;seenCopy.add(id);if(q.source==='24x7-monitor')log('copy.signal.24x7',{id:q.id,coin:q.coin,side:q.side,px:q.px,size:q.size,target:q.target,time:q.time})
 }
}
function later(type,details){setTimeout(()=>log(type,typeof details==='function'?details():details||{}),120)}
document.addEventListener('click',e=>{
 const t=e.target;
 if(t.closest('#walletLogout'))log('wallet.logout.request',{});
 if(t.closest('#saveProfile'))later('profile.save',()=>({name:document.getElementById('profileName')?.value||''}));
 if(t.closest('#addAlert'))later('alert.create',()=>{const a=parse('rwa_alerts_v1',[])[0]||{};return{id:a.id,symbol:a.symbol,type:a.type,threshold:a.threshold}});
 const ar=t.closest('[data-alert-remove]');if(ar)log('alert.remove',{id:ar.dataset.alertRemove});
 if(t.closest('#saveCopy'))later('copy.rules.save',()=>parse('rwa_copy_v1',{}));
 if(t.closest('#addWatch'))later('watchlist.add',{});
 const wr=t.closest('[data-watch-remove]');if(wr)log('watchlist.remove',{symbol:wr.dataset.watchRemove});
 if(t.closest('#publishNetworkPost'))later('social.post.publish',{});
 if(t.closest('#publishThesis'))later('social.thesis.save',{});
 const li=t.closest('[data-like]');if(li)log('social.like',{event:li.dataset.like});
 const rp=t.closest('[data-repost]');if(rp)log('social.repost',{event:rp.dataset.repost});
 const bm=t.closest('[data-bookmark]');if(bm)log('social.bookmark',{event:bm.dataset.bookmark});
 const re=t.closest('[data-reply]');if(re)log('social.reply.start',{event:re.dataset.reply});
 if(t.closest('#addRwaDraft'))later('rwa.draft.save',()=>({name:document.getElementById('rwaName')?.value||''}));
 const load=t.closest('[data-load-copy]');if(load)log('copy.signal.review',{id:load.dataset.loadCopy});
},true);
bootLogin();snapshot();setInterval(snapshot,2500);
window.RWAAuditHooks={snapshot};
})();