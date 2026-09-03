import os,json,time,urllib.request,traceback,base64
from pathlib import Path
import websocket
OUT=Path(os.environ["OUT_DIR"]);OUT.mkdir(parents=True,exist_ok=True)
AID=os.environ["ACCEPT_ID"];BASE="https://copytolive.com/"
R={"id":AID,"ok":False,"steps":[],"errors":[]}
pages=None
for _ in range(100):
    try:
        pages=json.load(urllib.request.urlopen("http://127.0.0.1:9781/json/list",timeout=1))
        if pages:break
    except:pass
    time.sleep(.2)
if not pages:raise SystemExit("NO_CDP")
p=next((x for x in pages if x.get("type")=="page"),pages[0])
ws=websocket.create_connection(p["webSocketDebuggerUrl"],timeout=60,origin="http://127.0.0.1:9781")
seq=0
def cdp(m,params=None):
    global seq;seq+=1;i=seq;ws.send(json.dumps({"id":i,"method":m,"params":params or {}}))
    while 1:
        x=json.loads(ws.recv())
        if x.get("id")==i:
            if "error" in x:raise RuntimeError(str(x["error"]))
            return x.get("result",{})
def ev(e):
    x=cdp("Runtime.evaluate",{"expression":e,"awaitPromise":True,"returnByValue":True})
    if x.get("exceptionDetails"):raise RuntimeError(str(x["exceptionDetails"]))
    return x.get("result",{}).get("value")
def nav(url,wait=4):
    cdp("Page.navigate",{"url":url});time.sleep(wait)
def snap(name,w,h):
    x=cdp("Page.captureScreenshot",{"format":"png","fromSurface":True,"captureBeyondViewport":False,"clip":{"x":0,"y":0,"width":w,"height":min(h,240),"scale":1}})
    (OUT/(name+".png")).write_bytes(base64.b64decode(x["data"]))
def state():
    return ev(r'''(()=>{
      const clean=s=>String(s||"").replace(/\s+/g," ").trim(),vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden"&&Number(s.opacity||1)>0};
      const names=["Home","Fundamental","Signal Scan","Crypto","Renko"];
      const norm=t=>{t=clean(t);return names.find(n=>t===n||t.endsWith(" "+n))||t};
      const navs=[...document.querySelectorAll("nav")].filter(n=>!n.closest("#desktop-sidebar")&&vis(n)&&names.filter(x=>clean(n.innerText).includes(x)).length>=4).sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);
      const n=navs[0]||null;
      const items=n?[...n.querySelectorAll(":scope > button")].filter(vis).map(b=>{const r=b.getBoundingClientRect(),svg=b.querySelector("svg"),sr=svg?svg.getBoundingClientRect():null,sp=[...b.querySelectorAll("span")].filter(vis),lab=sp[sp.length-1]||b,lr=lab.getBoundingClientRect(),cs=getComputedStyle(lab);return{name:norm(b.innerText),raw:clean(b.innerText),x:r.x,y:r.y,w:r.width,h:r.height,icon:sr?{w:sr.width,h:sr.height}:null,label:{w:lr.width,h:lr.height,fontSize:parseFloat(cs.fontSize)||0,fontWeight:cs.fontWeight}}}):[];
      const ifr=[...document.querySelectorAll("iframe")].filter(vis).map(f=>{const r=f.getBoundingClientRect();let child=null;try{const d=f.contentDocument,cn=d?clean(d.body?.innerText||"").slice(0,1200):"";const nn=d?[...d.querySelectorAll("nav")].filter(vis).map(x=>clean(x.innerText)).slice(0,5):[];child={text:cn,navs:nn}}catch(e){child={error:String(e)}}return{src:f.src,x:r.x,y:r.y,w:r.width,h:r.height,child}});
      const body=clean(document.body?.innerText||"");
      return {url:location.href,mode:localStorage.getItem("ot_backtest_view_mode"),nav: n?(()=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})():null,items,iframes:ifr,body:body.slice(0,3000),error:/Terjadi Kesalahan|Aplikasi mengalami error/i.test(body),scrollWidth:document.documentElement.scrollWidth,innerWidth};
    })()''')
def click(name):
    return ev(r'''(name=>{const clean=s=>String(s||"").replace(/\s+/g," ").trim(),vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden"};const names=["Home","Fundamental","Signal Scan","Crypto","Renko"];const navs=[...document.querySelectorAll("nav")].filter(n=>!n.closest("#desktop-sidebar")&&vis(n)&&names.filter(x=>clean(n.innerText).includes(x)).length>=4).sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);const n=navs[0];if(!n)return false;const b=[...n.querySelectorAll(":scope > button")].find(b=>{const t=clean(b.innerText);return t===name||t.endsWith(" "+name)});if(!b)return false;b.click();return true})('''+json.dumps(name)+''')''')
try:
    cdp("Page.enable");cdp("Runtime.enable")
    for viewport,w,h,mobile in [("desktop",1600,1000,False),("mobile",390,844,True)]:
        cdp("Emulation.setDeviceMetricsOverride",{"width":w,"height":h,"deviceScaleFactor":1,"mobile":mobile,"screenWidth":w,"screenHeight":h})
        nav(BASE+"?route-reality="+AID+"&v="+viewport,3)
        ev("localStorage.setItem('ot_backtest_view_mode','home')")
        nav(BASE+"?route-reality="+AID+"&v="+viewport+"&home=1",5)
        st=state();R["steps"].append({"viewport":viewport,"action":"start-home","state":st});snap(viewport+"-home",w,h)
        seqs=[["Fundamental","Home"],["Signal Scan","Home"],["Crypto","Home"],["Renko","Home"],["Renko","Crypto","Home"],["Crypto","Renko","Home"]]
        for si,actions in enumerate(seqs,1):
            nav(BASE+"?route-reality="+AID+"&v="+viewport+"&seq="+str(si),2)
            ev("localStorage.setItem('ot_backtest_view_mode','home')")
            nav(BASE+"?route-reality="+AID+"&v="+viewport+"&seq="+str(si)+"&home=1",4)
            for ai,a in enumerate(actions,1):
                ok=click(a)
                time.sleep(4 if ok else .3)
                s=state()
                R["steps"].append({"viewport":viewport,"sequence":si,"action":a,"clicked":ok,"state":s})
                if s.get("error"):R["errors"].append(viewport+" seq"+str(si)+" after "+a+" app-error")
                if ok:snap(viewport+"-s"+str(si)+"-"+str(ai)+"-"+a.lower().replace(" ","-"),w,h)
    R["ok"]=not R["errors"]
except Exception as e:
    R["errors"].append(repr(e));R["traceback"]=traceback.format_exc()
finally:
    (OUT/"report.json").write_text(json.dumps(R,ensure_ascii=False,indent=2)+"\n","utf-8")
    try:ws.close()
    except:pass
