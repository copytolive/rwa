#!/usr/bin/env python3
from __future__ import annotations

import ast
import hashlib
import re
from pathlib import Path

Q = Path("/Users/Shared/WorkspaceBersama/COPYTOLIVE_GOLD1000_QUARANTINE_SITE/20260903_124917")
C = Path("/Users/Shared/WorkspaceBersama/COPYTOLIVE_GOLD1000/rwa/backtest/GOLD1000/_archive/local_legacy/20260903_124917")
REPORT = Path("/Users/Shared/WorkspaceBersama/COPYTOLIVE_GOLD1000/quarantine_pipeline_dependency_audit_20260903.txt")

MODULES = [
    "__init__",
    "auto_executor",
    "signal_tracker",
    "risk_management",
    "signal_scorer",
    "monitoring",
    "error_handling",
    "signal_streamer",
    "multi_account",
]

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def import_refs(py: Path):
    try:
        text = py.read_text(encoding="utf-8", errors="ignore")
        tree = ast.parse(text)
    except Exception:
        return set(), set()

    refs = set()
    raw_refs = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                name = alias.name
                if name == "app.pipeline":
                    refs.add("__init__")
                elif name.startswith("app.pipeline."):
                    refs.add(name.split(".")[-1])
        elif isinstance(node, ast.ImportFrom):
            mod = node.module or ""
            if mod == "app.pipeline":
                if not node.names:
                    refs.add("__init__")
                for alias in node.names:
                    if alias.name == "*":
                        refs.update(MODULES)
                    else:
                        refs.add(alias.name)
            elif mod.startswith("app.pipeline."):
                refs.add(mod.split(".")[-1])

    for mod in MODULES:
        if mod == "__init__":
            patterns = [r"['\"]app\.pipeline['\"]"]
        else:
            patterns = [
                rf"['\"]app\.pipeline\.{re.escape(mod)}['\"]",
                rf"\bapp\.pipeline\.{re.escape(mod)}\b",
            ]
        if any(re.search(p, text) for p in patterns):
            raw_refs.add(mod)
    return refs, raw_refs

def main():
    if not Q.is_dir():
        raise SystemExit(f"ERROR: quarantine tidak ditemukan: {Q}")
    if not C.is_dir():
        raise SystemExit(f"ERROR: clean archive tidak ditemukan: {C}")

    clean_py = list(C.rglob("*.py"))
    import_users = {m: [] for m in MODULES}
    raw_users = {m: [] for m in MODULES}

    for py in clean_py:
        refs, raw = import_refs(py)
        for m in refs:
            if m in import_users:
                import_users[m].append(py)
        for m in raw:
            if m in raw_users:
                raw_users[m].append(py)

    rows = []
    required = []
    for m in MODULES:
        name = "__init__.py" if m == "__init__" else f"{m}.py"
        p1 = Q / "source_001" / "app" / "pipeline" / name
        p2 = Q / "source_002" / "app" / "pipeline" / name
        e1, e2 = p1.exists(), p2.exists()
        h1 = sha256(p1) if e1 else "-"
        h2 = sha256(p2) if e2 else "-"
        same = e1 and e2 and h1 == h2
        refs = sorted(set(import_users[m]))
        raws = sorted(set(raw_users[m]))
        all_users = sorted(set(refs + raws))
        if all_users:
            required.append(m)
        rows.append((m, e1, e2, same, h1, h2, all_users))

    lines = []
    lines.append("GOLD1000 QUARANTINE PIPELINE DEPENDENCY AUDIT")
    lines.append("=" * 64)
    lines.append(f"quarantine={Q}")
    lines.append(f"clean={C}")
    lines.append(f"clean_python_files={len(clean_py)}")
    lines.append("")
    for m, e1, e2, same, h1, h2, users in rows:
        lines.append(f"[{m}]")
        lines.append(f"source_001_exists={e1}")
        lines.append(f"source_002_exists={e2}")
        lines.append(f"same_hash_between_sources={same}")
        lines.append(f"sha256_source_001={h1}")
        lines.append(f"sha256_source_002={h2}")
        lines.append(f"clean_reference_count={len(users)}")
        for u in users[:20]:
            lines.append(f"  ref={u}")
        lines.append("")

    lines.append("=" * 64)
    lines.append(f"modules_referenced_by_clean_backtest={len(required)}")
    if required:
        lines.append("classification=KEEP_QUARANTINE_OR_COPY_REQUIRED_MODULES")
        lines.append("required_modules=" + ",".join(required))
    else:
        lines.append("classification=RUNTIME_PIPELINE_NOT_REFERENCED_BY_CLEAN_BACKTEST")
        lines.append("required_modules=")
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print("=" * 64)
    print("GOLD1000 — PIPELINE DEPENDENCY AUDIT")
    print("=" * 64)
    print(f"Clean Python files scanned : {len(clean_py)}")
    print(f"Pipeline modules checked   : {len(MODULES)} x 2 sources")
    print(f"Referenced by clean        : {len(required)}")
    print(f"Report                     : {REPORT}")
    print()
    for m, _, _, same, _, _, users in rows:
        print(f"{m:18} same_sources={str(same):5} clean_refs={len(users)}")
    print()
    if required:
        print("STOP — ada app/pipeline yang dipakai oleh clean backtest.")
        print("JANGAN HAPUS quarantine.")
        print("Required:", ", ".join(required))
    else:
        print("PASS — 18 file app/pipeline tidak direferensikan oleh clean backtest.")
        print("Mereka kandidat runtime/live-execution, bukan dependency backtest aktif.")
        print("Quarantine boleh dihapus untuk workspace backtest-only.")
    print("=" * 64)

if __name__ == "__main__":
    main()
