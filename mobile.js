(()=>{
  const $=id=>document.getElementById(id);
  const mirror=[
    ['selIcon','mobileSelIcon'],['selName','mobilePairName'],['selLabel','mobilePairLabel'],
    ['statPrice','mobileSelectedPrice'],['statChange','mobileSelectedChange'],['statHigh','mobileHigh'],
    ['statLow','mobileLow'],['statVol','mobileVol']
  ];
  let lastSparkKey='';

  function syncOne(from,to){
    const a=$(from),b=$(to);if(!a||!b)return;
    b.textContent=a.textContent;
    if(from==='statChange') b.className=a.className;
  }
  function syncAll(){
    mirror.forEach(([a,b])=>syncOne(a,b));
    const pc=$('pairCount'),mpc=$('mobilePairCount');
    if(pc&&mpc){const m=(pc.textContent||'').match(/\d+/);mpc.textContent=m?m[0]+' live pairs':'Live market universe'}
    const ld=$('liveDot'),mld=$('mobileLiveDot');
    if(ld&&mld){const live=ld.classList.contains('live');mld.style.background=live?'var(--green)':'#66707d';mld.style.boxShadow=live?'0 0 12px rgba(53,218,160,.65)':'none'}
    drawSparkline();
  }
  function watch(id){const el=$(id);if(el)new MutationObserver(syncAll).observe(el,{subtree:true,childList:true,characterData:true,attributes:true})}

  function drawSparkline(){
    const canvas=$('mobileSparkline');
    if(!canvas||innerWidth>680||typeof S==='undefined'||!Array.isArray(S.klines)||S.klines.length<2)return;
    const data=S.klines.slice(-48).map(x=>Number(x.c)).filter(Number.isFinite);if(data.length<2)return;
    const key=(S.selected||'')+'|'+data.length+'|'+data[data.length-1];if(key===lastSparkKey)return;lastSparkKey=key;
    const rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1,w=Math.max(1,rect.width),h=Math.max(1,rect.height);canvas.width=w*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const min=Math.min(...data),max=Math.max(...data),range=max-min||1,pad=4;const pts=data.map((v,i)=>[pad+(i/(data.length-1))*(w-pad*2),pad+(1-(v-min)/range)*(h-pad*2)]);
    const up=data[data.length-1]>=data[0],stroke=up?'#49e0aa':'#ff7383';const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,up?'rgba(73,224,170,.28)':'rgba(255,115,131,.25)');grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();ctx.lineTo(pts[pts.length-1][0],h);ctx.lineTo(pts[0][0],h);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  }

  function setDetailView(view,scroll=false){
    if(innerWidth>680)return;
    document.body.classList.remove('mview-overview','mview-trades','mview-depth');document.body.classList.add('mview-'+view);
    document.querySelectorAll('[data-mobile-view]').forEach(b=>b.classList.toggle('active',b.dataset.mobileView===view));
    if(view==='depth')document.querySelectorAll('[data-mobile-nav]').forEach(a=>a.classList.toggle('active',a.dataset.mobileNav==='depth'));
    else document.querySelectorAll('[data-mobile-nav]').forEach(a=>a.classList.toggle('active',a.dataset.mobileNav==='chart'));
    if(scroll){const target=view==='depth'?$('depth'):$('terminal');target?.scrollIntoView({behavior:'smooth',block:'start'})}
  }

  function triggerFilter(name){
    const btn=document.querySelector(`.filter[data-filter="${name}"]`);if(btn){btn.click();setTimeout(()=>$('markets')?.scrollIntoView({behavior:'smooth',block:'start'}),60)}
  }

  document.addEventListener('click',e=>{
    const row=e.target.closest('.pairrow');
    if(row&&innerWidth<=680)setTimeout(()=>{syncAll();setDetailView('overview');$('terminal')?.scrollIntoView({behavior:'smooth',block:'start'})},140);
    const view=e.target.closest('[data-mobile-view]');if(view){e.preventDefault();setDetailView(view.dataset.mobileView,true);return}
    const action=e.target.closest('[data-mobile-action]');if(action&&innerWidth<=680){const a=action.dataset.mobileAction;if(a==='search'){$('markets')?.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>$('search')?.focus(),300)}else if(a==='rwa')triggerFilter('rwa');else if(a==='gainers')triggerFilter('gainers')}
    const nav=e.target.closest('[data-mobile-nav]');if(nav&&innerWidth<=680){document.querySelectorAll('[data-mobile-nav]').forEach(x=>x.classList.remove('active'));nav.classList.add('active');if(nav.dataset.mobileNav==='depth')setDetailView('depth');else if(nav.dataset.mobileNav==='chart')setDetailView('overview')}
  });

  ['selIcon','selName','selLabel','statPrice','statChange','statHigh','statLow','statVol','pairCount','liveDot'].forEach(watch);
  addEventListener('resize',()=>{syncAll();if(innerWidth<=680&&!document.body.classList.contains('mview-overview')&&!document.body.classList.contains('mview-trades')&&!document.body.classList.contains('mview-depth'))setDetailView('overview')});
  syncAll();setDetailView('overview');setInterval(syncAll,1800);
})();
