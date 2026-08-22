(()=>{
'use strict';
if(!document.querySelector('link[data-rwa-suite-v2-css]')){const l=document.createElement('link');l.rel='stylesheet';l.href='suite-v2.css?v=1';l.dataset.rwaSuiteV2Css='1';document.head.appendChild(l)}
if(window.RWASuite?.version==='2.0.0')return;
if([...document.scripts].some(s=>(s.getAttribute('src')||'').split('?')[0].endsWith('suite-v2.js')))return;
const s=document.createElement('script');
s.src='suite-v2.js?v=2';
s.async=false;
s.dataset.rwaSuiteV2='1';
document.body.appendChild(s);
})();
