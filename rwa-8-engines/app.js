(()=>{
'use strict';
const $=id=>document.getElementById(id);
const engineMeta=[
  ['passport','RWA Passport','Business identity + VC'],['registry','Asset Registry','Business → asset graph'],['proof','Proof Engine','Evidence hashes + provenance'],['valuation','Valuation Engine','DCF / declared value'],['legal','Legal Engine','Jurisdiction + rights gate'],['compliance','Compliance Engine','KYB / screening / transfer'],['factory','RWA Factory','Issuance-readiness draft'],['marketplace','Marketplace','Discovery / finance / trade level']
];
let current=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const formatMoney=(v,c='USD')=>{const n=Number(v);if(!Number.isFinite(n))return'—';try{return new Intl.NumberFormat('en-US',{style:'currency',currency:c,maximumFractionDigits:0}).format(n)}catch{return`${c} ${n.toLocaleString()}`}};
function engineTone(e){const s=String(e?.status||'').toUpperCase();if(/CREATED|REGISTERED|HASHED|MODELLED|ALLOWED|CLEAR|READY/.test(s)&&!/BLOCKED|NOT_|NO_/.test(s))return'ok';if(/BLOCKED|MISSING|ERROR|FAIL/.test(s))return'bad';return'warn'}
function renderEngineGrid(result){
  const host=$('engineGrid');
  host.innerHTML=engineMeta.map(([id,title,sub])=>{const e=result?.[id],status=e?.status||'WAITING';return`<article class="engine ${engineTone(e)}"><span class="dot"></span><small>${esc(id.toUpperCase())}</small><b>${esc(title)}</b><small>${esc(sub)}</small><div><strong>${esc(status)}</strong></div></article>`}).join('');
}
function formInput(fd){
  return{
    mode:fd.get('mode'),
    business:{legalName:fd.get('legalName'),registrationId:fd.get('registrationId'),country:fd.get('country'),businessType:fd.get('businessType'),website:fd.get('website')},
    assets:[{assetType:fd.get('assetType'),name:fd.get('assetName'),description:fd.get('assetDescription'),country:fd.get('assetCountry'),currency:fd.get('currency'),declaredValue:fd.get('declaredValue'),annualRevenue:fd.get('annualRevenue'),ebitdaMargin:fd.get('ebitdaMargin'),growthRate:fd.get('growthRate'),discountRate:fd.get('discountRate')}],
    evidence:fd.get('evidenceName')?[{type:fd.get('evidenceType'),name:fd.get('evidenceName'),source:fd.get('evidenceSource'),reviewStatus:'UNREVIEWED'}]:[],
    screening:{status:'PENDING',providerVerified:false},review:{legalApproved:false,transferEligible:false}
  };
}
function setReady(id,ready,blockedLabel='REVIEW REQUIRED'){
  const el=$(id);if(!el)return;el.classList.toggle('ok',!!ready);el.classList.toggle('warn',!ready);const b=el.querySelector('b');if(b)b.textContent=ready?'READY':blockedLabel;
}
function renderResult(r){
  current=r;$('resultEmpty').hidden=true;$('result').hidden=false;
  renderEngineGrid(r);
  $('passportId').textContent=r.passport.id;$('passportBusiness').textContent=r.passport.business.legalName;$('passportCountry').textContent=r.passport.business.country;$('passportAssets').textContent=String(r.registry.assets.length);
  setReady('readyRegister',r.ready.register,'BLOCKED');setReady('readyFinance',r.ready.finance,'REVIEW REQUIRED');setReady('readyTrade',r.ready.trade,'DISABLED');
  const v=r.valuation.assets[0]?.valuation;$('valuationValue').textContent=v?formatMoney(v.enterpriseValue,r.registry.assets[0]?.currency):'Insufficient data';$('valuationMethod').textContent=v?`${v.method} · ${r.valuation.disclaimer}`:r.valuation.disclaimer;
  $('pipelineShort').textContent=r.pipelineHash.slice(0,20)+'…';$('resultJson').textContent=JSON.stringify(r,null,2);
}
function renderSaved(){
  const rows=window.RWA8Engines?.loadSaved?.()||[],host=$('savedList');
  host.innerHTML=rows.length?rows.map((r,i)=>`<article class="saved-row"><div><b>${esc(r.passport?.business?.legalName||'Business')}</b><small>${esc(r.passport?.id||'')} · ${esc(r.marketplace?.listing?.level||'DISCOVERY_ONLY')}</small></div><div><button type="button" data-open-saved="${i}">Open</button><button type="button" data-delete-saved="${esc(r.passport?.id||'')}">Delete</button></div></article>`).join(''):'<p>No locally saved passport yet.</p>';
  host.querySelectorAll('[data-open-saved]').forEach(b=>b.onclick=()=>renderResult(rows[Number(b.dataset.openSaved)]));
  host.querySelectorAll('[data-delete-saved]').forEach(b=>b.onclick=()=>{window.RWA8Engines.removePassport(b.dataset.deleteSaved);renderSaved()});
}
async function submit(e){
  e.preventDefault();const btn=e.submitter;try{if(btn)btn.disabled=true;const fd=new FormData(e.currentTarget);const result=await window.RWA8Engines.runPipeline(formInput(fd));renderResult(result)}catch(err){console.error(err);alert('RWA pipeline failed: '+(err?.message||err))}finally{if(btn)btn.disabled=false}
}
function loadDemo(){
  const f=$('rwaFactoryForm'),set=(name,value)=>{const x=f.elements[name];if(x)x.value=value};
  set('legalName','Patimban Logistics & Cold Chain');set('registrationId','DEMO-ID-2026-001');set('country','ID');set('businessType','Company');set('website','https://example.com');set('assetType','Infrastructure');set('assetCountry','ID');set('assetName','Cold Storage & Logistics Facility');set('assetDescription','Operating cold-chain facility serving export-oriented businesses with warehouse, logistics and contracted revenue.');set('declaredValue','5000000');set('currency','USD');set('annualRevenue','1800000');set('ebitdaMargin','24');set('growthRate','8');set('discountRate','16');set('evidenceType','Company Registration');set('evidenceName','Demo Company Registration');set('evidenceSource','DEMO-DATAROOM-001');set('mode','REGISTER');
}
function boot(){
  renderEngineGrid(null);renderSaved();$('rwaFactoryForm')?.addEventListener('submit',submit);$('loadDemo')?.addEventListener('click',loadDemo);$('savePassport')?.addEventListener('click',()=>{if(current){window.RWA8Engines.savePassport(current);renderSaved()}});$('exportPassport')?.addEventListener('click',()=>{if(current)window.RWA8Engines.exportJson(current)});
  const embed=new URLSearchParams(location.search).get('embed')==='1';if(embed)document.documentElement.dataset.embed='1';
}
if(window.RWA8Engines)boot();else addEventListener('rwa:8-engines-ready',boot,{once:true});
})();
