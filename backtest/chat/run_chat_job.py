from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile
from collections import deque
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHAT = ROOT / "chat"
REQUESTS = CHAT / "requests"
RESULTS = CHAT / "results"
ASSETS_PATH = ROOT / "data" / "assets.json"
DUKAS_HELPER = CHAT / "fetch_dukascopy.cjs"
ENGINE_VERSION = "vectorforge-chat-1.0.0"

REQUESTS.mkdir(parents=True, exist_ok=True)
RESULTS.mkdir(parents=True, exist_ok=True)


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def canonical(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def parse_day(value: str) -> date:
    return date.fromisoformat(value)


def iter_days(start: date, end: date):
    d = start
    while d < end:
        yield d
        d += timedelta(days=1)


class RollingMean:
    def __init__(self, n: int):
        self.n = max(1, int(n))
        self.q = deque()
        self.total = 0.0

    def push(self, value: float):
        self.q.append(value)
        self.total += value
        if len(self.q) > self.n:
            self.total -= self.q.popleft()

    def avg(self):
        return self.total / self.n if len(self.q) == self.n else None


class DonchianWindow:
    def __init__(self, n: int):
        self.n = max(2, int(n))
        self.i = 0
        self.maxq = deque()
        self.minq = deque()

    def bounds(self):
        expire = self.i - self.n
        while self.maxq and self.maxq[0][0] < expire:
            self.maxq.popleft()
        while self.minq and self.minq[0][0] < expire:
            self.minq.popleft()
        if self.i < self.n:
            return None, None
        return self.maxq[0][1], self.minq[0][1]

    def push(self, value: float):
        idx = self.i
        self.i += 1
        while self.maxq and self.maxq[-1][1] <= value:
            self.maxq.pop()
        while self.minq and self.minq[-1][1] >= value:
            self.minq.pop()
        self.maxq.append((idx, value))
        self.minq.append((idx, value))


class Strategy:
    def __init__(self, config: dict):
        self.c = config
        self.prev_rel = 0
        self.fast = RollingMean(config["fast"])
        self.slow = RollingMean(config["slow"])
        self.ema_f = None
        self.ema_s = None
        self.prev_price = None
        self.avg_gain = None
        self.avg_loss = None
        self.warm_count = 0
        self.warm_gain = 0.0
        self.warm_loss = 0.0
        self.don = DonchianWindow(config["slow"])

    def signal(self, price: float) -> int:
        c = self.c
        model = c["strategy"]
        if model == "price_sma":
            self.slow.push(price)
            ma = self.slow.avg()
            if ma is None:
                return 0
            rel = 1 if price > ma else -1 if price < ma else self.prev_rel
            sig = rel if self.prev_rel and rel != self.prev_rel else 0
            self.prev_rel = rel
            return sig

        if model == "sma_cross":
            self.fast.push(price)
            self.slow.push(price)
            f, s = self.fast.avg(), self.slow.avg()
            if f is None or s is None:
                return 0
            rel = 1 if f > s else -1 if f < s else self.prev_rel
            sig = rel if self.prev_rel and rel != self.prev_rel else 0
            self.prev_rel = rel
            return sig

        if model == "ema_cross":
            af = 2.0 / (c["fast"] + 1.0)
            ass = 2.0 / (c["slow"] + 1.0)
            self.ema_f = price if self.ema_f is None else af * price + (1 - af) * self.ema_f
            self.ema_s = price if self.ema_s is None else ass * price + (1 - ass) * self.ema_s
            rel = 1 if self.ema_f > self.ema_s else -1 if self.ema_f < self.ema_s else self.prev_rel
            sig = rel if self.prev_rel and rel != self.prev_rel else 0
            self.prev_rel = rel
            return sig

        if model == "rsi_revert":
            if self.prev_price is None:
                self.prev_price = price
                return 0
            change = price - self.prev_price
            self.prev_price = price
            gain, loss = max(0.0, change), max(0.0, -change)
            n = max(2, int(c["fast"]))
            if self.avg_gain is None:
                self.warm_gain += gain
                self.warm_loss += loss
                self.warm_count += 1
                if self.warm_count < n:
                    return 0
                self.avg_gain = self.warm_gain / n
                self.avg_loss = self.warm_loss / n
            else:
                self.avg_gain = (self.avg_gain * (n - 1) + gain) / n
                self.avg_loss = (self.avg_loss * (n - 1) + loss) / n
            rs = math.inf if self.avg_loss == 0 else self.avg_gain / self.avg_loss
            rsi = 100 - (100 / (1 + rs))
            if rsi <= c.get("rsi_lower", 30):
                return 1
            if rsi >= c.get("rsi_upper", 70):
                return -1
            return 0

        if model == "donchian":
            hi, lo = self.don.bounds()
            sig = 1 if hi is not None and price > hi else -1 if lo is not None and price < lo else 0
            self.don.push(price)
            return sig
        raise ValueError(f"unsupported strategy: {model}")


@dataclass
class Position:
    side: int
    entry: float
    stop: float
    target: float


class Simulator:
    def __init__(self, config: dict, point_size: float):
        self.c = config
        self.point = point_size
        self.strategy = Strategy(config)
        self.pos = None
        self.samples = 0
        self.signals = 0
        self.events = 0
        self.wins = 0
        self.long_events = 0
        self.short_events = 0
        self.gross_pos = 0.0
        self.gross_neg = 0.0
        self.net_r = 0.0
        self.peak = 0.0
        self.max_dd = 0.0
        self.loss_streak = 0
        self.max_loss_streak = 0
        self.last_bid = None
        self.last_ask = None
        self.friction_r = float(config.get("cost_r", 0.0)) + 2.0 * float(config.get("slippage_points", 0.0)) / float(config["stop_points"])

    def record(self, value: float, side: int):
        r = value - self.friction_r
        self.events += 1
        if side == 1:
            self.long_events += 1
        else:
            self.short_events += 1
        self.net_r += r
        if r > 0:
            self.wins += 1
            self.gross_pos += r
            self.loss_streak = 0
        else:
            self.gross_neg += abs(r)
            self.loss_streak += 1
            self.max_loss_streak = max(self.max_loss_streak, self.loss_streak)
        self.peak = max(self.peak, self.net_r)
        self.max_dd = max(self.max_dd, self.peak - self.net_r)

    def quote(self, bid: float, ask: float):
        if not (math.isfinite(bid) and math.isfinite(ask) and ask >= bid and bid > 0):
            return
        self.samples += 1
        self.last_bid, self.last_ask = bid, ask
        if self.pos:
            p = self.pos
            if p.side == 1:
                if bid <= p.stop:
                    self.record(-1.0, 1)
                    self.pos = None
                elif bid >= p.target:
                    self.record(float(self.c["rr"]), 1)
                    self.pos = None
            else:
                if ask >= p.stop:
                    self.record(-1.0, -1)
                    self.pos = None
                elif ask <= p.target:
                    self.record(float(self.c["rr"]), -1)
                    self.pos = None

        mid = (bid + ask) / 2.0
        sig = self.strategy.signal(mid)
        if sig:
            self.signals += 1
        if self.pos or not sig:
            return
        side_mode = self.c.get("trade_side", "both")
        if sig == 1 and side_mode == "short":
            return
        if sig == -1 and side_mode == "long":
            return
        d = float(self.c["stop_points"]) * self.point
        if sig == 1:
            entry = ask
            self.pos = Position(1, entry, entry - d, entry + d * float(self.c["rr"]))
        else:
            entry = bid
            self.pos = Position(-1, entry, entry + d, entry - d * float(self.c["rr"]))

    def close_open(self):
        if not self.pos or self.last_bid is None or self.last_ask is None:
            return
        p = self.pos
        d = float(self.c["stop_points"]) * self.point
        px = self.last_bid if p.side == 1 else self.last_ask
        raw = (px - p.entry) / d if p.side == 1 else (p.entry - px) / d
        raw = max(-1.0, min(float(self.c["rr"]), raw))
        self.record(raw, p.side)
        self.pos = None

    def summary(self, elapsed_days: int):
        weeks = max(elapsed_days / 7.0, 1.0 / 7.0)
        return {
            "net_r": self.net_r,
            "win_rate_pct": self.wins / self.events * 100.0 if self.events else 0.0,
            "profit_factor": self.gross_pos / self.gross_neg if self.gross_neg else (math.inf if self.gross_pos else 0.0),
            "max_drawdown_r": self.max_dd,
            "expectancy_r": self.net_r / self.events if self.events else 0.0,
            "events": self.events,
            "events_per_week": self.events / weeks,
            "max_loss_streak": self.max_loss_streak,
            "long_events": self.long_events,
            "short_events": self.short_events,
            "signals": self.signals,
            "samples": self.samples,
            "friction_r_per_event": self.friction_r,
        }


def load_assets():
    data = json.loads(ASSETS_PATH.read_text())
    return {x["symbol"].upper(): x for x in data["assets"]}


def normalize_request(raw: dict, asset: dict):
    start = parse_day(raw["start"])
    end = parse_day(raw["end"])
    if end <= start:
        raise ValueError("end must be after start; end date is exclusive")
    strategy = raw.get("strategy", "sma_cross")
    if strategy not in {"price_sma", "sma_cross", "ema_cross", "rsi_revert", "donchian"}:
        raise ValueError("unsupported strategy")
    side = raw.get("trade_side", "both")
    if side not in {"both", "long", "short"}:
        raise ValueError("trade_side must be both, long or short")
    c = {
        "request_id": str(raw["request_id"]),
        "asset": asset["symbol"],
        "start": start.isoformat(),
        "end": end.isoformat(),
        "strategy": strategy,
        "trade_side": side,
        "fast": max(2, int(raw.get("fast", 50))),
        "slow": max(3, int(raw.get("slow", 1000))),
        "stop_points": float(raw.get("stop_points", 15)),
        "rr": float(raw.get("rr", 2)),
        "spread_points": max(0.0, float(raw.get("spread_points", 1))),
        "slippage_points": max(0.0, float(raw.get("slippage_points", 0))),
        "cost_r": max(0.0, float(raw.get("cost_r", 0))),
        "rsi_lower": float(raw.get("rsi_lower", 30)),
        "rsi_upper": float(raw.get("rsi_upper", 70)),
        "point_size": float(raw.get("point_size", asset["point_size"])),
    }
    if c["stop_points"] <= 0 or c["rr"] <= 0 or c["point_size"] <= 0:
        raise ValueError("stop_points, rr and point_size must be positive")
    return c, start, end


def run_dukascopy(asset: dict, config: dict, start: date, end: date, sim: Simulator):
    combined = hashlib.sha256()
    processed_days = 0
    for d in iter_days(start, end):
        d2 = d + timedelta(days=1)
        cmd = [
            "node", str(DUKAS_HELPER), asset["provider_symbol"],
            f"{d.isoformat()}T00:00:00.000Z", f"{d2.isoformat()}T00:00:00.000Z"
        ]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
        day_hash = hashlib.sha256()
        assert proc.stdout is not None
        for line in proc.stdout:
            day_hash.update(line.encode("utf-8"))
            parts = line.rstrip("\n").split("\t")
            if len(parts) != 3:
                continue
            try:
                bid, ask = float(parts[1]), float(parts[2])
            except ValueError:
                continue
            sim.quote(bid, ask)
        stderr = proc.stderr.read() if proc.stderr else ""
        rc = proc.wait()
        if rc != 0:
            raise RuntimeError(f"Dukascopy adapter failed for {d}: {stderr[-1500:]}")
        digest = day_hash.hexdigest()
        combined.update(f"{d.isoformat()}:{digest}\n".encode())
        processed_days += 1
    return combined.hexdigest(), processed_days


def download_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "VectorForgeChat/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def run_binance(asset: dict, config: dict, start: date, end: date, sim: Simulator):
    combined = hashlib.sha256()
    processed_days = 0
    symbol = asset["provider_symbol"]
    half_spread = config["spread_points"] * config["point_size"] / 2.0
    for d in iter_days(start, end):
        name = f"{symbol}-aggTrades-{d.isoformat()}.zip"
        url = f"https://data.binance.vision/data/spot/daily/aggTrades/{symbol}/{name}"
        try:
            blob = download_bytes(url)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                continue
            raise
        zhash = hashlib.sha256(blob).hexdigest()
        combined.update(f"{d.isoformat()}:{zhash}\n".encode())
        with zipfile.ZipFile(io.BytesIO(blob)) as zf:
            members = [n for n in zf.namelist() if n.lower().endswith(".csv")]
            if not members:
                raise RuntimeError(f"no CSV in {name}")
            with zf.open(members[0]) as fh:
                text = io.TextIOWrapper(fh, encoding="utf-8", newline="")
                reader = csv.reader(text)
                for row in reader:
                    if len(row) < 6:
                        continue
                    try:
                        price = float(row[1])
                    except ValueError:
                        continue
                    sim.quote(price - half_spread, price + half_spread)
        processed_days += 1
    return combined.hexdigest(), processed_days


def process_request(path: Path, assets: dict):
    raw = json.loads(path.read_text())
    rid = str(raw.get("request_id") or path.stem)
    raw["request_id"] = rid
    result_path = RESULTS / f"{rid}.json"
    if result_path.exists():
        return False
    started_at = datetime.now(timezone.utc).isoformat()
    try:
        symbol = str(raw["asset"]).upper()
        if symbol not in assets:
            raise ValueError(f"unknown asset {symbol}")
        asset = assets[symbol]
        config, start, end = normalize_request(raw, asset)
        sim = Simulator(config, config["point_size"])
        if asset["provider"] == "dukascopy":
            dataset_hash, processed_days = run_dukascopy(asset, config, start, end, sim)
        elif asset["provider"] == "binance":
            dataset_hash, processed_days = run_binance(asset, config, start, end, sim)
        else:
            raise ValueError(f"unsupported provider {asset['provider']}")
        sim.close_open()
        summary = sim.summary((end - start).days)
        evaluation_id = sha256_text(canonical({
            "engine_version": ENGINE_VERSION,
            "provider": asset["provider"],
            "dataset_sha256": dataset_hash,
            "config": config,
        }))
        payload = {
            "status": "PASS_COMPLETED",
            "request_id": rid,
            "engine_version": ENGINE_VERSION,
            "provider": asset["provider"],
            "provider_mode": asset["mode"],
            "asset": symbol,
            "start": start.isoformat(),
            "end_exclusive": end.isoformat(),
            "processed_days": processed_days,
            "dataset_sha256": dataset_hash,
            "evaluation_id": evaluation_id,
            "config": config,
            "result": summary,
            "started_at": started_at,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        payload = {
            "status": "FAILED",
            "request_id": rid,
            "engine_version": ENGINE_VERSION,
            "error": f"{type(e).__name__}: {e}",
            "started_at": started_at,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
    result_path.write_text(json.dumps(payload, indent=2, allow_nan=False if payload.get("status") == "FAILED" else True))
    print(json.dumps({"request_id": rid, "status": payload["status"], "result_path": str(result_path)}))
    return True


def main():
    assets = load_assets()
    processed = 0
    for path in sorted(REQUESTS.glob("*.json")):
        if path.name.startswith("_"):
            continue
        if process_request(path, assets):
            processed += 1
    print(f"VectorForge chat runner processed {processed} request(s)")


if __name__ == "__main__":
    main()
