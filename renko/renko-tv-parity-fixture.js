/* Browser-visible long-history parity witness.
 * Activate with ?fixture=gold20y. This is deliberately a visual/algorithm
 * regression fixture, not a claim that the raw GC=F artifact passed trading
 * data governance Gate A.
 */
(()=>{
'use strict';
const p=new URLSearchParams(location.search);if(p.get('fixture')!=='gold20y')return;
async function apply(){
  const T=window.RWARenkoTV;if(!T)return;
  const r=await fetch('fixtures/gold-20y-close-parity.json',{cache:'no-store'});if(!r.ok)throw new Error(`fixture HTTP ${r.status}`);
  const f=await r.json(),bars=(f.bars||[]).map(([t,c])=>({openTime:Number(t),closeTime:Number(t)+86400000-1,open:Number(c),high:Number(c),low:Number(c),close:Number(c),volume:0,_renkoSourceInterval:'1d'}));
  T.state.generation++;
  T.state.symbol='GOLD20Y';T.state.tickSize=.1;T.state.lastPrice=Number(bars.at(-1)?.close);T.state.closedBars=bars;T.state.currentBar=null;T.state.status='live';
  T.state.historyPages=1;T.state.historyLadderTiers=['1d'];T.state.historyLadderActive=true;T.state.parityFixture='gold20y';T.state.parityFixtureSourceRowsDaily=f.source_rows_daily;T.state.parityFixtureGateAValidated=f.gate_a_validated;
  T.settings.source='close';T.settings.interval='1d';T.settings.method='traditional';T.settings.boxSize=900;T.settings.wicks=true;
  document.getElementById('sourceSelect')&&(document.getElementById('sourceSelect').value='close');
  document.getElementById('intervalSelect')&&(document.getElementById('intervalSelect').value='1d');
  document.getElementById('traditionalBox')&&(document.getElementById('traditionalBox').value='900');
  T.rebuild({fit:true});
  const count=T.state.confirmed?.length||0,from=bars[0]?.openTime||0,to=bars.at(-1)?.closeTime||0,years=(to-from)/(365.2425*86400000);
  document.documentElement.dataset.renkoParityFixture='gold20y';
  document.documentElement.dataset.renkoParityFixtureReady=count===5&&years>=20?'true':'false';
  document.documentElement.dataset.renkoParityFixtureBrickCount=String(count);
  document.documentElement.dataset.renkoParityFixtureSpanYears=years.toFixed(2);
  const pair=document.getElementById('pairName');if(pair)pair.textContent='GOLD · 20Y PARITY WITNESS';
  const icon=document.getElementById('pairIcon');if(icon)icon.textContent='AU';
  const source=document.getElementById('sourceText');if(source)source.textContent=`GOLD visual/algorithm witness · ${years.toFixed(2)} years preserved · Traditional box 900 · expected 5 Renko bricks`;
  const total=document.getElementById('sourceBarCount');if(total)total.textContent=`${bars.length} witness / ${Number(f.source_rows_daily).toLocaleString()} D1 raw`;
  const cov=document.getElementById('tvCoverage');if(cov)cov.textContent=`${new Date(from).toISOString().slice(0,10)} → ${new Date(to).toISOString().slice(0,10)} · ${years.toFixed(2)} years · ${count} Renko bricks`;
  const load=document.getElementById('tvLoadState');if(load){load.textContent=`PARITY WITNESS · GOLD 20Y · BOX 900 · ${count} BRICKS`;load.className='load-state live'}
  window.RENKO_GOLD20Y_FIXTURE={fixture:f,count,years,bars};
}
if(window.RWARenkoTV?.state?.status==='live')void apply();else window.addEventListener('renko:tv-ready',()=>void apply(),{once:true});
})();