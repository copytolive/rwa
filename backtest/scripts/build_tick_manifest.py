#!/usr/bin/env python3
import json, urllib.request
from pathlib import Path
from datetime import datetime, timezone
API="https://api.github.com/repos/zcbmlijygrdwa/fx_EUR_USD_tick/git/trees/master?recursive=1"
req=urllib.request.Request(API,headers={"Accept":"application/vnd.github+json","User-Agent":"VectorForge/1.0"})
with urllib.request.urlopen(req,timeout=120) as r:data=json.load(r)
items=[]
for x in data.get("tree",[]):
    p=x.get("path","")
    if x.get("type")=="blob" and p.startswith("EURUSD-") and p.endswith("_converted.txt"):
        month=p[len("EURUSD-"):len("EURUSD-")+7]
        items.append({"month":month,"path":p,"size_bytes":x.get("size"),"sha":x.get("sha"),"raw_url":f"https://raw.githubusercontent.com/zcbmlijygrdwa/fx_EUR_USD_tick/master/{p}"})
items.sort(key=lambda x:x["month"])
out={"source_repository":"zcbmlijygrdwa/fx_EUR_USD_tick","generated_at":datetime.now(timezone.utc).isoformat(),"files":len(items),"bytes":sum(x.get("size") or 0 for x in items),"first_month":items[0]["month"] if items else None,"last_month":items[-1]["month"] if items else None,"items":items}
Path("backtest/data/tick_manifest.json").write_text(json.dumps(out,indent=2))
print(f"indexed {out['files']} files / {out['bytes']:,} bytes / {out['first_month']}..{out['last_month']}")
