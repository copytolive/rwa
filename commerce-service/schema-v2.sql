CREATE TABLE IF NOT EXISTS store_owners (
  store_token TEXT NOT NULL REFERENCES stores(token) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'OWNER' CHECK(role IN ('OWNER','MANAGER')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(store_token, wallet)
);
CREATE INDEX IF NOT EXISTS idx_store_owners_wallet ON store_owners(wallet, active);

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  requester TEXT NOT NULL,
  reason TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  status TEXT NOT NULL CHECK(status IN ('REQUESTED','PROCESSING','SUCCEEDED','REJECTED','FAILED')),
  provider TEXT,
  provider_reference TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status, created_at DESC);
