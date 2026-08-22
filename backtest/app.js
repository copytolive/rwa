const SOURCE_REPO='https://github.com/zcbmlijygrdwa/fx_EUR_USD_tick';
const RAW_BASE='https://raw.githubusercontent.com/zcbmlijygrdwa/fx_EUR_USD_tick/master';
const ENGINE_VERSION='vectorforge-browser-1.2.1';

const $=id=>document.getElementById(id);
const months=[];
const verifiedSources=new Map();
for(let y=2009;y<=2018;y++){
  const start=y===2009?5:1,end=y===2018?7:12;
  for(let m=start;m<=end;m++)months.push(`${y}-${String(m).padStart(2,'0')}`);
}

function fillMonths(){
  for(const id of ['fromMonth','toMonth']){
    const el=$(id);el.innerHTML='';
    for(const ym of months){const o=document.createElement('option');o.value=ym;o.textContent=ym;el.appendChild(o)}
  }
  $('fromMonth').value='2018-01';$('toMonth').value='2018-01';
}

function renderCatalog(filter=''){
  const list=$('catalogList');list.innerHTML='';
  const shown=months.filter(m=>m.includes(filter.trim()));
  for(const ym of shown){
    const v=verifiedSources.get(ym);
    const a=document.createElement('a');a.className=`file${v?' verified':''}`;a.target='_blank';a.rel='noopener';
    a.href=`${SOURCE_REPO}/blob/master/EURUSD-${ym}_converted.txt`;
    if(v){
      const shortHash=(v.dataset_sha256||'').slice(0,10);
      a.title=`SHA-256 ${v.dataset_sha256||'unknown'} · ${Number(v.valid_samples||0).toLocaleString()} samples`;
      a.innerHTML=`<span>EURUSD ${ym}</span><small class="source-state">✓ ${shortHash}</small>`;
    }else{
      a.innerHTML=`<span>EURUSD ${ym}</span><small>pending · 1s ↗</small>`;
    }
    list.appendChild(a);
  }
  $('fileCount').textContent=`${shown.length} / ${months.length} files · ${verifiedSources.size} hashed`;
}

async function loadSourceHistory(){
  try{
    const r=await fetch(`./results/batches.json?cb=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const data=await r.json();
    verifiedSources.clear();
    for(const row of data.batches||[]){
      if(!row?.month)continue;
      const old=verifiedSources.get(row.month);
      if(!old||String(row.completed_at||'')>=String(old.completed_at||''))verifiedSources.set(row.month,row);
    }
  }catch(err){console.warn('Source history unavailable',err)}
  renderCatalog($('catalogSearch')?.value||'');
}

async function loadCampaign(){
  try{
    const r=await fetch(`./results/campaign.json?cb=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const c=await r.json();
    $('cTarget').textContent=Number(c.target_evaluations).toLocaleString();
    $('cVerified').textContent=Number(c.verified_completed).toLocaleString();
    const vs=c.verification_shards||{};
    $('cStatus').textContent=`STATUS · ${c.status}${vs.count?` · ${Number(vs.count).toLocaleString()} SHARDS`:''}`;
    const sc=c.source_catalog||{};
    const processed=Number.isFinite(+sc.processed_months)?+sc.processed_months:(c.last_verified_batch?1:0);
    const available=Number.isFinite(+sc.available_months)?+sc.available_months:months.length;
    $('cCoverage').textContent=`${processed} / ${available}`;
    $('cRemaining').textContent=`${Math.max(0,available-processed)} months remaining${sc.next_month?` · next ${sc.next_month}`:''}`;
    $('cSamples').textContent=Number(sc.verified_samples_total||c.last_verified_batch?.valid_samples||0).toLocaleString();
    const b=c.last_verified_batch;
    if(b){
      $('cBatch').textContent=Number(b.evaluations??b.evaluations_computed??0).toLocaleString();
      $('cBatchMonth').textContent=`${b.month} · ${b.engine_version}`;
      $('cHash').textContent=b.dataset_sha256||'—';$('cHash').title=b.dataset_sha256||'';
    }
  }catch(err){
    $('cVerified').textContent='unavailable';$('cStatus').textContent='ledger fetch failed';
    $('cCoverage').textContent='—';$('cSamples').textContent='—';
  }
}

async function loadLatestBatch(){
  try{
    const r=await fetch(`./results/latest_batch.json?cb=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const b=await r.json();
    const rows=[...(b.results||[])].sort((a,z)=>(a.flips??Infinity)-(z.flips??Infinity)).slice(0,12);
    $('batchMeta').textContent=`${b.source_month} · ${b.engine_version} · ${Number(b.valid_samples||0).toLocaleString()} source samples · ${Number(b.evaluations_computed??b.results?.length??0).toLocaleString()} computed · ${Number(b.new_batch_evaluations??0).toLocaleString()} new unique`;
    $('batchTable').innerHTML='';
    for(const x of rows){
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${Number(x.period).toLocaleString()}</td><td>${Number(x.samples).toLocaleString()}</td><td>${Number(x.flips).toLocaleString()}</td><td>${fmt(x.buy_pct)}</td><td>${fmt(x.sell_pct)}</td><td>${fmt(x.mean_abs_distance_pct,5)}</td>`;
      $('batchTable').appendChild(tr);
    }
  }catch(err){$('batchMeta').textContent=`Verified batch unavailable: ${err.message}`}
}

function selectedMonths(){
  const a=months.indexOf($('fromMonth').value),b=months.indexOf($('toMonth').value);
  if(a<0||b<0)return[];
  return a<=b?months.slice(a,b+1):months.slice(b,a+1);
}

function getConfig(){
  const custom=$('dataset').value==='custom';
  const file=$('customFile').files?.[0]||null;
  return{
    engineVersion:ENGINE_VERSION,
    dataset:custom?`custom:${file?.name||'none'}`:'eurusd1s',
    custom,
    months:custom?['CUSTOM']:selectedMonths(),
    strategy:$('strategy').value,
    tradeSide:$('tradeSide').value,
    fast:+$('fast').value,
    slow:+$('slow').value,
    slPips:+$('slPips').value,
    rr:+$('rr').value,
    pointSize:+$('pointSize').value,
    spreadPips:+$('spreadPips').value,
    slippagePoints:+$('slippagePoints').value,
    costR:+$('costR').value,
    rsiBuy:+$('rsiBuy').value,
    rsiSell:+$('rsiSell').value,
    bidCol:Math.max(1,+$('bidCol').value||1),
    askCol:Math.max(0,+$('askCol').value||0),
    sampleSeconds:Math.max(.001,+$('sampleSeconds').value||1),
    rawBase:RAW_BASE
  };
}

function setBusy(v){
  $('runBtn').disabled=v;$('stopBtn').disabled=!v;$('progressWrap').classList.toggle('hidden',!v);
  $('runState').textContent=v?'RUNNING':'IDLE';
}
function addLog(s){const d=document.createElement('div');d.textContent=s;$('log').prepend(d)}
function fmt(n,d=2){if(n===Infinity)return'∞';return Number.isFinite(+n)?Number(n).toLocaleString(undefined,{maximumFractionDigits:d,minimumFractionDigits:d}):'—'}
async function sha256(text){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')}

let worker=null,lastExport=null;
$('runBtn').addEventListener('click',()=>{
  const cfg=getConfig(),file=cfg.custom?($('customFile').files?.[0]||null):null;
  if(!cfg.months.length)return;
  if(cfg.custom&&!file){alert('Choose a custom TXT/CSV file first.');return}
  if(cfg.fast<2||cfg.slow<3||cfg.slPips<=0||cfg.rr<=0||cfg.pointSize<=0||cfg.costR<0||cfg.slippagePoints<0){alert('Check parameter values.');return}
  if(cfg.custom&&cfg.askCol===cfg.bidCol&&cfg.askCol!==0){alert('Bid and Ask columns must be different, or set Ask column to 0 for fallback spread.');return}

  $('log').innerHTML='';$('exportBtn').disabled=true;setBusy(true);$('progressBar').style.width='0%';$('progressText').textContent='Starting worker…';
  worker=new Worker('./worker.js');
  worker.onmessage=async e=>{
    const m=e.data;
    if(m.type==='progress'){
      $('progressBar').style.width=`${Math.max(0,Math.min(100,m.pct))}%`;
      $('progressText').textContent=m.text;if(m.log)addLog(m.log);
    }else if(m.type==='result'){
      setBusy(false);$('runState').textContent='COMPLETE';$('progressBar').style.width='100%';
      const r=m.result;
      $('mReturn').textContent=`${fmt(r.netR)} R`;
      $('mWr').textContent=`${fmt(r.positiveRate)}%`;
      $('mPf').textContent=fmt(r.gainLossRatio);
      $('mDd').textContent=`${fmt(r.maxDrawdownR)} R`;
      $('mTrades').textContent=Number(r.events).toLocaleString();
      $('mFreq').textContent=fmt(r.eventsPerWeek);
      $('mExpectancy').textContent=`${fmt(r.expectancyR,3)} R`;
      $('mLossStreak').textContent=Number(r.maxLossStreak||0).toLocaleString();
      $('mSides').textContent=`${Number(r.longEvents||0).toLocaleString()} / ${Number(r.shortEvents||0).toLocaleString()}`;
      $('mSignals').textContent=Number(r.signals||0).toLocaleString();
      $('mSamples').textContent=Number(r.samples).toLocaleString();
      $('mSegments').textContent=Number(r.monthsProcessed).toLocaleString();
      const fp=await sha256(JSON.stringify({config:cfg,result:r,engine:ENGINE_VERSION}));
      $('fingerprint').textContent=fp;$('progressText').textContent=`Completed ${r.monthsProcessed} source segment(s).`;
      addLog(`DONE · fingerprint ${fp.slice(0,16)}…`);
      lastExport={generatedAt:new Date().toISOString(),fingerprint:fp,config:cfg,result:r};$('exportBtn').disabled=false;
      worker.terminate();worker=null;
    }else if(m.type==='error'){
      setBusy(false);$('runState').textContent='ERROR';$('progressText').textContent=m.message;addLog(`ERROR · ${m.message}`);worker?.terminate();worker=null;
    }
  };
  worker.onerror=e=>{setBusy(false);$('runState').textContent='ERROR';$('progressText').textContent=e.message;worker?.terminate();worker=null};
  worker.postMessage({type:'run',config:cfg,file});
});

$('stopBtn').addEventListener('click',()=>{worker?.terminate();worker=null;setBusy(false);$('runState').textContent='STOPPED';$('progressText').textContent='Stopped by user.'});
$('exportBtn').addEventListener('click',()=>{
  if(!lastExport)return;
  const blob=new Blob([JSON.stringify(lastExport,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=u;a.download=`vectorforge-result-${Date.now()}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);
});
$('catalogSearch').addEventListener('input',e=>renderCatalog(e.target.value));
$('sourceRepo').href=SOURCE_REPO;
$('strategy').addEventListener('change',()=>{if($('strategy').value==='rsi_revert'&&+$('fast').value===50)$('fast').value=14});
$('dataset').addEventListener('change',()=>{
  const custom=$('dataset').value==='custom';$('customFields').classList.toggle('hidden-field',!custom);$('monthRange').style.display=custom?'none':'';
});

fillMonths();renderCatalog();loadCampaign();loadLatestBatch();loadSourceHistory();
