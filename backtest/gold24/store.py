from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pandas as pd

from core import Candidate, novelty_pass

LEDGER_COMPARE_COLS = [
    "entry_bar", "exit_bar", "side", "pending_order", "entry_price", "exit_price",
    "fixed_sl", "fixed_tp", "quantity", "gross_pnl", "cost", "net_pnl", "exit_reason",
]

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
CREATE TABLE IF NOT EXISTS configs (
  config_hash TEXT PRIMARY KEY,
  canonical_json TEXT NOT NULL,
  family TEXT NOT NULL,
  symbol TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  execution_hash TEXT,
  ledger_path TEXT,
  metrics_json TEXT,
  counted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DROP INDEX IF EXISTS idx_execution_nonempty;
CREATE INDEX IF NOT EXISTS idx_execution_hash ON configs(execution_hash);
CREATE INDEX IF NOT EXISTS idx_family ON configs(family);
CREATE INDEX IF NOT EXISTS idx_fingerprint ON configs(fingerprint);
CREATE TABLE IF NOT EXISTS portfolio (
  config_hash TEXT PRIMARY KEY,
  rank INTEGER,
  correlation_max REAL NOT NULL DEFAULT 0,
  FOREIGN KEY(config_hash) REFERENCES configs(config_hash)
);
CREATE TABLE IF NOT EXISTS state (k TEXT PRIMARY KEY, v TEXT NOT NULL);
"""


class Store:
    def __init__(self, path: str | Path):
        self.path = str(path)
        self.db = sqlite3.connect(self.path)
        self.db.executescript(SCHEMA)

    def close(self):
        self.db.close()

    def seen(self, config_hash: str) -> bool:
        return self.db.execute("SELECT 1 FROM configs WHERE config_hash=?", (config_hash,)).fetchone() is not None

    def prior_family(self, family: str):
        rows = self.db.execute("SELECT canonical_json FROM configs WHERE family=?", (family,)).fetchall()
        for (raw,) in rows:
            yield Candidate(**json.loads(raw))

    def novelty_ok(self, c: Candidate) -> bool:
        return all(novelty_pass(c, prior) for prior in self.prior_family(c.family))

    def execution_seen(self, execution_hash: str) -> bool:
        if not execution_hash:
            return False
        return self.db.execute("SELECT 1 FROM configs WHERE execution_hash=?", (execution_hash,)).fetchone() is not None

    @staticmethod
    def _canonical_ledger_records(df: pd.DataFrame) -> list[dict]:
        if df.empty:
            return []
        cols = [c for c in LEDGER_COMPARE_COLS if c in df.columns]
        x = df[cols].copy()
        return json.loads(x.to_json(orient="records", double_precision=12))

    def exact_execution_duplicate(self, result: dict) -> bool:
        """Hash narrows candidates; exact full trade-ledger equality is final authority."""
        execution_hash = result.get("execution_hash")
        if not execution_hash:
            return False
        matches = self.db.execute(
            "SELECT config_hash,ledger_path FROM configs WHERE execution_hash=?",
            (execution_hash,),
        ).fetchall()
        if not matches:
            return False
        current = self._canonical_ledger_records(pd.DataFrame(result.get("ledger", [])))
        for config_hash, ledger_path in matches:
            try:
                prior = pd.read_parquet(ledger_path)
                if "config_hash" in prior.columns:
                    prior = prior[prior["config_hash"] == config_hash]
                if current == self._canonical_ledger_records(prior):
                    return True
            except Exception:
                # Fail closed for promotion: if an expected prior ledger cannot be read,
                # the caller must not claim the current result execution-unique.
                return True
        return False

    def insert_result(self, result: dict, ledger_path: str, counted: bool):
        """Archive every config, including exact execution duplicates; counted controls promotion only."""
        c = result["candidate"]
        self.db.execute(
            "INSERT INTO configs(config_hash,canonical_json,family,symbol,fingerprint,execution_hash,ledger_path,metrics_json,counted) VALUES(?,?,?,?,?,?,?,?,?)",
            (
                result["config_hash"], json.dumps(c, sort_keys=True), c["family"], c["symbol"],
                result["fingerprint"], result["execution_hash"], ledger_path,
                json.dumps(result["metrics"], sort_keys=True), int(bool(counted)),
            ),
        )
        self.db.commit()

    def eligible_rows(self):
        rows = self.db.execute(
            "SELECT config_hash,canonical_json,fingerprint,execution_hash,ledger_path,metrics_json FROM configs WHERE counted=1"
        ).fetchall()
        out = []
        for h, c, f, eh, lp, m in rows:
            out.append({
                "config_hash": h,
                "candidate": json.loads(c),
                "fingerprint": f,
                "execution_hash": eh,
                "ledger_path": lp,
                "metrics": json.loads(m),
            })
        return out

    def replace_portfolio(self, hashes: list[str], correlations: dict[str, float] | None = None):
        correlations = correlations or {}
        self.db.execute("DELETE FROM portfolio")
        for i, h in enumerate(hashes, 1):
            self.db.execute(
                "INSERT INTO portfolio(config_hash,rank,correlation_max) VALUES(?,?,?)",
                (h, i, float(correlations.get(h, 0.0))),
            )
        self.db.commit()

    def portfolio_hashes(self):
        return [x[0] for x in self.db.execute("SELECT config_hash FROM portfolio ORDER BY rank").fetchall()]

    def set_state(self, k: str, v):
        self.db.execute(
            "INSERT INTO state(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v",
            (k, json.dumps(v)),
        )
        self.db.commit()
