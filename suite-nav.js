(()=>{
const nav=document.querySelector('.mobile-tabs');
if(nav){
  nav.innerHTML='<a href="#markets" data-mobile-nav="markets"><span>⌕</span><small>Markets</small></a><a class="active" href="#terminal" data-mobile-nav="chart"><span>⌁</span><small>Chart</small></a><a href="#social" data-mobile-nav="social"><span>◎</span><small>Social</small></a><a href="#suite" data-mobile-nav="hub"><span>◇</span><small>Hub</small></a><a href="#suite" data-mobile-nav="portfolio"><span>▣</span><small>Portfolio</small></a>';
}
function suite(tab){if(window.RWASuite)window.RWASuite.open(tab)}
const top=[...document.querySelectorAll('.topnav button')];
for(const b of top){
  const t=b.textContent.trim().toLowerCase();
  if(t==='markets')b.onclick=()=>{window.RWASuite?.close?.();document.getElementById('terminal')?.scrollIntoView({behavior:'smooth'})};
  if(t==='intelligence')b.onclick=()=>suite('intel');
  if(t==='assets')b.onclick=()=>suite('rwa');
  if(t==='research')b.onclick=()=>suite('feed');
  if(t==='company')b.onclick=()=>suite('profile');
}
const prod=[...document.querySelectorAll('.product-nav button')];
for(const b of prod){
  const t=b.textContent.trim().toLowerCase();
  if(t.includes('rwa index'))b.onclick=()=>suite('intel');
  if(t.includes('asset marketplace'))b.onclick=()=>suite('rwa');
  if(t.includes('research'))b.onclick=()=>suite('feed');
}
const sign=document.querySelector('.signin');if(sign)sign.onclick=()=>suite('profile');
const inst=document.querySelector('.institutional');if(inst)inst.onclick=()=>suite('rwa');
})();