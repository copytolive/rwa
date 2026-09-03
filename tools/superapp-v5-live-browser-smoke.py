#!/usr/bin/env python3
import subprocess, tempfile, pathlib, os, sys, shutil, time
BASE=os.environ.get('RWA_LIVE_URL','https://copytolive.github.io/rwa/')
BROWSER=os.environ.get('RWA_BROWSER_BIN')
candidates=[BROWSER,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/Applications/Chromium.app/Contents/MacOS/Chromium',shutil.which('google-chrome'),shutil.which('chromium'),shutil.which('chromium-browser')]
BROWSER=next((x for x in candidates if x and pathlib.Path(x).exists()),None)
if not BROWSER:
    print('LIVE_BROWSER_SMOKE=FAIL:NO_CHROMIUM_BROWSER');raise SystemExit(2)
with tempfile.TemporaryDirectory(prefix='rwa-v5-live-browser-') as td:
    routes=['markets','intelligence','assets','research','portfolio','social','institutional','asset/ONDO']
    for i,route in enumerate(routes):
        profile=pathlib.Path(td)/f'p{i}';profile.mkdir()
        url=f'{BASE}?browser-smoke={int(time.time())}-{i}#{route}'
        cmd=[BROWSER,'--headless=new','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check',f'--user-data-dir={profile}','--virtual-time-budget=4500','--dump-dom',url]
        if sys.platform.startswith('linux'):cmd.insert(1,'--no-sandbox')
        try:r=subprocess.run(cmd,capture_output=True,text=True,timeout=35)
        except subprocess.TimeoutExpired:print(f'LIVE_BROWSER_ROUTE_{route}=FAIL:TIMEOUT');raise SystemExit(3)
        dom=r.stdout
        if 'data-rwa-super-app="5.0.0"' not in dom:print(f'LIVE_BROWSER_ROUTE_{route}=FAIL:NO_V5');raise SystemExit(4)
        if f'data-rwa-route="{route}"' not in dom:print(f'LIVE_BROWSER_ROUTE_{route}=FAIL:ROUTE');raise SystemExit(5)
        if 'data-rwa-path="/rwa/"' not in dom:print(f'LIVE_BROWSER_ROUTE_{route}=FAIL:PATH_EXIT');raise SystemExit(6)
        print(f'LIVE_BROWSER_ROUTE_{route}=PASS')
    # mobile asset detail
    profile=pathlib.Path(td)/'mobile';profile.mkdir()
    url=f'{BASE}?browser-smoke=mobile#{"asset/ONDO"}'
    cmd=[BROWSER,'--headless=new','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check',f'--user-data-dir={profile}','--window-size=390,844','--virtual-time-budget=4500','--dump-dom',url]
    if sys.platform.startswith('linux'):cmd.insert(1,'--no-sandbox')
    r=subprocess.run(cmd,capture_output=True,text=True,timeout=35);dom=r.stdout
    for label in ['Markets','Search','Trade','Social','Portfolio']:
        if f'<small>{label}</small>' not in dom:print(f'LIVE_MOBILE_NAV=FAIL:{label}');raise SystemExit(7)
    if 'rwa-asset-detail-tabs' not in dom:print('LIVE_MOBILE_ASSET=FAIL');raise SystemExit(8)
    print('LIVE_MOBILE_NAV=PASS')
    print('LIVE_BROWSER_SMOKE=PASS')
