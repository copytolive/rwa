(()=>{
'use strict';
if(window.RWAMarketLabels)return;
function sync(){const f=document.querySelector('.filter[data-filter="rwa"]');if(f)f.textContent='RWA-linked';document.querySelectorAll('.mobile-breadth small').forEach(x=>{if(x.textContent.trim()==='RWA PAIRS')x.textContent='RWA-LINKED'});document.querySelectorAll('.pairmeta small').forEach(x=>{if(/^RWA\s*·/i.test(x.textContent))x.textContent=x.textContent.replace(/^RWA\s*·/i,'RWA-linked ·')});const trust=[...document.querySelectorAll('.trustbar span')].find(x=>x.querySelector('b')?.textContent.trim()==='RWA');if(trust)trust.innerHTML='<b>RWA</b> Store tokens require verified physical commerce';}
function bind(){sync();new MutationObserver(sync).observe(document.documentElement,{subtree:true,childList:true,characterData:true})}
window.RWAMarketLabels={version:'1.0.0',policy:'public-rwa-linked-vs-store-token-v1',refresh:sync};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
