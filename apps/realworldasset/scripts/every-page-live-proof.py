#!/usr/bin/env python3
import argparse, json, os, re, time
from pathlib import Path
from urllib.parse import urljoin, urlparse
from PIL import Image
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

FORBIDDEN = [
    re.compile(r"\bUI\s+DEMO\b", re.I),
    re.compile(r"\bDEMO\b", re.I),
    re.compile(r"Alex\s+Morgan", re.I),
    re.compile(r"Level\s*3\s*[·-]\s*Demo", re.I),
    re.compile(r"Sample\s+dataset", re.I),
    re.compile(r"Connected\s+Account\s*\(Preview\)", re.I),
    re.compile(r"local(?:ly)?\s+(?:for\s+this\s+)?UI\s+prototype", re.I),
    re.compile(r"POS-DEMO|ORD-DEMO", re.I),
]

REPRESENTATIVE_LIVE = {"/", "/home/", "/markets/", "/intelligence/", "/businesses/", "/rwa/"}


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--base", required=True)
    p.add_argument("--evidence", default="every-page-live-proof")
    return p.parse_args()


def discover_routes(out_dir: Path):
    routes = []
    for index in sorted(out_dir.rglob("index.html")):
        rel = index.parent.relative_to(out_dir)
        if rel.parts and rel.parts[0].startswith("_"):
            continue
        route = "/" if not rel.parts else "/" + "/".join(rel.parts) + "/"
        routes.append(route)
    return sorted(set(routes))


def bright_ratio(path: Path):
    with Image.open(path).convert("RGB") as im:
        if im.width > 1000:
            im.thumbnail((1000, max(1, int(im.height * 1000 / im.width))))
        pixels = list(im.getdata())
        if not pixels:
            return 0.0
        bright = sum(1 for r, g, b in pixels if r >= 236 and g >= 236 and b >= 236)
        return bright / len(pixels)


def large_light_surfaces(page):
    return page.evaluate("""
    () => {
      const vw = innerWidth, vh = innerHeight, minArea = vw * vh * 0.12;
      const bad = [];
      const parse = (value) => {
        const m = String(value || '').match(/rgba?\\((\\d+)[, ]+(\\d+)[, ]+(\\d+)(?:[, /]+([\\d.]+))?\\)/i);
        if (!m) return null;
        return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] == null ? 1 : Number(m[4])];
      };
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        const area = Math.max(0, Math.min(vw, r.right) - Math.max(0, r.left)) * Math.max(0, Math.min(vh, r.bottom) - Math.max(0, r.top));
        if (area < minArea) continue;
        const c = parse(getComputedStyle(el).backgroundColor);
        if (!c || c[3] < .55) continue;
        if (c[0] > 228 && c[1] > 228 && c[2] > 228) {
          bad.push({tag: el.tagName, cls: String(el.className || '').slice(0,120), rgb: c.slice(0,3), area: Math.round(area)});
          if (bad.length >= 8) break;
        }
      }
      return bad;
    }
    """)


def safe_name(route):
    return "root" if route == "/" else route.strip("/").replace("/", "__").replace("?", "_")


def main():
    args = parse_args()
    out_dir = Path(args.out).resolve()
    evidence = Path(args.evidence).resolve()
    evidence.mkdir(parents=True, exist_ok=True)
    (evidence / "desktop").mkdir(exist_ok=True)
    (evidence / "mobile").mkdir(exist_ok=True)
    routes = discover_routes(out_dir)
    if not routes:
        raise SystemExit("NO_EXPORTED_ROUTES")

    expected_live = os.getenv("EXPECT_PUBLIC_FEED", "0") == "1"
    results = []
    failures = []
    viewports = [("desktop", 1672, 941), ("mobile", 390, 844)]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        for viewport_name, width, height in viewports:
            context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1)
            page = context.new_page()
            page_errors = []
            response_errors = []
            page.on("pageerror", lambda e: page_errors.append(str(e)))
            def on_response(resp):
                try:
                    if urlparse(resp.url).netloc == urlparse(args.base).netloc and resp.status >= 400:
                        response_errors.append({"url": resp.url, "status": resp.status})
                except Exception:
                    pass
            page.on("response", on_response)

            for route in routes:
                page_errors.clear(); response_errors.clear()
                url = args.base.rstrip("/") + route
                record = {"route": route, "viewport": viewport_name, "width": width, "height": height, "url": url}
                try:
                    resp = page.goto(url, wait_until="domcontentloaded", timeout=25000)
                    if not resp or resp.status != 200:
                        record["navigation_status"] = None if not resp else resp.status
                        failures.append(f"{viewport_name} {route}: navigation status {record['navigation_status']}")
                    try:
                        page.wait_for_load_state("load", timeout=7000)
                    except PlaywrightTimeoutError:
                        pass
                    page.wait_for_timeout(500)
                    live_dashboard = page.locator("[data-live-source='hyperliquid-public']").count() > 0
                    if live_dashboard and route in REPRESENTATIVE_LIVE:
                        try:
                            page.wait_for_function("""() => {
                              const el=document.querySelector('.live-feed-badge');
                              return el && !/CONNECTING/i.test(el.textContent||'');
                            }""", timeout=7000)
                        except PlaywrightTimeoutError:
                            pass
                    body_text = page.locator("body").inner_text(timeout=5000)
                    markers = sorted({m.group(0) for pattern in FORBIDDEN for m in pattern.finditer(body_text)})
                    record["forbidden_markers"] = markers
                    if markers:
                        failures.append(f"{viewport_name} {route}: forbidden visible markers {markers[:5]}")

                    geometry = page.evaluate("""() => ({
                      innerWidth,
                      scrollWidth: document.documentElement.scrollWidth,
                      scrollHeight: document.documentElement.scrollHeight,
                      bodyWidth: document.body.getBoundingClientRect().width
                    })""")
                    record["geometry"] = geometry
                    if geometry["scrollWidth"] > geometry["innerWidth"] + 2:
                        failures.append(f"{viewport_name} {route}: global horizontal overflow {geometry['scrollWidth']}>{geometry['innerWidth']}")

                    lights = large_light_surfaces(page)
                    record["large_light_surfaces"] = lights
                    if lights:
                        failures.append(f"{viewport_name} {route}: large white/light surface {lights[0]}")

                    feed_text = ""
                    tick_count = None
                    if live_dashboard:
                        badge = page.locator(".live-feed-badge")
                        if badge.count(): feed_text = badge.first.inner_text()
                        tick = page.locator(".live-hero-state")
                        if tick.count():
                            m = re.search(r"Successful real ticks:\s*(\d+)", tick.first.inner_text(), re.I)
                            tick_count = int(m.group(1)) if m else None
                    record["live_dashboard"] = live_dashboard
                    record["feed_state"] = feed_text
                    record["real_tick_count"] = tick_count
                    if expected_live and route in REPRESENTATIVE_LIVE and live_dashboard and "LIVE VENUE DATA" not in feed_text.upper():
                        failures.append(f"{viewport_name} {route}: public venue probe passed but browser feed is not LIVE ({feed_text!r})")

                    shot = evidence / viewport_name / f"{safe_name(route)}.png"
                    page.screenshot(path=str(shot), full_page=True, animations="disabled")
                    ratio = bright_ratio(shot)
                    record["white_pixel_ratio"] = round(ratio, 6)
                    if ratio > 0.10:
                        failures.append(f"{viewport_name} {route}: white pixel ratio {ratio:.3f} exceeds 0.10")

                    record["page_errors"] = list(page_errors)
                    record["same_origin_http_errors"] = list(response_errors)
                    if page_errors:
                        failures.append(f"{viewport_name} {route}: page errors {page_errors[:2]}")
                    if response_errors:
                        failures.append(f"{viewport_name} {route}: same-origin HTTP errors {response_errors[:2]}")
                except Exception as e:
                    record["exception"] = repr(e)
                    failures.append(f"{viewport_name} {route}: exception {e}")
                    try:
                        shot = evidence / viewport_name / f"{safe_name(route)}--exception.png"
                        page.screenshot(path=str(shot), full_page=True, animations="disabled")
                    except Exception:
                        pass
                results.append(record)
            context.close()
        browser.close()

    summary = {
        "routes": len(routes),
        "viewports": len(viewports),
        "screenshots_expected": len(routes) * len(viewports),
        "checks": len(results),
        "failures": len(failures),
        "expected_public_feed": expected_live,
        "route_list": routes,
        "failure_list": failures,
    }
    (evidence / "report.json").write_text(json.dumps({"summary": summary, "results": results}, indent=2), encoding="utf-8")
    (evidence / "summary.txt").write_text("\n".join([
        f"ROUTES={summary['routes']}", f"VIEWPORTS={summary['viewports']}",
        f"SCREENSHOTS_EXPECTED={summary['screenshots_expected']}", f"CHECKS={summary['checks']}",
        f"FAILURES={summary['failures']}", f"EXPECT_PUBLIC_FEED={int(expected_live)}",
        *[f"FAIL: {x}" for x in failures]
    ]) + "\n", encoding="utf-8")

    if failures:
        print(f"EVERY_PAGE_LIVE_PROOF=FAIL routes={len(routes)} checks={len(results)} failures={len(failures)}")
        for item in failures[:120]: print("-", item)
        raise SystemExit(1)
    print(f"EVERY_PAGE_LIVE_PROOF=PASS routes={len(routes)} viewports=2 screenshots={len(routes)*2} failures=0")

if __name__ == "__main__":
    main()
