(()=>{
'use strict';
if(window.RWARenkoV5Auto)return;
const state={lastKey:'',timer:0,armed:false};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function current(){const v3=window.RWARenkoV3,v5=window.RWARenkoV5,s=v3?.state;return {v3,v5,s,key:s&&Number(s.box)>0?`${s.selected}|${Number(s.box)}`:''}}
async function maybeStart(reason='auto'){
  const {v5,s,key}=current();
  if(!v5||!s||!key)return;
  if(state.lastKey===key&&state.armed)return;
  state.lastKey=key;state.armed=true;
  if(v5.state.running)v5.cancel();
  const status=document.getElementById('archiveStatus');
  const detail=document.getElementById('archiveDetail');
  if(status){status.className='archive-status loading';status.textContent='AUTO LOADING TOTAL RAW TICK HISTORY'}
  if(detail)detail.textContent=`${s.selected} · fixed box ${s.box} · oldest available raw trade archive → live`;
  await sleep(900);
  const now=current();
  if(now.key!==key)return;
  const cached=now.v5?.state?.result;
  if(cached?.complete&&cached.symbol===s.selected&&Number(cached.box)===Number(s.box))return;
  now.v5?.start();
}
async function boot(){
  for(let i=0;i<150&&!window.RWARenkoV5;i++)await sleep(100);
  if(!window.RWARenkoV5)throw Error('Renko V5 unavailable');
  window.RWARenkoV5Auto={version:'5.1.0',mode:'auto-selected-market-lifetime-raw-tick',state,maybeStart};
  const b=document.getElementById('archiveLoad');if(b)b.title='Reload total raw-tick history for the selected market';
  setInterval(()=>{const {key}=current();if(key&&key!==state.lastKey){state.armed=false;maybeStart('selection-or-box-change').catch(console.error)}},500);
  maybeStart('boot').catch(console.error);
}
boot().catch(e=>console.error('[Renko V5 Auto]',e));
})();
