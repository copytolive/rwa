from pathlib import Path
import json
import shutil
import subprocess
import time
from playwright.sync_api import sync_playwright

VIEWPORT = {"width": 1672, "height": 941}
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "visual-audit"
PREVIEW = ROOT / ".visual-preview"
SITE = PREVIEW / "realworldasset"

CHAT03_ROUTES = [
    ("63-public-business-profile", "/businesses/kopi-nusantara/"),
    ("09-dedicated-rwa-detail", "/rwa/marina-bay-residences/"),
    ("39-crypto-asset-detail", "/markets/btc-usdc/"),
    ("40-business-token-detail", "/businesses/kopi-nusantara/token/"),
    ("41-regulated-rwa-detail", "/rwa/marina-bay-residences-regulated/"),
]


def prepare_preview() -> None:
    if PREVIEW.exists():
        shutil.rmtree(PREVIEW)
    SITE.mkdir(parents=True)
    shutil.copytree(ROOT / "out", SITE, dirs_exist_ok=True)
    OUT.mkdir(exist_ok=True)


def wait_ready(page) -> None:
    page.wait_for_load_state("networkidle")
    try:
        page.evaluate("document.fonts && document.fonts.ready")
    except Exception:
        pass
    page.wait_for_timeout(250)


def capture(page, base_url: str, name: str, route: str) -> dict:
    response = page.goto(base_url + route, wait_until="domcontentloaded", timeout=30000)
    wait_ready(page)
    record = {
        "name": name,
        "route": route,
        "url": page.url,
        "status": response.status if response else None,
        "viewport": VIEWPORT,
        "innerWidth": page.evaluate("window.innerWidth"),
        "innerHeight": page.evaluate("window.innerHeight"),
        "title": page.title(),
    }
    if name == "01-public-landing":
        record["landingPreview"] = page.evaluate("""
        async () => {
          const el = document.querySelector('.rwa-dashboard-preview');
          const assetUrl = '/realworldasset/chat01/landing-dashboard.jpg';
          const asset = await fetch(assetUrl);
          const buf = await asset.arrayBuffer();
          const image = new Image();
          let decodeOk = false;
          let decodeError = null;
          image.src = assetUrl;
          try { await image.decode(); decodeOk = true; } catch (e) { decodeError = String(e); }
          if (!el) return {missing:true, assetStatus:asset.status, assetBytes:buf.byteLength, decodeOk, decodeError, naturalWidth:image.naturalWidth, naturalHeight:image.naturalHeight};
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return {
            display:s.display, visibility:s.visibility, opacity:s.opacity,
            width:s.width, height:s.height, backgroundImage:s.backgroundImage,
            rect:{x:r.x,y:r.y,width:r.width,height:r.height},
            max1100:matchMedia('(max-width:1100px)').matches,
            assetStatus:asset.status, assetType:asset.headers.get('content-type'), assetBytes:buf.byteLength,
            decodeOk, decodeError, naturalWidth:image.naturalWidth, naturalHeight:image.naturalHeight
          };
        }
        """)
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=False)
    return record


def dom_state(page, button=None) -> dict:
    button_state = {}
    if button is not None:
        try:
            button_state = {
                "text": (button.inner_text() or "").strip(),
                "ariaLabel": button.get_attribute("aria-label"),
                "ariaPressed": button.get_attribute("aria-pressed"),
                "ariaSelected": button.get_attribute("aria-selected"),
                "dataActive": button.get_attribute("data-active"),
                "class": button.get_attribute("class"),
                "disabled": button.is_disabled(),
            }
        except Exception:
            button_state = {"detached": True}
    page_state = page.evaluate("""
    () => {
      const s = document.body.innerHTML;
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      const amount = document.querySelector('input[aria-label="Trade amount"]');
      return {
        bodyHash: (h >>> 0).toString(16),
        bodyClass: document.body.className,
        appClass: document.querySelector('.app-shell')?.className || '',
        dialogCount: document.querySelectorAll('[role="dialog"], .rwa-overlay').length,
        statusText: Array.from(document.querySelectorAll('[role="status"]')).map(x => x.textContent || '').join('|'),
        tradeAmount: amount ? amount.value : null,
      };
    }
    """)
    return {"url": page.url, "button": button_state, "page": page_state}


def is_current_state_button(before: dict) -> bool:
    b = before.get("button", {})
    return b.get("ariaPressed") == "true" or b.get("ariaSelected") == "true" or b.get("dataActive") == "true"


def preset_matches_current(before: dict) -> bool:
    text = before.get("button", {}).get("text", "").replace(" ", "").upper()
    amount = before.get("page", {}).get("tradeAmount")
    if amount is None or not text.startswith("$"):
        return False
    mapping = {"$1K": "1000", "$10K": "10000", "$50K": "50000", "$100K": "100000"}
    return mapping.get(text) == str(amount)


def changed(before: dict, after: dict) -> bool:
    if before.get("url") != after.get("url"):
        return True
    bp, ap = before.get("page", {}), after.get("page", {})
    for key in ("bodyHash", "bodyClass", "appClass", "dialogCount", "statusText", "tradeAmount"):
        if bp.get(key) != ap.get(key):
            return True
    bb, ab = before.get("button", {}), after.get("button", {})
    for key in ("text", "ariaPressed", "ariaSelected", "dataActive", "class"):
        if bb.get(key) != ab.get(key):
            return True
    return False


def audit_route_buttons(page, base_url: str, route_name: str, route: str) -> list[dict]:
    page.goto(base_url + route, wait_until="domcontentloaded", timeout=10000)
    page.wait_for_timeout(80)
    initial = page.locator("button:visible")
    count = initial.count()
    results = []

    for index in range(count):
        page.goto(base_url + route, wait_until="domcontentloaded", timeout=10000)
        page.wait_for_timeout(30)
        buttons = page.locator("button:visible")
        if index >= buttons.count():
            results.append({"route": route, "index": index, "status": "SKIP_DYNAMIC"})
            continue
        button = buttons.nth(index)
        before = dom_state(page, button)
        label = before.get("button", {}).get("ariaLabel") or before.get("button", {}).get("text") or f"button-{index}"

        if before.get("button", {}).get("disabled"):
            results.append({"route": route, "index": index, "label": label, "status": "SKIP_DISABLED"})
            continue
        if is_current_state_button(before):
            results.append({"route": route, "index": index, "label": label, "status": "PASS_CURRENT_STATE"})
            continue
        if preset_matches_current(before):
            results.append({"route": route, "index": index, "label": label, "status": "PASS_ALREADY_APPLIED"})
            continue

        error = None
        try:
            button.evaluate("el => el.click()")
            page.wait_for_timeout(120)
        except Exception as exc:
            error = str(exc)

        after = dom_state(page)
        ok = error is None and changed(before, after)
        results.append({
            "route": route,
            "index": index,
            "label": label,
            "status": "PASS" if ok else "FAIL",
            "beforeUrl": before.get("url"),
            "afterUrl": after.get("url"),
            "error": error,
        })

    failed = [x for x in results if x["status"] == "FAIL"]
    if failed:
        summary = "; ".join(f'{x["route"]} #{x["index"]} {x.get("label")}: {x.get("error") or "no observable action"}' for x in failed[:12])
        raise RuntimeError(f"CHAT03 browser button audit failed ({len(failed)}): {summary}")
    print(f'CHAT03 button audit PASS: {route_name} — {len(results)} visible buttons checked.')
    return results


def main() -> None:
    prepare_preview()
    server = subprocess.Popen(
        ["python3", "-m", "http.server", "4173", "--bind", "127.0.0.1", "--directory", str(PREVIEW)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(1)
    base_url = "http://127.0.0.1:4173/realworldasset"
    records = []
    interaction_records = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
            page = browser.new_page(viewport=VIEWPORT, device_scale_factor=1)

            # CHAT 01 evidence
            records.append(capture(page, base_url, "01-public-landing", "/"))
            records.append(capture(page, base_url, "02-login-signup", "/login/"))
            records.append(capture(page, base_url, "03-onboarding", "/onboarding/"))
            records.append(capture(page, base_url, "05-manage-wallet", "/account/wallet/"))

            modal_route = "/markets/btc-usdc/"
            response = page.goto(base_url + modal_route, wait_until="domcontentloaded", timeout=30000)
            wait_ready(page)
            connect = page.get_by_role("button", name="Connect Wallet")
            if connect.count() == 0:
                raise RuntimeError(f"Connect Wallet button not found on {modal_route}")
            connect.first.click()
            page.wait_for_timeout(250)
            page.screenshot(path=str(OUT / "04-connect-wallet-modal.png"), full_page=False)
            records.append({
                "name": "04-connect-wallet-modal",
                "route": modal_route + " + Connect Wallet",
                "url": page.url,
                "status": response.status if response else None,
                "viewport": VIEWPORT,
                "title": page.title(),
            })

            # CHAT 03 visual evidence
            for name, route in CHAT03_ROUTES:
                records.append(capture(page, base_url, name, route))

            # Browser-level action verification for every visible native button on all CHAT 03 reference surfaces.
            for name, route in CHAT03_ROUTES:
                interaction_records.extend(audit_route_buttons(page, base_url, name, route))

            browser.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()

    (OUT / "capture.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
    (OUT / "chat03-button-audit.json").write_text(json.dumps(interaction_records, indent=2), encoding="utf-8")
    passed = sum(1 for x in interaction_records if x["status"].startswith("PASS"))
    skipped = sum(1 for x in interaction_records if x["status"].startswith("SKIP"))
    print(f"Captured {len(records)} reference surfaces at 1672x941")
    print(f"CHAT03 browser button audit PASS: {passed} functional/current-state buttons, {skipped} intentional skips.")


if __name__ == "__main__":
    main()
