'use strict';
const CACHE='rwa-superapp-v5-shell-20';
const CORE=['./','./index.html','./styles.css?v=7','./mobile.css?v=6','./stable-shell.css?v=3','./superapp-v5.css?v=13','./app.js?v=10','./realtime-core.js?v=3&compat=realtime-core.js?v=2','./chart-core.js?v=1','./market-performance.js?v=12','./mobile.js?v=12','./superapp-v5.js?v=17','./rwa-discovery-catalog.json','./manifest.webmanifest'];
const ROOT='/rwa/';
const isRenko=u=>u.pathname.startsWith(ROOT+'renko/');
const isFreshControlScript=u=>u.pathname===ROOT+'legacy-canonical.js'||u.pathname===ROOT+'superapp-v5.js'||u.pathname===ROOT+'market-performance.js'||u.pathname===ROOT+'rwa-multichain.js'||u.pathname===ROOT+'rwa-multichain-engine.js';
const networkFresh=async r=>{
  const req=new Request(r,{cache:'reload'});
  const res=await fetch(req);
  if(!res.ok)throw Error('network '+res.status);
  return res;
};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(CORE.map(u=>c.add(u)))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith('rwa-superapp-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==location.origin)return;
  if(isRenko(u)){
    e.respondWith(networkFresh(r).catch(()=>new Response('RENKO tick-native runtime requires a fresh network response. Stale timeframe builds are intentionally blocked.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}})));
    return;
  }
  if(isFreshControlScript(u)){
    e.respondWith(networkFresh(r).then(x=>{const c=x.clone();caches.open(CACHE).then(k=>k.put(r,c));return x}).catch(()=>caches.match(r)));
    return;
  }
  if(r.mode==='navigate'){
    e.respondWith(fetch(new Request(r,{cache:'reload'})).then(x=>{
      if((u.pathname===ROOT||u.pathname===ROOT+'index.html')&&x.ok){const c=x.clone();caches.open(CACHE).then(k=>k.put('./index.html',c));}
      return x;
    }).catch(()=>caches.match('./index.html').then(x=>x||caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(x=>{if(x.ok&&['script','style','document'].includes(r.destination)){const c=x.clone();caches.open(CACHE).then(k=>k.put(r,c))}return x}).catch(()=>hit)));
});
