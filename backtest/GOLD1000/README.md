# CopyToLive GOLD1000 consolidation

Goal: one repository, one canonical backtest engine, one predictable place for active files, and a preserved archive for legacy/local material.

## Active source of truth

The canonical execution engine remains:

- `backtest/gold24/copytolive_unified_engine.py`

Until migration is fully verified, do not duplicate or fork execution semantics under GOLD1000. Active GOLD1000 scanners, strategy adapters, certification, and tests must import that canonical engine.

## Consolidation layout

```
backtest/GOLD1000/
├── README.md
├── active/                  # new GOLD1000-facing entrypoints/adapters only
├── manifests/               # inventories, hashes, provenance
└── _archive/
    ├── local_legacy/        # imported historical/local code, read-only
    └── github_legacy/       # GitHub legacy files after verified migration
```

Heavy market datasets should not be committed to GitHub. Keep them in one local/runtime data root and record their path/hash in manifests.

## Rules

1. GitHub `copytolive/rwa` is the single source of truth for executable backtest code.
2. Mac/local is a checked-out mirror/bridge, not an independent engine.
3. CopyToLive VPS runs the same canonical engine bytes.
4. Google Drive stores results/evidence, not execution logic.
5. Legacy files are archived before deletion or migration.
6. No legacy file is removed until inventory + SHA256 + import test are recorded.
7. Duplicate execution logic is not allowed after consolidation.

## Local synchronization

Run:

```bash
bash tools/gold1000_local_consolidate.sh [OPTIONAL_LEGACY_SOURCE_DIR]
```

The script updates the local GitHub checkout and, when a legacy source directory is supplied, copies its code/config/docs into a timestamped archive inside this repository and writes a SHA256 inventory. It does not delete the source directory.
