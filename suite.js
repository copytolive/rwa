(()=>{
'use strict';
if(!document.querySelector('link[data-rwa-suite-v2-css]')){const l=document.createElement('link');l.rel='stylesheet';l.href='suite-v2.css?v=1';l.dataset.rwaSuiteV2Css='1';document.head.appendChild(l)}
if(window.RWASuite?.version==='2.0.0')return;
if(!window.RWASuite){window.RWASuite={version:'loading-v2',open:(tab='profile')=>{try{localStorage.setItem('rwa_suite_tab_v2',JSON.stringify(tab))}catch{};const el=document.getElementById('suite');if(el)el.style.display='block';if(innerWidth<=680)document.body.classList.add('suite-open')}}}
if([...document.scripts].some(s=>(s.getAttribute('src')||'').split('?')[0].endsWith('suite-v2.js')))return;
const s=document.createElement('script');
s.src='suite-v2.js?v=2';
s.async=false;
s.dataset.rwaSuiteV2='1';
document.body.appendChild(s);
})();
