#!/usr/bin/env python3
import http.server, socketserver, threading, subprocess, tempfile, pathlib, os, re, sys, shutil
ROOT=pathlib.Path(__file__).resolve().parents[1]
BROWSER=os.environ.get('RWA_BROWSER_BIN')
candidates=[BROWSER,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/Applications/Chromium.app/Contents/MacOS/Chromium',shutil.which('google-chrome'),shutil.which('chromium'),shutil.which('chromium-browser')]
BROWSER=next((x for x in candidates if x and pathlib.Path(x).exists()),None)
if not BROWSER:
    print('BROWSER_SMOKE=FAIL:NO_CHROMIUM_BROWSER')
    raise SystemExit(2)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
with tempfile.TemporaryDirectory(prefix='rwa-v5-browser-') as td:
    base=pathlib.Path(td);(base/'rwa').symlink_to(ROOT,target_is_directory=True)
    os.chdir(base)
    with socketserver.TCPServer(('127.0.0.1',0),Quiet) as srv:
        port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
        routes=['markets','intelligence','assets','research','institutional','asset/ONDO']
        profile=base/'chrome-profile';profile.mkdir()
        for route in routes:
            url=f'http://127.0.0.1:{port}/rwa/qa/superapp-v5-harness.html#{route}'
            cmd=[BROWSER,'--headless=new','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check',f'--user-data-dir={profile}', '--virtual-time-budget=1800','--dump-dom',url]
            if sys.platform.startswith('linux'): cmd.insert(1,'--no-sandbox')
            try:r=subprocess.run(cmd,capture_output=True,text=True,timeout=20)
            except subprocess.TimeoutExpired: print(f'BROWSER_ROUTE_{route}=FAIL:TIMEOUT');raise SystemExit(3)
            dom=r.stdout
            if 'data-rwa-super-app="5.0.0"' not in dom: print(f'BROWSER_ROUTE_{route}=FAIL:NO_V5');raise SystemExit(4)
            expected=route
            if f'data-rwa-route="{expected}"' not in dom:
                print(f'BROWSER_ROUTE_{route}=FAIL:ROUTE');raise SystemExit(5)
            print(f'BROWSER_ROUTE_{route}=PASS')
        # Mobile contract: bottom navigation must be V5-owned and native-like.
        url=f'http://127.0.0.1:{port}/rwa/qa/superapp-v5-harness.html#asset/ONDO'
        cmd=[BROWSER,'--headless=new','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check',f'--user-data-dir={profile}','--window-size=390,844','--virtual-time-budget=1800','--dump-dom',url]
        if sys.platform.startswith('linux'): cmd.insert(1,'--no-sandbox')
        r=subprocess.run(cmd,capture_output=True,text=True,timeout=20);dom=r.stdout
        for label in ['Markets','Search','Trade','Social','Portfolio']:
            if f'<small>{label}</small>' not in dom: print(f'MOBILE_NAV=FAIL:{label}');raise SystemExit(6)
        if 'rwa-asset-detail-tabs' not in dom: print('MOBILE_ASSET=FAIL');raise SystemExit(7)
        print('MOBILE_NAV=PASS')
        print('BROWSER_SMOKE=PASS')
