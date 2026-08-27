#!/usr/bin/env bash
set -euo pipefail
systemctl is-active --quiet gold24.service
python3 - <<'PY'
import json, os
p='/var/lib/gold24/status.json'
if not os.path.exists(p):
    raise SystemExit('status.json missing')
d=json.load(open(p))
print(json.dumps(d, indent=2))
print('HEALTH=PASS' if d.get('worker','').startswith('RUNNING') else 'HEALTH=FAIL')
PY
