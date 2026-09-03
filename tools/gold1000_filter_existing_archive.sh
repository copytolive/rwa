#!/usr/bin/env bash
set -euo pipefail

REPO="/Users/Shared/WorkspaceBersama/COPYTOLIVE_GOLD1000/rwa"
ARCHIVE_BASE="$REPO/backtest/GOLD1000/_archive/local_legacy"
MANIFEST_DIR="$REPO/backtest/GOLD1000/manifests"
QUARANTINE_BASE="/Users/Shared/WorkspaceBersama/COPYTOLIVE_GOLD1000_QUARANTINE_SITE"

test -d "$REPO/.git" || { echo "ERROR: repo lokal tidak ditemukan: $REPO"; exit 1; }
test -d "$ARCHIVE_BASE" || { echo "ERROR: archive lokal tidak ditemukan"; exit 1; }

SOURCE_ARCHIVE="${1:-}"
if [[ -z "$SOURCE_ARCHIVE" ]]; then
  SOURCE_ARCHIVE="$(find "$ARCHIVE_BASE" -mindepth 1 -maxdepth 1 -type d | LC_ALL=C sort | tail -1)"
fi

test -n "$SOURCE_ARCHIVE" || { echo "ERROR: tidak ada archive sumber"; exit 1; }
test -d "$SOURCE_ARCHIVE" || { echo "ERROR: archive sumber tidak ditemukan: $SOURCE_ARCHIVE"; exit 1; }

TS="$(basename "$SOURCE_ARCHIVE")"
TMP="$ARCHIVE_BASE/.backtest_only_$TS"
QUARANTINE="$QUARANTINE_BASE/$TS"
MANIFEST="$MANIFEST_DIR/local_legacy_${TS}.sha256"
META="$MANIFEST_DIR/local_legacy_${TS}.meta"

rm -rf "$TMP"
mkdir -p "$TMP"
mkdir -p "$QUARANTINE_BASE"

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

extract_source() {
  local src_root="$1"
  local dest_root="$2"

  for rel in     pipeline     strategies     backtest     app/engines     app/services/backtest     app/services/backtests     scripts/backtest     scripts/backtests     scripts/gold     scripts/strategies     tests/backtest     tests/backtests     tests/engines     tests/strategies
  do
    copy_tree_if_exists "$src_root" "$rel" "$dest_root"
  done

  for rel in     app/api/routes/backtest.py     app/api/routes/historical_backtest.py     requirements.txt     requirements-dev.txt     pyproject.toml     poetry.lock     setup.py     setup.cfg     pytest.ini     ORIGINAL_SOURCE_PATH.txt
  do
    copy_file_if_exists "$src_root" "$rel" "$dest_root"
  done

  while IFS= read -r -d '' f; do
    rel="${f#$src_root/}"
    case "$rel" in
      frontend/*|web/*|website/*|site/*|public/*|static/*|templates/*|assets/*|node_modules/*)
        continue
        ;;
    esac
    mkdir -p "$(dirname "$dest_root/$rel")"
    cp -p "$f" "$dest_root/$rel"
  done < <(
    find "$src_root"       -type f       (         -iname '*backtest*.py' -o         -iname '*backtest*.sh' -o         -iname '*backtest*.yml' -o         -iname '*backtest*.yaml' -o         -iname '*strategy*.py' -o         -iname '*gold*.py' -o         -iname '*replay*.py' -o         -iname '*parity*.py' -o         -iname '*scanner*.py'       )       -not -path '*/frontend/*'       -not -path '*/web/*'       -not -path '*/website/*'       -not -path '*/site/*'       -not -path '*/public/*'       -not -path '*/static/*'       -not -path '*/templates/*'       -not -path '*/assets/*'       -not -path '*/node_modules/*'       -print0 2>/dev/null
  )
}

echo "======================================================"
echo " GOLD1000 — FILTER EXISTING ARCHIVE TO BACKTEST ONLY"
echo "======================================================"
echo "Source archive : $SOURCE_ARCHIVE"

N=0
while IFS= read -r SRC; do
  N=$((N+1))
  NAME="$(basename "$SRC")"
  DEST="$TMP/$NAME"
  mkdir -p "$DEST"
  echo "Filter $NAME ..."
  extract_source "$SRC" "$DEST"
done < <(find "$SOURCE_ARCHIVE" -mindepth 1 -maxdepth 1 -type d -name 'source_*' | LC_ALL=C sort)

if [[ "$N" -eq 0 ]]; then
  echo "ERROR: tidak ada source_* dalam archive."
  rm -rf "$TMP"
  exit 2
fi

FILES="$(find "$TMP" -type f | wc -l | tr -d ' ')"
PYFILES="$(find "$TMP" -type f -name '*.py' | wc -l | tr -d ' ')"

if [[ "$FILES" -lt 2 || "$PYFILES" -lt 1 ]]; then
  echo "ERROR: hasil filter tidak valid. files=$FILES py=$PYFILES"
  rm -rf "$TMP"
  exit 3
fi

BAD_SITE="$(find "$TMP" -type f   ( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' )   -print)"

if [[ -n "$BAD_SITE" ]]; then
  echo "ERROR: site/UI masih ditemukan:"
  echo "$BAD_SITE"
  rm -rf "$TMP"
  exit 4
fi

(
  cd "$TMP"
  find . -type f -print0 | sort -z | xargs -0 shasum -a 256
) > "$MANIFEST.tmp"

echo
echo "Validation:"
echo "sources=$N"
echo "files=$FILES"
echo "python_files=$PYFILES"
echo "site_ui_files=0"

# Only after the filtered copy passes all validation:
rm -rf "$QUARANTINE"
mv "$SOURCE_ARCHIVE" "$QUARANTINE"
mv "$TMP" "$SOURCE_ARCHIVE"
mv "$MANIFEST.tmp" "$MANIFEST"

{
  echo "timestamp=$TS"
  echo "scope=BACKTEST_ONLY"
  echo "site_ui_included=NO"
  echo "filtered_archive=$SOURCE_ARCHIVE"
  echo "broad_snapshot_quarantined=$QUARANTINE"
  echo "manifest=$MANIFEST"
} > "$META"

echo
echo "======================================================"
echo " PASS — BACKTEST ONLY"
echo "======================================================"
echo "Repo archive   : $SOURCE_ARCHIVE"
echo "Files kept     : $FILES"
echo "Python files   : $PYFILES"
echo "Site/UI files  : 0"
echo "Old broad copy : $QUARANTINE"
echo "Manifest       : $MANIFEST"
echo "======================================================"
