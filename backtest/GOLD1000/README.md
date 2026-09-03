# CopyToLive GOLD1000 consolidation

Goal: one repository, one canonical backtest engine, one predictable place for active files, and a preserved archive for legacy/local backtest material only.

## Active source of truth

The canonical execution engine remains:

- `backtest/gold24/copytolive_unified_engine.py`

Until migration is fully verified, do not duplicate or fork execution semantics under GOLD1000. Active GOLD1000 scanners, strategy adapters, certification, and tests must import that canonical engine.

## Consolidation layout

```
backtest/GOLD1000/
├── README.md
├── active/                  # active GOLD1000 backtest code only
├── manifests/               # inventories, hashes, provenance
└── _archive/
    ├── local_legacy/        # local legacy BACKTEST system only
    └── github_legacy/       # GitHub legacy BACKTEST files only
```

Heavy market datasets should not be committed to GitHub. Keep them in one local/runtime data root and record their path/hash in manifests.

## Scope rule: backtest only

GOLD1000 stores only the backtest system: engine, pipeline, strategies, scanners/replay/parity logic, backtest tests, and directly related backend integration files.

Do **not** store website/UI code in GOLD1000. Frontend/web/site/public/static/templates/assets and HTML/CSS/JS/TS/TSX/JSX are excluded from local legacy archive imports.

## Rules

1. GitHub `copytolive/rwa` is the single source of truth for executable backtest code.
2. Mac/local is a checked-out mirror/bridge, not an independent engine.
3. CopyToLive VPS runs the same canonical engine bytes.
4. Google Drive stores results/evidence, not execution logic.
5. GOLD1000 archive scope is BACKTEST_ONLY; website/UI is excluded.
6. Heavy datasets and credentials are never copied into the Git archive.
7. Legacy backtest files are archived before deletion or migration.
8. No legacy file is removed until inventory + SHA256 + import test are recorded.
9. Duplicate execution logic is not allowed after consolidation.

## Local synchronization

Run:

```bash
bash tools/gold1000_local_consolidate.sh [OPTIONAL_TRADING_SERVICE_DIR]
```

The script updates the local GitHub checkout and, when a local source is supplied, copies only backtest-related code/config into a timestamped archive and writes a SHA256 inventory.

For the already-created broad local snapshot, run:

```bash
bash tools/gold1000_filter_existing_archive.sh
```

That command replaces the in-repo broad snapshot with a validated backtest-only copy and moves the former broad snapshot outside the repository into a quarantine folder for safety.
