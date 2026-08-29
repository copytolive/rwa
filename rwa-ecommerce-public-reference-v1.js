(()=>{
'use strict';
if(window.RWAEcommercePublicReference)return;
const VERSION='1.1.0';
const saved=new Map();
function open(){return document.body.classList.contains('rwa-seablueprint-commerce-open')}
function remember(el){if(el&&!saved.has(el))saved.set(el,el.getAttribute('style'))}
function imp(el,props){if(!el)return;remember(el);for(const[k,v]of Object.entries(props))el.style.setProperty(k,v,'important')}
function hide(el){imp(el,{display:'none',visibility:'hidden','pointer-events':'none'})}
function pinDesktop(){
  const html=document.documentElement,body=document.body,app=document.querySelector('.app'),top=document.querySelector('.topbar'),layout=document.querySelector('.layout'),left=layout?.querySelector(':scope > .left'),main=layout?.querySelector(':scope > .main'),right=layout?.querySelector(':scope > .right'),dock=document.querySelector('#rwaCommerceDock');
  imp(html,{overflow:'hidden','scrollbar-gutter':'auto'});imp(body,{overflow:'hidden','overflow-x':'hidden','overflow-y':'hidden','scrollbar-gutter':'auto'});imp(app,{'padding-top':'0',height:'100vh','min-height':'100vh',overflow:'hidden'});
  imp(top,{position:'fixed',inset:'auto',top:'0',left:'0',right:'0',width:'100vw',height:'59px','min-height':'59px','max-height':'59px',margin:'0','z-index':'12000'});
  imp(layout,{position:'fixed',inset:'auto',left:'0',right:'440px',top:'59px',bottom:'34px',display:'grid','grid-template-columns':'286px minmax(0,1fr) 236px','grid-template-rows':'minmax(0,1fr)','grid-template-areas':'none','grid-auto-flow':'row',gap:'4px',width:'auto','max-width':'none','min-width':'0',height:'auto','min-height':'0','max-height':'none',margin:'0',padding:'4px','padding-right':'4px','box-sizing':'border-box','align-items':'stretch',overflow:'hidden'});
  imp(left,{'grid-column':'1','grid-row':'1',position:'relative',inset:'auto',top:'auto',left:'auto',right:'auto',bottom:'auto',width:'auto','min-width':'0','max-width':'none',height:'100%','min-height':'0','max-height':'none',margin:'0',overflow:'hidden'});
  imp(main,{'grid-column':'2','grid-row':'1',position:'relative',inset:'auto',top:'auto',left:'auto',right:'auto',bottom:'auto',width:'auto','min-width':'0','max-width':'none',height:'100%','min-height':'0','max-height':'none',margin:'0',overflow:'hidden'});
  imp(right,{'grid-column':'3','grid-row':'1',position:'relative',inset:'auto',top:'auto',left:'auto',right:'auto',bottom:'auto',width:'auto','min-width':'0','max-width':'none',height:'100%','min-height':'0','max-height':'none',margin:'0',overflow:'hidden'});
  imp(dock,{position:'fixed',inset:'auto',top:'59px',right:'0',bottom:'34px',left:'auto',width:'440px','min-width':'440px','max-width':'440px',height:'auto',margin:'0',transform:'none'});
  hide(document.querySelector('.credibility-strip'));hide(document.querySelector('.productbar'));hide(document.querySelector('.trustbar'));
}
function clean(){
  if(!open())return;
  if(innerWidth>680)pinDesktop();
  for(const el of document.querySelectorAll('#rwaMarketplaceLaunch,#rwaMultiChainLaunch,.rwa-command-button,[data-rwa-command-open]'))hide(el);
  const host=document.querySelector('.top-actions');if(host)for(const el of [...host.children]){if(el.matches('.rwa-target-inpage,.rwa-target-icon-actions,.signin'))continue;hide(el)}
  const nav=document.querySelector('.topnav');if(nav){const ecommerce=[...nav.querySelectorAll('[data-rwa-target-nav="ecommerce"]')];ecommerce.slice(1).forEach(x=>x.remove())}
  document.documentElement.dataset.rwaEcommerceReference='1';
}
function restore(){
  if(open())return;
  for(const[el,style]of saved){if(!el?.isConnected)continue;if(style===null)el.removeAttribute('style');else el.setAttribute('style',style)}saved.clear();delete document.documentElement.dataset.rwaEcommerceReference;
}
function sync(){open()?clean():restore()}
new MutationObserver(()=>queueMicrotask(sync)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
addEventListener('hashchange',sync);addEventListener('resize',()=>requestAnimationFrame(sync),{passive:true});setInterval(sync,70);sync();
window.RWAEcommercePublicReference={version:VERSION,apply:sync,isActive:()=>open()&&innerWidth>680,audit:()=>{const r=s=>{const x=document.querySelector(s)?.getBoundingClientRect();return x?Object.fromEntries(['left','top','right','bottom','width','height'].map(k=>[k,Math.round(x[k])])):null};return{version:VERSION,open:open(),reference:document.documentElement.dataset.rwaEcommerceReference==='1',multichainVisible:[...document.querySelectorAll('#rwaMultiChainLaunch')].some(x=>getComputedStyle(x).display!=='none'),commandVisible:[...document.querySelectorAll('.rwa-command-button,[data-rwa-command-open]')].some(x=>getComputedStyle(x).display!=='none'),topbar:r('.topbar'),layout:r('.layout'),orderBook:r('.layout>.right'),dock:r('#rwaCommerceDock')}}};
})();
