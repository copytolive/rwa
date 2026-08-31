const REPO='narzulalistiqlal/rwa';
const $=id=>document.getElementById(id);

async function loadCatalog(){
  const r=await fetch(`./data/assets.json?cb=${Date.now()}`,{cache:'no-store'});
  if(!r.ok)throw new Error(`asset catalog HTTP ${r.status}`);
  return (await r.json()).assets||[];
}

function isoDay(d){return d.toISOString().slice(0,10)}

function setupBuilder(assets){
  const host=document.querySelector('.chat-mode');
  if(!host)return;
  const wrap=document.createElement('div');
  wrap.className='public-builder';
  wrap.innerHTML=`
    <div class="subhead">Public GitHub request builder</div>
    <div class="row3">
      <label>Instrument<select id="publicAsset"></select></label>
      <label>Start date<input id="publicStart" type="date"></label>
      <label>End date (exclusive)<input id="publicEnd" type="date"></label>
    </div>
    <button id="publicRequestBtn" class="primary public-run">Open Public Backtest Request</button>
    <div id="publicRequestHelp" class="hint">Public requests run on GitHub Actions and are limited to 7 calendar days per job. The strategy and execution parameters are copied from the configuration panel above.</div>`;
  host.appendChild(wrap);
  const select=$('publicAsset');
  for(const a of assets){const o=document.createElement('option');o.value=a.symbol;o.textContent=`${a.symbol} · ${a.name}`;select.appendChild(o)}
  if(assets.some(a=>a.symbol==='XAUUSD'))select.value='XAUUSD';
  const now=new Date('2024-01-03T00:00:00Z');
  $('publicStart').value=isoDay(new Date(now.getTime()-86400000));
  $('publicEnd').value=isoDay(now);
  $('publicRequestBtn').addEventListener('click',()=>{
    const start=$('publicStart').value,end=$('publicEnd').value,asset=select.value;
    if(!start||!end)return alert('Choose start and end dates.');
    const days=(new Date(`${end}T00:00:00Z`)-new Date(`${start}T00:00:00Z`))/86400000;
    if(!(days>=1&&days<=7))return alert('Public GitHub requests must cover 1 to 7 calendar days.');
    const req={
      asset,start,end,
      strategy:$('strategy').value,
      trade_side:$('tradeSide').value,
      fast:+$('fast').value,
      slow:+$('slow').value,
      stop_points:+$('slPips').value,
      rr:+$('rr').value,
      spread_points:+$('spreadPips').value,
      slippage_points:+$('slippagePoints').value,
      cost_r:+$('costR').value
    };
    const title=`[VectorForge Backtest] ${asset} ${start} to ${end}`;
    const body=`VectorForge public historical backtest request.\n\n\`\`\`json\n${JSON.stringify(req,null,2)}\n\`\`\`\n\nSubmitted from the public GitHub Pages request builder.`;
    const url=`https://github.com/${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    window.open(url,'_blank','noopener');
  });
}

loadCatalog().then(setupBuilder).catch(err=>console.warn('Public request builder unavailable',err));
