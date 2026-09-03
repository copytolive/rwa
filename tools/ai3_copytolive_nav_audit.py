import os,json,time,urllib.request,traceback,base64
from pathlib import Path
import websocket

OUT=Path(os.environ["OUT_DIR"]); OUT.mkdir(parents=True, exist_ok=True)
AID=os.environ["ACCEPT_ID"]
BASE="https://copytolive.com/?ai3navcycle="+AID
REPORT={"id":AID,"ok":False,"acceptance":"FAIL","desktop":{},"mobile":{}}

pages=None
for _ in range(120):
    try:
        pages=json.load(urllib.request.urlopen("http://127.0.0.1:9778/json/list",timeout=1))
        if pages: break
    except Exception:
        pass
    time.sleep(.25)
if not pages: raise SystemExit("CHROME_CDP_UNAVAILABLE")

page=next((p for p in pages if p.get("type")=="page"),pages[0])
ws=websocket.create_connection(page["webSocketDebuggerUrl"],timeout=60,origin="http://127.0.0.1:9778")
seq=0
def cdp(method,params=None):
    global seq
    seq+=1; i=seq
    ws.send(json.dumps({"id":i,"method":method,"params":params or {}}))
    while True:
        m=json.loads(ws.recv())
        if m.get("id")==i:
            if "error" in m: raise RuntimeError(str(m["error"]))
            return m.get("result",{})
def ev(expr):
    r=cdp("Runtime.evaluate",{"expression":expr,"awaitPromise":True,"returnByValue":True})
    if r.get("exceptionDetails"): raise RuntimeError(str(r["exceptionDetails"]))
    return r.get("result",{}).get("value")
def navigate_root(tag,wait=5):
    cdp("Page.navigate",{"url":BASE+"&state="+tag+"&t="+str(time.time())})
    time.sleep(wait)
def clean_top():
    return ev(r'''(()=>{
      const clean=s=>String(s||"").replace(/\s+/g," ").trim();
      const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden"&&Number(s.opacity||1)>0};
      const want=["Home","Fundamental","Signal Scan","Crypto","Renko"];
      const score=n=>{
        const tx=clean(n.innerText);
        return want.filter(w=>tx.includes(w)).length;
      };
      const navs=[...document.querySelectorAll("nav")].filter(n=>!n.closest("#desktop-sidebar")&&vis(n)&&score(n)>=4);
      navs.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top || score(b)-score(a));
      return navs[0]||null;
    })()''')
def nav_metrics():
    return ev(r'''(()=>{
      const clean=s=>String(s||"").replace(/\s+/g," ").trim();
      const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden"&&Number(s.opacity||1)>0};
      const want=["Home","Fundamental","Signal Scan","Crypto","Renko"];
      const norm=t=>{
        t=clean(t);
        if(t.endsWith(" Crypto")) return "Crypto";
        return want.find(w=>t===w||t.endsWith(" "+w))||t;
      };
      const score=n=>want.filter(w=>clean(n.innerText).includes(w)).length;
      const navs=[...document.querySelectorAll("nav")].filter(n=>!n.closest("#desktop-sidebar")&&vis(n)&&score(n)>=4);
      navs.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top || score(b)-score(a));
      const nav=navs[0]; if(!nav)return null;
      const nr=nav.getBoundingClientRect();
      const bs=[...nav.querySelectorAll(":scope > button")].filter(vis);
      const items=bs.map(b=>{
        const r=b.getBoundingClientRect(),svg=b.querySelector("svg"),sr=svg?svg.getBoundingClientRect():null;
        const spans=[...b.querySelectorAll("span")].filter(vis);
        const lab=spans[spans.length-1]||b,lr=lab.getBoundingClientRect(),cs=getComputedStyle(lab);
        return {name:norm(b.innerText),raw:clean(b.innerText),x:r.x,y:r.y,w:r.width,h:r.height,
          icon:sr?{w:sr.width,h:sr.height,x:sr.x,y:sr.y}:null,
          label:{x:lr.x,y:lr.y,w:lr.width,h:lr.height,fontSize:parseFloat(cs.fontSize)||0,fontWeight:cs.fontWeight,lineHeight:cs.lineHeight},
          active:(b.getAttribute("aria-current")||"")==="page"||b.classList.contains("active")||cs.color.includes("240, 185, 11")};
      });
      return {nav:{x:nr.x,y:nr.y,w:nr.width,h:nr.height},items,
        bodyScrollWidth:document.documentElement.scrollWidth,innerWidth:innerWidth,
        viewMode:localStorage.getItem("ot_backtest_view_mode"),
        url:location.href};
    })()''')
def click_top(name):
    return ev(r'''(name=>{
      const clean=s=>String(s||"").replace(/\s+/g," ").trim();
      const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden"};
      const want=["Home","Fundamental","Signal Scan","Crypto","Renko"];
      const score=n=>want.filter(w=>clean(n.innerText).includes(w)).length;
      const navs=[...document.querySelectorAll("nav")].filter(n=>!n.closest("#desktop-sidebar")&&vis(n)&&score(n)>=4);
      navs.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top || score(b)-score(a));
      const nav=navs[0];if(!nav)return false;
      const b=[...nav.querySelectorAll(":scope > button")].find(b=>{const t=clean(b.innerText);return t===name||t.endsWith(" "+name)});
      if(!b)return false;b.click();return true;
    })('''+json.dumps(name)+''')''')
def signal_back():
    return ev(r'''(()=>{
      const clean=s=>String(s||"").replace(/\s+/g," ").trim();
      const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden"};
      const title=[...document.querySelectorAll("h1,h2,h3,div,span")].find(e=>vis(e)&&(clean(e.textContent)==="Scanner Signal"||clean(e.textContent)==="Signal Scan"));
      if(!title)return {ok:false,why:"title-missing"};
      let p=title.parentElement;
      for(let d=0;d<5&&p;d++,p=p.parentElement){
        const bs=[...p.querySelectorAll("button")].filter(vis);
        const cand=bs.find(b=>{
          const t=clean(b.innerText),a=clean(b.getAttribute("aria-label")),ti=clean(b.title);
          const r=b.getBoundingClientRect(),tr=title.getBoundingClientRect();
          return /back|kembali/i.test(t+" "+a+" "+ti)||(r.right<=tr.left+12 && r.width<=64 && r.height<=64);
        });
        if(cand){cand.click();return {ok:true,text:clean(cand.innerText),aria:cand.getAttribute("aria-label"),title:cand.title};}
      }
      return {ok:false,why:"button-missing"};
    })()''')
def snap(name,width,height,clip_h):
    r=cdp("Page.captureScreenshot",{"format":"png","fromSurface":True,"captureBeyondViewport":False,
        "clip":{"x":0,"y":0,"width":width,"height":clip_h,"scale":1}})
    (OUT/(name+".png")).write_bytes(base64.b64decode(r["data"]))
def valid_metrics(m):
    if not m:return False,"nav-missing"
    names=[x["name"] for x in m["items"]]
    exp=["Home","Fundamental","Signal Scan","Crypto","Renko"]
    if names!=exp:return False,"labels:"+repr(names)
    if any(x["name"]=="Hyperliquid" for x in m["items"]):return False,"hyperliquid-top"
    return True,""
def geom_signature(m):
    return [(round(x["x"],2),round(x["y"],2),round(x["w"],2),round(x["h"],2),
             round((x["icon"] or {}).get("w",0),2),round((x["icon"] or {}).get("h",0),2),
             round(x["label"]["fontSize"],2)) for x in m["items"]]
def max_delta(a,b):
    sa,sb=geom_signature(a),geom_signature(b)
    if len(sa)!=len(sb):return 999
    return max(abs(x-y) for ra,rb in zip(sa,sb) for x,y in zip(ra,rb))
def assert_route_stable(base_m,m,label,viewport):
    ok,why=valid_metrics(m)
    if not ok: raise RuntimeError(viewport+" "+label+" "+why)
    d=max_delta(base_m,m)
    if d>1.5: raise RuntimeError(viewport+" "+label+" nav geometry drift "+str(d)+" base="+json.dumps(geom_signature(base_m))+" current="+json.dumps(geom_signature(m)))
    if m["bodyScrollWidth"]>m["innerWidth"]+2: raise RuntimeError(viewport+" "+label+" horizontal overflow "+json.dumps({"scroll":m["bodyScrollWidth"],"inner":m["innerWidth"]}))
    return d

try:
    cdp("Page.enable"); cdp("Runtime.enable")
    for viewport,width,height,clip_h,mobile,scale in [
        ("desktop",1600,1000,220,False,1),
        ("mobile",390,844,190,True,1)
    ]:
        cdp("Emulation.setDeviceMetricsOverride",{"width":width,"height":height,"deviceScaleFactor":scale,"mobile":mobile,"screenWidth":width,"screenHeight":height})
        navigate_root(viewport+"-home",6)
        ev("localStorage.setItem('ot_backtest_view_mode','home')")
        navigate_root(viewport+"-home-reset",5)
        base_m=nav_metrics()
        ok,why=valid_metrics(base_m)
        if not ok: raise RuntimeError(viewport+" home "+why)
        REPORT[viewport]["home"]=base_m
        snap(viewport+"-home",width,height,clip_h)

        for label in ["Fundamental","Crypto","Renko"]:
            navigate_root(viewport+"-"+label.lower()+"-base",4)
            ev("localStorage.setItem('ot_backtest_view_mode','home')")
            navigate_root(viewport+"-"+label.lower()+"-home",4)
            if not click_top(label): raise RuntimeError(viewport+" click missing "+label)
            time.sleep(6)
            m=nav_metrics(); d=assert_route_stable(base_m,m,label,viewport)
            REPORT[viewport][label.lower()]={"metrics":m,"maxDeltaPx":d}
            snap(viewport+"-"+label.lower(),width,height,clip_h)

        navigate_root(viewport+"-signal-base",4)
        ev("localStorage.setItem('ot_backtest_view_mode','home')")
        navigate_root(viewport+"-signal-home",4)
        if not click_top("Signal Scan"): raise RuntimeError(viewport+" click missing Signal Scan")
        time.sleep(6)
        sigstate=ev(r'''(()=>({text:String(document.body?.innerText||"").replace(/\s+/g," ").slice(0,20000),viewMode:localStorage.getItem("ot_backtest_view_mode"),url:location.href}))()''')
        if "Market Scanner" not in sigstate["text"] and "Scanner Signal" not in sigstate["text"]:
            raise RuntimeError(viewport+" signal scan did not render")
        snap(viewport+"-signal",width,height,clip_h)
        back=signal_back()
        if not back.get("ok"): raise RuntimeError(viewport+" signal back missing "+json.dumps(back))
        time.sleep(6)
        back_m=nav_metrics(); d=assert_route_stable(base_m,back_m,"signal-back-home",viewport)
        home_state=ev(r'''(()=>({viewMode:localStorage.getItem("ot_backtest_view_mode"),text:String(document.body?.innerText||"").replace(/\s+/g," ").slice(0,15000)}))()''')
        if home_state["viewMode"] not in (None,"home","backtest") and "Max Loss" not in home_state["text"]:
            raise RuntimeError(viewport+" back did not restore Home "+json.dumps(home_state))
        REPORT[viewport]["signal"]={"state":sigstate,"back":back,"backHomeMetrics":back_m,"backDeltaPx":d,"homeState":home_state}
        snap(viewport+"-signal-back-home",width,height,clip_h)

        # Two mixed navigation cycles to catch state leakage and layout shifts.
        cycles=[["Crypto","Renko","Fundamental"],["Renko","Crypto","Fundamental"]]
        cyc=[]
        for ci,cycle in enumerate(cycles,1):
            navigate_root(viewport+"-cycle-"+str(ci)+"-base",4)
            ev("localStorage.setItem('ot_backtest_view_mode','home')")
            navigate_root(viewport+"-cycle-"+str(ci)+"-home",4)
            rows=[]
            for label in cycle:
                if not click_top(label): raise RuntimeError(viewport+" cycle click missing "+label)
                time.sleep(4)
                m=nav_metrics(); d=assert_route_stable(base_m,m,"cycle-"+label,viewport)
                rows.append({"label":label,"deltaPx":d,"viewMode":m["viewMode"]})
                if label!="Fundamental":
                    # return to Home through visible Home button so next target starts cleanly
                    if not click_top("Home"): raise RuntimeError(viewport+" cycle Home click missing after "+label)
                    time.sleep(4)
            cyc.append(rows)
        REPORT[viewport]["cycles"]=cyc

    REPORT["ok"]=True; REPORT["acceptance"]="PASS"
except Exception as e:
    REPORT["error"]=str(e); REPORT["traceback"]=traceback.format_exc()
finally:
    (OUT/"report.json").write_text(json.dumps(REPORT,ensure_ascii=False,indent=2)+"\n","utf-8")
    try: ws.close()
    except Exception: pass
if not REPORT["ok"]: raise SystemExit(REPORT.get("error","nav continuity failed"))
