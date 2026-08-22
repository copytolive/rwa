(()=>{
'use strict';
if(window.RWASuite?.version==='2.0.0')return;
if([...document.scripts].some(s=>(s.getAttribute('src')||'').split('?')[0].endsWith('suite-v2.js')))return;
const s=document.createElement('script');
s.src='suite-v2.js?v=2';
s.async=false;
s.dataset.rwaSuiteV2='1';
document.body.appendChild(s);
})();
