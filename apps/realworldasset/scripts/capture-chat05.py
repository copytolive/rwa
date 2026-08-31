from pathlib import Path
import json, shutil, subprocess, time
from playwright.sync_api import sync_playwright

VIEWPORT={"width":1672,"height":941}
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"visual-audit"
PREVIEW=ROOT/".visual-preview-chat05"
SITE=PREVIEW/"realworldasset"
SURFACES=[
 ("64-portfolio-overview","/portfolio/"),
 ("65-orders-transaction-history","/account/transactions/"),
 ("67-deposit-add-funds-flow","/account/deposit/"),
 ("68-withdraw-send-flow","/account/withdraw/"),
 ("71-own-account-profile-dashboard","/account/"),
]

def prepare():
    if PREVIEW.exists(): shutil.rmtree(PREVIEW)
    SITE.mkdir(parents=True)
    shutil.copytree(ROOT/"out",SITE,dirs_exist_ok=True)
    OUT.mkdir(exist_ok=True)

def goto(page,base,route):
    r=page.goto(base+route,wait_until="domcontentloaded",timeout=15000)
    page.wait_for_timeout(100)
    return r

def instrument(page):
    page.evaluate("""() => {
      window.__rwaNavCalls=[];
      if(!window.__rwaHistoryPatched){
        const p=history.pushState.bind(history), r=history.replaceState.bind(history);
        history.pushState=(...a)=>{window.__rwaNavCalls.push(['push',String(a[2]||'')]);return p(...a)};
        history.replaceState=(...a)=>{window.__rwaNavCalls.push(['replace',String(a[2]||'')]);return r(...a)};
        window.__rwaHistoryPatched=true;
      }
    }""")

def capture(page,base,name,route):
    r=goto(page,base,route)
    page.screenshot(path=str(OUT/f"{name}.png"),full_page=False)
    return {"name":name,"route":route,"url":page.url,"status":r.status if r else None,"viewport":VIEWPORT,"title":page.title()}

def state(page):
    return page.evaluate("""() => {
      const s=document.body.innerHTML; let h=2166136261;
      for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
      return {url:location.href,hash:(h>>>0).toString(16),dialogs:document.querySelectorAll('[role="dialog"]').length,status:Array.from(document.querySelectorAll('[role="status"]')).map(x=>x.textContent||'').join('|'),nav:(window.__rwaNavCalls||[]).slice()}
    }""")

def button_state(b):
    box=b.bounding_box()
    hit=True
    if box:
      x=box['x']+box['width']/2; y=box['y']+box['height']/2
      hit=b.evaluate("(el,p)=>{const t=document.elementFromPoint(p.x,p.y);return !!t&&(t===el||el.contains(t))}",{"x":x,"y":y})
    return {"text":((b.inner_text() or "").strip()),"ariaLabel":b.get_attribute("aria-label"),"ariaPressed":b.get_attribute("aria-pressed"),"ariaSelected":b.get_attribute("aria-selected"),"dataActive":b.get_attribute("data-active"),"disabled":b.is_disabled(),"hit":hit}

def changed(a,b):
    return a["url"]!=b["url"] or a["hash"]!=b["hash"] or a["dialogs"]!=b["dialogs"] or a["status"]!=b["status"] or a.get("nav")!=b.get("nav")

def audit_surface(page,base,name,route):
    goto(page,base,route)
    count=page.locator("button:visible").count(); out=[]
    for i in range(count):
      goto(page,base,route); instrument(page)
      bs=page.locator("button:visible")
      if i>=bs.count(): out.append({"surface":name,"index":i,"status":"SKIP_DYNAMIC"}); continue
      b=bs.nth(i); meta=button_state(b); label=meta.get("ariaLabel") or meta.get("text") or f"button-{i}"
      if meta.get("disabled"): out.append({"surface":name,"index":i,"label":label,"status":"SKIP_DISABLED"}); continue
      if not meta.get("hit"): out.append({"surface":name,"index":i,"label":label,"status":"SKIP_COVERED"}); continue
      if meta.get("ariaPressed")=="true" or meta.get("ariaSelected")=="true" or meta.get("dataActive")=="true": out.append({"surface":name,"index":i,"label":label,"status":"PASS_CURRENT_STATE"}); continue
      before=state(page); err=None
      try:
        b.click(timeout=2500)
        page.wait_for_timeout(120)
      except Exception as e: err=str(e)
      after=state(page); ok=err is None and changed(before,after)
      out.append({"surface":name,"index":i,"label":label,"status":"PASS" if ok else "FAIL","beforeUrl":before["url"],"afterUrl":after["url"],"navCalls":after.get("nav"),"error":err})
    fail=[x for x in out if x["status"]=="FAIL"]
    if fail:
      summary="; ".join(f'{x["surface"]} #{x["index"]} {x.get("label")}: {x.get("error") or "no observable action"}' for x in fail[:15])
      raise RuntimeError(f"CHAT05 browser button audit failed ({len(fail)}): {summary}")
    print(f"CHAT05 button audit PASS: {name} — {len(out)} visible buttons checked")
    return out

def main():
    prepare(); server=subprocess.Popen(["python3","-m","http.server","4175","--bind","127.0.0.1","--directory",str(PREVIEW)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
    base="http://127.0.0.1:4175/realworldasset"; records=[]; audits=[]
    try:
      with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox"]); page=browser.new_page(viewport=VIEWPORT,device_scale_factor=1)
        for name,route in SURFACES: records.append(capture(page,base,name,route))
        for name,route in SURFACES: audits.extend(audit_surface(page,base,name,route))
        browser.close()
    finally:
      server.terminate()
      try: server.wait(timeout=5)
      except subprocess.TimeoutExpired: server.kill()
    (OUT/"chat05-capture.json").write_text(json.dumps(records,indent=2),encoding="utf-8")
    (OUT/"chat05-button-audit.json").write_text(json.dumps(audits,indent=2),encoding="utf-8")
    passed=sum(1 for x in audits if x["status"].startswith("PASS")); skipped=sum(1 for x in audits if x["status"].startswith("SKIP"))
    print("Captured 5 CHAT05 source-of-truth surfaces at 1672x941")
    print(f"CHAT05 browser button audit PASS: {passed} functional/current-state controls; {skipped} intentional skips")

if __name__=="__main__": main()
