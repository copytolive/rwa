#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
GOLD="$ROOT/backtest/gold24"
VENV="${GOLD10B_VENV:-$ROOT/.venv_gold10b}"
MODE="${1:-verify}"

if [ ! -f "$GOLD/core.py" ]; then
  echo "ERROR: canonical GOLD24 root missing: $GOLD"
  exit 2
fi

if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
fi

PY="$VENV/bin/python"
PIP="$VENV/bin/pip"

"$PIP" install -q --upgrade pip
"$PIP" install -q -r "$GOLD/requirements.txt"

verify() {
  "$PY" -m py_compile     "$GOLD/copytolive_unified_engine.py"     "$GOLD/core.py"     "$GOLD/multimethod_v1_discovery.py"     "$GOLD/multimethod_v1_discovery_strict.py"     "$GOLD/multimethod_v1_finalize_strict.py"     "$GOLD/multimethod_v1_full_rescan.py"     "$GOLD/screening_gpt_real_audit.py"     "$GOLD/screening_gpt_combined_portfolio_audit.py"     "$GOLD/period2019_selected_report.py"

  (
    cd "$GOLD"
    "$PY" selftest.py
    "$PY" - <<'PY'
import json
import core
from pathlib import Path
u=json.loads(Path("MASTER_METHOD_UNIVERSE.json").read_text())
assert len(core.FAMILIES)==48, len(core.FAMILIES)
assert core.TARGET_ENGINE_FAMILY_COUNT==48
assert len(core.DATA_BLOCKED_NATIVE_MTF_FAMILIES)==2
assert int(u["implemented_engine_family_count"])==48
print("PASS — GOLD10B READY: 48 real families + 2 native-H4 DATA_BLOCKED")
PY
  )
}

discover() {
  STATE="${2:-}"
  COUNT="${3:-100000}"
  SEED="${4:-2026090304}"

  if [ -z "$STATE" ]; then
    echo "Usage: $0 discover /PATH/TO/CANONICAL_STATE [candidate_count] [seed]"
    exit 2
  fi

  test -s "$STATE/gold24-v11.db"
  test -s "$STATE/gate_a/GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv"
  test -s "$STATE/gate_a/gate_a_receipt.json"
  test -s "$GOLD/runtime_v11/latest_validation_summary.json"

  OUT="$GOLD/runtime_multimethod_v1"
  EXISTING="$OUT/latest_multimethod_v1_discovery.json"
  if [ ! -s "$EXISTING" ]; then
    EXISTING="$OUT/latest_multimethod_v1_full_rescan.json"
  fi
  test -s "$EXISTING"

  (
    cd "$ROOT"
    "$PY" backtest/gold24/multimethod_v1_discovery_strict.py       --state-dir "$STATE"       --out-dir "$OUT"       --source-summary "$GOLD/runtime_v11/latest_validation_summary.json"       --existing-library "$EXISTING"       --candidate-count "$COUNT"       --base-seed "$SEED"

    "$PY" backtest/gold24/multimethod_v1_finalize_strict.py --out-dir "$OUT"
  )

  echo "PASS — discovery finished"
  echo "Output: $OUT"
}

case "$MODE" in
  verify) verify ;;
  discover) discover "$@" ;;
  *)
    echo "Usage:"
    echo "  $0 verify"
    echo "  $0 discover /PATH/TO/CANONICAL_STATE [candidate_count] [seed]"
    exit 2
    ;;
esac
