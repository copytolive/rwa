(()=>{
  const $=id=>document.getElementById(id);
  const pairs=[
    ['selIcon','mobileSelIcon'],['selName','mobilePairName'],['selLabel','mobilePairLabel'],
    ['statPrice','mobileSelectedPrice'],['statChange','mobileSelectedChange'],['statHigh','mobileHigh'],
    ['statLow','mobileLow'],['statVol','mobileVol']
  ];
  function syncOne(from,to){
    const a=$(from),b=$(to);if(!a||!b)return;
    b.textContent=a.textContent;
    if(from==='statChange') b.className=a.className;
  }
  function syncAll(){pairs.forEach(([a,b])=>syncOne(a,b));
    const pc=$('pairCount'),mpc=$('mobilePairCount');
    if(pc&&mpc){const m=(pc.textContent||'').match(/\d+/);mpc.textContent=m?m[0]+' live pairs':'Live market universe'}
    const ld=$('liveDot'),mld=$('mobileLiveDot');
    if(ld&&mld){mld.style.background=ld.classList.contains('live')?'var(--green)':'#66707d';mld.style.boxShadow=ld.classList.contains('live')?'0 0 12px rgba(53,218,160,.65)':'none'}
  }
  function watch(id){const el=$(id);if(el)new MutationObserver(syncAll).observe(el,{subtree:true,childList:true,characterData:true,attributes:true})}
  ['selIcon','selName','selLabel','statPrice','statChange','statHigh','statLow','statVol','pairCount','liveDot'].forEach(watch);
  document.addEventListener('click',e=>{
    const row=e.target.closest('.pairrow');
    if(row&&innerWidth<=680)setTimeout(()=>{syncAll();document.querySelector('.mobile-feature-card')?.scrollIntoView({behavior:'smooth',block:'nearest'})},120);
  });
  syncAll();
  setInterval(syncAll,2500);
})();
