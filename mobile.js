(()=>{
  const $=id=>document.getElementById(id);

  const compactNumber=v=>{
    const n=Number(v);if(!Number.isFinite(n))return '—';
    return '$'+Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n);
  };

  function syncStatus(){
    const pc=$('pairCount'),mpc=$('mobilePairCount');
    if(mpc){
      if(typeof S!=='undefined'&&Array.isArray(S.pairs)&&S.pairs.length)mpc.textContent=`${S.pairs.length} live pairs`;
      else if(pc){const m=(pc.textContent||'').match(/\d+/);mpc.textContent=m?`${m[0]} live pairs`:'Loading markets…'}
    }
  }

  function syncBreadth(){
    if(typeof S==='undefined'||!Array.isArray(S.pairs)||!S.pairs.length)return;
    let gain=0,loss=0,rwa=0;
    for(const x of S.pairs){if((x.change||0)>0)gain++;else if((x.change||0)<0)loss++;if(x.rwa)rwa++;}
    if($('mobileGainers'))$('mobileGainers').textContent=gain.toLocaleString();
    if($('mobileLosers'))$('mobileLosers').textContent=loss.toLocaleString();
    if($('mobileRwaCount'))$('mobileRwaCount').textContent=rwa.toLocaleString();
  }

  function annotateRows(){
    if(innerWidth>680||typeof S==='undefined'||!S.map)return;
    document.querySelectorAll('.pairrow[data-sym]').forEach(row=>{
      const x=S.map.get(row.dataset.sym),box=row.querySelector('.pairprice');if(!x||!box)return;
      let vol=box.querySelector('.mobile-row-vol');
      if(!vol){vol=document.createElement('span');vol.className='mobile-row-vol';box.appendChild(vol);}
      vol.textContent=`Vol ${compactNumber(x.vol)}`;
    });
  }

  function syncMobile(){syncStatus();syncBreadth();annotateRows();}
  function watch(id,fn=syncMobile){const el=$(id);if(el)new MutationObserver(fn).observe(el,{subtree:true,childList:true,characterData:true,attributes:true})}

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
    if(row&&innerWidth<=680){setTimeout(()=>{syncMobile();setDetailView('overview',true)},100);return}

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

  ['pairCount','liveDot'].forEach(id=>watch(id));
  watch('pairList',()=>setTimeout(syncMobile,0));
  addEventListener('resize',()=>{
    syncMobile();
    if(innerWidth<=680&&!document.body.classList.contains('mview-overview')&&!document.body.classList.contains('mview-trades')&&!document.body.classList.contains('mview-depth'))setDetailView('overview');
  });

  syncMobile();
  if(innerWidth<=680)setDetailView('overview');
  setInterval(syncMobile,2200);
})();
