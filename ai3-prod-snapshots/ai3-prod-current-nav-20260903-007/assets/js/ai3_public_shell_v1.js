(()=>{"use strict";
const K="ot_backtest_view_mode",H=["lucide-coins","lucide-orbit","lucide-circle-dollar-sign","lucide-trending-up"];
const norm=s=>String(s||"").replace(/\s+/g," ").trim();
const side=c=>Array.from(document.querySelectorAll("#desktop-sidebar nav button")).find(b=>b.querySelector("svg."+c))||null;
const meta=[["lucide-house","Home"],["lucide-activity","Dashboard Hyperliquid"],["lucide-zap","Signal Scan"],["lucide-chart-column","Fundamental"],["lucide-chart-candlestick","Crypto"],["lucide-user","Account"]];
function sidebar(){/* ai3-sidebar-native-v2 */
  const root=document.querySelector("#desktop-sidebar");if(!root)return;
  const nav=root.querySelector("nav");if(!nav)return;
  /* top-nav clones never belong inside the native desktop sidebar */
  nav.querySelectorAll("button[data-ai3]").forEach(b=>b.remove());
  /* restore native buttons hidden by the previous orphan-cleaner */
  nav.querySelectorAll('button[data-ai3-orphan-hidden="1"]').forEach(b=>{
    b.style.removeProperty("display");b.removeAttribute("aria-hidden");b.removeAttribute("data-ai3-orphan-hidden");b.tabIndex=0;
  });
  const native=[
    ["lucide-house","Home"],
    ["lucide-chart-column","Fundamental"],
    ["lucide-zap","Signal Scan"],
    ["lucide-chart-candlestick","Crypto"],
    ["lucide-activity","Hyperliquid"],
    ["lucide-user","Account"]
  ];
  native.forEach(([c,l])=>{
    const b=Array.from(nav.querySelectorAll("button")).find(x=>x.querySelector("svg."+c));
    if(b){b.title=l;b.setAttribute("aria-label",l);if(c==="lucide-activity"){b.style.removeProperty("display");b.removeAttribute("aria-hidden");b.tabIndex=0}}
  });
  H.forEach(c=>{
    Array.from(nav.querySelectorAll("button")).filter(b=>b.querySelector("svg."+c)).forEach(b=>{
      b.style.setProperty("display","none","important");b.tabIndex=-1;b.setAttribute("aria-hidden","true");
    })
  });
}
function go(mode,icon){const b=side(icon);if(b){b.click();setTimeout(install,80);return}try{localStorage.setItem(K,mode);location.reload()}catch(e){location.href="/"}}
function direct(mode){try{localStorage.setItem(K,mode);location.assign("/")}catch(e){location.href="/"}}
function spans(b){return Array.from(b.querySelectorAll("span"))}
function label(b){return spans(b).find(s=>["Backtest","Home","Fundamental","Screener Crypto","Crypto","Signal Scan","Hyperliquid"].includes(norm(s.textContent)))||null}
function find(nav,names){return Array.from(nav.querySelectorAll(":scope > button")).find(b=>names.includes(norm(b.innerText)))||null}
const sig='<svg viewBox="0 0 60 60" width="36" height="36" aria-hidden="true"><path d="M33 7 17 31h13l-3 22 17-27H31z" fill="#FFD700" stroke="#B8860B" stroke-width="2" stroke-linejoin="round"/></svg>';
const hyp='<svg viewBox="0 0 60 60" width="36" height="36" aria-hidden="true"><path d="M8 31h9l5-14 8 28 6-20 5 10h11" fill="none" stroke="#FFD700" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="30" cy="30" r="24" fill="none" stroke="#B8860B" stroke-width="1.5"/></svg>';
function add(nav,tpl,k,l,ico,fn){let b=nav.querySelector('[data-ai3="'+k+'"]');if(b)return b;b=tpl.cloneNode(true);b.dataset.ai3=k;b.removeAttribute("style");b.querySelectorAll("span.absolute").forEach(x=>x.remove());const a=spans(b),iw=a[0];if(iw)iw.innerHTML=ico;const tx=label(b)||a[a.length-1];if(tx)tx.textContent=l;b.title=l;b.setAttribute("aria-label",l);b.className=String(b.className).replace(/text-\[#FFD700\]/g,"text-[#848E9C]");b.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();fn()});return b}
function primary(nav){const h=find(nav,["Backtest","Home"]),f=find(nav,["Fundamental"]),c=find(nav,["Screener Crypto","Crypto"]);if(!h||!f||!c)return;nav.dataset.ai3Primary="1";const hl=label(h);if(hl)hl.textContent="Home";h.title="Home";const cl=label(c);if(cl)cl.textContent="Crypto";c.title="Crypto";Array.from(nav.querySelectorAll(":scope > button")).filter(b=>norm(b.innerText)==="Hyperliquid").forEach(b=>{b.style.setProperty("display","none","important");b.setAttribute("aria-hidden","true");b.tabIndex=-1});const s=add(nav,f,"signal","Signal Scan",sig,()=>direct("scanner-signal"));f.insertAdjacentElement("afterend",s);if(s.nextElementSibling!==c)s.insertAdjacentElement("afterend",c)}
function install(){sidebar();Array.from(document.querySelectorAll("nav")).forEach(n=>{if(n.closest("#desktop-sidebar"))return;const t=norm(n.innerText);if((t.includes("Backtest")||t.includes("Home"))&&t.includes("Fundamental")&&(t.includes("Screener Crypto")||t.includes("Crypto")))primary(n)});cleanupTopHyper();fitFilterBars();signalFilter();document.querySelectorAll("h1,h2,h3").forEach(n=>{const t=norm(n.textContent);if(t==="Fundamental Saham")n.textContent="Fundamental";if(t==="Scanner Signal")n.textContent="Signal Scan"});if(document.title.startsWith("OpenTrue"))document.title="CopyToLive - Trading, Fundamental, Crypto & Hyperliquid"}
if(!document.getElementById("ai3-shell-style")){const s=document.createElement("style");s.id="ai3-shell-style";s.textContent='nav[data-ai3-primary="1"]{width:456px!important;max-width:456px!important;height:66px!important;min-height:66px!important;display:flex!important;gap:4px!important;align-items:stretch!important;justify-content:flex-start!important;overflow:hidden!important;scrollbar-width:none;box-sizing:border-box!important}nav[data-ai3-primary="1"]::-webkit-scrollbar{display:none}nav[data-ai3-primary="1"]>button{flex:0 0 88px!important;width:88px!important;min-width:88px!important;max-width:88px!important;height:66px!important;min-height:66px!important;padding:0!important;margin:0!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:2px!important}nav[data-ai3-primary="1"]>button>span:first-child{width:32px!important;height:32px!important;min-width:32px!important;display:flex!important;align-items:center!important;justify-content:center!important}nav[data-ai3-primary="1"]>button svg{width:32px!important;height:32px!important;max-width:32px!important;max-height:32px!important}nav[data-ai3-primary="1"]>button>span:last-child{font-size:13px!important;line-height:19.5px!important;font-weight:600!important;white-space:nowrap!important}@media(max-width:1023px){nav[data-ai3-primary="1"]{width:min(100%,380px)!important;max-width:380px!important;min-width:0!important;height:66px!important;min-height:66px!important;gap:0!important;overflow:hidden!important;padding:0!important}nav[data-ai3-primary="1"]>button{flex:0 0 20%!important;width:20%!important;min-width:0!important;max-width:20%!important;height:66px!important;min-height:66px!important}nav[data-ai3-primary="1"]>button>span:first-child{width:28px!important;height:28px!important;min-width:28px!important}nav[data-ai3-primary="1"]>button svg{width:28px!important;height:28px!important;max-width:28px!important;max-height:28px!important}nav[data-ai3-primary="1"]>button>span:last-child{font-size:10px!important;line-height:15px!important;font-weight:600!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important}}';document.head.appendChild(s)}
const FILTER_SETS=[["Max Loss","Profit Factor","Win Rate","Risk Reward"],["P/E","ROE","Debt / Equity","Revenue Growth"],["Metode","Pair","Market","OOS WR"],["Metode","Position","Market","Status"]];
function cleanupTopHyper(){
  Array.from(document.querySelectorAll("nav")).forEach(nav=>{
    if(nav.closest("#desktop-sidebar"))return;
    const t=norm(nav.innerText);
    if(!t.includes("Fundamental")||!(t.includes("Home")||t.includes("Backtest")))return;
    Array.from(nav.querySelectorAll(":scope > button")).filter(b=>norm(b.innerText)==="Hyperliquid").forEach(b=>{b.style.setProperty("display","none","important");b.setAttribute("aria-hidden","true");b.tabIndex=-1});
  });
}
function fitFilterBars(){
  Array.from(document.querySelectorAll("button")).filter(b=>norm(b.innerText)==="Cari").forEach(btn=>{
    let p=btn.parentElement,bar=null;
    for(let i=0;i<8&&p;i++,p=p.parentElement){
      const t=norm(p.innerText),hits=Math.max(...FILTER_SETS.map(set=>set.filter(x=>t.includes(x)).length));
      if(hits>=3){bar=p;break}
    }
    if(!bar)return;
    bar.dataset.ai3Filterbar="1";
  });
}
function scannerCtx(){
  const h=Array.from(document.querySelectorAll("h1,h2,h3")).find(x=>norm(x.textContent).startsWith("Market Scanner"));
  if(!h)return null;
  const header=h.closest("header")||h.parentElement,root=header&&header.parentElement;
  return root?{h,header,root}:null;
}
function scanButtons(root){return Array.from(root.querySelectorAll("button")).filter(b=>!b.closest("#ai3-signal-filter"))}
function clickScanOption(root,type,value){
  const buttons=scanButtons(root);
  let b=null;
  if(type==="tf")b=buttons.find(x=>norm(x.innerText)===value);
  else if(type==="rr")b=buttons.find(x=>norm(x.innerText)===value);
  else b=buttons.find(x=>norm(x.innerText).toLowerCase().includes(value.toLowerCase()));
  if(b)b.click();
}
function signalFilter(){
  const c=scannerCtx();if(!c)return;
  if(document.querySelector('[data-ai5-signal-v8="1"]')){
    const legacy=document.getElementById("ai3-signal-filter");
    if(legacy)legacy.remove();
    document.documentElement.setAttribute("data-ai5-parent-legacy-guard","1");
    return;
  }
  let bar=document.getElementById("ai3-signal-filter");
  if(!bar){
    bar=document.createElement("div");bar.id="ai3-signal-filter";
    bar.innerHTML='<div class="ai3-sf-cell"><label>Instruments</label><button type="button" data-ai3-instruments>Selected</button></div><div class="ai3-sf-cell"><label>Timeframe</label><select data-ai3-tf><option>15m</option><option selected>1h</option><option>4h</option><option>1d</option></select></div><div class="ai3-sf-cell"><label>R:R</label><select data-ai3-rr><option>1:1</option><option>1:1.5</option><option selected>1:2</option><option>1:2.5</option><option>1:3</option></select></div><div class="ai3-sf-cell"><label>Mode</label><select data-ai3-mode><option>Strict</option><option>Moderate</option><option>Aggressive</option></select></div><button type="button" class="ai3-sf-search" data-ai3-scan>⌕&nbsp; Cari</button>';
    c.header.insertAdjacentElement("afterend",bar);
    const mode=bar.querySelector("[data-ai3-mode]");try{const v=localStorage.getItem("ot_scan_sensitivity");if(v)mode.value=v.charAt(0).toUpperCase()+v.slice(1)}catch(_){}
    bar.querySelector("[data-ai3-tf]").addEventListener("change",e=>clickScanOption(c.root,"tf",e.target.value));
    bar.querySelector("[data-ai3-rr]").addEventListener("change",e=>clickScanOption(c.root,"rr",e.target.value));
    mode.addEventListener("change",e=>clickScanOption(c.root,"mode",e.target.value));
    bar.querySelector("[data-ai3-instruments]").addEventListener("click",()=>{
      const target=Array.from(c.root.querySelectorAll("h1,h2,h3")).find(x=>norm(x.textContent)==="Instruments")||Array.from(c.root.querySelectorAll("div")).find(x=>norm(x.textContent).includes("Hyperliquid Major"));
      if(target)target.scrollIntoView({block:"nearest",behavior:"smooth"});
    });
    bar.querySelector("[data-ai3-scan]").addEventListener("click",()=>{
      const b=scanButtons(c.root).find(x=>/^Scan\s+\d+\s+Instruments?/i.test(norm(x.innerText)))||scanButtons(c.root).find(x=>norm(x.innerText).startsWith("Scan "));
      if(b)b.click();
    });
  }
  const scan=scanButtons(c.root).find(x=>/^Scan\s+\d+\s+Instruments?/i.test(norm(x.innerText)));
  const m=scan&&norm(scan.innerText).match(/Scan\s+(\d+)\s+Instrument/i),txt=m?m[1]+" selected":"Selected";
  const ib=bar.querySelector("[data-ai3-instruments]");if(ib&&ib.textContent!==txt)ib.textContent=txt;
}
if(!document.getElementById("ai3-filter-style")){const s=document.createElement("style");s.id="ai3-filter-style";s.textContent='[data-ai3-filterbar="1"]{width:min(calc(100% - 32px),1170px)!important;max-width:1170px!important;height:64px!important;min-height:64px!important;max-height:64px!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box!important}#ai3-signal-filter{width:min(calc(100% - 32px),1170px);max-width:1170px;height:64px;min-height:64px;max-height:64px;margin:12px auto;display:grid;grid-template-columns:1.15fr 1fr 1fr 1fr 118px;background:#1E2329;border:1px solid #2B3139;border-radius:34px;overflow:hidden;box-sizing:border-box;color:#EAECEF;flex:0 0 auto}.ai3-sf-cell{min-width:0;padding:9px 22px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid #2B3139}.ai3-sf-cell label{font-size:12px;line-height:16px;font-weight:800;color:#EAECEF}.ai3-sf-cell select,.ai3-sf-cell button{width:100%;padding:3px 0 0;background:transparent;border:0;outline:0;color:#848E9C;text-align:left;font-size:13px;line-height:18px}.ai3-sf-cell select{appearance:auto;cursor:pointer}.ai3-sf-cell button{cursor:pointer}.ai3-sf-search{align-self:center;justify-self:stretch;height:40px;margin:0 10px;border:0;border-radius:22px;background:#F0B90B;color:#0B0E11;font-weight:900;font-size:13px;cursor:pointer;box-shadow:0 0 20px rgba(240,185,11,.18)}@media(max-width:767px){[data-ai3-filterbar="1"]{width:calc(100% - 16px)!important;height:56px!important;min-height:56px!important;max-height:56px!important}#ai3-signal-filter{width:calc(100% - 16px);max-width:none;height:56px;min-height:56px;max-height:56px;grid-template-columns:repeat(4,minmax(132px,1fr)) 100px;border-radius:20px;overflow-x:auto}.ai3-sf-cell{padding:8px 12px}.ai3-sf-search{margin:0 8px;height:38px}}';document.head.appendChild(s)}
function ai3FundamentalFallback(e){
  const el=e&&e.target&&e.target.closest?e.target.closest('nav[data-ai3-primary="1"] button'):null;
  if(!el||norm(el.innerText||el.textContent)!=="Fundamental")return;
  e.preventDefault();
  e.stopPropagation();
  if(typeof e.stopImmediatePropagation==="function")e.stopImmediatePropagation();
  try{
    localStorage.setItem(K,"fundamental-saham");
    if(location.pathname!=="/"||location.search||location.hash)history.replaceState(null,"","/");
    window.dispatchEvent(new CustomEvent("copytolive:open-fundamental"));
  }catch(_){}
}
document.addEventListener("click",ai3FundamentalFallback,true);
function ai3SignalFallback(e){
  const el=e&&e.target&&e.target.closest?e.target.closest('nav button'):null;
  if(!el||norm(el.innerText||el.textContent)!=="Signal Scan")return;
  const box=el.getBoundingClientRect();if(box.bottom<0||box.top>220)return;
  e.preventDefault();
  e.stopPropagation();
  if(typeof e.stopImmediatePropagation==="function")e.stopImmediatePropagation();
  direct("scanner-signal");
}
document.addEventListener("click",ai3SignalFallback,true);
function ai3ScannerBackFallback(e){let m="";try{m=localStorage.getItem(K)||""}catch(_){}if(m!=="scanner-signal")return;const b=e&&e.target&&e.target.closest?e.target.closest("button"):null;if(!b)return;const t=norm(b.innerText||b.textContent),a=norm(b.getAttribute("aria-label")),q=norm(b.getAttribute("title")),back=t==="Back"||a==="Back"||q==="Back"||!!b.querySelector("svg.lucide-arrow-left,svg.lucide-chevron-left");if(!back)return;const r=b.getBoundingClientRect();if(r.bottom<0||r.top>260)return;e.preventDefault();e.stopPropagation();if(typeof e.stopImmediatePropagation==="function")e.stopImmediatePropagation();try{localStorage.setItem(K,"home");location.assign("/")}catch(_){location.href="/"}}
document.addEventListener("click",ai3ScannerBackFallback,true);

document.addEventListener("click",()=>setTimeout(install,90),true);let ai3InstallTimer=0;new MutationObserver(()=>{clearTimeout(ai3InstallTimer);ai3InstallTimer=setTimeout(install,80)}).observe(document.documentElement,{childList:true,subtree:true});
try{if(location.pathname==="/fundamental/"&&localStorage.getItem(K)!=="fundamental-saham"){localStorage.setItem(K,"fundamental-saham");location.reload();return}}catch{}let n=0,t=setInterval(()=>{install();if(++n>=100)clearInterval(t)},120);install();
})();
