const SOURCE_REPO='https://github.com/zcbmlijygrdwa/fx_EUR_USD_tick';
const RAW_BASE='https://raw.githubusercontent.com/zcbmlijygrdwa/fx_EUR_USD_tick/master';
const ENGINE_VERSION='vectorforge-browser-1.1.1';

const $=id=>document.getElementById(id);
const months=[];
for(let y=2009;y<=2018;y++){
  const start=y===2009?5:1, end=y===2018?7:12;
  for(let m=start;m<=end;m++) months.push(`${y}-${String(m).padStart(2,'0')}`);
}

function fillMonths(){
  for(const id of ['fromMonth','toMonth']){
    const el=$(id); el.innerHTML='';
    for(const ym of months){const o=document.createElement('option');o.value=ym;o.textContent=ym;el.appendChild(o)}
  }
  $('fromMonth').value='2018-01'; $('toMonth').value='2018-01';
}

function renderCatalog(filter=''){
  const list=$('catalogList'); list.innerHTML='';
  const shown=months.filter(m=>m.includes(filter.trim()));
  for(const ym of shown){
    const a=document.createElement('a'); a.className='file'; a.target='_blank'; a.rel='noopener';
    a.href=`${SOURCE_REPO}/blob/master/EURUSD-${ym}_converted.txt`;
    a.innerHTML=`<span>EURUSD ${ym}</span><small>1s ↗</small>`; list.appendChild(a);
  }
  $('fileCount').textContent=`${shown.length} / ${months.length} files`;
}

async function loadCampaign(){
  try{
    const r=await fetch(`./results/campaign.json?cb=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const c=await r.json();
    $('cTarget').textContent=Number(c.target_evaluations).toLocaleString();
    $('cVerified').textContent=Number(c.verified_completed).toLocaleString();
    $('cStatus').textContent=`STATUS · ${c.status}`;
    const b=c.last_verified_batch;
    if(b){$('cBatch').textContent=Number(b.evaluations).toLocaleString();$('cBatchMonth').textContent=`${b.month} · ${b.engine_version}`;$('cHash').textContent=b.dataset_sha256||'—';$('cHash').title=b.dataset_sha256||''}
  }catch(err){$('cVerified').textContent='unavailable';$('cStatus').textContent='ledger fetch failed'}
}

function selectedMonths(){
  const a=months.indexOf($('fromMonth').value), b=months.indexOf($('toMonth').value);
  if(a<0||b<0) return [];
  return a<=b?months.slice(a,b+1):months.slice(b,a+1);
}

function getConfig(){
  const custom=$('dataset').value==='custom';
  const file=$('customFile').files?.[0]||null;
  return {
    engineVersion:ENGINE_VERSION,
    dataset:custom?`custom:${file?.name||'none'}`:'eurusd1s',
    custom,
    months:custom?['CUSTOM']:selectedMonths(),
    strategy:$('strategy').value,
    fast:+$('fast').value,
    slow:+$('slow').value,
    slPips:+$('slPips').value,
    rr:+$('rr').value,
    pointSize:+$('pointSize').value,
    spreadPips:+$('spreadPips').value,
    rsiBuy:+$('rsiBuy').value,
    rsiSell:+$('rsiSell').value,
    rawBase:RAW_BASE
  };
}

function setBusy(v){
  $('runBtn').disabled=v; $('stopBtn').disabled=!v; $('progressWrap').classList.toggle('hidden',!v);
  $('runState').textContent=v?'RUNNING':'IDLE';
}
function addLog(s){const d=document.createElement('div');d.textContent=s;$('log').prepend(d)}
function fmt(n,d=2){if(n===Infinity)return '∞';return Number.isFinite(n)?Number(n).toLocaleString(undefined,{maximumFractionDigits:d,minimumFractionDigits:d}):'—'}
async function sha256(text){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')}

let worker=null,lastExport=null;
$('runBtn').addEventListener('click',()=>{
  const cfg=getConfig(),file=cfg.custom?($('customFile').files?.[0]||null):null;
  if(!cfg.months.length) return;
  if(cfg.custom&&!file){alert('Choose a custom TXT/CSV file first.');return}
  if(cfg.fast<2||cfg.slow<3||cfg.slPips<=0||cfg.rr<=0||cfg.pointSize<=0){alert('Check parameter values.');return}
  $('log').innerHTML=''; $('exportBtn').disabled=true; setBusy(true); $('progressBar').style.width='0%'; $('progressText').textContent='Starting worker…';
  worker=new Worker('./worker.js');
  worker.onmessage=async e=>{
    const m=e.data;
    if(m.type==='progress'){
      $('progressBar').style.width=`${Math.max(0,Math.min(100,m.pct))}%`;
      $('progressText').textContent=m.text; if(m.log)addLog(m.log);
    } else if(m.type==='result'){
      setBusy(false); $('runState').textContent='COMPLETE'; $('progressBar').style.width='100%';
      const r=m.result;
      $('mReturn').textContent=`${fmt(r.netR)} R`;
      $('mWr').textContent=`${fmt(r.positiveRate)}%`;
      $('mPf').textContent=fmt(r.gainLossRatio);
      $('mDd').textContent=`${fmt(r.maxDrawdownR)} R`;
      $('mTrades').textContent=Number(r.events).toLocaleString();
      $('mFreq').textContent=fmt(r.eventsPerWeek);
      $('mEquity').textContent=`${fmt(r.netR)} R`;
      $('mSamples').textContent=Number(r.samples).toLocaleString();
      const fp=await sha256(JSON.stringify({config:cfg,result:r,engine:ENGINE_VERSION}));
      $('fingerprint').textContent=fp; $('progressText').textContent=`Completed ${r.monthsProcessed} source segment(s).`;
      addLog(`DONE · fingerprint ${fp.slice(0,16)}…`);
      lastExport={generatedAt:new Date().toISOString(),fingerprint:fp,config:cfg,result:r};$('exportBtn').disabled=false;
      worker.terminate();worker=null;
    } else if(m.type==='error'){
      setBusy(false); $('runState').textContent='ERROR'; $('progressText').textContent=m.message;addLog(`ERROR · ${m.message}`);worker?.terminate();worker=null;
    }
  };
  worker.onerror=e=>{setBusy(false);$('runState').textContent='ERROR';$('progressText').textContent=e.message;worker?.terminate();worker=null};
  worker.postMessage({type:'run',config:cfg,file});
});
$('stopBtn').addEventListener('click',()=>{worker?.terminate();worker=null;setBusy(false);$('runState').textContent='STOPPED';$('progressText').textContent='Stopped by user.'});
$('exportBtn').addEventListener('click',()=>{
  if(!lastExport)return;const blob=new Blob([JSON.stringify(lastExport,null,2)],{type:'application/json'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=`vectorforge-result-${Date.now()}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);
});
$('catalogSearch').addEventListener('input',e=>renderCatalog(e.target.value));
$('sourceRepo').href=SOURCE_REPO;
$('strategy').addEventListener('change',()=>{if($('strategy').value==='rsi_revert'&&+$('fast').value===50)$('fast').value=14});
$('dataset').addEventListener('change',()=>{const custom=$('dataset').value==='custom';$('customFileLabel').classList.toggle('hidden-field',!custom);$('monthRange').style.display=custom?'none':''});
fillMonths();renderCatalog();loadCampaign();
