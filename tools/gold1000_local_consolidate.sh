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

copy_tree_if_exists() {
  local src_root="$1"
  local rel="$2"
  local dest_root="$3"
  if [[ -d "$src_root/$rel" ]]; then
    mkdir -p "$dest_root/$rel"
    rsync -a       --exclude='.git/'       --exclude='node_modules/'       --exclude='.venv/'       --exclude='venv/'       --exclude='__pycache__/'       --exclude='.pytest_cache/'       --exclude='.mypy_cache/'       --exclude='.DS_Store'       --exclude='.env'       --exclude='.env.*'       --exclude='*.pem'       --exclude='*.key'       --exclude='*.parquet'       --exclude='*.csv'       --exclude='*.zip'       --exclude='*.7z'       --exclude='*.tar'       --exclude='*.gz'       --exclude='*.html'       --exclude='*.css'       --exclude='*.js'       --exclude='*.jsx'       --exclude='*.ts'       --exclude='*.tsx'       "$src_root/$rel/" "$dest_root/$rel/"
  fi
}

copy_file_if_exists() {
  local src_root="$1"
  local rel="$2"
  local dest_root="$3"
  if [[ -f "$src_root/$rel" ]]; then
    mkdir -p "$(dirname "$dest_root/$rel")"
    cp -p "$src_root/$rel" "$dest_root/$rel"
  fi
}

archive_backtest_only() {
  local src_root="$1"
  local dest_root="$2"

  # Core execution / research system only.
  for rel in     pipeline     strategies     backtest     app/engines     app/services/backtest     app/services/backtests     scripts/backtest     scripts/backtests     scripts/gold     scripts/strategies     tests/backtest     tests/backtests     tests/engines     tests/strategies
  do
    copy_tree_if_exists "$src_root" "$rel" "$dest_root"
  done

  # Known backtest API integration files only; no website/frontend.
  for rel in     app/api/routes/backtest.py     app/api/routes/historical_backtest.py     requirements.txt     requirements-dev.txt     pyproject.toml     poetry.lock     setup.py     setup.cfg     pytest.ini
  do
    copy_file_if_exists "$src_root" "$rel" "$dest_root"
  done

  # Catch standalone backtest-related code/config while explicitly excluding site/UI trees.
  while IFS= read -r -d '' f; do
    local rel="${f#$src_root/}"
    case "$rel" in
      frontend/*|web/*|website/*|site/*|public/*|static/*|templates/*|assets/*|node_modules/*)
        continue
        ;;
    esac
    mkdir -p "$(dirname "$dest_root/$rel")"
    cp -p "$f" "$dest_root/$rel"
  done < <(
    find "$src_root"       -type f       (         -iname '*backtest*.py' -o         -iname '*backtest*.sh' -o         -iname '*backtest*.yml' -o         -iname '*backtest*.yaml' -o         -iname '*strategy*.py' -o         -iname '*gold*.py' -o         -iname '*replay*.py' -o         -iname '*parity*.py' -o         -iname '*scanner*.py'       )       -not -path '*/node_modules/*'       -not -path '*/frontend/*'       -not -path '*/web/*'       -not -path '*/website/*'       -not -path '*/site/*'       -not -path '*/public/*'       -not -path '*/static/*'       -not -path '*/templates/*'       -not -path '*/assets/*'       -print0 2>/dev/null
  )

  printf '%s\n' "$src_root" > "$dest_root/ORIGINAL_SOURCE_PATH.txt"
}

if [[ -n "$LEGACY_SRC" ]]; then
  if [[ ! -d "$LEGACY_SRC" ]]; then
    echo "ERROR: legacy source tidak ditemukan: $LEGACY_SRC"
    exit 1
  fi

  TS="$(date +%Y%m%d_%H%M%S)"
  DEST="backtest/GOLD1000/_archive/local_legacy/$TS"
  mkdir -p "$DEST"

  echo "== Archive BACKTEST ONLY -> $DEST =="
  archive_backtest_only "$LEGACY_SRC" "$ROOT/$DEST"

  MANIFEST="backtest/GOLD1000/manifests/local_legacy_$TS.sha256"
  (
    cd "$DEST"
    find . -type f -print0 | sort -z | xargs -0 shasum -a 256
  ) > "$ROOT/$MANIFEST"

  FILES="$(find "$DEST" -type f | wc -l | tr -d ' ')"
  if [[ "$FILES" -lt 2 ]]; then
    echo "ERROR: hasil filter terlalu sedikit ($FILES file). Archive tidak dianggap valid."
    exit 2
  fi

  if find "$DEST" -type f       ( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' )       | grep -q .; then
    echo "ERROR: file site/UI terdeteksi di archive."
    exit 3
  fi

  {
    echo "timestamp=$TS"
    echo "source=$LEGACY_SRC"
    echo "destination=$DEST"
    echo "manifest=$MANIFEST"
    echo "scope=BACKTEST_ONLY"
    echo "site_ui_included=NO"
    echo "source_deleted=NO"
  } > "backtest/GOLD1000/manifests/local_legacy_$TS.meta"

  echo "PASS: backtest-only archive dibuat; site/UI tidak disalin."
fi

echo "== Canonical engine =="
test -f backtest/gold24/copytolive_unified_engine.py
shasum -a 256 backtest/gold24/copytolive_unified_engine.py

echo "== Git status =="
git status --short

echo
echo "PASS: GitHub local mirror synced; GOLD1000 hanya menyimpan sistem backtest."
