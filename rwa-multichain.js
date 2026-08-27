(()=>{
'use strict';
if(window.RWAMultiChain?.version==='1.0.0')return;

const VERSION='1.0.0';
const POLICY='chain-abstraction-fail-closed-v1';
const REGISTRY_URL='rwa-multichain-registry.json?v=1';
const STORAGE_KEY='rwa_multichain_selected_v1';
const state={registry:null,selected:'hyperliquid',open:false};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const toastSafe=t=>typeof window.toast==='function'?window.toast(t):console.log(t);

function selectedSymbol(){
  const t=$('selName')?.textContent||'BTC / USDT';
  return String(t).split(/[\/\s-]/)[0].replace(/[^A-Za-z0-9]/g,'').toUpperCase()||'BTC';
}
function statusLabel(n){
  if(n.status==='EXECUTION_GATED')return'PROTECTED EXECUTION';
  if(n.status==='FUNDING_GATED')return'FUNDING GATED';
  return'ADAPTER GATED';
}
function statusTone(n){return n.status==='EXECUTION_GATED'?'live':n.status==='FUNDING_GATED'?'funding':'gated'}
function initials(name){return String(name||'').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'MC'}
function capabilityText(n){
  const c=n.capabilities||{};
  const out=[];
  if(c.execution==='machine-gated')out.push('Execution · machine gated');
  else if(c.execution)out.push('Execution · enabled');
  else out.push('Execution · locked');
  if(c.funding==='machine-gated-usdc')out.push('USDC funding · gated');
  else if(c.funding)out.push('Funding · enabled');
  else out.push('Funding · locked');
  out.push(c.gas==='adapter-required'?'Gas · adapter required':c.gas==='wallet'?'Gas · wallet':'Gas · native');
  return out;
}
function installStyles(){
  if($('rwaMultiChainStyle'))return;
  const s=document.createElement('style');s.id='rwaMultiChainStyle';s.textContent=`
  .rwa-multichain-launch{display:inline-flex!important;align-items:center;gap:7px;height:32px;padding:0 11px;border:1px solid #282b34;border-radius:7px;background:#0d0f14;color:#e9ecf2;font:700 10px/1 system-ui;letter-spacing:.08em;white-space:nowrap;cursor:pointer}
  .rwa-multichain-launch:hover,.rwa-multichain-launch.active{border-color:#4b5364;background:#13161d}
  .rwa-multichain-launch i{width:7px;height:7px;border-radius:50%;background:#7dffb2;box-shadow:0 0 0 3px rgba(125,255,178,.08)}
  #rwaMultiChainPanel[hidden]{display:none!important}
  #rwaMultiChainPanel{position:fixed;z-index:9700;right:0;top:94px;bottom:34px;width:min(440px,100vw);overflow:auto;background:rgba(8,9,13,.985);border-left:1px solid #20232b;box-shadow:-20px 0 55px rgba(0,0,0,.38);color:#f4f5f7;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .rwa-mc-head{position:sticky;top:0;z-index:2;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 18px 14px;background:rgba(8,9,13,.96);backdrop-filter:blur(16px);border-bottom:1px solid #20232b}
  .rwa-mc-head small{display:block;color:#7dffb2;font:800 10px/1.2 system-ui;letter-spacing:.14em;margin-bottom:7px}
  .rwa-mc-head h2{margin:0;font-size:21px;line-height:1.1;letter-spacing:-.02em}.rwa-mc-head p{margin:7px 0 0;color:#8e95a4;font-size:12px;line-height:1.45;max-width:300px}
  .rwa-mc-close{width:34px;height:34px;border:1px solid #272a32;background:#101218;color:#bfc4cf;border-radius:8px;font-size:20px;cursor:pointer}
  .rwa-mc-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:14px 18px 6px}.rwa-mc-summary div{padding:11px;border:1px solid #20232b;border-radius:9px;background:#0d0f14}.rwa-mc-summary small{display:block;color:#6f7685;font-size:9px;font-weight:800;letter-spacing:.08em}.rwa-mc-summary b{display:block;margin-top:5px;font-size:18px}.rwa-mc-summary span{display:block;margin-top:2px;color:#8c93a1;font-size:9px}
  .rwa-mc-note{margin:10px 18px 4px;padding:11px 12px;border:1px solid #1f352a;border-radius:8px;background:#0c1511;color:#a9d5bc;font-size:11px;line-height:1.45}.rwa-mc-note b{color:#7dffb2}
  .rwa-mc-list{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:14px 18px}.rwa-mc-chain{display:flex;align-items:center;gap:10px;min-height:66px;padding:10px;border:1px solid #20232b;border-radius:10px;background:#0c0e13;color:#e6e9ef;text-align:left;cursor:pointer}.rwa-mc-chain:hover,.rwa-mc-chain.active{border-color:#4b5364;background:#12151c}.rwa-mc-chain.active{box-shadow:inset 0 0 0 1px #353b48}.rwa-mc-icon{display:grid;place-items:center;flex:0 0 31px;height:31px;border-radius:50%;background:#171a22;border:1px solid #2b303b;color:#dfe4ec;font-size:9px;font-weight:900}.rwa-mc-chain div{min-width:0}.rwa-mc-chain b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.rwa-mc-chain small{display:block;margin-top:4px;color:#7f8796;font-size:9px}.rwa-mc-state{margin-left:auto;width:7px;height:7px;border-radius:50%;background:#666}.rwa-mc-state.live{background:#7dffb2}.rwa-mc-state.funding{background:#ffd56a}.rwa-mc-state.gated{background:#777f8f}
  .rwa-mc-detail{margin:0 18px 18px;padding:15px;border:1px solid #242832;border-radius:11px;background:#0d0f15}.rwa-mc-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.rwa-mc-detail-head small{display:block;color:#777f8e;font-size:9px;font-weight:800;letter-spacing:.1em}.rwa-mc-detail-head h3{margin:4px 0 0;font-size:17px}.rwa-mc-badge{padding:5px 7px;border:1px solid #303541;border-radius:999px;color:#aeb5c2;font-size:8px;font-weight:800;letter-spacing:.07em}.rwa-mc-detail p{margin:11px 0;color:#939baa;font-size:11px;line-height:1.5}.rwa-mc-caps{display:grid;gap:6px;margin:12px 0}.rwa-mc-caps span{display:flex;align-items:center;gap:7px;color:#b6bcc8;font-size:10px}.rwa-mc-caps span:before{content:"";width:5px;height:5px;border-radius:50%;background:#596171}.rwa-mc-actions{display:flex;gap:8px}.rwa-mc-actions button{flex:1;min-height:36px;border:1px solid #303542;border-radius:8px;background:#161922;color:#f2f4f7;font-size:10px;font-weight:800;cursor:pointer}.rwa-mc-actions button.primary{border-color:#30543e;background:#102619;color:#9bffc0}.rwa-mc-actions button[disabled]{opacity:.48;cursor:not-allowed}.rwa-mc-foot{padding:0 18px 20px;color:#697180;font-size:9px;line-height:1.5}
  @media(max-width:900px){.rwa-multichain-launch{padding:0 9px}.rwa-multichain-launch span{display:none}}
  @media(max-width:680px){.rwa-multichain-launch{position:fixed;right:12px;bottom:74px;z-index:9650;height:38px;border-radius:19px;padding:0 13px;background:#11141b;box-shadow:0 8px 26px rgba(0,0,0,.35)}.rwa-multichain-launch span{display:inline}#rwaMultiChainPanel{top:56px;bottom:0;width:100vw;border-left:0}.rwa-mc-list{grid-template-columns:1fr 1fr}.rwa-mc-summary{grid-template-columns:repeat(3,1fr)}}
  `;document.head.appendChild(s)
}
async function loadRegistry(){
  if(state.registry)return state.registry;
  const r=await fetch(REGISTRY_URL,{cache:'no-store'});if(!r.ok)throw Error('Multi-chain registry unavailable');
  const j=await r.json();
  if(j?.policy!==POLICY||!Array.isArray(j.networks)||j.networks.length<2)throw Error('Multi-chain registry failed safety validation');
  const ids=new Set();for(const n of j.networks){if(!n?.id||ids.has(n.id))throw Error('Multi-chain registry contains invalid network ids');ids.add(n.id)}
  state.registry=j;
  try{const saved=localStorage.getItem(STORAGE_KEY);if(saved&&ids.has(saved))state.selected=saved}catch{}
  return j;
}
function installLauncher(){
  let b=$('rwaMultiChainLaunch');if(b)return b;
  b=document.createElement('button');b.type='button';b.id='rwaMultiChainLaunch';b.className='rwa-multichain-launch';b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-controls','rwaMultiChainPanel');b.innerHTML='<i></i><span>MULTI CHAIN</span>';
  const host=document.querySelector('.top-actions')||document.querySelector('.topbar')||document.body;
  const anchor=host.querySelector?.('.signin,[data-v5-action="wallet"],.rwa-institutional-link');
  if(anchor)host.insertBefore(b,anchor);else host.appendChild(b);
  b.addEventListener('click',()=>state.open?close():open());
  return b;
}
function installPanel(){
  let p=$('rwaMultiChainPanel');if(p)return p;
  p=document.createElement('section');p.id='rwaMultiChainPanel';p.hidden=true;p.setAttribute('role','dialog');p.setAttribute('aria-modal','false');p.setAttribute('aria-label','RWA Multi Chain');
  p.innerHTML='<div class="rwa-mc-head"><div><small>MULTI CHAIN</small><h2>One RWA workspace. Many networks.</h2><p>Choose network context without exposing unsupported transaction routes.</p></div><button type="button" class="rwa-mc-close" aria-label="Close multi chain">×</button></div><div id="rwaMultiChainBody"><div class="rwa-mc-note"><b>Loading network registry…</b></div></div>';
  document.body.appendChild(p);p.querySelector('.rwa-mc-close')?.addEventListener('click',close);return p;
}
function summary(reg){
  const exec=reg.networks.filter(n=>n.status==='EXECUTION_GATED').length;
  const funding=reg.networks.filter(n=>n.status==='FUNDING_GATED').length;
  const gated=reg.networks.filter(n=>n.status==='ADAPTER_GATED').length;
  return`<div class="rwa-mc-summary"><div><small>NETWORKS</small><b>${reg.networks.length}</b><span>Unified contexts</span></div><div><small>EXECUTION</small><b>${exec}</b><span>Protected rail</span></div><div><small>GATED</small><b>${funding+gated}</b><span>Fail-closed rails</span></div></div>`
}
function render(){
  const reg=state.registry,body=$('rwaMultiChainBody');if(!reg||!body)return;
  const active=reg.networks.find(n=>n.id===state.selected)||reg.networks[0];
  const caps=capabilityText(active);
  const canTrade=active.status==='EXECUTION_GATED';
  const canFund=active.status==='FUNDING_GATED';
  body.innerHTML=`${summary(reg)}
  <div class="rwa-mc-note"><b>CHAIN ABSTRACTION</b> Network choice stays inside one interface. Unsupported writes fail closed; gas abstraction is shown only when a validated adapter actually provides it.</div>
  <div class="rwa-mc-list">${reg.networks.map(n=>`<button type="button" class="rwa-mc-chain ${n.id===active.id?'active':''}" data-rwa-chain="${esc(n.id)}"><span class="rwa-mc-icon">${esc(initials(n.name))}</span><div><b>${esc(n.name)}</b><small>${esc(n.family)} · ${esc(n.native||'')}</small></div><i class="rwa-mc-state ${statusTone(n)}"></i></button>`).join('')}</div>
  <section class="rwa-mc-detail"><div class="rwa-mc-detail-head"><div><small>SELECTED NETWORK</small><h3>${esc(active.name)}</h3></div><span class="rwa-mc-badge">${esc(statusLabel(active))}</span></div><p>${esc(active.description||'')}</p><div class="rwa-mc-caps">${caps.map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="rwa-mc-actions"><button type="button" data-rwa-mc-market>Keep current market</button><button type="button" class="primary" data-rwa-mc-continue ${canTrade||canFund?'':'disabled'}>${canTrade?'Open protected trade':canFund?'Open gated funding':'Adapter locked'}</button></div></section>
  <div class="rwa-mc-foot">Policy: ${esc(POLICY)} · Selected market: ${esc(selectedSymbol())}. Network selection alone never sends a transaction.</div>`;
  body.querySelectorAll('[data-rwa-chain]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.rwaChain)));
  body.querySelector('[data-rwa-mc-market]')?.addEventListener('click',close);
  const c=body.querySelector('[data-rwa-mc-continue]');if(c&&!c.disabled)c.addEventListener('click',continueSelected);
}
function select(id){
  if(!state.registry?.networks?.some(n=>n.id===id))return false;
  state.selected=id;try{localStorage.setItem(STORAGE_KEY,id)}catch{}render();
  window.dispatchEvent(new CustomEvent('rwa:multichain-select',{detail:{network:id,policy:POLICY}}));return true;
}
function continueSelected(){
  const n=state.registry?.networks?.find(x=>x.id===state.selected);if(!n)return;
  const sym=selectedSymbol();
  if(n.status==='EXECUTION_GATED'){
    close();
    if(typeof window.RWASuperApp?.openTrade==='function')window.RWASuperApp.openTrade(sym);
    else window.RWASuperApp?.navigate?.(`trade/${sym}`);
    toastSafe(`${n.name}: protected execution opened. Mainnet remains machine gated.`);return;
  }
  if(n.status==='FUNDING_GATED'){
    close();window.RWASuperApp?.navigate?.(`trade/${sym}`);
    toastSafe(`${n.name}: USDC funding is available only through the protected machine-gated flow.`);return;
  }
  toastSafe(`${n.name}: adapter is fail-closed. No transaction was sent.`);
}
async function open(){
  installStyles();installLauncher();installPanel();
  try{await loadRegistry();render()}catch(e){const b=$('rwaMultiChainBody');if(b)b.innerHTML=`<div class="rwa-mc-note"><b>FAIL CLOSED</b> ${esc(e.message||e)}. No network transaction is available.</div>`}
  state.open=true;$('rwaMultiChainPanel').hidden=false;$('rwaMultiChainLaunch')?.classList.add('active');document.body.classList.add('rwa-multichain-open');
}
function close(){state.open=false;const p=$('rwaMultiChainPanel');if(p)p.hidden=true;$('rwaMultiChainLaunch')?.classList.remove('active');document.body.classList.remove('rwa-multichain-open')}
function boot(){installStyles();installLauncher();installPanel();loadRegistry().then(()=>render()).catch(()=>{})}

document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.open)close()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('rwa:product-os-ready',boot,{once:true});

window.RWAMultiChain={version:VERSION,policy:POLICY,open,close,select,status:()=>({version:VERSION,policy:POLICY,selected:state.selected,open:state.open,networks:state.registry?.networks?.map(n=>({id:n.id,status:n.status}))||[]})};
})();
