/* Measure main-thread long-task blocking around chart wheel gestures. */
(()=>{
'use strict';if(window.RWARenkoScrollBlocking)return;
const stats={events:0,longTasks:0,maxBlockingMs:0,totalBlockingMs:0,supported:false};const windows=[];
function wheel(e){if(!e.target?.closest?.('#chartWrap,#chartHost'))return;const s=performance.now();stats.events++;windows.push({start:s,end:s+75});while(windows.length>64)windows.shift();document.documentElement.dataset.renkoScrollBlockingMs=String(stats.maxBlockingMs)}
document.addEventListener('wheel',wheel,{capture:true,passive:true});
try{if(typeof PerformanceObserver==='function'&&PerformanceObserver.supportedEntryTypes?.includes('longtask')){stats.supported=true;const po=new PerformanceObserver(list=>{for(const x of list.getEntries()){const a=x.startTime,b=a+x.duration;if(windows.some(w=>a<=w.end&&b>=w.start)){stats.longTasks++;stats.totalBlockingMs+=x.duration;stats.maxBlockingMs=Math.max(stats.maxBlockingMs,x.duration);document.documentElement.dataset.renkoScrollBlockingMs=String(stats.maxBlockingMs)}}});po.observe({type:'longtask',buffered:true})}}catch(e){console.warn('[RENKO scroll blocking observer]',e)}
window.RWARenkoScrollBlocking={version:'1.0.0',rule:'performance-longtask-observer-75ms-wheel-window',stats};
})();