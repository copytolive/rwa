(()=>{
'use strict';
if(window.RWAMonitorClient)return;
let last=0;
function jget(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}}
function jset(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
function toastSafe(t){if(typeof toast==='function')toast(t)}
async function sync(){try{const r=await fetch(`monitor/status.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)return;const s=await r.json();window.RWA24x7Status=s;if(s.updated_at>last){last=s.updated_at;const q=jget('rwa_copy_queue_v1',[]),ids=new Set(q.map(x=>x.id));for(const f of s.copy_signals||[]){const id=`24x7-${f.tid||f.time}-${f.coin}`;if(!ids.has(id)){q.unshift({id,coin:f.coin,side:f.side,px:Number(f.px),sourceSize:Number(f.sz),size:Number(f.sz),time:f.time,target:f.target,source:'24x7-monitor'});ids.add(id)}}jset('rwa_copy_queue_v1',q.slice(0,100));for(const a of s.alerts||[])toastSafe(`24/7 alert: ${a.symbol} ${a.type}`)}const box=document.getElementById('providerRows');if(box&&document.querySelector('[data-ops-panel="system"].active')){let e=document.getElementById('scheduledMonitorRow');if(!e){e=document.createElement('div');e.id='scheduledMonitorRow';e.className='ops-row';box.appendChild(e)}const age=s.updated_at?Math.max(0,Math.round((Date.now()-s.updated_at)/60000)):null;e.innerHTML=`<b>GitHub 24/7 monitor</b><span class="${age!=null&&age<15?'up':'down'}">${age==null?'WAITING':age+'m ago'}</span>`}}catch{}}
setInterval(sync,60000);sync();window.RWAMonitorClient={sync,status:()=>window.RWA24x7Status||null};
})();