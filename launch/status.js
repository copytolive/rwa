(()=>{
'use strict';
const order=['browser_single_write','browser_global_mainnet_lock','monitoring_pipeline','real_wallet_e2e','reviewer_registry','verified_rwa_asset','worker_configured','worker_live','worker_control','beta_internal','beta_closed','beta_public','mainnet_control'];
const labels={browser_single_write:'Execution safety',browser_global_mainnet_lock:'Mainnet hard lock',monitoring_pipeline:'Monitoring',real_wallet_e2e:'Real-wallet E2E',reviewer_registry:'Reviewer registry',verified_rwa_asset:'Verified RWA asset',worker_configured:'24/7 worker config',worker_live:'24/7 worker live',worker_control:'Worker safety control',beta_internal:'Internal beta',beta_closed:'Closed beta',beta_public:'Public beta',mainnet_control:'Mainnet control'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(){
  const r=await fetch('./readiness.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Readiness unavailable');const x=await r.json();
  const checks=x.checks||{},keys=order.filter(k=>checks[k]);const passed=keys.filter(k=>checks[k].ok).length,pct=keys.length?Math.round(passed/keys.length*100):0;
  const status=document.getElementById('status');status.textContent=x.status||'BLOCKED';status.className=x.mainnet_ready?'ready':x.beta_ready?'beta-ready':'blocked';
  document.getElementById('summary').textContent=x.mainnet_ready?'All launch gates passed. MAINNET activation is authorized by the machine gate.':x.beta_ready?'Engineering and launch prerequisites passed. Beta evidence is still being accumulated.':`Engineering ${x.engineering_ready?'PASS':'PENDING'} · ${x.blockers?.length||0} launch blocker(s) remain.`;
  document.getElementById('meter').style.width=pct+'%';
  document.getElementById('checks').innerHTML=keys.map(k=>`<article class="card check ${checks[k].ok?'pass':'pending'}"><div><small>${esc(labels[k]||k)}</small><b>${checks[k].ok?'PASS':'PENDING'}</b></div><p>${esc(checks[k].detail)}</p></article>`).join('');
  const b=x.beta||{},c=b.counts||{},t=b.thresholds||{};document.getElementById('internal').textContent=`${c.internal||0}/${t.internal||3}`;document.getElementById('closed').textContent=`${c.closed||0}/${t.closed||20}`;document.getElementById('public').textContent=`${c.public||0}/${t.public||100}`;
  document.getElementById('updated').textContent='Updated '+new Date(x.generated_at).toLocaleString();
}
load().catch(e=>{document.getElementById('status').textContent='UNAVAILABLE';document.getElementById('summary').textContent=e.message});setInterval(load,30000);
})();
