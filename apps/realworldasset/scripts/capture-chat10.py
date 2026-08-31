from pathlib import Path
import json, shutil, subprocess, time
from playwright.sync_api import sync_playwright
VIEWPORT={"width":1672,"height":941};ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/"visual-audit";PREVIEW=ROOT/".visual-preview-chat10";SITE=PREVIEW/"realworldasset"
SURFACES={"29-community-page":"/community/","30-trader-user-profile":"/community/users/alex-yield/","31-thesis-detail-thread":"/community/thesis/kopi-long-term-value/","32-create-thesis":"/community/compose/","33-saved-ideas-bookmarks":"/bookmarks/"}

def prepare():
    if PREVIEW.exists():shutil.rmtree(PREVIEW)
    SITE.mkdir(parents=True);shutil.copytree(ROOT/"out",SITE,dirs_exist_ok=True);OUT.mkdir(exist_ok=True)
def goto(page,base,route):
    r=page.goto(base+route,wait_until="domcontentloaded",timeout=15000)
    try:page.evaluate("document.fonts.ready")
    except Exception:pass
    page.wait_for_timeout(180);return r
def instrument(page):
    page.evaluate("""() => {window.__nav=[];if(!window.__patched){const p=history.pushState.bind(history),r=history.replaceState.bind(history);history.pushState=(...a)=>{window.__nav.push(['push',String(a[2]||'')]);return p(...a)};history.replaceState=(...a)=>{window.__nav.push(['replace',String(a[2]||'')]);return r(...a)};window.__patched=true}}""")
def reset(page,base,name):goto(page,base,SURFACES[name]);instrument(page)
def state(page):return page.evaluate("""() => {const c=document.body.cloneNode(true);c.querySelectorAll('.app-shell > .sr-only[role="status"]').forEach(x=>x.remove());const s=c.innerHTML;let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return {url:location.href,hash:(h>>>0).toString(16),dialogs:document.querySelectorAll('[role="dialog"]').length,status:Array.from(document.querySelectorAll('[role="status"]')).map(x=>x.textContent||'').join('|'),nav:(window.__nav||[]).slice()}}""")
def changed(a,b):return a["url"]!=b["url"] or a["hash"]!=b["hash"] or a["dialogs"]!=b["dialogs"] or a["status"]!=b["status"] or a["nav"]!=b["nav"]
def meta(b):
    try:b.scroll_into_view_if_needed(timeout=1800)
    except Exception:pass
    box=b.bounding_box();hit=True
    if box:
      x=box['x']+box['width']/2;y=box['y']+box['height']/2;hit=b.evaluate("(el,p)=>{const t=document.elementFromPoint(p.x,p.y);return !!t&&(t===el||el.contains(t))}",{"x":x,"y":y})
    return {"label":b.get_attribute("aria-label") or (b.inner_text() or "").strip(),"active":b.get_attribute("data-active")=="true" or b.get_attribute("aria-pressed")=="true" or b.get_attribute("aria-selected")=="true","disabled":b.is_disabled(),"hit":hit}
def capture(page,base,name):
    reset(page,base,name);text=page.locator("body").inner_text()
    if "404" in text[:120] or "Route reserved for" in text:raise RuntimeError(f"{name} placeholder/404")
    page.evaluate("scrollTo(0,0)");page.screenshot(path=str(OUT/f"{name}.png"),full_page=False);return {"name":name,"url":page.url,"viewport":VIEWPORT}
def audit(page,base,name):
    reset(page,base,name);count=page.locator("button:visible").count();rows=[]
    for i in range(count):
      reset(page,base,name);buttons=page.locator("button:visible")
      if i>=buttons.count():rows.append({"surface":name,"index":i,"status":"SKIP_DYNAMIC"});continue
      b=buttons.nth(i);m=meta(b);label=m["label"] or f"button-{i}"
      if m["disabled"]:rows.append({"surface":name,"index":i,"label":label,"status":"SKIP_DISABLED"});continue
      if not m["hit"]:rows.append({"surface":name,"index":i,"label":label,"status":"SKIP_COVERED"});continue
      if m["active"]:rows.append({"surface":name,"index":i,"label":label,"status":"PASS_CURRENT_STATE"});continue
      a=state(page);err=None
      try:b.click(timeout=3000);page.wait_for_timeout(140)
      except Exception as e:err=str(e)
      z=state(page);ok=err is None and changed(a,z);rows.append({"surface":name,"index":i,"label":label,"status":"PASS" if ok else "FAIL","beforeUrl":a["url"],"afterUrl":z["url"],"error":err})
    fail=[x for x in rows if x["status"]=="FAIL"]
    if fail:raise RuntimeError("CHAT10 browser button audit failed: "+"; ".join(f'{x["surface"]} #{x["index"]} {x["label"]}: {x.get("error") or "no observable action"}' for x in fail[:30]))
    print(f"CHAT10 button audit PASS: {name} — {len(rows)} visible buttons checked");return rows
def verify_flow(page,base):
    goto(page,base,"/community/");page.locator("button.author").first.click(timeout=4000);page.wait_for_timeout(180)
    if "/community/users/" not in page.url:raise RuntimeError(f"Community -> profile failed: {page.url}")
    goto(page,base,"/community/");page.locator("button.thesis-title").first.click(timeout=4000);page.wait_for_timeout(180)
    if "/community/thesis/" not in page.url:raise RuntimeError(f"Community -> thesis failed: {page.url}")
    goto(page,base,"/community/");page.get_by_role("button",name="Create Thesis",exact=False).first.click(timeout=4000);page.wait_for_timeout(180)
    if "/community/compose" not in page.url:raise RuntimeError(f"Community -> composer failed: {page.url}")
    goto(page,base,"/bookmarks/")
    if "Saved Ideas" not in page.locator("body").inner_text():raise RuntimeError("Bookmarks failed")
    print("CHAT10 flow PASS: Community -> Profile / Thesis / Composer -> Bookmarks")
def main():
    prepare();server=subprocess.Popen(["python3","-m","http.server","4180","--bind","127.0.0.1","--directory",str(PREVIEW)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1);base="http://127.0.0.1:4180/realworldasset";records=[];audits=[]
    try:
      with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox"]);page=browser.new_page(viewport=VIEWPORT,device_scale_factor=1);verify_flow(page,base)
        for name in SURFACES:records.append(capture(page,base,name))
        for name in SURFACES:audits.extend(audit(page,base,name))
        browser.close()
    finally:
      server.terminate()
    (OUT/"chat10-capture.json").write_text(json.dumps(records,indent=2));(OUT/"chat10-button-audit.json").write_text(json.dumps(audits,indent=2));print(f"Captured {len(records)} CHAT10 surfaces at 1672x941; {sum(x['status'].startswith('PASS') for x in audits)} controls passed/current-state")
if __name__=="__main__":main()
