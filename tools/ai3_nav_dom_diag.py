import json,time,urllib.request,websocket,os
from pathlib import Path
OUT=Path(os.environ["OUT"]);OUT.parent.mkdir(parents=True,exist_ok=True)
pages=None
for _ in range(100):
    try:
        pages=json.load(urllib.request.urlopen("http://127.0.0.1:9781/json/list",timeout=1))
        if pages: break
    except: pass
    time.sleep(.2)
if not pages: raise SystemExit("chrome unavailable")
p=next((x for x in pages if x.get("type")=="page"),pages[0])
ws=websocket.create_connection(p["webSocketDebuggerUrl"],timeout=60,origin="http://127.0.0.1:9781")
seq=0
def cdp(m,params=None):
    global seq
    seq+=1;i=seq;ws.send(json.dumps({"id":i,"method":m,"params":params or {}}))
    while 1:
      r=json.loads(ws.recv())
      if r.get("id")==i:return r.get("result",{})
def ev(e):
    return cdp("Runtime.evaluate",{"expression":e,"awaitPromise":True,"returnByValue":True}).get("result",{}).get("value")
def nav(url): cdp("Page.navigate",{"url":url});time.sleep(5)
cdp("Page.enable");cdp("Runtime.enable")
cdp("Emulation.setDeviceMetricsOverride",{"width":1600,"height":1000,"deviceScaleFactor":1,"mobile":False,"screenWidth":1600,"screenHeight":1000})
nav("https://copytolive.com/?diag=navhome")
ev("localStorage.setItem('ot_backtest_view_mode','home')")
nav("https://copytolive.com/?diag=navhome2")
ancestor=ev(r'''(()=>{
 const clean=s=>String(s||"").replace(/\s+/g," ").trim(),vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width&&r.height&&s.display!="none"};
 const n=[...document.querySelectorAll("nav")].find(n=>!n.closest("#desktop-sidebar")&&vis(n)&&clean(n.innerText).includes("Signal Scan")&&clean(n.innerText).includes("Renko"));if(!n)return null;
 let rows=[],p=n;for(let i=0;i<7&&p;i++,p=p.parentElement){const r=p.getBoundingClientRect(),cs=getComputedStyle(p);rows.push({tag:p.tagName,id:p.id,cls:String(p.className||""),x:r.x,y:r.y,w:r.width,h:r.height,display:cs.display,position:cs.position,justify:cs.justifyContent,paddingLeft:cs.paddingLeft,paddingRight:cs.paddingRight})}
 return rows;
})()''')
ev("localStorage.setItem('ot_backtest_view_mode','scanner-signal')")
nav("https://copytolive.com/?diag=signal")
signal=ev(r'''(()=>{
 const clean=s=>String(s||"").replace(/\s+/g," ").trim(),vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width&&r.height&&s.display!="none"&&s.visibility!="hidden"};
 const hs=[...document.querySelectorAll("h1,h2,h3")].filter(vis).map(e=>({text:clean(e.textContent),html:e.outerHTML.slice(0,1000),rect:(()=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()}));
 const buttons=[...document.querySelectorAll("button")].filter(vis).map(b=>{const r=b.getBoundingClientRect();return{text:clean(b.innerText),aria:b.getAttribute("aria-label"),title:b.title,html:b.outerHTML.slice(0,1200),rect:{x:r.x,y:r.y,w:r.width,h:r.height}}}).filter(x=>x.rect.y<170);
 return {headings:hs.filter(x=>/Scanner|Signal|Market/.test(x.text)),buttons};
})()''')
OUT.write_text(json.dumps({"ancestors":ancestor,"signal":signal},indent=2),"utf-8")
ws.close()
