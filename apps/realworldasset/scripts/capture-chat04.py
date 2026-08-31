from pathlib import Path
import json
import shutil
import subprocess
import time
from playwright.sync_api import sync_playwright

VIEWPORT={"width":1672,"height":941}
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"visual-audit"
PREVIEW=ROOT/".visual-preview-chat04"
SITE=PREVIEW/"realworldasset"
ORDER_ID="ORD-20240517-8F4A2C9D"
POSITION_ID="POS-KOPI-001"


def prepare():
    if PREVIEW.exists(): shutil.rmtree(PREVIEW)
    SITE.mkdir(parents=True)
    shutil.copytree(ROOT/"out",SITE,dirs_exist_ok=True)
    OUT.mkdir(exist_ok=True)


def ready(page):
    page.wait_for_load_state("domcontentloaded")
    page.wait_for_timeout(180)


def goto(page,base,route):
    response=page.goto(base+route,wait_until="domcontentloaded",timeout=15000)
    ready(page)
    return response


def open_preview(page):
    b=page.get_by_role("button",name="Place Buy Limit Order")
    if b.count()==0: raise RuntimeError("CHAT04 Place Buy Limit Order button missing")
    b.first.click(); page.wait_for_timeout(180)
    if page.locator('[role="dialog"]').count()==0: raise RuntimeError("CHAT04 Preview Order dialog did not open")


def open_result(page):
    open_preview(page)
    b=page.get_by_role("button",name="Confirm Buy")
    if b.count()==0: raise RuntimeError("CHAT04 Confirm Buy button missing")
    b.first.click(); page.wait_for_timeout(220)
    if page.get_by_text("Order Filled",exact=True).count()==0: raise RuntimeError("CHAT04 Order Filled result did not render")


def capture(page,base,name,route,setup=None):
    response=goto(page,base,route)
    if setup: setup(page)
    page.screenshot(path=str(OUT/f"{name}.png"),full_page=False)
    return {"name":name,"route":route,"url":page.url,"status":response.status if response else None,"viewport":VIEWPORT,"title":page.title()}


def page_state(page):
    return page.evaluate("""() => {
      const s=document.body.innerHTML; let h=2166136261;
      for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
      return {url:location.href,hash:(h>>>0).toString(16),dialogs:document.querySelectorAll('[role="dialog"]').length,status:Array.from(document.querySelectorAll('[role="status"]')).map(x=>x.textContent||'').join('|')}
    }""")


def button_state(button):
    return {"text":((button.inner_text() or "").strip()),"ariaLabel":button.get_attribute("aria-label"),"ariaPressed":button.get_attribute("aria-pressed"),"ariaSelected":button.get_attribute("aria-selected"),"dataActive":button.get_attribute("data-active"),"disabled":button.is_disabled()}


def changed(before,after):
    return any(before.get(k)!=after.get(k) for k in ("url","hash","dialogs","status"))


def audit_surface(page,base,name,route,setup=None):
    goto(page,base,route)
    if setup: setup(page)
    initial=page.locator("button:visible")
    count=initial.count(); results=[]
    for index in range(count):
        goto(page,base,route)
        if setup: setup(page)
        buttons=page.locator("button:visible")
        if index>=buttons.count():
            results.append({"surface":name,"index":index,"status":"SKIP_DYNAMIC"}); continue
        button=buttons.nth(index); bs=button_state(button)
        label=bs.get("ariaLabel") or bs.get("text") or f"button-{index}"
        # Chromium still reports controls behind a modal as CSS-visible. They are not hit-testable
        # to a user, so audit only the active dialog controls while a modal is open.
        if page.locator('[role="dialog"]').count()>0 and not button.evaluate("el => !!el.closest('[role=dialog]')"):
            results.append({"surface":name,"index":index,"label":label,"status":"SKIP_OVERLAY_COVERED"}); continue
        if bs.get("disabled"):
            results.append({"surface":name,"index":index,"label":label,"status":"SKIP_DISABLED"}); continue
        if bs.get("ariaPressed")=="true" or bs.get("ariaSelected")=="true" or bs.get("dataActive")=="true":
            results.append({"surface":name,"index":index,"label":label,"status":"PASS_CURRENT_STATE"}); continue
        before=page_state(page); error=None
        try:
            button.evaluate("el=>el.click()")
            page.wait_for_timeout(100)
        except Exception as exc: error=str(exc)
        after=page_state(page); ok=error is None and changed(before,after)
        results.append({"surface":name,"index":index,"label":label,"status":"PASS" if ok else "FAIL","beforeUrl":before.get("url"),"afterUrl":after.get("url"),"error":error})
    failed=[x for x in results if x["status"]=="FAIL"]
    if failed:
        summary="; ".join(f'{x["surface"]} #{x["index"]} {x.get("label")}: {x.get("error") or "no observable action"}' for x in failed[:15])
        raise RuntimeError(f"CHAT04 button audit failed ({len(failed)}): {summary}")
    checked=sum(1 for x in results if x["status"].startswith("PASS"))
    covered=sum(1 for x in results if x["status"]=="SKIP_OVERLAY_COVERED")
    print(f"CHAT04 button audit PASS: {name} — {checked} interactable buttons checked, {covered} background controls covered by modal")
    return results


def main():
    prepare()
    server=subprocess.Popen(["python3","-m","http.server","4174","--bind","127.0.0.1","--directory",str(PREVIEW)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    time.sleep(1); base="http://127.0.0.1:4174/realworldasset"; records=[]; audits=[]
    try:
      with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
        page=browser.new_page(viewport=VIEWPORT,device_scale_factor=1)
        records.append(capture(page,base,"10-advanced-trade-expanded","/trade/kopi/"))
        records.append(capture(page,base,"11-preview-order-modal","/trade/kopi/",open_preview))
        records.append(capture(page,base,"12-order-result","/trade/kopi/",open_result))
        records.append(capture(page,base,"13-order-detail",f"/orders/{ORDER_ID}/"))
        records.append(capture(page,base,"14-position-detail",f"/positions/{POSITION_ID}/"))
        surfaces=[("10-advanced-trade-expanded","/trade/kopi/",None),("11-preview-order-modal","/trade/kopi/",open_preview),("12-order-result","/trade/kopi/",open_result),("13-order-detail",f"/orders/{ORDER_ID}/",None),("14-position-detail",f"/positions/{POSITION_ID}/",None)]
        for name,route,setup in surfaces: audits.extend(audit_surface(page,base,name,route,setup))
        browser.close()
    finally:
      server.terminate()
      try: server.wait(timeout=5)
      except subprocess.TimeoutExpired: server.kill()
    (OUT/"chat04-capture.json").write_text(json.dumps(records,indent=2),encoding="utf-8")
    (OUT/"chat04-button-audit.json").write_text(json.dumps(audits,indent=2),encoding="utf-8")
    passed=sum(1 for x in audits if x["status"].startswith("PASS")); covered=sum(1 for x in audits if x["status"]=="SKIP_OVERLAY_COVERED"); skipped=sum(1 for x in audits if x["status"].startswith("SKIP") and x["status"]!="SKIP_OVERLAY_COVERED")
    print(f"Captured 5 CHAT04 source-of-truth surfaces at 1672x941")
    print(f"CHAT04 browser button audit PASS: {passed} interactable functional/current-state controls; {covered} controls correctly blocked by modal; {skipped} other intentional skips")

if __name__=="__main__": main()
