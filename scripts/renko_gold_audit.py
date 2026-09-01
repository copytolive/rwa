#!/usr/bin/env python3
"""Audit canonical GOLD monthly fixed-1s packs and build lightweight manifests."""
from __future__ import annotations

import argparse
import datetime as dt
import gzip
import hashlib
import json
import pathlib
from typing import Iterable

UTC = dt.timezone.utc
ORIGIN = dt.datetime(2003, 5, 5, tzinfo=UTC)
ORIGIN_WITNESS_SECOND = 1052092863
HEADER = "unix_second,open_tick,high_tick,low_tick,close_tick"


def sha256_file(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def audit_month(path: pathlib.Path, meta: dict) -> dict:
    actual_sha = sha256_file(path)
    if actual_sha != meta.get("assetSha256"):
        raise RuntimeError(f"SHA mismatch {path.name}: {actual_sha} != {meta.get('assetSha256')}")
    if path.stat().st_size != int(meta.get("bytes", -1)):
        raise RuntimeError(f"byte-size mismatch {path.name}")
    count = 0
    first = last = prev = None
    with gzip.open(path, "rt", encoding="utf-8", newline="") as f:
        header = f.readline().rstrip("\r\n")
        if header != HEADER:
            raise RuntimeError(f"bad header {path.name}: {header}")
        for line_no, raw in enumerate(f, start=2):
            row = raw.rstrip("\r\n").split(",")
            if len(row) != 5:
                raise RuntimeError(f"bad column count {path.name}:{line_no}")
            try:
                sec, o, h, l, c = map(int, row)
            except Exception as e:
                raise RuntimeError(f"non-integer row {path.name}:{line_no}") from e
            if prev is not None and sec <= prev:
                kind = "duplicate" if sec == prev else "non-monotonic"
                raise RuntimeError(f"{kind} second {sec} in {path.name}:{line_no}")
            if l > h or not (l <= o <= h) or not (l <= c <= h):
                raise RuntimeError(f"invalid OHLC {path.name}:{line_no}")
            if first is None:
                first = sec
            last = prev = sec
            count += 1
    if count != int(meta.get("barCount", -1)):
        raise RuntimeError(f"barCount mismatch {path.name}: {count} != {meta.get('barCount')}")
    if first != int(meta.get("earliestSecond", -1)) or last != int(meta.get("latestSecond", -1)):
        raise RuntimeError(f"coverage endpoint mismatch {path.name}")
    return {
        "asset": path.name,
        "assetSha256": actual_sha,
        "bytes": path.stat().st_size,
        "barCount": count,
        "earliestSecond": first,
        "latestSecond": last,
        "duplicates": 0,
        "conflicts": 0,
        "ohlcErrors": 0,
        "pass": True,
    }


def audit_source_status(meta: dict) -> bool:
    """Require raw source observations to reconcile with explicit classifications."""
    raw_not_found = int(meta.get("notFoundHours", 0))
    raw_empty = int(meta.get("emptySourceHours", 0))
    closed_nf = int(meta.get("marketClosedNotFoundHours", 0))
    closed_empty = int(meta.get("marketClosedEmptyHours", 0))
    unavailable = int(meta.get("sourceUnavailableHours", raw_not_found))
    provider_empty = int(meta.get("providerEmptyHours", 0))
    market_closed = int(meta.get("marketClosedHours", closed_nf + closed_empty))
    return (
        raw_not_found == closed_nf + unavailable
        and raw_empty == closed_empty + provider_empty
        and market_closed == closed_nf + closed_empty
        and bool(meta.get("sourceStatusAccountingPass", False))
    )


def audit_year(summary_path: pathlib.Path, data_dir: pathlib.Path, output: pathlib.Path, write_summary: bool) -> dict:
    summary = json.loads(summary_path.read_text())
    if summary.get("provider") != "Dukascopy" or summary.get("instrumentCode") != "XAU-USD" or summary.get("interval") != "1s":
        raise RuntimeError("year summary identity invalid")
    audits = []
    prev_last = None
    for m in sorted(summary.get("months", []), key=lambda x: (int(x["year"]), int(x["month"]))):
        if not audit_source_status(m):
            raise RuntimeError(f"source-hour accounting invalid {m.get('year')}-{m.get('month')}")
        p = data_dir / m["asset"]
        if not p.exists():
            raise RuntimeError(f"missing monthly asset {p}")
        a = audit_month(p, m)
        if prev_last is not None and int(a["earliestSecond"]) <= prev_last:
            raise RuntimeError(f"monthly overlap/conflict before {p.name}")
        prev_last = int(a["latestSecond"])
        audits.append(a)
        m["auditPass"] = True
        m["sourceStatusAccountingPass"] = True
    result = {
        "schema": "renko-gold-year-audit-v2",
        "year": summary["year"],
        "provider": "Dukascopy",
        "instrumentCode": "XAU-USD",
        "interval": "1s",
        "priceSide": summary["priceSide"],
        "tickSize": summary["tickSize"],
        "months": audits,
        "barCount": sum(x["barCount"] for x in audits),
        "bytes": sum(x["bytes"] for x in audits),
        "duplicates": 0,
        "conflicts": 0,
        "sourceStatusAccountingPass": True,
        "pass": True,
    }
    summary["audit"] = {
        "schema": result["schema"],
        "pass": True,
        "duplicates": 0,
        "conflicts": 0,
        "sourceStatusAccountingPass": True,
    }
    if write_summary:
        summary_path.write_text(json.dumps(summary, indent=2) + "\n")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n")
    print("RENKO_GOLD_YEAR_AUDIT_PASS", json.dumps({k:v for k,v in result.items() if k != "months"}, separators=(",", ":")), flush=True)
    return result


def expected_months(start: dt.datetime, cutoff: dt.datetime) -> list[str]:
    y, m = start.year, start.month
    out = []
    while (y, m) <= (cutoff.year, cutoff.month):
        out.append(f"{y:04d}-{m:02d}")
        if m == 12:
            y, m = y + 1, 1
        else:
            m += 1
    return out


def build_manifest(summary_paths: Iterable[pathlib.Path], cutoff: dt.datetime, output_dir: pathlib.Path):
    summaries = [json.loads(p.read_text()) for p in summary_paths]
    summaries.sort(key=lambda x: int(x["year"]))
    if not summaries:
        raise RuntimeError("no year summaries")
    sides = {x.get("priceSide") for x in summaries}
    ticks = {float(x.get("tickSize")) for x in summaries}
    if sides != {"bid"}:
        raise RuntimeError(f"price-side not locked to calibrated bid: {sides}")
    if ticks != {0.001}:
        raise RuntimeError(f"tick-size mismatch: {ticks}")

    months = []
    for y in summaries:
        if not y.get("audit", {}).get("pass"):
            raise RuntimeError(f"year {y.get('year')} missing PASS audit")
        if not y.get("audit", {}).get("sourceStatusAccountingPass"):
            raise RuntimeError(f"year {y.get('year')} missing source-hour accounting PASS")
        for m in y.get("months", []):
            if not m.get("auditPass"):
                raise RuntimeError(f"month {m.get('year')}-{m.get('month')} missing PASS audit")
            if not audit_source_status(m):
                raise RuntimeError(f"month {m.get('year')}-{m.get('month')} source-hour accounting invalid")
            if not m.get("assetUrl") or not m.get("dataCommitSha"):
                raise RuntimeError(f"month {m.get('year')}-{m.get('month')} missing immutable storage identity")
            months.append(m)
    months.sort(key=lambda x: (int(x["year"]), int(x["month"])))

    actual_keys = [f"{int(m['year']):04d}-{int(m['month']):02d}" for m in months]
    expected_keys = expected_months(ORIGIN, cutoff)
    missing = [x for x in expected_keys if x not in set(actual_keys)]
    extra = [x for x in actual_keys if x not in set(expected_keys)]
    if len(actual_keys) != len(set(actual_keys)):
        raise RuntimeError("duplicate monthly metadata")

    prev_last = None
    overlaps = []
    for m in months:
        first, last = int(m["earliestSecond"]), int(m["latestSecond"])
        if prev_last is not None and first <= prev_last:
            overlaps.append({"month": f"{int(m['year']):04d}-{int(m['month']):02d}", "previousLatestSecond": prev_last, "earliestSecond": first})
        prev_last = last

    unavailable = sum(int(m.get("sourceUnavailableHours", m.get("notFoundHours", 0))) for m in months)
    provider_empty = sum(int(m.get("providerEmptyHours", 0)) for m in months)
    market_closed = sum(int(m.get("marketClosedHours", 0)) for m in months)
    market_closed_empty = sum(int(m.get("marketClosedEmptyHours", 0)) for m in months)
    market_closed_not_found = sum(int(m.get("marketClosedNotFoundHours", 0)) for m in months)
    raw_not_found = sum(int(m.get("notFoundHours", 0)) for m in months)
    raw_empty = sum(int(m.get("emptySourceHours", 0)) for m in months)
    source_hours = sum(int(m.get("sourceHours", 0)) for m in months)
    first_second = int(months[0]["earliestSecond"]) if months else None
    last_second = int(months[-1]["latestSecond"]) if months else None
    origin_ok = first_second is not None and int(ORIGIN.timestamp()) <= first_second <= ORIGIN_WITNESS_SECOND + 1
    all_audited = all(bool(m.get("auditPass")) for m in months)
    source_status_accounting = all(audit_source_status(m) for m in months)
    backfill_complete = bool(
        not missing
        and not extra
        and not overlaps
        and unavailable == 0
        and origin_ok
        and all_audited
        and source_status_accounting
    )

    manifest_months = []
    for m in months:
        manifest_months.append({
            "year": int(m["year"]),
            "month": int(m["month"]),
            "asset": m["asset"],
            "assetUrl": m["assetUrl"],
            "storage": m.get("storage", "git-lfs-media"),
            "dataCommitSha": m["dataCommitSha"],
            "format": "csv.gz",
            "barCount": int(m["barCount"]),
            "earliestSecond": int(m["earliestSecond"]),
            "latestSecond": int(m["latestSecond"]),
            "sourceHours": int(m["sourceHours"]),
            "emptySourceHours": int(m["emptySourceHours"]),
            "notFoundHours": int(m.get("notFoundHours", 0)),
            "marketClosedHours": int(m.get("marketClosedHours", 0)),
            "marketClosedEmptyHours": int(m.get("marketClosedEmptyHours", 0)),
            "marketClosedNotFoundHours": int(m.get("marketClosedNotFoundHours", 0)),
            "providerEmptyHours": int(m.get("providerEmptyHours", 0)),
            "sourceUnavailableHours": int(m.get("sourceUnavailableHours", m.get("notFoundHours", 0))),
            "sourceStatusAccountingPass": True,
            "tickSize": float(m["tickSize"]),
            "priceSide": m["priceSide"],
            "sourceDigestSha256": m["sourceDigestSha256"],
            "assetSha256": m["assetSha256"],
            "bytes": int(m["bytes"]),
            "auditPass": True,
            "marketClosedHourRanges": m.get("marketClosedHourRanges", []),
            "marketClosedEmptyHourRanges": m.get("marketClosedEmptyHourRanges", []),
            "marketClosedNotFoundHourRanges": m.get("marketClosedNotFoundHourRanges", []),
            "providerEmptyHourRanges": m.get("providerEmptyHourRanges", []),
            "sourceUnavailableHourRanges": m.get("sourceUnavailableHourRanges", []),
        })

    version_hash = hashlib.sha256(
        json.dumps(
            [{k:m[k] for k in ("year", "month", "assetSha256", "sourceDigestSha256", "dataCommitSha")} for m in manifest_months],
            separators=(",", ":"),
            sort_keys=True,
        ).encode()
    ).hexdigest()
    generated = dt.datetime.now(UTC).isoformat().replace("+00:00", "Z")
    manifest = {
        "schema": "renko-gold-s1-full-manifest-v1",
        "dataVersion": f"dukascopy-xauusd-s1-{version_hash[:16]}",
        "versionSha256": version_hash,
        "generatedAt": generated,
        "provider": "Dukascopy",
        "instrumentCode": "XAU-USD",
        "symbol": "XAUUSD",
        "interval": "1s",
        "priceEncoding": "integer-ticks",
        "tickSize": 0.001,
        "priceSide": "bid",
        "origin": ORIGIN.isoformat().replace("+00:00", "Z"),
        "documentedEarliestWitnessSecond": ORIGIN_WITNESS_SECOND,
        "cutoff": cutoff.isoformat().replace("+00:00", "Z"),
        "chunkUnit": "calendar-month",
        "storage": "Git LFS objects served by media.githubusercontent.com; Git branches contain pointer blobs only",
        "backfillComplete": backfill_complete,
        "months": manifest_months,
    }
    coverage = {
        "schema": "renko-gold-s1-coverage-v2",
        "generatedAt": generated,
        "dataVersion": manifest["dataVersion"],
        "provider": "Dukascopy",
        "instrumentCode": "XAU-USD",
        "interval": "1s",
        "priceSide": "bid",
        "tickSize": 0.001,
        "origin": manifest["origin"],
        "cutoff": manifest["cutoff"],
        "expectedMonths": len(expected_keys),
        "publishedMonths": len(actual_keys),
        "missingMonths": missing,
        "extraMonths": extra,
        "overlaps": overlaps,
        "barCount": sum(int(m["barCount"]) for m in months),
        "compressedBytes": sum(int(m["bytes"]) for m in months),
        "sourceHours": source_hours,
        "emptySourceHours": raw_empty,
        "notFoundHours": raw_not_found,
        "marketClosedHours": market_closed,
        "marketClosedEmptyHours": market_closed_empty,
        "marketClosedNotFoundHours": market_closed_not_found,
        "providerEmptyHours": provider_empty,
        "sourceUnavailableHours": unavailable,
        "sourceStatusAccountingPass": source_status_accounting,
        "earliestSecond": first_second,
        "latestSecond": last_second,
        "originWitnessSatisfied": origin_ok,
        "duplicateSeconds": 0,
        "conflictingOHLC": 0,
        "allMonthlyAuditsPass": all_audited,
        "backfillComplete": backfill_complete,
    }
    checksums = {
        "schema": "renko-gold-s1-checksums-v1",
        "dataVersion": manifest["dataVersion"],
        "assets": [
            {
                "year":m["year"], "month":m["month"], "asset":m["asset"],
                "bytes":m["bytes"], "barCount":m["barCount"],
                "assetSha256":m["assetSha256"], "sourceDigestSha256":m["sourceDigestSha256"]
            }
            for m in manifest_months
        ],
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "full-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (output_dir / "coverage.json").write_text(json.dumps(coverage, indent=2) + "\n")
    (output_dir / "checksums.json").write_text(json.dumps(checksums, indent=2) + "\n")
    (output_dir / "checksums.sha256").write_text("".join(f"{m['assetSha256']}  {m['asset']}\n" for m in manifest_months))
    print("RENKO_GOLD_TOTAL_MANIFEST_PASS", json.dumps(coverage, separators=(",", ":")), flush=True)
    return manifest, coverage


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    ay = sub.add_parser("audit-year")
    ay.add_argument("--summary", required=True)
    ay.add_argument("--data-dir", required=True)
    ay.add_argument("--output", required=True)
    ay.add_argument("--write-summary", action="store_true")
    bm = sub.add_parser("build-manifest")
    bm.add_argument("--summaries-dir", required=True)
    bm.add_argument("--cutoff", required=True)
    bm.add_argument("--output-dir", required=True)
    a = p.parse_args()
    if a.cmd == "audit-year":
        audit_year(pathlib.Path(a.summary), pathlib.Path(a.data_dir), pathlib.Path(a.output), a.write_summary)
    else:
        cutoff = dt.datetime.fromisoformat(a.cutoff.replace("Z", "+00:00"))
        if cutoff.tzinfo is None:
            cutoff = cutoff.replace(tzinfo=UTC)
        paths = sorted(pathlib.Path(a.summaries_dir).glob("summary-*.json"))
        build_manifest(paths, cutoff.astimezone(UTC), pathlib.Path(a.output_dir))


if __name__ == "__main__":
    main()
