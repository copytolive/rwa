from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from core import Candidate, novelty_pass

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
CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_nonempty ON configs(execution_hash) WHERE execution_hash IS NOT NULL AND execution_hash != '';
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

    def insert_result(self, result: dict, ledger_path: str, counted: bool):
        c = result["candidate"]
        self.db.execute(
            "INSERT INTO configs(config_hash,canonical_json,family,symbol,fingerprint,execution_hash,ledger_path,metrics_json,counted) VALUES(?,?,?,?,?,?,?,?,?)",
            (result["config_hash"], json.dumps(c, sort_keys=True), c["family"], c["symbol"], result["fingerprint"], result["execution_hash"], ledger_path, json.dumps(result["metrics"], sort_keys=True), int(bool(counted))),
        )
        self.db.commit()

    def eligible_rows(self):
        rows = self.db.execute("SELECT config_hash,canonical_json,fingerprint,ledger_path,metrics_json FROM configs WHERE counted=1").fetchall()
        out = []
        for h, c, f, lp, m in rows:
            out.append({"config_hash": h, "candidate": json.loads(c), "fingerprint": f, "ledger_path": lp, "metrics": json.loads(m)})
        return out

    def replace_portfolio(self, hashes: list[str]):
        self.db.execute("DELETE FROM portfolio")
        for i, h in enumerate(hashes, 1):
            self.db.execute("INSERT INTO portfolio(config_hash,rank) VALUES(?,?)", (h, i))
        self.db.commit()

    def portfolio_hashes(self):
        return [x[0] for x in self.db.execute("SELECT config_hash FROM portfolio ORDER BY rank").fetchall()]

    def set_state(self, k: str, v):
        self.db.execute("INSERT INTO state(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", (k, json.dumps(v)))
        self.db.commit()
