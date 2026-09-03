import os,json,time,urllib.request,traceback,base64
from pathlib import Path
import websocket
OUT=Path(os.environ["OUT_DIR"]);OUT.mkdir(parents=True,exist_ok=True)
AID=os.environ["ACCEPT_ID"];ROOT="https://copytolive.com/"
R={"id":AID,"ok":False,"acceptance":"FAIL","issues":[],"desktop":{},"mobile":{}}
pages=None
for _ in range(120):
    try:
        pages=json.load(urllib.request.urlopen("http://127.0.0.1:9779/json/list",timeout=1))
        if pages:break
    except:pass
    time.sleep(.25)
if not pages:raise SystemExit("CHROME_CDP_UNAVAILABLE")
p=next((x for x in pages if x.get("type")=="page"),pages[0])
ws=websocket.create_connection(p["webSocketDebuggerUrl"],timeout=60,origin="http://127.0.0.1:9779")
seq=0
def cdp(m,params=None):
 global seq;seq+=1;i=seq;ws.send(json.dumps({"id":i,"method":m,"params":params or {}}))
 while True:
  x=json.loads(ws.recv())
  if x.get("id")==i:
   if "error" in x:raise RuntimeError(str(x["error"]))
   return x.get("result",{})
def ev(expr):
 x=cdp("Runtime.evaluate",{"expression":expr,"awaitPromise":True,"returnByValue":True})
 if x.get("exceptionDetails"):raise RuntimeError(str(x["exceptionDetails"]))
 return x.get("result",{}).get("value")
def nav_to(url,wait=5):
 cdp("Page.navigate",{"url":url});time.sleep(wait)
def shot(name,w,h,clip):
 x=cdp("Page.captureScreenshot",{"format":"png","fromSurface":True,"captureBeyondViewport":False,"clip":{"x":0,"y":0,"width":w,"height":clip,"scale":1}})
 (OUT/(name+".png")).write_bytes(base64.b64decode(x["data"]))
def root_home(tag,wait=4):
 nav_to(ROOT+"?ai3full="+AID+"&s="+tag+"&t="+str(time.time()),2)
 ev("localStorage.setItem('ot_backtest_view_mode','home')")
 nav_to(ROOT+"?ai3full="+AID+"&s="+tag+"-home&t="+str(time.time()),wait)
def top_metrics():
 return ev(r'''(()=>{
 const clean=s=>String(s||"").replace(/\s+/g," ").trim(),vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden"&&Number(s.opacity||1)>0};
 const names=["Home","Fundamental","Signal Scan","Crypto","Renko"],norm=t=>{t=clean(t);return names.find(n=>t===n||t.endsWith(" "+n))||t};
 const navs=[...document.querySelectorAll("nav")].filter(n=>!n.closest("#desktop-sidebar")&&vis(n)&&names.filter(x=>clean(n.innerText).includes(x)).length>=4);
 navs.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);
 const n=navs[0];if(!n)return null;const nr=n.getBoundingClientRect();
 const items=[...n.querySelectorAll(":scope > button")].filter(vis).map(b=>{const r=b.getBoundingClientRect(),svg=b.querySelector("svg"),sr=svg?svg.getBoundingClientRect():null,sp=[...b.querySelectorAll("span")].filter(vis),lab=sp[sp.length-1]||b,lr=lab.getBoundingClientRect(),cs=getComputedStyle(lab);return{name:norm(b.innerText),raw:clean(b.innerText),x:r.x,y:r.y,w:r.width,h:r.height,icon:sr?{w:sr.width,h:sr.height}:null,label:{w:lr.width,h:lr.height,fontSize:parseFloat(cs.fontSize)||0,fontWeight:cs.fontWeight}}});
 return {nav:{x:nr.x,y:nr.y,w:nr.width,h:nr.height},items,scrollWidth:document.documentElement.scrollWidth,innerWidth,viewMode:localStorage.getItem("ot_backtest_view_mode"),url:location.href};
 })()''')
def fundamental_metrics():
 return ev(r'''(()=>{
 const clean=s=>String(s||"").replace(/\s+/g," ").trim(),vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden"};
 const nav=document.querySelector(".mainNav"),bar=document.querySelector("#fundSearchBar");if(!nav)return null;
 const nr=nav.getBoundingClientRect(),br=bar?bar.getBoundingClientRect():null;
 return {nav:{x:nr.x,y:nr.y,w:nr.width,h:nr.height},items:[...nav.querySelectorAll(":scope > button")].filter(vis).map(b=>{const r=b.getBoundingClientRect(),svg=b.querySelector("svg"),sr=svg?svg.getBoundingClientRect():null,l=b.querySelector(".mainNavLabel"),lr=l?l.getBoundingClientRect():null,cs=l?getComputedStyle(l):null;return{name:clean(b.innerText),x:r.x,y:r.y,w:r.width,h:r.height,icon:sr?{w:sr.width,h:sr.height}:null,label:lr?{w:lr.width,h:lr.height,fontSize:parseFloat(cs.fontSize)||0,fontWeight:cs.fontWeight}:null}}),filter:br?{x:br.x,y:br.y,w:br.width,h:br.height}:null,scrollWidth:document.documentElement.scrollWidth,innerWidth};
 })()''')
def click_top(name):
 return ev(r'''(name=>{const clean=s=>String(s||"").replace(/\s+/g," ").trim(),vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden"};const names=["Home","Fundamental","Signal Scan","Crypto","Renko"];const navs=[...document.querySelectorAll("nav")].filter(n=>!n.closest("#desktop-sidebar")&&vis(n)&&names.filter(x=>clean(n.innerText).includes(x)).length>=4);navs.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);const n=navs[0];if(!n)return false;const b=[...n.querySelectorAll(":scope > button")].find(b=>{const t=clean(b.innerText);return t===name||t.endsWith(" "+name)});if(!b)return false;b.click();return true})('''+json.dumps(name)+''')''')
def back_signal():
 return ev(r'''(()=>{const clean=s=>String(s||"").replace(/\s+/g," ").trim(),vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden"};const title=[...document.querySelectorAll("h1,h2,h3,div,span")].find(e=>vis(e)&&(clean(e.textContent)==="Scanner Signal"||clean(e.textContent)==="Signal Scan"));if(!title)return{ok:false,why:"title"};let p=title.parentElement;for(let d=0;d<6&&p;d++,p=p.parentElement){const tr=title.getBoundingClientRect(),b=[...p.querySelectorAll("button")].filter(vis).find(x=>{const r=x.getBoundingClientRect(),q=(clean(x.innerText)+" "+clean(x.getAttribute("aria-label"))+" "+clean(x.title)).toLowerCase();return q.includes("back")||q.includes("kembali")||(r.right<=tr.left+18&&r.width<=64&&r.height<=64)});if(b){b.click();return{ok:true,text:clean(b.innerText),aria:b.getAttribute("aria-label")}}}return{ok:false,why:"button"}})()''')
def page_state():
 return ev(r'''(()=>({viewMode:localStorage.getItem("ot_backtest_view_mode"),text:String(document.body?.innerText||"").replace(/\s+/g," ").slice(0,12000),scrollWidth:document.documentElement.scrollWidth,innerWidth,url:location.href}))()''')
def sig(m):
 if not m:return None
 return [[round(i["x"],2),round(i["y"],2),round(i["w"],2),round(i["h"],2),round((i.get("icon")or{}).get("w",0),2),round((i.get("icon")or{}).get("h",0),2),round((i.get("label")or{}).get("fontSize",0),2)] for i in m["items"]]
def geom_delta(a,b):
 sa,sb=sig(a),sig(b)
 if not sa or not sb or len(sa)!=len(sb):return 999
 return max(abs(x-y) for ra,rb in zip(sa,sb) for x,y in zip(ra,rb))
def add_issue(view,msg):R["issues"].append(view+": "+msg)

try:
 cdp("Page.enable");cdp("Runtime.enable")
 for view,w,h,clip,mobile in [("desktop",1600,1000,225,False),("mobile",390,844,190,True)]:
  cdp("Emulation.setDeviceMetricsOverride",{"width":w,"height":h,"deviceScaleFactor":1,"mobile":mobile,"screenWidth":w,"screenHeight":h})
  rr=R[view]
  root_home(view+"-base",5);hm=top_metrics();rr["home"]=hm;shot(view+"-home",w,h,clip)
  if hm and hm["scrollWidth"]>hm["innerWidth"]+2:add_issue(view,"Home horizontal overflow")
  if view=="desktop":
   if not hm:add_issue(view,"Home top nav missing")
   else:
    names=[x["name"] for x in hm["items"]]
    if names!=["Home","Fundamental","Signal Scan","Crypto","Renko"]:add_issue(view,"Home nav labels "+repr(names))
    wsizes=[round(x["w"],2) for x in hm["items"]]
    if max(wsizes)-min(wsizes)>1.5:add_issue(view,"Home button widths differ "+repr(wsizes))
    icons=[round((x.get("icon")or{}).get("w",0),2) for x in hm["items"]]
    if max(icons)-min(icons)>1.5:add_issue(view,"Home icon widths differ "+repr(icons))
  # Fundamental direct document is exactly what iframe displays.
  nav_to(ROOT+"fundamental.html?embedded=1&ai3full="+AID+"&v="+view+"&t="+str(time.time()),6)
  fm=fundamental_metrics();rr["fundamental"]=fm;shot(view+"-fundamental",w,h,clip)
  if fm:
   names=[x["name"] for x in fm["items"]]
   if "Hyperliquid" in names:add_issue(view,"Fundamental top Hyperliquid still visible")
   if view=="desktop" and len(names)!=5:add_issue(view,"Fundamental nav item count "+str(len(names)))
   if fm["filter"] and view=="desktop" and abs(fm["filter"]["w"]-1170)>2:add_issue(view,"Fundamental filter width "+str(fm["filter"]["w"]))
   if fm["filter"] and view=="desktop" and abs(fm["filter"]["h"]-64)>2:add_issue(view,"Fundamental filter height "+str(fm["filter"]["h"]))
  else:add_issue(view,"Fundamental metrics missing")
  # Root route variants.
  if view=="desktop":
   for label in ["Crypto","Renko"]:
    root_home(view+"-"+label.lower(),4)
    if not click_top(label):add_issue(view,label+" click missing");continue
    time.sleep(5);m=top_metrics();rr[label.lower()]=m;shot(view+"-"+label.lower(),w,h,clip)
    if hm and m:
     d=geom_delta(hm,m);rr[label.lower()+"DeltaPx"]=d
     if d>1.5:add_issue(view,label+" nav geometry drift "+str(d))
  # Signal and back on both viewports. If top nav isn't visible on mobile, enter by view mode.
  root_home(view+"-signal",4)
  clicked=click_top("Signal Scan")
  if not clicked:
   ev("localStorage.setItem('ot_backtest_view_mode','scanner-signal')");nav_to(ROOT+"?ai3full="+AID+"&signal="+view+"&t="+str(time.time()),6)
  else:time.sleep(6)
  st=page_state();rr["signalState"]=st;shot(view+"-signal",w,h,clip)
  if "Market Scanner" not in st["text"] and "Scanner Signal" not in st["text"]:add_issue(view,"Signal Scan render missing")
  back=back_signal();rr["signalBackClick"]=back
  if back.get("ok"):
   time.sleep(6);bst=page_state();rr["afterSignalBack"]=bst;shot(view+"-signal-back-home",w,h,clip)
   if bst.get("viewMode") not in ("home","backtest",None) and "Max Loss" not in bst.get("text",""):add_issue(view,"Signal back did not restore Home")
   if bst["scrollWidth"]>bst["innerWidth"]+2:add_issue(view,"Home after Signal back horizontal overflow")
  else:add_issue(view,"Signal back button not found")
  # Two route cycles, screenshot final state and record failures.
  cyc=[]
  for ci,seqn in enumerate([["Crypto","Home","Renko","Home"],["Renko","Home","Crypto","Home"]],1):
   if view!="desktop": break
   root_home(view+"-cycle-"+str(ci),4);rows=[]
   for label in seqn:
    ok=click_top(label);time.sleep(3 if ok else .2);rows.append({"label":label,"clicked":ok,"state":page_state()})
    if not ok:add_issue(view,"cycle "+str(ci)+" click missing "+label)
   cyc.append(rows)
  rr["cycles"]=cyc
 R["ok"]=len(R["issues"])==0;R["acceptance"]="PASS" if R["ok"] else "FAIL"
except Exception as e:
 R["error"]=str(e);R["traceback"]=traceback.format_exc()
finally:
 (OUT/"report.json").write_text(json.dumps(R,ensure_ascii=False,indent=2)+"\n","utf-8")
 try:ws.close()
 except:pass
if not R["ok"]:raise SystemExit("; ".join(R["issues"][:12]) or R.get("error","audit failed"))
