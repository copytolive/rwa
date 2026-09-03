(()=>{"use strict";
const K="ot_backtest_view_mode",norm=s=>String(s||"").replace(/\s+/g," ").trim();
const LABELS=["Home","Fundamental","Signal Scan","Crypto","Renko"];
const SIDE_HIDE=["lucide-coins","lucide-orbit","lucide-circle-dollar-sign","lucide-trending-up"];
const vis=e=>{if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden"};
function btnName(b){const t=norm(b&&b.innerText);if(t==="Backtest")return"Home";if(t==="Screener Crypto"||t.endsWith(" Screener Crypto"))return"Crypto";return LABELS.find(x=>t===x||t.endsWith(" "+x))||t}
function sidebar(){
 const root=document.querySelector("#desktop-sidebar"),nav=root&&root.querySelector("nav");if(!nav)return;
 const map=[["lucide-house","Home"],["lucide-chart-column","Fundamental"],["lucide-zap","Signal Scan"],["lucide-chart-candlestick","Crypto"],["lucide-activity","Hyperliquid"],["lucide-user","Account"]];
 map.forEach(([c,l])=>{const b=[...nav.querySelectorAll("button")].find(x=>x.querySelector("svg."+c));if(!b)return;b.title=l;b.setAttribute("aria-label",l);if(c==="lucide-activity"){b.style.removeProperty("display");b.removeAttribute("aria-hidden");b.tabIndex=0}});
 SIDE_HIDE.forEach(c=>[...nav.querySelectorAll("button")].filter(b=>b.querySelector("svg."+c)).forEach(b=>{b.style.setProperty("display","none","important");b.setAttribute("aria-hidden","true");b.tabIndex=-1}));
}
function topNavs(){return[...document.querySelectorAll("nav")].filter(nav=>{if(nav.closest("#desktop-sidebar"))return false;const r=nav.getBoundingClientRect(),t=norm(nav.innerText);return r.top<230&&["Home","Fundamental","Crypto","Renko"].filter(x=>t.includes(x)).length>=4})}
function lockTopNav(){
 const mobile=innerWidth<768,w=mobile?76:88,g=mobile?0:4,h=66,icon=mobile?28:32,wrapSize=mobile?32:36,font=mobile?10:13,total=w*5+g*4;
 topNavs().forEach(nav=>{
  const bs=[...nav.querySelectorAll(":scope > button")];
  bs.forEach(b=>{const t=norm(b.innerText);if(t==="Hyperliquid"||t.endsWith(" Hyperliquid")){b.style.setProperty("display","none","important");b.setAttribute("aria-hidden","true");b.tabIndex=-1}});
  const targets=LABELS.map(name=>bs.find(b=>btnName(b)===name)).filter(Boolean);if(targets.length!==5)return;
  nav.dataset.ai3Continuity="1";
  [["gap",g+"px"],["width",total+"px"],["min-width",total+"px"],["max-width",total+"px"],["padding","0"],["justify-content","center"],["align-items","center"],["overflow","visible"]].forEach(([k,v])=>nav.style.setProperty(k,v,"important"));
  targets.forEach(b=>{
   [["box-sizing","border-box"],["flex","0 0 "+w+"px"],["width",w+"px"],["min-width",w+"px"],["max-width",w+"px"],["height",h+"px"],["min-height",h+"px"],["max-height",h+"px"],["padding","6px 2px 4px"],["gap","3px"],["justify-content","center"],["align-items","center"]].forEach(([k,v])=>b.style.setProperty(k,v,"important"));
   const svg=b.querySelector("svg"),iw=svg&&svg.closest("span");if(iw){[["width",wrapSize+"px"],["height",wrapSize+"px"],["min-width",wrapSize+"px"],["min-height",wrapSize+"px"],["opacity","1"],["margin-bottom","0"],["overflow","visible"]].forEach(([k,v])=>iw.style.setProperty(k,v,"important"))}
   if(svg){svg.style.setProperty("width",icon+"px","important");svg.style.setProperty("height",icon+"px","important")}
   const lab=[...b.querySelectorAll("span")].find(x=>norm(x.textContent)===btnName(b));if(lab){lab.style.setProperty("font-size",font+"px","important");lab.style.setProperty("font-weight","600","important");lab.style.setProperty("line-height",mobile?"15px":"19.5px","important");lab.style.setProperty("white-space","nowrap","important")}
  });
 });
}
const FILTERS=[["Max Loss","Profit Factor","Win Rate","Risk Reward"],["Metode","Pair","Market","OOS WR"],["Metode","Position","Market","Status"]];
function fitFilterBars(){
 [...document.querySelectorAll("button")].filter(b=>norm(b.innerText)==="Cari"&&!b.closest("#ai3-signal-filter")).forEach(btn=>{let p=btn.parentElement,bar=null;for(let i=0;i<8&&p;i++,p=p.parentElement){const t=norm(p.innerText),hits=Math.max(...FILTERS.map(set=>set.filter(x=>t.includes(x)).length));if(hits>=3){bar=p;break}}if(bar)bar.dataset.ai3Filterbar="1"});
}
function scannerCtx(){const h=[...document.querySelectorAll("h1,h2,h3")].find(x=>norm(x.textContent).startsWith("Market Scanner"));if(!h)return null;const header=h.closest("header")||h.parentElement,root=header&&header.parentElement;return root?{h,header,root}:null}
function scanButtons(root){return[...root.querySelectorAll("button")].filter(b=>!b.closest("#ai3-signal-filter"))}
function clickScanOption(root,type,value){const bs=scanButtons(root);let b=null;if(type==="tf"||type==="rr")b=bs.find(x=>norm(x.innerText)===value);else b=bs.find(x=>norm(x.innerText).toLowerCase()===value.toLowerCase()||norm(x.innerText).toLowerCase().includes(value.toLowerCase()));if(b)b.click()}
function signalFilter(){
 const c=scannerCtx();if(!c)return;let bar=document.getElementById("ai3-signal-filter");
 if(!bar){
  bar=document.createElement("div");bar.id="ai3-signal-filter";bar.setAttribute("aria-label","Signal Scan filters");
  bar.innerHTML='<div class="ai3-sf-cell"><label>Instruments</label><button type="button" data-ai3-instruments>Selected</button></div><div class="ai3-sf-cell"><label>Timeframe</label><select data-ai3-tf><option>15m</option><option selected>1h</option><option>4h</option><option>1d</option></select></div><div class="ai3-sf-cell"><label>R:R</label><select data-ai3-rr><option>1:1</option><option>1:1.5</option><option selected>1:2</option><option>1:2.5</option><option>1:3</option></select></div><div class="ai3-sf-cell"><label>Mode</label><select data-ai3-mode><option>Strict</option><option>Moderate</option><option>Aggressive</option></select></div><button type="button" class="ai3-sf-search" data-ai3-scan><span aria-hidden="true">⌕</span>&nbsp; Cari</button>';
  c.header.insertAdjacentElement("afterend",bar);
  const mode=bar.querySelector("[data-ai3-mode]");try{const v=localStorage.getItem("ot_scan_sensitivity");if(v)mode.value=v.charAt(0).toUpperCase()+v.slice(1)}catch(_){}
  bar.querySelector("[data-ai3-tf]").addEventListener("change",e=>clickScanOption(c.root,"tf",e.target.value));
  bar.querySelector("[data-ai3-rr]").addEventListener("change",e=>clickScanOption(c.root,"rr",e.target.value));
  mode.addEventListener("change",e=>clickScanOption(c.root,"mode",e.target.value));
  bar.querySelector("[data-ai3-instruments]").addEventListener("click",()=>{const t=[...c.root.querySelectorAll("h1,h2,h3")].find(x=>norm(x.textContent)==="Instruments")||[...c.root.querySelectorAll("div")].find(x=>norm(x.textContent).includes("Hyperliquid Major"));if(t)t.scrollIntoView({block:"nearest",behavior:"smooth"})});
  bar.querySelector("[data-ai3-scan]").addEventListener("click",()=>{const b=scanButtons(c.root).find(x=>/^Scan\s+\d+\s+Instruments?/i.test(norm(x.innerText)))||scanButtons(c.root).find(x=>norm(x.innerText).startsWith("Scan "));if(b)b.click()});
 }
 const scan=scanButtons(c.root).find(x=>/^Scan\s+\d+\s+Instruments?/i.test(norm(x.innerText))),m=scan&&norm(scan.innerText).match(/Scan\s+(\d+)\s+Instrument/i),ib=bar.querySelector("[data-ai3-instruments]"),txt=m?m[1]+" selected":"Selected";if(ib&&ib.textContent!==txt)ib.textContent=txt;
}
function isTopButton(el,name){const b=el&&el.closest?el.closest("nav button"):null;if(!b||b.closest("#desktop-sidebar"))return false;return b.getBoundingClientRect().top<230&&btnName(b)===name}
document.addEventListener("click",e=>{
 if(isTopButton(e.target,"Fundamental")){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();try{if(location.pathname!=="/"||location.search||location.hash)history.replaceState(null,"","/");window.dispatchEvent(new CustomEvent("copytolive:open-fundamental"))}catch(_){}return}
 const b=e.target&&e.target.closest?e.target.closest("button"):null;if(!b)return;
 const title=[...document.querySelectorAll("span")].find(x=>norm(x.textContent)==="Scanner Signal"&&vis(x));if(!title)return;
 const br=b.getBoundingClientRect(),tr=title.getBoundingClientRect();if(br.top<=tr.bottom+12&&br.right<=tr.left+4&&br.width<=60&&br.height<=60){try{localStorage.setItem(K,"home")}catch(_){}}
},true);
if(!document.getElementById("ai3-continuity-style")){const st=document.createElement("style");st.id="ai3-continuity-style";st.textContent='[data-ai3-filterbar="1"]{width:calc(100% - 32px)!important;max-width:1170px!important;height:64px!important;min-height:64px!important;max-height:64px!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box!important}#ai3-signal-filter{width:calc(100% - 32px);max-width:1170px;height:64px;min-height:64px;max-height:64px;margin:12px auto;display:grid;grid-template-columns:1.15fr 1fr 1fr 1fr 118px;background:#1E2329;border:1px solid #2B3139;border-radius:34px;overflow:hidden;box-sizing:border-box;color:#EAECEF;flex:0 0 auto}.ai3-sf-cell{min-width:0;padding:9px 22px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid #2B3139}.ai3-sf-cell label{font-size:12px;line-height:16px;font-weight:800;color:#EAECEF}.ai3-sf-cell select,.ai3-sf-cell button{width:100%;padding:3px 0 0;background:transparent;border:0;outline:0;color:#848E9C;text-align:left;font-size:13px;line-height:18px}.ai3-sf-cell select{appearance:auto;cursor:pointer}.ai3-sf-cell button{cursor:pointer}.ai3-sf-search{align-self:center;justify-self:stretch;height:40px;margin:0 10px;border:0;border-radius:22px;background:#F0B90B;color:#0B0E11;font-weight:900;font-size:13px;cursor:pointer;box-shadow:0 0 20px rgba(240,185,11,.18)}@media(max-width:767px){[data-ai3-filterbar="1"]{width:calc(100% - 16px)!important;height:56px!important;min-height:56px!important;max-height:56px!important}#ai3-signal-filter{width:calc(100% - 16px);max-width:none;height:56px;min-height:56px;max-height:56px;grid-template-columns:repeat(4,minmax(120px,1fr)) 96px;border-radius:20px;overflow-x:auto;overflow-y:hidden}.ai3-sf-cell{padding:6px 10px}.ai3-sf-cell label{font-size:10px;line-height:13px}.ai3-sf-cell select,.ai3-sf-cell button{font-size:11px;line-height:15px}.ai3-sf-search{margin:0 7px;height:38px;font-size:11px}}';document.head.appendChild(st)}
function install(){sidebar();lockTopNav();fitFilterBars();signalFilter();document.querySelectorAll("h1,h2,h3").forEach(n=>{if(norm(n.textContent)==="Fundamental Saham")n.textContent="Fundamental"})}
let timer=0;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(install,60)}).observe(document.documentElement,{childList:true,subtree:true});
addEventListener("resize",()=>{clearTimeout(timer);timer=setTimeout(install,60)});
let n=0,iv=setInterval(()=>{install();if(++n>80)clearInterval(iv)},150);install();
window.__CTL_AI3_CONTINUITY__={version:2,install};
})();