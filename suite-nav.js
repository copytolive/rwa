(()=>{
const nav=document.querySelector('.mobile-tabs');
if(nav){
  nav.innerHTML='<a href="#markets" data-mobile-nav="markets"><span>⌕</span><small>Markets</small></a><a class="active" href="#terminal" data-mobile-nav="chart"><span>⌁</span><small>Chart</small></a><a href="#social" data-mobile-nav="social"><span>◎</span><small>Social</small></a><a href="#suite" data-mobile-nav="hub"><span>◇</span><small>Hub</small></a><a href="#suite" data-mobile-nav="portfolio"><span>▣</span><small>Portfolio</small></a>';
}
function hideSuite(){
  document.body.classList.remove('suite-open');
  const s=document.getElementById('suite');if(s)s.style.display='none';
}
function suite(tab){
  if(!window.RWASuite)return;
  window.RWASuite.open(tab);
  const s=document.getElementById('suite');
  if(innerWidth>680&&s)setTimeout(()=>s.scrollIntoView({behavior:'smooth',block:'start'}),20);
}
document.addEventListener('click',e=>{
  if(e.target.closest('[data-suite-close]')){e.preventDefault();hideSuite();if(innerWidth>680)document.getElementById('terminal')?.scrollIntoView({behavior:'smooth',block:'start'})}
});
const top=[...document.querySelectorAll('.topnav button')];
for(const b of top){
  const t=b.textContent.trim().toLowerCase();
  if(t==='markets')b.onclick=()=>{hideSuite();document.getElementById('terminal')?.scrollIntoView({behavior:'smooth'})};
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