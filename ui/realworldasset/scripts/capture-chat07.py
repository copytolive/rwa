from pathlib import Path
import json, shutil, subprocess, time
from playwright.sync_api import sync_playwright

VIEWPORT={"width":1672,"height":941}
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"visual-audit"
PREVIEW=ROOT/".visual-preview-chat07"
SITE=PREVIEW/"realworldasset"
SURFACES=[
 ("15-kyc-identity-verification","/compliance/kyc/"),
 ("16-kyb-business-verification","/compliance/kyb/"),
 ("17-geographic-eligibility-restricted-state","/rwa/marina-bay-residences-regulated/restricted/"),
 ("18-disclosures-data-room","/rwa/marina-bay-residences-regulated/disclosures/"),
]

def prepare():
    if PREVIEW.exists(): shutil.rmtree(PREVIEW)
    SITE.mkdir(parents=True)
    shutil.copytree(ROOT/"out",SITE,dirs_exist_ok=True)
    OUT.mkdir(exist_ok=True)

def goto(page,base,route):
    r=page.goto(base+route,wait_until="domcontentloaded",timeout=15000)
    page.wait_for_timeout(180)
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
    if not r or r.status != 200:
        raise RuntimeError(f"CHAT07 route failed: {route} status={r.status if r else None}")
    page.screenshot(path=str(OUT/f"{name}.png"),full_page=False)
    return {"name":name,"route":route,"url":page.url,"status":r.status,"viewport":VIEWPORT,"title":page.title()}

def state(page):
    return page.evaluate("""() => {
      const clone=document.body.cloneNode(true);
      clone.querySelectorAll('.app-shell > .sr-only[role="status"]').forEach(x=>x.remove());
      const s=clone.innerHTML; let h=2166136261;
      for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
      const statuses=Array.from(document.querySelectorAll('[role="status"]')).filter(x=>!x.matches('.app-shell > .sr-only[role="status"]')).map(x=>x.textContent||'').join('|');
      return {url:location.href,hash:(h>>>0).toString(16),dialogs:document.querySelectorAll('[role="dialog"]').length,status:statuses,nav:(window.__rwaNavCalls||[]).slice()}
    }""")

def meta(button):
    box=button.bounding_box(); hit=True
    if box:
      x=box['x']+box['width']/2; y=box['y']+box['height']/2
      hit=button.evaluate("(el,p)=>{const t=document.elementFromPoint(p.x,p.y);return !!t&&(t===el||el.contains(t))}",{"x":x,"y":y})
    return {"text":((button.inner_text() or "").strip()),"ariaLabel":button.get_attribute("aria-label"),"ariaPressed":button.get_attribute("aria-pressed"),"ariaSelected":button.get_attribute("aria-selected"),"dataActive":button.get_attribute("data-active"),"disabled":button.is_disabled(),"hit":hit}

def changed(a,b):
    return a["url"]!=b["url"] or a["hash"]!=b["hash"] or a["dialogs"]!=b["dialogs"] or a["status"]!=b["status"] or a.get("nav")!=b.get("nav")

def reset(page,base,route):
    goto(page,base,route); instrument(page)

def audit_surface(page,base,name,route):
    reset(page,base,route)
    count=page.locator("button:visible").count(); rows=[]
    for i in range(count):
      reset(page,base,route)
      buttons=page.locator("button:visible")
      if i>=buttons.count(): rows.append({"surface":name,"index":i,"status":"SKIP_DYNAMIC"}); continue
      b=buttons.nth(i); m=meta(b); label=m.get("ariaLabel") or m.get("text") or f"button-{i}"
      if m.get("disabled"): rows.append({"surface":name,"index":i,"label":label,"status":"SKIP_DISABLED"}); continue
      if not m.get("hit"): rows.append({"surface":name,"index":i,"label":label,"status":"SKIP_COVERED"}); continue
      if m.get("ariaPressed")=="true" or m.get("ariaSelected")=="true" or m.get("dataActive")=="true": rows.append({"surface":name,"index":i,"label":label,"status":"PASS_CURRENT_STATE"}); continue
      before=state(page); err=None
      try:
        b.click(timeout=2500); page.wait_for_timeout(160)
      except Exception as e: err=str(e)
      after=state(page); ok=err is None and changed(before,after)
      rows.append({"surface":name,"index":i,"label":label,"status":"PASS" if ok else "FAIL","beforeUrl":before["url"],"afterUrl":after["url"],"navCalls":after.get("nav"),"error":err})
    fail=[x for x in rows if x["status"]=="FAIL"]
    if fail:
      summary="; ".join(f'{x["surface"]} #{x["index"]} {x.get("label")}: {x.get("error") or "no observable action"}' for x in fail[:20])
      raise RuntimeError(f"CHAT07 browser button audit failed ({len(fail)}): {summary}")
    print(f"CHAT07 button audit PASS: {name} — {len(rows)} visible buttons checked")
    return rows

def verify_guard(page,base):
    goto(page,base,"/rwa/marina-bay-residences-regulated/")
    button=page.get_by_role("button",name="Preview Subscription",exact=False).first
    button.click(timeout=4000); page.wait_for_timeout(150)
    if "/compliance/kyc" not in page.url or "returnTo=" not in page.url:
      raise RuntimeError(f"Regulated trade did not enter KYC returnTo flow: {page.url}")
    goto(page,base,"/compliance/kyc/?returnTo=%2Ftrade%2Fmarina-bay-residences-regulated")
    page.get_by_role("button",name="Submit Verification",exact=False).first.click(timeout=4000)
    page.wait_for_timeout(180)
    status=page.locator('[role="status"]').all_inner_texts()
    if not any("Selfie" in x for x in status):
      raise RuntimeError("KYC validation did not block incomplete liveness state")
    print("CHAT07 regulated trade guard PASS: Preview Subscription -> KYC with returnTo; incomplete submit validates liveness")

def main():
    prepare(); server=subprocess.Popen(["python3","-m","http.server","4177","--bind","127.0.0.1","--directory",str(PREVIEW)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
    base="http://127.0.0.1:4177/realworldasset"; records=[]; audits=[]
    try:
      with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox"]); page=browser.new_page(viewport=VIEWPORT,device_scale_factor=1)
        for name,route in SURFACES: records.append(capture(page,base,name,route))
        verify_guard(page,base)
        for name,route in SURFACES: audits.extend(audit_surface(page,base,name,route))
        browser.close()
    finally:
      server.terminate()
      try: server.wait(timeout=5)
      except subprocess.TimeoutExpired: server.kill()
    (OUT/"chat07-capture.json").write_text(json.dumps(records,indent=2),encoding="utf-8")
    (OUT/"chat07-button-audit.json").write_text(json.dumps(audits,indent=2),encoding="utf-8")
    passed=sum(1 for x in audits if x["status"].startswith("PASS")); skipped=sum(1 for x in audits if x["status"].startswith("SKIP"))
    print("Captured 4 CHAT07 source-of-truth surfaces at 1672x941")
    print(f"CHAT07 browser button audit PASS: {passed} functional/current-state controls; {skipped} intentional skips")

if __name__=="__main__": main()
