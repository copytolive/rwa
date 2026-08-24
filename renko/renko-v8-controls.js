(()=>{
'use strict';
if(window.RWARenkoV8Controls)return;
const IDS=new Set(['tvZoomOut','tvZoomIn','tvPanOlder','tvPanNewer','tvReset','tvLive']);
function act(id){
  const v=window.RWARenkoV8;if(!v)return;
  if(id==='tvZoomOut')v.setVisible(v.state.visible*1.2,.5);
  else if(id==='tvZoomIn')v.setVisible(v.state.visible*.82,.5);
  else if(id==='tvPanOlder')v.pan(v.state.visible*.75);
  else if(id==='tvPanNewer')v.pan(-v.state.visible*.75);
  else if(id==='tvReset'){v.setVisible(50,.5);v.state.offset=0;v.draw()}
  else if(id==='tvLive'){v.state.offset=0;v.draw()}
}
document.addEventListener('click',e=>{
  const b=e.target?.closest?.('button');if(!b||!IDS.has(b.id))return;
  e.preventDefault();e.stopImmediatePropagation();act(b.id);
},true);
window.RWARenkoV8Controls={version:'8.1.0',ids:[...IDS]};
})();
