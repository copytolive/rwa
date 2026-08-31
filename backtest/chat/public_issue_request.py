from __future__ import annotations

import json
import os
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = json.loads((ROOT / 'data' / 'assets.json').read_text())
ALLOWED = {x['symbol'].upper() for x in ASSETS['assets']}
REQUESTS = ROOT / 'chat' / 'requests'
REQUESTS.mkdir(parents=True, exist_ok=True)


def main() -> None:
    event_path = Path(os.environ['GITHUB_EVENT_PATH'])
    event = json.loads(event_path.read_text())
    issue = event.get('issue') or {}
    title = str(issue.get('title') or '')
    if not title.startswith('[VectorForge Backtest]'):
        print('Not a VectorForge request; exiting.')
        return
    body = str(issue.get('body') or '')
    m = re.search(r'```json\s*(\{.*?\})\s*```', body, re.S | re.I)
    if not m:
        raise SystemExit('Request body must contain one fenced JSON object.')
    req = json.loads(m.group(1))
    issue_no = int(issue['number'])
    req['request_id'] = f'public-issue-{issue_no}'
    symbol = str(req.get('asset') or '').upper()
    if symbol not in ALLOWED:
        raise SystemExit(f'Asset {symbol!r} is not in the public catalog.')
    req['asset'] = symbol
    start = date.fromisoformat(str(req['start']))
    end = date.fromisoformat(str(req['end']))
    days = (end - start).days
    if days < 1:
        raise SystemExit('End date must be after start date.')
    if days > 7:
        raise SystemExit('Public GitHub requests are limited to 7 calendar days per job.')
    out = REQUESTS / f"{req['request_id']}.json"
    out.write_text(json.dumps(req, indent=2))
    print(out)


if __name__ == '__main__':
    main()
