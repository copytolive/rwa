(()=>{
  'use strict';
  const L=window.LightweightCharts;
  if(!L||typeof L.createChart!=='function'||L.__rwaBridgeInstalled)return;
  const native=L.createChart.bind(L);
  L.createChart=(...args)=>{
    const chart=native(...args);
    window.__RWARenkoChart=chart;
    try{window.dispatchEvent(new CustomEvent('renko:chart-ready',{detail:{chart}}))}catch(_){ }
    return chart;
  };
  L.__rwaBridgeInstalled=true;
})();
