(()=>{
'use strict';
if(window.RWAVerificationEvidence)return;
const $=id=>document.getElementById(id);
const wallet=()=>{try{return String(JSON.parse(localStorage.getItem('rwa_wallet_link_v1')||'null')?.wallet||'').toLowerCase()}catch{return''}};
const key=()=>`rwa_verify_v1:${wallet()||'anon'}`;
const get=()=>{try{return JSON.parse(localStorage.getItem(key())||'{}')||{}}catch{return{}}};
const set=v=>localStorage.setItem(key(),JSON.stringify(v));
function inject(){if($('verifyKybEvidence'))return false;const form=document.querySelector('[data-ops-panel="verify"] .suite-card .suite-form');if(!form)return false;form.insertAdjacentHTML('beforeend','<div class="suite-field"><label>KYB / AML EVIDENCE URL</label><input id="verifyKybEvidence" type="url" inputmode="url" placeholder="https://..."></div><div class="suite-field"><label>RISK DISCLOSURE URL</label><input id="verifyDisclosureEvidence" type="url" inputmode="url" placeholder="https://..."></div>');render();return true}
function render(){if(!inject()&&!$('verifyKybEvidence'))return;const v=get();if($('verifyKybEvidence')&&document.activeElement!==$('verifyKybEvidence'))$('verifyKybEvidence').value=v.kyb||'';if($('verifyDisclosureEvidence')&&document.activeElement!==$('verifyDisclosureEvidence'))$('verifyDisclosureEvidence').value=v.disclosure||''}
function save(){const v=get();v.kyb=$('verifyKybEvidence')?.value.trim()||'';v.disclosure=$('verifyDisclosureEvidence')?.value.trim()||'';set(v);window.RWAAudit?.log?.('rwa.verification.evidence',{kyb:!!v.kyb,disclosure:!!v.disclosure});setTimeout(()=>window.RWAVerifyClient?.render?.(),0)}
document.addEventListener('click',e=>{if(e.target.closest('#saveVerification'))setTimeout(save,0);if(e.target.closest('[data-ops-tab="verify"]'))setTimeout(render,30)},true);
window.addEventListener('rwa:wallet-login',render);window.addEventListener('rwa:wallet-logout',render);new MutationObserver(()=>inject()).observe(document.documentElement,{childList:true,subtree:true});window.RWAVerificationEvidence={version:'1.0.0',render,save};inject();
})();