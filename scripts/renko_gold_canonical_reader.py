#!/usr/bin/env python3
"""Streaming reader for the canonical Dukascopy XAU-USD fixed-1s monthly store.

The reader is deliberately manifest-driven: chart and backtest address the same
immutable monthly gzip assets and verify the same SHA256 values. Monthly files
are never expanded to a full in-memory table. The optional WilderATRState keeps
rolling context across month/year boundaries without resetting at chunks.
"""
from __future__ import annotations

import argparse
import contextlib
import csv
import dataclasses
import datetime as dt
import gzip
import hashlib
import io
import json
import os
import pathlib
import tempfile
import urllib.request
from typing import Iterable, Iterator

UTC = dt.timezone.utc
HEADER = ["unix_second", "open_tick", "high_tick", "low_tick", "close_tick"]


@dataclasses.dataclass(frozen=True, slots=True)
class Bar:
    unix_second: int
    open_tick: int
    high_tick: int
    low_tick: int
    close_tick: int


class WilderATRState:
    """Ordinary Wilder ATR over canonical fixed-1s OHLC, continuous across files."""
    __slots__ = ("length", "prev_close", "atr", "warm", "count")

    def __init__(self, length: int = 14):
        self.length = max(1, int(length))
        self.prev_close: int | None = None
        self.atr: float | None = None
        self.warm: list[float] = []
        self.count = 0

    def update(self, bar: Bar) -> float | None:
        h, l = bar.high_tick, bar.low_tick
        if self.prev_close is None:
            tr = float(h - l)
        else:
            tr = float(max(h - l, abs(h - self.prev_close), abs(l - self.prev_close)))
        self.prev_close = bar.close_tick
        self.count += 1
        if self.atr is None:
            self.warm.append(tr)
            if len(self.warm) == self.length:
                self.atr = sum(self.warm) / self.length
                self.warm.clear()
        else:
            self.atr = ((self.atr * (self.length - 1)) + tr) / self.length
        return self.atr


class CanonicalGoldReader:
    def __init__(self, manifest: dict, cache_dir: pathlib.Path | None = None):
        self.manifest = manifest
        self._validate_manifest_identity()
        self.cache_dir = cache_dir
        if cache_dir:
            cache_dir.mkdir(parents=True, exist_ok=True)
        self.months = sorted(manifest.get("months", []), key=lambda m: (int(m["year"]), int(m["month"])))

    @classmethod
    def from_path_or_url(cls, source: str, cache_dir: pathlib.Path | None = None):
        if source.startswith(("https://", "http://")):
            with urllib.request.urlopen(source, timeout=60) as r:
                manifest = json.load(r)
        else:
            manifest = json.loads(pathlib.Path(source).read_text())
        return cls(manifest, cache_dir)

    def _validate_manifest_identity(self):
        m = self.manifest
        if m.get("provider") != "Dukascopy" or m.get("instrumentCode") != "XAU-USD":
            raise ValueError("manifest is not canonical Dukascopy XAU-USD")
        if m.get("interval") != "1s":
            raise ValueError("manifest interval must remain fixed 1s")
        if float(m.get("tickSize", 0)) != 0.001:
            raise ValueError("unexpected canonical tickSize")
        if m.get("priceSide") != "bid":
            raise ValueError("manifest priceSide differs from locked calibration")

    def reproducibility_identity(self) -> dict:
        return {
            "schema": self.manifest.get("schema"),
            "dataVersion": self.manifest.get("dataVersion"),
            "versionSha256": self.manifest.get("versionSha256"),
            "provider": self.manifest["provider"],
            "instrumentCode": self.manifest["instrumentCode"],
            "interval": self.manifest["interval"],
            "priceSide": self.manifest["priceSide"],
            "tickSize": self.manifest["tickSize"],
            "assets": [
                {
                    "year": int(m["year"]),
                    "month": int(m["month"]),
                    "asset": m["asset"],
                    "assetSha256": m["assetSha256"],
                    "sourceDigestSha256": m.get("sourceDigestSha256"),
                    "dataCommitSha": m.get("dataCommitSha"),
                }
                for m in self.months
            ],
        }

    def _selected_months(self, start_second: int | None, end_second: int | None):
        for m in self.months:
            first = int(m["earliestSecond"])
            last = int(m["latestSecond"])
            if end_second is not None and first > end_second:
                break
            if start_second is not None and last < start_second:
                continue
            yield m

    def _download_verified(self, meta: dict) -> pathlib.Path:
        expected = str(meta["assetSha256"])
        target = self.cache_dir / meta["asset"] if self.cache_dir else None
        if target and target.exists() and self._sha256(target) == expected:
            return target
        fd, temp_name = tempfile.mkstemp(prefix="renko-gold-", suffix=".csv.gz", dir=str(self.cache_dir) if self.cache_dir else None)
        os.close(fd)
        temp = pathlib.Path(temp_name)
        h = hashlib.sha256()
        total = 0
        try:
            req = urllib.request.Request(meta["assetUrl"], headers={"User-Agent": "copytolive-renko-canonical-reader/1"})
            with urllib.request.urlopen(req, timeout=120) as r, temp.open("wb") as out:
                while True:
                    block = r.read(1024 * 1024)
                    if not block:
                        break
                    h.update(block)
                    total += len(block)
                    out.write(block)
            if h.hexdigest() != expected:
                raise RuntimeError(f"asset SHA256 mismatch for {meta['asset']}")
            if "bytes" in meta and total != int(meta["bytes"]):
                raise RuntimeError(f"asset byte size mismatch for {meta['asset']}")
            if target:
                os.replace(temp, target)
                return target
            return temp
        except Exception:
            temp.unlink(missing_ok=True)
            raise

    @staticmethod
    def _sha256(path: pathlib.Path) -> str:
        h = hashlib.sha256()
        with path.open("rb") as f:
            for block in iter(lambda: f.read(1024 * 1024), b""):
                h.update(block)
        return h.hexdigest()

    def iter_bars(self, start_second: int | None = None, end_second: int | None = None) -> Iterator[Bar]:
        previous_second: int | None = None
        for meta in self._selected_months(start_second, end_second):
            path = self._download_verified(meta)
            delete_after = self.cache_dir is None
            count = 0
            first = last = None
            try:
                with gzip.open(path, "rt", encoding="utf-8", newline="") as f:
                    reader = csv.reader(f)
                    header = next(reader, None)
                    if header != HEADER:
                        raise RuntimeError(f"canonical CSV header mismatch for {meta['asset']}")
                    for line_no, row in enumerate(reader, start=2):
                        if len(row) != 5:
                            raise RuntimeError(f"bad canonical row {meta['asset']}:{line_no}")
                        sec, o, h, l, c = map(int, row)
                        if first is None:
                            first = sec
                        last = sec
                        count += 1
                        if previous_second is not None and sec <= previous_second:
                            raise RuntimeError(f"duplicate/non-monotonic canonical second {sec}")
                        previous_second = sec
                        if l > h or not (l <= o <= h and l <= c <= h):
                            raise RuntimeError(f"invalid OHLC at {meta['asset']}:{line_no}")
                        if start_second is not None and sec < start_second:
                            continue
                        if end_second is not None and sec > end_second:
                            break
                        yield Bar(sec, o, h, l, c)
                if count and start_second is None and end_second is None:
                    if count != int(meta["barCount"]) or first != int(meta["earliestSecond"]) or last != int(meta["latestSecond"]):
                        raise RuntimeError(f"decoded metadata mismatch for {meta['asset']}")
            finally:
                if delete_after:
                    path.unlink(missing_ok=True)

    def iter_with_atr(self, length: int = 14, start_second: int | None = None, end_second: int | None = None):
        state = WilderATRState(length)
        for bar in self.iter_bars(start_second, end_second):
            yield bar, state.update(bar)


def parse_time(value: str | None) -> int | None:
    if not value:
        return None
    if value.isdigit():
        return int(value)
    x = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if x.tzinfo is None:
        x = x.replace(tzinfo=UTC)
    return int(x.timestamp())


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--manifest", required=True)
    p.add_argument("--cache-dir")
    p.add_argument("--start")
    p.add_argument("--end")
    p.add_argument("--atr-length", type=int, default=14)
    p.add_argument("--identity", action="store_true")
    a = p.parse_args()
    reader = CanonicalGoldReader.from_path_or_url(a.manifest, pathlib.Path(a.cache_dir) if a.cache_dir else None)
    if a.identity:
        print(json.dumps(reader.reproducibility_identity(), indent=2))
        return
    start, end = parse_time(a.start), parse_time(a.end)
    count = 0
    first = last = None
    final_atr = None
    for bar, atr in reader.iter_with_atr(a.atr_length, start, end):
        if first is None:
            first = bar.unix_second
        last = bar.unix_second
        final_atr = atr
        count += 1
    print("RENKO_GOLD_CANONICAL_READER_PASS", json.dumps({
        "bars": count,
        "earliestSecond": first,
        "latestSecond": last,
        "atrLength": a.atr_length,
        "finalAtrTicks": final_atr,
        "identity": reader.reproducibility_identity(),
    }, separators=(",", ":")))


if __name__ == "__main__":
    main()
