#!/usr/bin/env bash
set -euo pipefail

Q="/Users/Shared/WorkspaceBersama/COPYTOLIVE_GOLD1000_QUARANTINE_SITE/20260903_124917"
C="/Users/Shared/WorkspaceBersama/COPYTOLIVE_GOLD1000/rwa/backtest/GOLD1000/_archive/local_legacy/20260903_124917"
R="/Users/Shared/WorkspaceBersama/COPYTOLIVE_GOLD1000/quarantine_check_20260903.txt"

test -d "$Q" || { echo "ERROR: quarantine tidak ditemukan: $Q"; exit 1; }
test -d "$C" || { echo "ERROR: clean archive tidak ditemukan: $C"; exit 1; }

TMP_CLEAN="$(mktemp)"
TMP_CAND="$(mktemp)"
TMP_UNIQUE="$(mktemp)"
trap 'rm -f "$TMP_CLEAN" "$TMP_CAND" "$TMP_UNIQUE"' EXIT

echo "======================================================"
echo " GOLD1000 — QUARANTINE RECHECK"
echo "======================================================"

echo "Quarantine size:"
du -sh "$Q" || true

echo
echo "Clean archive size:"
du -sh "$C" || true

echo
echo "Total file quarantine:"
find "$Q" -type f | wc -l | tr -d ' '

echo
echo "Total file clean:"
find "$C" -type f | wc -l | tr -d ' '

echo
echo "Site/UI files di quarantine:"
find "$Q" -type f -print |
grep -E '\.(html|css|js|jsx|ts|tsx)$' |
wc -l | tr -d ' ' || true

echo
echo "== HASH CLEAN ARCHIVE =="

find "$C" -type f -print0 |
while IFS= read -r -d '' F; do
  shasum -a 256 "$F" | awk '{print $1}'
done | LC_ALL=C sort -u > "$TMP_CLEAN"

echo
echo "== CARI KANDIDAT BACKTEST DI QUARANTINE =="

find "$Q" -type f -print0 |
while IFS= read -r -d '' F; do
  REL="${F#$Q/}"
  NAME="$(basename "$F")"
  KEEP=0

  case "$REL" in
    */pipeline/*|*/strategies/*|*/backtest/*|*/app/engines/*|*/app/services/backtest/*|*/app/services/backtests/*|*/scripts/backtest/*|*/scripts/backtests/*|*/scripts/gold/*|*/scripts/strategies/*|*/tests/backtest/*|*/tests/backtests/*|*/tests/engines/*|*/tests/strategies/*)
      KEEP=1
      ;;
  esac

  case "$NAME" in
    *backtest*.py|*backtest*.sh|*backtest*.yml|*backtest*.yaml|*strategy*.py|*gold*.py|*replay*.py|*parity*.py|*scanner*.py)
      KEEP=1
      ;;
  esac

  if [[ "$KEEP" -eq 1 ]]; then
    HASH="$(shasum -a 256 "$F" | awk '{print $1}')"
    printf '%s|%s\n' "$HASH" "$F"
  fi
done > "$TMP_CAND"

CAND_COUNT="$(wc -l < "$TMP_CAND" | tr -d ' ')"
echo "Kandidat backtest di quarantine: $CAND_COUNT"

echo
echo "== CARI FILE BACKTEST UNIK YANG BELUM ADA DI CLEAN =="

while IFS='|' read -r HASH FILE; do
  [[ -n "$HASH" ]] || continue
  if ! grep -qx "$HASH" "$TMP_CLEAN"; then
    printf '%s|%s\n' "$HASH" "$FILE"
  fi
done < "$TMP_CAND" > "$TMP_UNIQUE"

UNIQUE_COUNT="$(wc -l < "$TMP_UNIQUE" | tr -d ' ')"

{
  echo "GOLD1000 QUARANTINE RECHECK"
  echo "=============================================="
  echo "quarantine=$Q"
  echo "clean=$C"
  echo "candidate_backtest_files=$CAND_COUNT"
  echo "unique_backtest_candidates=$UNIQUE_COUNT"
  echo
  cat "$TMP_UNIQUE"
} > "$R"

echo
echo "======================================================"
echo " HASIL"
echo "======================================================"
echo "Kandidat backtest di quarantine      : $CAND_COUNT"
echo "Backtest unik hanya di quarantine    : $UNIQUE_COUNT"
echo "Laporan                              : $R"

if [[ "$UNIQUE_COUNT" -eq 0 ]]; then
  echo
  echo "PASS — tidak ada file backtest unik yang hilang."
  echo "Quarantine tidak diperlukan untuk sistem backtest."
  echo "AMAN UNTUK DIHAPUS jika backup campuran tidak diperlukan."
else
  echo
  echo "STOP — ditemukan kandidat backtest unik."
  echo "JANGAN HAPUS QUARANTINE."
  echo
  echo "30 file pertama:"
  cut -d'|' -f2- "$TMP_UNIQUE" | head -30
fi

echo "======================================================"
