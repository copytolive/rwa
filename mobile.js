(()=>{
  const $=id=>document.getElementById(id);

  function syncStatus(){
    const pc=$('pairCount'),mpc=$('mobilePairCount');
    if(pc&&mpc){const m=(pc.textContent||'').match(/\d+/);mpc.textContent=m?`${m[0]} live pairs`:'Live market universe'}
    const ld=$('liveDot'),mld=$('mobileLiveDot');
    if(ld&&mld){const live=ld.classList.contains('live');mld.style.background=live?'var(--green)':'#66707d';mld.style.boxShadow=live?'0 0 10px rgba(53,218,160,.6)':'none'}
  }

  function watch(id){const el=$(id);if(el)new MutationObserver(syncStatus).observe(el,{subtree:true,childList:true,characterData:true,attributes:true})}

  function setDetailView(view,scroll=false){
    if(innerWidth>680)return;
    document.body.classList.remove('mview-overview','mview-trades','mview-depth');
    document.body.classList.add(`mview-${view}`);
    document.querySelectorAll('[data-mobile-view]').forEach(b=>b.classList.toggle('active',b.dataset.mobileView===view));
    document.querySelectorAll('[data-mobile-nav]').forEach(a=>a.classList.remove('active'));
    const navName=view==='depth'?'depth':'chart';
    document.querySelector(`[data-mobile-nav="${navName}"]`)?.classList.add('active');
    if(scroll)(view==='depth'?$('depth'):$('terminal'))?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function goMarkets(){
    if(innerWidth>680)return;
    document.querySelectorAll('[data-mobile-nav]').forEach(a=>a.classList.remove('active'));
    document.querySelector('[data-mobile-nav="markets"]')?.classList.add('active');
    $('markets')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  document.addEventListener('click',e=>{
    const row=e.target.closest('.pairrow');
    if(row&&innerWidth<=680){setTimeout(()=>setDetailView('overview',true),120);return}

    const view=e.target.closest('[data-mobile-view]');
    if(view&&innerWidth<=680){e.preventDefault();setDetailView(view.dataset.mobileView,true);return}

    const nav=e.target.closest('[data-mobile-nav]');
    if(nav&&innerWidth<=680){
      e.preventDefault();
      const target=nav.dataset.mobileNav;
      if(target==='markets')goMarkets();
      else if(target==='depth')setDetailView('depth',true);
      else setDetailView('overview',true);
    }
  });

  ['pairCount','liveDot'].forEach(watch);
  addEventListener('resize',()=>{syncStatus();if(innerWidth<=680&&!document.body.classList.contains('mview-overview')&&!document.body.classList.contains('mview-trades')&&!document.body.classList.contains('mview-depth'))setDetailView('overview')});
  syncStatus();
  if(innerWidth<=680)setDetailView('overview');
  setInterval(syncStatus,2500);
})();
