(()=>{"use strict";
const N=["Home","Fundamental","Signal Scan","Crypto","Renko"];
const c=s=>String(s||"").replace(/\s+/g," ").trim();
const nm=b=>{const t=c(b.innerText||b.textContent);return N.find(n=>t===n||t.endsWith(" "+n))||(t==="Backtest"?"Home":t==="Screener Crypto"?"Crypto":t)};
function nav(doc=document){
 const mob=(doc.defaultView||window).innerWidth<768,w=mob?76:88,g=mob?0:4,ic=mob?28:32,fs=mob?11:13,total=w*5+g*4;
 [...doc.querySelectorAll("nav")].forEach(v=>{
  if(v.closest("#desktop-sidebar"))return;
  const t=c(v.innerText);if(!t.includes("Fundamental")||!(t.includes("Home")||t.includes("Backtest"))||!t.includes("Crypto"))return;
  const bs=[...v.querySelectorAll(":scope > button")],m=new Map();
  bs.forEach(b=>{if(c(b.innerText)==="Hyperliquid"){b.style.setProperty("display","none","important");b.setAttribute("aria-hidden","true");b.tabIndex=-1}const n=nm(b);if(N.includes(n)&&!m.has(n))m.set(n,b)});
  if(m.size<5)return;
  Object.entries({display:"flex","align-items":"center","justify-content":"center",gap:g+"px",width:total+"px","min-width":total+"px","max-width":total+"px",padding:"0",margin:"0 auto"}).forEach(([k,x])=>v.style.setProperty(k,x,"important"));
  N.forEach((n,i)=>{const b=m.get(n);b.style.setProperty("order",String(i),"important");[["flex","0 0 "+w+"px"],["width",w+"px"],["min-width",w+"px"],["max-width",w+"px"],["height","66px"],["min-height","66px"],["max-height","66px"],["padding","6px 2px 4px"],["margin","0"],["gap","3px"]].forEach(([k,x])=>b.style.setProperty(k,x,"important"));const s=b.querySelector("svg");if(s){s.style.setProperty("width",ic+"px","important");s.style.setProperty("height",ic+"px","important")}const l=[...b.querySelectorAll("span")].find(x=>c(x.textContent)===n);if(l){l.style.setProperty("font-size",fs+"px","important");l.style.setProperty("font-weight","600","important");l.style.setProperty("line-height",mob?"16px":"19.5px","important");l.style.setProperty("height","auto","important")}});
 });
}
function fundamental(doc=document){
 const v=doc.querySelector(".mainNav");if(!v)return;
 const mob=(doc.defaultView||window).innerWidth<768,w=mob?76:88,g=mob?0:4,ic=mob?28:32,fs=mob?10:13,total=w*5+g*4;
 const bs=[...v.querySelectorAll(":scope > button")],m=new Map();
 bs.forEach(b=>{if(c(b.innerText)==="Hyperliquid"){b.style.setProperty("display","none","important");b.setAttribute("aria-hidden","true");b.tabIndex=-1}const n=nm(b);if(N.includes(n)&&!m.has(n))m.set(n,b)});
 Object.entries({display:"flex","align-items":"center","justify-content":"center",gap:g+"px",width:total+"px","min-width":total+"px","max-width":total+"px",height:"66px","min-height":"66px","max-height":"66px",padding:"0",margin:"0 auto"}).forEach(([k,x])=>v.style.setProperty(k,x,"important"));
 N.forEach((n,i)=>{const b=m.get(n);if(!b)return;b.style.setProperty("order",String(i),"important");[["flex","0 0 "+w+"px"],["width",w+"px"],["min-width",w+"px"],["max-width",w+"px"],["height","66px"],["min-height","66px"],["max-height","66px"],["padding","6px 2px 4px"],["margin","0"]].forEach(([k,x])=>b.style.setProperty(k,x,"important"));const s=b.querySelector("svg");if(s){s.style.setProperty("width",ic+"px","important");s.style.setProperty("height",ic+"px","important")}const l=b.querySelector(".mainNavLabel");if(l){l.style.setProperty("font-size",fs+"px","important");l.style.setProperty("font-weight","600","important")}});
 const row=v.closest(".mainNavRow");if(row){row.style.setProperty("height","80px","important");row.style.setProperty("min-height","80px","important");row.style.setProperty("padding","0","important")}
 const bar=doc.querySelector("#fundSearchBar,.fundSearchBar"),sc=doc.querySelector(".fundSearchScroll");if(sc){sc.style.setProperty("overflow-x","auto","important");sc.style.setProperty("max-width","100vw","important")}if(bar){bar.style.setProperty("height",mob?"56px":"64px","important");bar.style.setProperty("min-height",mob?"56px":"64px","important");bar.style.setProperty("max-height",mob?"56px":"64px","important");if(mob){bar.style.setProperty("width","760px","important");bar.style.setProperty("min-width","760px","important")}else{bar.style.setProperty("width","calc(100% - 32px)","important");bar.style.setProperty("max-width","1170px","important");bar.style.setProperty("min-width","0","important");bar.style.setProperty("margin","0 auto","important")}}
}
function all(){nav(document);fundamental(document);[...document.querySelectorAll("iframe")].forEach(f=>{try{fundamental(f.contentDocument)}catch(_){}})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",all,{once:true});else all();
let t=0;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(all,50)}).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener("resize",all);
window.__AI3_NAV_GEOMETRY__={apply:all,version:1};
})();