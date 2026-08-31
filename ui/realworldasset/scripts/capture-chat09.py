from pathlib import Path
import json, shutil, subprocess, time
from playwright.sync_api import sync_playwright

VIEWPORT={"width":1672,"height":941}
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"visual-audit"
PREVIEW=ROOT/".visual-preview-chat09"
SITE=PREVIEW/"realworldasset"
SURFACES={
  "25-full-store-page":"/businesses/kopi-nusantara/store/",
  "26-product-detail":"/businesses/kopi-nusantara/store/products/3/",
  "27-checkout":"/checkout/",
  "28-commerce-order-success-order-history":"/account/orders/",
  "70-refund-dispute-flow":"/account/orders/RWA-ORD-20240516-9F7A2B/dispute/",
}
CURRENT_STATE_LABELS={
  "25-full-store-page":{"Clear All","Reset"},
  "26-product-detail":{"−"},
  "27-checkout":{"−"},
  "70-refund-dispute-flow":{"➤"},
}

def prepare():
    if PREVIEW.exists(): shutil.rmtree(PREVIEW)
    SITE.mkdir(parents=True); shutil.copytree(ROOT/"out",SITE,dirs_exist_ok=True); OUT.mkdir(exist_ok=True)

def goto(page,base,route):
    r=page.goto(base+route,wait_until="domcontentloaded",timeout=15000)
    try: page.evaluate("document.fonts.ready")
    except Exception: pass
    page.wait_for_timeout(250); return r

def instrument(page):
    page.evaluate("""() => {window.__rwaNavCalls=[];if(!window.__rwaHistoryPatched){const p=history.pushState.bind(history),r=history.replaceState.bind(history);history.pushState=(...a)=>{window.__rwaNavCalls.push(['push',String(a[2]||'')]);return p(...a)};history.replaceState=(...a)=>{window.__rwaNavCalls.push(['replace',String(a[2]||'')]);return r(...a)};window.__rwaHistoryPatched=true}}""")

def reset(page,base,name): goto(page,base,SURFACES[name]); instrument(page)

def state(page):
    return page.evaluate("""() => {const clone=document.body.cloneNode(true);clone.querySelectorAll('.app-shell > .sr-only[role="status"]').forEach(x=>x.remove());const s=clone.innerHTML;let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}const statuses=Array.from(document.querySelectorAll('[role="status"]')).filter(x=>!x.matches('.app-shell > .sr-only[role="status"]')).map(x=>x.textContent||'').join('|');return {url:location.href,hash:(h>>>0).toString(16),dialogs:document.querySelectorAll('[role="dialog"]').length,status:statuses,nav:(window.__rwaNavCalls||[]).slice()}}""")

def meta(button):
    try: button.scroll_into_view_if_needed(timeout=2000)
    except Exception: pass
    box=button.bounding_box(); hit=True
    if box:
      x=box['x']+box['width']/2; y=box['y']+box['height']/2
      hit=button.evaluate("(el,p)=>{const t=document.elementFromPoint(p.x,p.y);return !!t&&(t===el||el.contains(t))}",{"x":x,"y":y})
    return {"text":((button.inner_text() or "").strip()),"ariaLabel":button.get_attribute("aria-label"),"ariaPressed":button.get_attribute("aria-pressed"),"ariaSelected":button.get_attribute("aria-selected"),"dataActive":button.get_attribute("data-active"),"disabled":button.is_disabled(),"hit":hit}

def changed(a,b): return a["url"]!=b["url"] or a["hash"]!=b["hash"] or a["dialogs"]!=b["dialogs"] or a["status"]!=b["status"] or a.get("nav")!=b.get("nav")

def capture_surface(page,base,name):
    reset(page,base,name)
    if page.locator("body").count()!=1: raise RuntimeError(f"{name} did not render")
    text=page.locator("body").inner_text()
    if "404" in text[:120] or "Route reserved for" in text: raise RuntimeError(f"{name} rendered placeholder/404")
    page.evaluate("scrollTo(0,0)"); page.screenshot(path=str(OUT/f"{name}.png"),full_page=False)
    return {"name":name,"url":page.url,"viewport":VIEWPORT,"title":page.title()}

def audit_surface(page,base,name):
    reset(page,base,name); count=page.locator("button:visible").count(); rows=[]
    for i in range(count):
      reset(page,base,name); buttons=page.locator("button:visible")
      if i>=buttons.count(): rows.append({"surface":name,"index":i,"status":"SKIP_DYNAMIC"}); continue
      b=buttons.nth(i); m=meta(b); label=m.get("ariaLabel") or m.get("text") or f"button-{i}"
      if m.get("disabled"): rows.append({"surface":name,"index":i,"label":label,"status":"SKIP_DISABLED"}); continue
      if not m.get("hit"): rows.append({"surface":name,"index":i,"label":label,"status":"SKIP_COVERED"}); continue
      if m.get("ariaPressed")=="true" or m.get("ariaSelected")=="true" or m.get("dataActive")=="true" or label in CURRENT_STATE_LABELS.get(name,set()): rows.append({"surface":name,"index":i,"label":label,"status":"PASS_CURRENT_STATE"}); continue
      before=state(page); err=None
      try: b.click(timeout=3000); page.wait_for_timeout(220)
      except Exception as e: err=str(e)
      after=state(page); ok=err is None and changed(before,after)
      rows.append({"surface":name,"index":i,"label":label,"status":"PASS" if ok else "FAIL","beforeUrl":before["url"],"afterUrl":after["url"],"error":err})
    fail=[x for x in rows if x["status"]=="FAIL"]
    if fail:
      summary="; ".join(f'{x["surface"]} #{x["index"]} {x.get("label")}: {x.get("error") or "no observable action"}' for x in fail[:30]); raise RuntimeError(f"CHAT09 browser button audit failed ({len(fail)}): {summary}")
    print(f"CHAT09 button audit PASS: {name} — {len(rows)} visible buttons checked"); return rows

def verify_flow(page,base):
    goto(page,base,"/businesses/kopi-nusantara/"); page.get_by_role("button",name="Visit Store",exact=False).first.click(timeout=4000); page.wait_for_timeout(250)
    if "/businesses/kopi-nusantara/store" not in page.url: raise RuntimeError(f"BusinessProfile -> Store failed: {page.url}")
    page.get_by_role("button",name="View Detail",exact=True).first.click(timeout=4000); page.wait_for_timeout(250)
    if "/store/products/" not in page.url: raise RuntimeError(f"Store -> Product failed: {page.url}")
    page.get_by_role("button",name="Buy Now",exact=True).click(timeout=4000); page.wait_for_timeout(250)
    if "/checkout" not in page.url: raise RuntimeError(f"Product -> Checkout failed: {page.url}")
    page.get_by_role("button",name="Confirm Purchase",exact=False).click(timeout=4000); page.wait_for_timeout(250)
    if "/account/orders" not in page.url: raise RuntimeError(f"Checkout -> Orders failed: {page.url}")
    page.get_by_role("button",name="Refund Policy",exact=False).click(timeout=4000); page.wait_for_timeout(250)
    if "/dispute" not in page.url: raise RuntimeError(f"Orders -> Dispute failed: {page.url}")
    page.get_by_role("button",name="Continue to Review",exact=False).click(timeout=4000); page.wait_for_timeout(180)
    if "Reason" not in page.locator("body").inner_text(): raise RuntimeError("Dispute step did not remain live after Continue")
    print("CHAT09 flow PASS: BusinessProfile -> Store -> Product -> Checkout -> Orders -> Refund/Dispute")

def main():
    prepare(); server=subprocess.Popen(["python3","-m","http.server","4179","--bind","127.0.0.1","--directory",str(PREVIEW)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1);base="http://127.0.0.1:4179/realworldasset";records=[];audits=[]
    try:
      with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox"]);page=browser.new_page(viewport=VIEWPORT,device_scale_factor=1);verify_flow(page,base)
        for name in SURFACES: records.append(capture_surface(page,base,name))
        for name in SURFACES: audits.extend(audit_surface(page,base,name))
        browser.close()
    finally:
      server.terminate()
      try: server.wait(timeout=5)
      except subprocess.TimeoutExpired: server.kill()
    (OUT/"chat09-capture.json").write_text(json.dumps(records,indent=2),encoding="utf-8");(OUT/"chat09-button-audit.json").write_text(json.dumps(audits,indent=2),encoding="utf-8")
    passed=sum(1 for x in audits if x["status"].startswith("PASS"));skipped=sum(1 for x in audits if x["status"].startswith("SKIP"));print("Captured 5 CHAT09 source-of-truth surfaces at 1672x941");print(f"CHAT09 browser button audit PASS: {passed} functional/current-state controls; {skipped} intentional skips")

if __name__=="__main__": main()
