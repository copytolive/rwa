(()=>{
'use strict';
const $=id=>document.getElementById(id);
const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const LS={
 profile:'rwa_profile_local_v1', wallet:'rwa_wallet_link_v1', watch:'rwa_watchlist_v1',
 alerts:'rwa_alerts_v1', copy:'rwa_copy_v1', bookmarks:'rwa_bookmarks_v1',
 rwaDrafts:'rwa_asset_drafts_v1', suiteTab:'rwa_suite_tab_v1'
};
const RELAYS=['wss://relay.damus.io','wss://nos.lol','wss://relay.primal.net'];
const state={nostrPub:'',wallet:'',walletVerified:false,profile:null,hl:null,leaderPeriod:'day',
  feedEvents:[],networkProfiles:new Map(),verifiedAssets:[],copyTimer:null,alertTimer:null,lastCopyTime:0};

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const jget=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch{return d}};
const jset=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const money=v=>{const n=Number(v);return Number.isFinite(n)?'$'+n.toLocaleString(undefined,{maximumFractionDigits:2}):'—'};
const pct=v=>{const n=Number(v);return Number.isFinite(n)?(n>=0?'+':'')+n.toFixed(2)+'%':'—'};
const short=a=>a?`${a.slice(0,6)}…${a.slice(-4)}`:'—';
const toastSafe=t=>typeof toast==='function'?toast(t):console.log(t);
const selected=()=>typeof S!=='undefined'&&S.map?S.map.get(S.selected):null;

function setSuiteStatus(id,text,kind=''){
  const el=$(id);if(!el)return;el.textContent=text;el.className='suite-status'+(kind?' '+kind:'');
}
function openSuite(tab='profile'){
  if(innerWidth<=680){
    document.body.classList.remove('market-drawer-open','social-open');
    document.body.classList.add('suite-open');
  }
  const s=$('suite');if(s){s.style.display='block';s.scrollTop=0}
  setSuiteTab(tab);
  qa('[data-mobile-nav]').forEach(a=>a.classList.toggle('active',a.dataset.mobileNav==='hub'||(tab==='portfolio'&&a.dataset.mobileNav==='portfolio')));
}
function closeSuite(){
  document.body.classList.remove('suite-open');
  if(innerWidth<=680){const s=$('suite');if(s)s.style.display='none'}
}
function setSuiteTab(tab){
  jset(LS.suiteTab,tab);
  qa('[data-suite-tab]').forEach(b=>b.classList.toggle('active',b.dataset.suiteTab===tab));
  qa('.suite-panel').forEach(p=>p.classList.toggle('active',p.dataset.suitePanel===tab));
  if(tab==='profile')renderProfile();
  if(tab==='leaderboard')loadLeaderboard();
  if(tab==='copy')renderCopy();
  if(tab==='watch')renderWatch();
  if(tab==='portfolio')renderPortfolio();
  if(tab==='feed')loadNetworkFeed();
  if(tab==='intel')renderIntel();
  if(tab==='rwa')renderRwa();
  if(tab==='trade')renderTradeState();
}
function relayQuery(filters,timeout=2600){
  return new Promise(resolve=>{
    const out=new Map(),socks=[];let done=0,settled=false;
    const finish=()=>{if(settled)return;settled=true;for(const ws of socks)try{ws.close()}catch{};resolve([...out.values()].sort((a,b)=>(b.created_at||0)-(a.created_at||0)))};
    const timer=setTimeout(finish,timeout);
    RELAYS.forEach((url,i)=>{
      try{
        const ws=new WebSocket(url);socks.push(ws);const sub='rwa'+Date.now()+i;
        ws.onopen=()=>ws.send(JSON.stringify(['REQ',sub,...filters]));
        ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m[0]==='EVENT'&&m[2]?.id)out.set(m[2].id,m[2]);if(m[0]==='EOSE'){done++;if(done===RELAYS.length){clearTimeout(timer);finish()}}}catch{}};
        ws.onerror=()=>{done++;if(done===RELAYS.length){clearTimeout(timer);finish()}};
      }catch{done++}
    });
  });
}
function relayPublish(ev){
  let sent=0;
  for(const url of RELAYS){
    try{
      const ws=new WebSocket(url);
      ws.onopen=()=>{try{ws.send(JSON.stringify(['EVENT',ev]));sent++}finally{setTimeout(()=>ws.close(),900)}};
    }catch{}
  }
  return sent;
}
async function nostrSign(kind,content,tags=[]){
  if(!window.nostr)throw new Error('Nostr signer not available');
  return window.nostr.signEvent({kind,created_at:Math.floor(Date.now()/1000),tags,content});
}
async function connectNostr(){
  if(!window.nostr){setSuiteStatus('nostrStatus','Signer needed','warn');toastSafe('Install/use a NIP-07/NIP-46 Nostr signer to enable network identity');return}
  try{
    state.nostrPub=await window.nostr.getPublicKey();
    setSuiteStatus('nostrStatus',short(state.nostrPub),'ok');
    await loadOwnProfile();await loadFollowStats();renderProfile();
  }catch(e){setSuiteStatus('nostrStatus','Connection failed','bad');toastSafe(e.message||'Nostr connection failed')}
}
async function loadOwnProfile(){
  if(!state.nostrPub)return;
  const evs=await relayQuery([{kinds:[0],authors:[state.nostrPub],limit:1}],1800);
  if(evs[0]){try{state.profile=JSON.parse(evs[0].content||'{}')}catch{}}
  if(!state.profile)state.profile=jget(LS.profile,{name:'',about:'',picture:''});
}
async function saveProfile(){
  const p={name:$('profileName')?.value.trim()||'',about:$('profileBio')?.value.trim()||'',picture:$('profileAvatar')?.value.trim()||''};
  jset(LS.profile,p);state.profile=p;
  if(!state.nostrPub){toastSafe('Saved locally. Connect Nostr to publish a real network profile.');renderProfile();return}
  try{
    const ev=await nostrSign(0,JSON.stringify(p),[['t','rwa-trader']]);relayPublish(ev);
    toastSafe('Profile signed and published to the network');renderProfile();
  }catch(e){toastSafe(e.message||'Profile publish failed')}
}
async function loadFollowStats(){
  if(!state.nostrPub)return;
  const [mine,followers]=await Promise.all([
    relayQuery([{kinds:[3],authors:[state.nostrPub],limit:1}],1700),
    relayQuery([{kinds:[3],'#p':[state.nostrPub],limit:500}],2000)
  ]);
  const following=mine[0]?.tags?.filter(t=>t[0]==='p').length||0;
  const followerCount=new Set(followers.map(e=>e.pubkey)).size;
  if($('profileFollowers'))$('profileFollowers').textContent=followerCount.toLocaleString();
  if($('profileFollowing'))$('profileFollowing').textContent=following.toLocaleString();
}
async function followPubkey(pub){
  if(!state.nostrPub){toastSafe('Connect Nostr first');return}
  const mine=await relayQuery([{kinds:[3],authors:[state.nostrPub],limit:1}],1600);
  const tags=(mine[0]?.tags||[]).filter(t=>t[0]==='p');
  if(!tags.some(t=>t[1]===pub))tags.push(['p',pub]);
  const ev=await nostrSign(3,'',tags);relayPublish(ev);toastSafe('Trader followed');loadFollowStats();
}
function renderProfile(){
  const p=state.profile||jget(LS.profile,{name:'',about:'',picture:''});
  if($('profileName')&&document.activeElement!==$('profileName'))$('profileName').value=p.name||'';
  if($('profileBio')&&document.activeElement!==$('profileBio'))$('profileBio').value=p.about||'';
  if($('profileAvatar')&&document.activeElement!==$('profileAvatar'))$('profileAvatar').value=p.picture||'';
  if($('profileIdentity'))$('profileIdentity').textContent=state.nostrPub?short(state.nostrPub):'Local profile';
  if($('profileWallet'))$('profileWallet').textContent=state.wallet?short(state.wallet):'Not linked';
  const m=state.hl;
  if($('profileRoi'))$('profileRoi').textContent=m?pct(m.roiAll):'—';
  if($('profileWin'))$('profileWin').textContent=m&&m.winRate!=null?pct(m.winRate):'—';
  if($('profileDd'))$('profileDd').textContent=m&&m.maxDd!=null?pct(-Math.abs(m.maxDd)):'—';
  if($('profileOpen'))$('profileOpen').textContent=m?String(m.positions.length):'—';
}
async function connectWallet(){
  if(!window.ethereum){setSuiteStatus('walletStatus','Wallet needed','warn');toastSafe('EVM wallet provider not found');return}
  try{
    const accounts=await window.ethereum.request({method:'eth_requestAccounts'});const addr=(accounts?.[0]||'').toLowerCase();
    if(!/^0x[a-f0-9]{40}$/.test(addr))throw new Error('Invalid wallet');
    const ts=Date.now();const msg=`RWA Network wallet link\nNostr: ${state.nostrPub||'none'}\nWallet: ${addr}\nTime: ${ts}`;
    const hex='0x'+[...new TextEncoder().encode(msg)].map(b=>b.toString(16).padStart(2,'0')).join('');
    const sig=await window.ethereum.request({method:'personal_sign',params:[hex,addr]});
    state.wallet=addr;state.walletVerified=true;jset(LS.wallet,{wallet:addr,message:msg,signature:sig,nostr:state.nostrPub,ts});
    setSuiteStatus('walletStatus',short(addr),'ok');
    if(state.nostrPub){
      try{const ev=await nostrSign(30078,JSON.stringify({wallet:addr,message:msg,signature:sig}),[['d','rwa-wallet-link'],['wallet',addr],['t','rwa-trader']]);relayPublish(ev)}catch{}
    }
    await loadHyperliquid(addr);renderProfile();renderPortfolio();toastSafe('Wallet linked. P&L can now be verified from venue data.');
  }catch(e){setSuiteStatus('walletStatus','Connection failed','bad');toastSafe(e.message||'Wallet connection failed')}
}
async function hlInfo(type,data={},testnet=false){
  const url=testnet?'https://api.hyperliquid-testnet.xyz/info':'https://api.hyperliquid.xyz/info';
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,...data})});
  if(!r.ok)throw new Error(`Hyperliquid ${r.status}`);return r.json();
}
function maxDrawdown(history){
  let peak=-Infinity,dd=0;for(const row of history||[]){const v=Number(row[1]);if(!Number.isFinite(v))continue;if(v>peak)peak=v;if(peak>0)dd=Math.max(dd,(peak-v)/peak*100)}return dd;
}
function periodMetric(portfolio,key){
  const row=(portfolio||[]).find(x=>x[0]===key)?.[1];if(!row)return{roi:null,pnl:null,history:[]};
  const h=row.accountValueHistory||[],p=row.pnlHistory||[];const a0=Number(h[0]?.[1]),a1=Number(h.at(-1)?.[1]);
  const roi=Number.isFinite(a0)&&a0!==0&&Number.isFinite(a1)?(a1-a0)/Math.abs(a0)*100:null;
  const pnl=Number(p.at(-1)?.[1]??0);return{roi,pnl:Number.isFinite(pnl)?pnl:null,history:h};
}
async function loadHyperliquid(addr=state.wallet){
  if(!addr)return;
  setSuiteStatus('pnlVerifyStatus','Loading venue data…','');
  try{
    const [ch,portfolio,fills]=await Promise.all([
      hlInfo('clearinghouseState',{user:addr}),hlInfo('portfolio',{user:addr}),hlInfo('userFills',{user:addr,aggregateByTime:true})
    ]);
    const positions=(ch.assetPositions||[]).map(x=>x.position||x).filter(Boolean);
    const closed=(fills||[]).map(f=>Number(f.closedPnl)).filter(n=>Number.isFinite(n)&&n!==0);
    const wins=closed.filter(n=>n>0).length;
    const all=periodMetric(portfolio,'allTime'),day=periodMetric(portfolio,'day'),week=periodMetric(portfolio,'week'),month=periodMetric(portfolio,'month');
    state.hl={ch,portfolio,fills,positions,accountValue:Number(ch.marginSummary?.accountValue||0),withdrawable:Number(ch.withdrawable||0),
      winRate:closed.length?wins/closed.length*100:null,maxDd:maxDrawdown(all.history),roiAll:all.roi,day,week,month,all};
    setSuiteStatus('pnlVerifyStatus',state.walletVerified?'VERIFIED BY HYPERLIQUID':'PUBLIC WALLET DATA',state.walletVerified?'ok':'');
    renderProfile();renderPortfolio();
  }catch(e){setSuiteStatus('pnlVerifyStatus','Venue unavailable','bad');toastSafe(e.message||'Could not load Hyperliquid data')}
}
async function verifyWalletLink(ev){
  try{
    const d=JSON.parse(ev.content||'{}');if(!d.wallet||!d.signature||!d.message)return null;
    const {verifyMessage}=await import('https://esm.sh/ethers@6.15.0');
    const recovered=(verifyMessage(d.message,d.signature)||'').toLowerCase();
    if(recovered!==String(d.wallet).toLowerCase())return null;
    if(!d.message.includes(`Nostr: ${ev.pubkey}`))return null;
    return{pubkey:ev.pubkey,wallet:d.wallet.toLowerCase(),event:ev};
  }catch{return null}
}
async function fetchProfiles(pubkeys){
  if(!pubkeys.length)return new Map();
  const evs=await relayQuery([{kinds:[0],authors:pubkeys.slice(0,100),limit:100}],2200);
  const map=new Map();for(const e of evs){if(map.has(e.pubkey))continue;try{map.set(e.pubkey,JSON.parse(e.content||'{}'))}catch{}}
  return map;
}
async function loadLeaderboard(){
  const box=$('leaderRows');if(!box)return;box.innerHTML='<div class="suite-empty">Finding signed trader wallets…</div>';
  try{
    const links=await relayQuery([{kinds:[30078],'#d':['rwa-wallet-link'],limit:40}],2600);
    const unique=new Map();
    for(const ev of links){if(unique.has(ev.pubkey))continue;const v=await verifyWalletLink(ev);if(v)unique.set(ev.pubkey,v);if(unique.size>=12)break}
    if(!unique.size){box.innerHTML='<div class="suite-empty">No verified RWA Network traders found yet. Connect Nostr + wallet to become the first verified profile.</div>';return}
    const profiles=await fetchProfiles([...unique.keys()]);const period=state.leaderPeriod;
    const rows=[];
    for(const v of unique.values()){
      try{
        const portfolio=await hlInfo('portfolio',{user:v.wallet});const m=periodMetric(portfolio,period);
        rows.push({...v,profile:profiles.get(v.pubkey)||{},roi:m.roi,pnl:m.pnl});
      }catch{}
    }
    rows.sort((a,b)=>(b.roi??-1e9)-(a.roi??-1e9));
    box.innerHTML=rows.map((r,i)=>`<div class="leader-row"><span class="leader-rank">${i+1}</span><div class="leader-user"><b>${esc(r.profile.name||short(r.wallet))}</b><small>${esc(short(r.wallet))} · verified wallet</small></div><div><b class="${(r.roi||0)>=0?'up':'down'}">${esc(pct(r.roi))}</b><small>${esc(money(r.pnl))}</small></div><button data-follow-pub="${esc(r.pubkey)}">Follow</button><button data-copy-wallet="${esc(r.wallet)}">Copy</button></div>`).join('');
  }catch(e){box.innerHTML='<div class="suite-empty">Leaderboard network unavailable right now.</div>'}
}
function renderCopy(){
  const c=jget(LS.copy,{target:'',allocation:10,maxLoss:100,maxNotional:250,enabled:false,lastTime:0});
  if($('copyTarget'))$('copyTarget').value=c.target||'';
  if($('copyAllocation'))$('copyAllocation').value=c.allocation??10;
  if($('copyMaxLoss'))$('copyMaxLoss').value=c.maxLoss??100;
  if($('copyMaxNotional'))$('copyMaxNotional').value=c.maxNotional??250;
  if($('copyEnabled'))$('copyEnabled').checked=!!c.enabled;
  setSuiteStatus('copyStatus',c.enabled?'Watching while app is open':'Paused',c.enabled?'ok':'');
  if(c.enabled)startCopyWatch();else stopCopyWatch();
}
function saveCopy(){
  const c={target:($('copyTarget')?.value||'').trim().toLowerCase(),allocation:Number($('copyAllocation')?.value||10),
    maxLoss:Number($('copyMaxLoss')?.value||100),maxNotional:Number($('copyMaxNotional')?.value||250),
    enabled:!!$('copyEnabled')?.checked,lastTime:jget(LS.copy,{}).lastTime||Date.now()};
  if(c.target&&!/^0x[a-f0-9]{40}$/.test(c.target)){toastSafe('Target wallet address is invalid');return}
  jset(LS.copy,c);toastSafe('Copy-trade risk rules saved');renderCopy();
}
function stopCopyWatch(){if(state.copyTimer){clearInterval(state.copyTimer);state.copyTimer=null}}
function startCopyWatch(){stopCopyWatch();state.copyTimer=setInterval(checkCopySignals,10000);checkCopySignals()}
async function checkCopySignals(){
  const c=jget(LS.copy,{});if(!c.enabled||!c.target)return;
  try{
    const start=Math.max(Number(c.lastTime||Date.now()),Date.now()-3600000);
    const fills=await hlInfo('userFillsByTime',{user:c.target,startTime:start,aggregateByTime:true});
    const fresh=(fills||[]).filter(f=>Number(f.time)>Number(c.lastTime||0)).sort((a,b)=>a.time-b.time);
    if(fresh.length){
      const queue=jget('rwa_copy_queue_v1',[]);
      for(const f of fresh){queue.unshift({id:`${f.tid||f.time}-${f.coin}`,coin:f.coin,side:f.side==='B'?'BUY':'SELL',px:Number(f.px),sourceSize:Number(f.sz),size:Number(f.sz)*(Number(c.allocation||10)/100),time:f.time,target:c.target})}
      jset('rwa_copy_queue_v1',queue.slice(0,30));c.lastTime=Math.max(...fresh.map(f=>Number(f.time)));jset(LS.copy,c);renderCopyQueue();toastSafe(`${fresh.length} new copy signal${fresh.length>1?'s':''} ready for review`);
    }
  }catch{}
}
function renderCopyQueue(){
  const box=$('copyQueue');if(!box)return;const qv=jget('rwa_copy_queue_v1',[]);
  box.innerHTML=qv.length?qv.map(x=>`<div class="copy-signal"><div><b>${esc(x.side)} ${esc(x.coin)}</b><small>${esc(new Date(x.time).toLocaleTimeString())} · source ${esc(short(x.target))}</small></div><div><b>${esc(String(x.size.toFixed(6)))}</b><small>@ ${esc(money(x.px))}</small></div><button data-load-copy="${esc(x.id)}">Review</button></div>`).join(''):'<div class="suite-empty">No new copy signals. The watcher only runs while this page is open.</div>';
}
function watchlist(){return jget(LS.watch,[])}
function renderWatch(){
  const box=$('watchRows');if(!box)return;const w=watchlist();
  box.innerHTML=w.length?w.map(sym=>{const x=typeof S!=='undefined'?S.map.get(sym):null;return`<div class="watch-row"><div><b>${esc(x?x.base+' / USDT':sym)}</b><small>${esc(x?money(x.price):'Waiting for market')}</small></div><span class="${(x?.change||0)>=0?'up':'down'}">${esc(x?pct(x.change):'—')}</span><button data-watch-remove="${esc(sym)}">×</button></div>`}).join(''):'<div class="suite-empty">Watchlist is empty. Add the current chart market.</div>';
  renderAlerts();
}
function addCurrentWatch(){
  const x=selected();if(!x)return;const w=watchlist();if(!w.includes(x.symbol))w.unshift(x.symbol);jset(LS.watch,w.slice(0,50));renderWatch();toastSafe(`${x.base} added to watchlist`);
}
function alerts(){return jget(LS.alerts,[])}
function addAlert(){
  const x=selected();if(!x)return;const type=$('alertType')?.value||'price_above';const threshold=Number($('alertThreshold')?.value);
  if(!Number.isFinite(threshold)){toastSafe('Enter an alert threshold');return}
  const a=alerts();a.unshift({id:Date.now(),symbol:x.symbol,type,threshold,baselineHigh:x.high,baselineLow:x.low,created:Date.now(),triggered:false});jset(LS.alerts,a.slice(0,50));renderAlerts();startAlertWatch();toastSafe('Alert saved');
}
function renderAlerts(){
  const box=$('alertRows');if(!box)return;const a=alerts();
  box.innerHTML=a.length?a.map(v=>`<div class="alert-row"><div><b>${esc(v.symbol)}</b><small>${esc(v.type.replaceAll('_',' '))} ${esc(String(v.threshold))}</small></div><span class="${v.triggered?'up':''}">${v.triggered?'TRIGGERED':'ACTIVE'}</span><button data-alert-remove="${v.id}">×</button></div>`).join(''):'<div class="suite-empty">No alerts configured.</div>';
}
async function notify(title,body){try{if('Notification'in window){if(Notification.permission==='default')await Notification.requestPermission();if(Notification.permission==='granted')new Notification(title,{body})}}catch{}}
function startAlertWatch(){if(state.alertTimer)return;state.alertTimer=setInterval(checkAlerts,2500)}
function checkAlerts(){
  if(typeof S==='undefined')return;const a=alerts();let changed=false;
  for(const v of a){if(v.triggered)continue;const x=S.map.get(v.symbol);if(!x)continue;let hit=false;
    if(v.type==='price_above')hit=x.price>=v.threshold;
    if(v.type==='price_below')hit=x.price<=v.threshold;
    if(v.type==='change_abs')hit=Math.abs(x.change||0)>=v.threshold;
    if(v.type==='volume_min')hit=(x.vol||0)>=v.threshold;
    if(v.type==='breakout')hit=(x.price||0)>(v.baselineHigh||Infinity);
    if(hit){v.triggered=true;v.triggeredAt=Date.now();changed=true;notify(`RWA Alert · ${x.base}`,`${v.type.replaceAll('_',' ')} triggered at ${money(x.price)}`);toastSafe(`Alert: ${x.base} ${v.type.replaceAll('_',' ')}`)}
  }
  if(changed){jset(LS.alerts,a);renderAlerts()}
}
function renderPortfolio(){
  const m=state.hl;
  if($('portfolioWallet'))$('portfolioWallet').textContent=state.wallet?short(state.wallet):'Connect wallet';
  for(const [id,val] of [['portfolioValue',m?money(m.accountValue):'—'],['portfolioWithdraw',m?money(m.withdrawable):'—'],
    ['portfolioDay',m?pct(m.day.roi):'—'],['portfolioWeek',m?pct(m.week.roi):'—'],['portfolioMonth',m?pct(m.month.roi):'—']])if($(id))$(id).textContent=val;
  const box=$('positionRows');if(box)box.innerHTML=m&&m.positions.length?m.positions.map(p=>`<div class="position-row"><div><b>${esc(p.coin)}</b><small>${Number(p.szi)>=0?'LONG':'SHORT'} · ${esc(String(p.leverage?.value||p.leverage||'—'))}x</small></div><div><b>${esc(String(p.szi))}</b><small>Entry ${esc(money(p.entryPx))}</small></div><div><b class="${Number(p.unrealizedPnl)>=0?'up':'down'}">${esc(money(p.unrealizedPnl))}</b><small>ROE ${esc(pct(Number(p.returnOnEquity||0)*100))}</small></div></div>`).join(''):'<div class="suite-empty">No open Hyperliquid positions.</div>';
}
async function publishNetworkPost(){
  const input=$('networkPostText');const text=input?.value.trim();if(!text)return;
  if(!state.nostrPub){toastSafe('Connect Nostr to publish to the real network');return}
  const x=selected(),side=$('networkPostSide')?.value||'THESIS';
  try{
    const tags=[['t','rwa-trading'],['side',side]];if(x)tags.push(['pair',x.symbol]);
    const ev=await nostrSign(1,text,tags);relayPublish(ev);if(input)input.value='';toastSafe('Post signed and published');setTimeout(loadNetworkFeed,900);
  }catch(e){toastSafe(e.message||'Publish failed')}
}
async function loadNetworkFeed(){
  const box=$('networkFeed');if(!box)return;box.innerHTML='<div class="suite-empty">Loading signed social feed…</div>';
  try{
    const evs=await relayQuery([{kinds:[1],'#t':['rwa-trading'],limit:50}],2600);state.feedEvents=evs;
    if(!evs.length){box.innerHTML='<div class="suite-empty">No signed network posts found yet. Publish the first thesis.</div>';return}
    const profiles=await fetchProfiles([...new Set(evs.map(e=>e.pubkey))]);state.networkProfiles=profiles;
    box.innerHTML=evs.map(e=>{const p=profiles.get(e.pubkey)||{},side=e.tags?.find(t=>t[0]==='side')?.[1]||'THESIS',pair=e.tags?.find(t=>t[0]==='pair')?.[1]||'MARKET';
      return`<article class="network-post" data-event="${esc(e.id)}"><header><div class="net-avatar">${esc((p.name||e.pubkey).slice(0,1).toUpperCase())}</div><div><b>${esc(p.name||short(e.pubkey))}</b><small>${esc(pair)} · ${new Date((e.created_at||0)*1000).toLocaleString()}</small></div><span>${esc(side)}</span></header><p>${esc(e.content)}</p><footer><button data-reply="${esc(e.id)}">Reply</button><button data-like="${esc(e.id)}">Like</button><button data-repost="${esc(e.id)}">Repost</button><button data-bookmark="${esc(e.id)}">Bookmark</button></footer></article>`}).join('');
  }catch{box.innerHTML='<div class="suite-empty">Network relays unavailable. Local market features remain active.</div>'}
}
function eventById(id){return state.feedEvents.find(e=>e.id===id)}
async function replyEvent(id){
  const src=eventById(id);if(!src||!state.nostrPub)return toastSafe('Connect Nostr first');const text=prompt('Reply');if(!text?.trim())return;
  const tags=[['e',src.id,'','reply'],['p',src.pubkey],['t','rwa-trading']];const ev=await nostrSign(1,text.trim(),tags);relayPublish(ev);toastSafe('Reply published');
}
async function likeEvent(id){
  const src=eventById(id);if(!src||!state.nostrPub)return toastSafe('Connect Nostr first');const ev=await nostrSign(7,'+',[['e',src.id],['p',src.pubkey]]);relayPublish(ev);toastSafe('Reaction published');
}
async function repostEvent(id){
  const src=eventById(id);if(!src||!state.nostrPub)return toastSafe('Connect Nostr first');const ev=await nostrSign(6,JSON.stringify(src),[['e',src.id],['p',src.pubkey]]);relayPublish(ev);toastSafe('Repost published');
}
async function bookmarkEvent(id){
  const list=jget(LS.bookmarks,[]);if(!list.includes(id))list.unshift(id);jset(LS.bookmarks,list.slice(0,200));
  if(state.nostrPub){try{const ev=await nostrSign(10003,'',list.map(x=>['e',x]));relayPublish(ev)}catch{}}
  toastSafe('Bookmarked');
}
function renderIntel(){
  if(typeof S==='undefined'||!S.pairs.length)return;const xs=S.pairs.filter(x=>Number.isFinite(x.change)&&Number.isFinite(x.vol));
  const gain=xs.filter(x=>x.change>0).length,loss=xs.filter(x=>x.change<0).length;
  if($('intelBreadth'))$('intelBreadth').textContent=`${gain} ↑ / ${loss} ↓`;
  const x=selected();if($('intelMomentum'))$('intelMomentum').textContent=x?pct(x.change):'—';
  let ratio=null;if(typeof S!=='undefined'&&S.klines?.length>21){const a=S.klines,cur=a.at(-1).v,avg=a.slice(-21,-1).reduce((s,k)=>s+k.v,0)/20;ratio=avg?cur/avg:null}
  if($('intelVolSpike'))$('intelVolSpike').textContent=ratio?`${ratio.toFixed(2)}× 20-bar avg`:'—';
  const buy=Number(($('buyPct')?.textContent||'50').replace('%',''));if($('intelSentiment'))$('intelSentiment').textContent=Number.isFinite(buy)?`${buy.toFixed(0)}% buy pressure`:'—';
  const top=[...xs].sort((a,b)=>(Math.abs(b.change)*Math.log10((b.vol||1)+10))-(Math.abs(a.change)*Math.log10((a.vol||1)+10))).slice(0,8);
  const box=$('intelTrending');if(box)box.innerHTML=top.map(v=>`<button data-suite-symbol="${esc(v.symbol)}"><b>${esc(v.base)}</b><span class="${v.change>=0?'up':'down'}">${esc(pct(v.change))}</span><small>${esc(money(v.price))} · Vol ${esc(money(v.vol))}</small></button>`).join('');
}
async function loadVerifiedAssets(){
  try{const r=await fetch('rwa-assets.json?'+Date.now(),{cache:'no-store'});const j=await r.json();state.verifiedAssets=Array.isArray(j.verified)?j.verified:[]}catch{state.verifiedAssets=[]}
}
function rwaDrafts(){return jget(LS.rwaDrafts,[])}
function renderRwa(){
  const verified=state.verifiedAssets,drafts=rwaDrafts(),box=$('rwaAssetRows');if(!box)return;
  const rows=[...verified.map(a=>({...a,_verified:true})),...drafts.map(a=>({...a,_verified:false}))];
  if($('rwaVerifiedCount'))$('rwaVerifiedCount').textContent=String(verified.length);
  if($('rwaDraftCount'))$('rwaDraftCount').textContent=String(drafts.length);
  box.innerHTML=rows.length?rows.map(a=>`<article class="asset-card ${a._verified?'verified':''}"><header><div><small>${a._verified?'VERIFIED ASSET':'DRAFT · UNVERIFIED'}</small><h3>${esc(a.name)}</h3></div><span>${esc(a.type||'Asset')}</span></header><div class="asset-metrics"><div><small>NAV</small><b>${esc(money(a.nav))}</b></div><div><small>YIELD</small><b>${a.yield!=null?esc(pct(a.yield)):'—'}</b></div><div><small>LOCATION</small><b>${esc(a.location||'—')}</b></div></div><footer>${a.document?`<a href="${esc(a.document)}" target="_blank" rel="noopener">Document</a>`:'<span>No document</span>'}<button ${a._verified?'':'disabled'}>${a._verified?'View market':'Verification required'}</button></footer></article>`).join(''):'<div class="suite-empty">No verified RWA assets have been published yet. Add a draft; it will stay explicitly unverified until reviewed and committed to the public registry.</div>';
}
function addRwaDraft(){
  const name=$('rwaName')?.value.trim();if(!name)return toastSafe('Asset name is required');
  const d={id:Date.now(),name,type:$('rwaType')?.value.trim()||'Real Estate',nav:Number($('rwaNav')?.value||0),yield:Number($('rwaYield')?.value||0),location:$('rwaLocation')?.value.trim()||'',document:$('rwaDoc')?.value.trim()||''};
  const a=rwaDrafts();a.unshift(d);jset(LS.rwaDrafts,a.slice(0,50));renderRwa();toastSafe('Asset saved as UNVERIFIED draft');
}
function renderTradeState(){
  if($('tradeWallet'))$('tradeWallet').textContent=state.wallet?short(state.wallet):'Not connected';
  const x=selected();if(x&&$('tradeCoin')&&!$('tradeCoin').value)$('tradeCoin').value=x.base;
}
function tradePreview(){
  const coin=($('tradeCoin')?.value||'').trim().toUpperCase(),side=$('tradeSide')?.value||'BUY',price=Number($('tradePrice')?.value),size=Number($('tradeSize')?.value),testnet=!!$('tradeTestnet')?.checked;
  if(!coin||!Number.isFinite(price)||price<=0||!Number.isFinite(size)||size<=0)return toastSafe('Enter coin, limit price and size');
  const notional=price*size,risk=Number($('tradeMaxNotional')?.value||1000);const ok=notional<=risk;
  const box=$('tradePreview');if(box)box.innerHTML=`<div><small>ENVIRONMENT</small><b>${testnet?'TESTNET':'MAINNET'}</b></div><div><small>ORDER</small><b>${esc(side)} ${esc(size)} ${esc(coin)}</b></div><div><small>LIMIT</small><b>${esc(money(price))}</b></div><div><small>NOTIONAL</small><b class="${ok?'':'down'}">${esc(money(notional))}</b></div><div><small>RISK CHECK</small><b class="${ok?'up':'down'}">${ok?'PASS':'ABOVE MAX'}</b></div>`;
  return{coin,side,price,size,testnet,notional,risk,ok};
}
async function executeTrade(){
  const o=tradePreview();if(!o||!o.ok)return;
  if(!window.ethereum)return toastSafe('Connect an EVM wallet first');
  if(!o.testnet&&!$('tradeMainnetConfirm')?.checked)return toastSafe('Mainnet confirmation is required');
  try{
    const [{ExchangeClient,HttpTransport},{createWalletClient,custom},{arbitrum}]=await Promise.all([
      import('https://esm.sh/jsr/@nktkas/hyperliquid'),import('https://esm.sh/viem@2.37.3'),import('https://esm.sh/viem@2.37.3/chains')
    ]);
    const accounts=await window.ethereum.request({method:'eth_requestAccounts'});const account=accounts[0];
    const wallet=createWalletClient({account,chain:arbitrum,transport:custom(window.ethereum)});
    const transport=new HttpTransport(o.testnet?{isTestnet:true}:undefined);
    const meta=await hlInfo('meta',{},o.testnet);const idx=(meta.universe||[]).findIndex(x=>x.name===o.coin);if(idx<0)throw new Error(`${o.coin} not found in Hyperliquid perp universe`);
    const client=new ExchangeClient({transport,wallet});
    setSuiteStatus('tradeStatus','Awaiting wallet signature…','warn');
    const result=await client.order({orders:[{a:idx,b:o.side==='BUY',p:String(o.price),s:String(o.size),r:!!$('tradeReduceOnly')?.checked,t:{limit:{tif:'Gtc'}}}],grouping:'na'});
    setSuiteStatus('tradeStatus','Order submitted','ok');if($('tradeResult'))$('tradeResult').textContent=JSON.stringify(result,null,2);toastSafe(`${o.testnet?'Testnet':'Mainnet'} order submitted`);
  }catch(e){setSuiteStatus('tradeStatus','Order failed','bad');if($('tradeResult'))$('tradeResult').textContent=String(e.message||e);toastSafe(e.message||'Order failed')}
}
function loadCopyIntoTrade(id){
  const x=jget('rwa_copy_queue_v1',[]).find(v=>v.id===id);if(!x)return;
  if($('tradeCoin'))$('tradeCoin').value=x.coin;if($('tradeSide'))$('tradeSide').value=x.side;if($('tradePrice'))$('tradePrice').value=String(x.px);if($('tradeSize'))$('tradeSize').value=String(x.size);
  openSuite('trade');tradePreview();
}
async function init(){
  const w=jget(LS.wallet,null);if(w?.wallet){state.wallet=w.wallet;state.walletVerified=false;setSuiteStatus('walletStatus',short(w.wallet),'')}
  state.profile=jget(LS.profile,{name:'',about:'',picture:''});
  await loadVerifiedAssets();renderRwa();renderWatch();renderCopy();renderCopyQueue();startAlertWatch();renderIntel();renderProfile();renderTradeState();
  const tab=jget(LS.suiteTab,'profile');setSuiteTab(tab);
  setInterval(()=>{renderWatch();renderIntel();checkAlerts();if(state.wallet&&document.visibilityState==='visible'&&state.hl)renderPortfolio()},3500);
}
document.addEventListener('click',async e=>{
  const st=e.target.closest('[data-suite-tab]');if(st){e.preventDefault();setSuiteTab(st.dataset.suiteTab);return}
  const nav=e.target.closest('[data-mobile-nav]');if(nav&&['hub','portfolio'].includes(nav.dataset.mobileNav)){e.preventDefault();openSuite(nav.dataset.mobileNav==='portfolio'?'portfolio':'profile');return}
  if(e.target.closest('[data-suite-close]')){e.preventDefault();closeSuite();qa('[data-mobile-nav]').forEach(a=>a.classList.toggle('active',a.dataset.mobileNav==='chart'));return}
  if(e.target.closest('#connectNostr'))return connectNostr();
  if(e.target.closest('#saveProfile'))return saveProfile();
  if(e.target.closest('#connectWallet')||e.target.closest('#portfolioConnect')||e.target.closest('#tradeConnect'))return connectWallet();
  const follow=e.target.closest('[data-follow-pub]');if(follow)return followPubkey(follow.dataset.followPub);
  const cp=e.target.closest('[data-copy-wallet]');if(cp){if($('copyTarget'))$('copyTarget').value=cp.dataset.copyWallet;openSuite('copy');return}
  if(e.target.closest('#saveCopy'))return saveCopy();
  const load=e.target.closest('[data-load-copy]');if(load)return loadCopyIntoTrade(load.dataset.loadCopy);
  if(e.target.closest('#addWatch'))return addCurrentWatch();
  const wr=e.target.closest('[data-watch-remove]');if(wr){jset(LS.watch,watchlist().filter(x=>x!==wr.dataset.watchRemove));renderWatch();return}
  if(e.target.closest('#addAlert'))return addAlert();
  const ar=e.target.closest('[data-alert-remove]');if(ar){jset(LS.alerts,alerts().filter(x=>String(x.id)!==ar.dataset.alertRemove));renderAlerts();return}
  if(e.target.closest('#refreshPortfolio'))return state.wallet?loadHyperliquid(state.wallet):connectWallet();
  if(e.target.closest('#publishNetworkPost'))return publishNetworkPost();
  const re=e.target.closest('[data-reply]');if(re)return replyEvent(re.dataset.reply);
  const li=e.target.closest('[data-like]');if(li)return likeEvent(li.dataset.like);
  const rp=e.target.closest('[data-repost]');if(rp)return repostEvent(rp.dataset.repost);
  const bm=e.target.closest('[data-bookmark]');if(bm)return bookmarkEvent(bm.dataset.bookmark);
  const sym=e.target.closest('[data-suite-symbol]');if(sym){if(typeof selectPair==='function')selectPair(sym.dataset.suiteSymbol,false);closeSuite();return}
  if(e.target.closest('#addRwaDraft'))return addRwaDraft();
  if(e.target.closest('#previewTrade'))return tradePreview();
  if(e.target.closest('#executeTrade'))return executeTrade();
  const per=e.target.closest('[data-leader-period]');if(per){state.leaderPeriod=per.dataset.leaderPeriod;qa('[data-leader-period]').forEach(b=>b.classList.toggle('active',b===per));return loadLeaderboard()}
});
addEventListener('resize',()=>{if(innerWidth>680){document.body.classList.remove('suite-open');const s=$('suite');if(s)s.style.display='block'}else if(!document.body.classList.contains('suite-open')){const s=$('suite');if(s)s.style.display='none'}});
window.RWASuite={open:openSuite,connectWallet,connectNostr,loadHyperliquid};
init();
})();