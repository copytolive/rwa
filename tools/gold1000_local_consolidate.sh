#!/usr/bin/env bash
set -euo pipefail

REPO_EXPECTED="copytolive/rwa"
LEGACY_SRC="${1:-}"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"

if [[ -z "$ROOT" ]]; then
  echo "ERROR: jalankan script ini dari clone GitHub copytolive/rwa"
  exit 1
fi

cd "$ROOT"

REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
if [[ "$REMOTE_URL" != *"copytolive/rwa"* ]]; then
  echo "ERROR: origin bukan repo $REPO_EXPECTED"
  echo "origin=$REMOTE_URL"
  exit 1
fi

echo "== Sync GitHub -> local =="
git fetch --all --prune
git checkout main
git pull --ff-only origin main

mkdir -p backtest/GOLD1000/active
mkdir -p backtest/GOLD1000/manifests
mkdir -p backtest/GOLD1000/_archive/local_legacy
mkdir -p backtest/GOLD1000/_archive/github_legacy

if [[ -n "$LEGACY_SRC" ]]; then
  if [[ ! -d "$LEGACY_SRC" ]]; then
    echo "ERROR: legacy source tidak ditemukan: $LEGACY_SRC"
    exit 1
  fi

  TS="$(date +%Y%m%d_%H%M%S)"
  DEST="backtest/GOLD1000/_archive/local_legacy/$TS"
  mkdir -p "$DEST"

  echo "== Archive local legacy -> $DEST =="
  rsync -a     --exclude='.git/'     --exclude='node_modules/'     --exclude='.venv/'     --exclude='venv/'     --exclude='__pycache__/'     --exclude='.DS_Store'     --exclude='*.parquet'     --exclude='*.csv'     --exclude='*.zip'     --exclude='*.7z'     --exclude='*.tar'     --exclude='*.gz'     "$LEGACY_SRC/" "$DEST/"

  MANIFEST="backtest/GOLD1000/manifests/local_legacy_$TS.sha256"
  (
    cd "$DEST"
    find . -type f -print0 | sort -z | xargs -0 shasum -a 256
  ) > "$ROOT/$MANIFEST"

  {
    echo "timestamp=$TS"
    echo "source=$LEGACY_SRC"
    echo "destination=$DEST"
    echo "manifest=$MANIFEST"
  } > "backtest/GOLD1000/manifests/local_legacy_$TS.meta"

  echo "Archive copied. Source TIDAK dihapus."
fi

echo "== Canonical engine =="
test -f backtest/gold24/copytolive_unified_engine.py
shasum -a 256 backtest/gold24/copytolive_unified_engine.py

echo "== Git status =="
git status --short

echo
echo "PASS: GitHub local mirror synced; consolidation workspace ready."
echo "Jika legacy source diberikan, file lama sudah disalin ke _archive/local_legacy dengan SHA256 manifest."
