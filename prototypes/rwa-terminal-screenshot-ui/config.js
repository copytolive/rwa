(() => {
  const closes = [1082,1064,1085,1072,1098,1115,1102,1124,1137,1110,1090,1076,1095,1112,1135,1148,1120,1137,1145,1129,1140,1160,1144,1132,1140,1122,1131,1145,1150,1139,1128,1140,1147,1132,1123,1119,1135,1144,1130,1122,1138,1142,1135,1128,1117,1129,1140,1132,1121,1138,1145,1139,1128,1142,1136,1124,1134,1143,1131,1142];
  const vols = [42,58,34,62,48,86,71,65,52,93,74,48,39,57,68,84,53,91,78,43,76,52,65,88,55,67,60,93,74,70,45,64,59,81,48,66,52,73,62,90,70,51,64,77,57,83,69,76,54,87,65,48,72,66,60,88,72,58,78,63];
  function render(svg, compact=false) {
    const w = Number(svg.getAttribute('viewBox').split(' ')[2]);
    const h = Number(svg.getAttribute('viewBox').split(' ')[3]);
    const padL = compact ? 12 : 36, padR = compact ? 34 : 56, top = compact ? 26 : 38;
    const priceH = compact ? h*0.58 : h*0.64;
    const volTop = compact ? h*0.70 : h*0.74;
    const volH = h - volTop - (compact?18:30);
    const minP=1035,maxP=1210;
    const x0=padL, x1=w-padR;
    const step=(x1-x0)/(closes.length-1);
    const y=p=>top+(maxP-p)/(maxP-minP)*(priceH-top);
    let html='';
    for(let i=0;i<6;i++){ const yy=top+i*(priceH-top)/5; html+=`<line x1="${x0}" y1="${yy}" x2="${x1}" y2="${yy}" class="grid"/>`; }
    for(let i=0;i<8;i++){ const xx=x0+i*(x1-x0)/7; html+=`<line x1="${xx}" y1="${top}" x2="${xx}" y2="${h-(compact?16:26)}" class="grid v"/>`; }
    const axes = compact ? [1200,1160,1120,1080,1040] : [1200,1160,1120,1080,1040,1000];
    axes.forEach(p=> html+=`<text x="${x1+8}" y="${y(p)+3}" class="axis-label">${(p/1000).toFixed(4)}</text>`);
    closes.forEach((c,i)=>{
      const prev=i?closes[i-1]:1075;
      const open = i%3===0 ? prev+8 : i%3===1 ? prev-5 : prev+3;
      const hi=Math.max(open,c)+(i%5+4);
      const lo=Math.min(open,c)-(i%4+5);
      const xx=x0+i*step;
      const up=c>=open;
      const cls=up?'up':'down';
      const bw=Math.max(compact?2.4:3.1, step*0.58);
      html+=`<line x1="${xx}" y1="${y(hi)}" x2="${xx}" y2="${y(lo)}" class="wick ${cls}"/>`;
      html+=`<rect x="${xx-bw/2}" y="${Math.min(y(open),y(c))}" width="${bw}" height="${Math.max(2,Math.abs(y(open)-y(c)))}" rx=".6" class="body ${cls}"/>`;
      const vh=vols[i]/100*volH;
      html+=`<rect x="${xx-bw/2}" y="${volTop+volH-vh}" width="${bw}" height="${vh}" class="volume ${cls}" opacity=".55"/>`;
    });
    const py=y(1142.8);
    html+=`<line x1="${x0}" y1="${py}" x2="${x1}" y2="${py}" class="current-line"/><rect x="${x1+2}" y="${py-11}" width="${compact?30:42}" height="22" rx="3" class="current-tag"/><text x="${x1+(compact?17:23)}" y="${py+4}" text-anchor="middle" class="current-text">1.1428</text>`;
    if(!compact){
      html+=`<line x1="${x0}" y1="${y(1098)}" x2="${x1}" y2="${y(1098)}" class="stop-line"/><rect x="${x1-118}" y="${y(1098)-13}" width="92" height="18" rx="3" class="stop-tag"/><text x="${x1-72}" y="${y(1098)}" text-anchor="middle" class="tag-text dark">Stop Loss  1.0980</text>`;
      html+=`<line x1="${x0}" y1="${y(1185)}" x2="${x1}" y2="${y(1185)}" class="tp-line"/><rect x="${x1-124}" y="${y(1185)-13}" width="98" height="18" rx="3" class="tp-tag"/><text x="${x1-75}" y="${y(1185)}" text-anchor="middle" class="tag-text dark">Take Profit  1.1850</text>`;
      html+=`<rect x="${x1-60}" y="${y(1142)-12}" width="35" height="17" rx="3" class="entry-tag"/><text x="${x1-42}" y="${y(1142)}" text-anchor="middle" class="tag-text dark">Entry</text><text x="${x1-42}" y="${y(1142)+18}" text-anchor="middle" class="green-note">1.1420</text>`;
      const days=['24','25','26','27','28','29','30','31','Jun']; days.forEach((d,i)=>{const xx=x0+i*(x1-x0)/(days.length-1);html+=`<text x="${xx}" y="${h-9}" class="day-label" text-anchor="middle">${d}</text>`});
      html+=`<text x="${x0+6}" y="${volTop-6}" class="vol-label">Volume SMA</text><text x="${x0+73}" y="${volTop-6}" class="vol-green">1.23M</text>`;
    } else {
      html+=`<text x="${x0+4}" y="${volTop-6}" class="vol-label">Volume SMA</text><text x="${x0+66}" y="${volTop-6}" class="vol-red">1.23M</text>`;
      const days=['28','29','30','31','Jun']; days.forEach((d,i)=>{const xx=x0+i*(x1-x0)/(days.length-1);html+=`<text x="${xx}" y="${h-4}" class="day-label" text-anchor="middle">${d}</text>`});
    }
    svg.innerHTML=html;
  }
  document.querySelectorAll('svg[data-chart]').forEach(svg=>render(svg, svg.dataset.chart==='mobile'));
})();