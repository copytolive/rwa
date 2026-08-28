PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
PRAGMA synchronous=NORMAL;

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  jurisdiction TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ONBOARDING' CHECK(status IN ('ONBOARDING','ACTIVE','SUSPENDED','CLOSED')),
  kyb_verified INTEGER NOT NULL DEFAULT 0 CHECK(kyb_verified IN (0,1)),
  evidence_hash TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS business_wallets (
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'OPERATOR',
  identity_verified INTEGER NOT NULL DEFAULT 0 CHECK(identity_verified IN (0,1)),
  connected_at INTEGER NOT NULL,
  verified_at INTEGER,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  PRIMARY KEY(business_id,wallet)
);
CREATE INDEX IF NOT EXISTS idx_business_wallets_wallet ON business_wallets(lower(wallet),active);

CREATE TABLE IF NOT EXISTS store_bindings (
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  store_token TEXT NOT NULL,
  location_id TEXT NOT NULL DEFAULT '',
  terminal_policy TEXT NOT NULL DEFAULT 'ECOMMERCE_OR_APPROVED_POS',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(business_id,store_token)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_binding_unique_live ON store_bindings(store_token) WHERE active=1;

CREATE TABLE IF NOT EXISTS validation_policy (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  min_settled_count INTEGER NOT NULL DEFAULT 1 CHECK(min_settled_count >= 1),
  min_settled_cents INTEGER NOT NULL DEFAULT 100 CHECK(min_settled_cents >= 0),
  max_settlement_age_ms INTEGER NOT NULL DEFAULT 2592000000 CHECK(max_settlement_age_ms > 0),
  min_reconciliation_bps INTEGER NOT NULL DEFAULT 10000 CHECK(min_reconciliation_bps BETWEEN 0 AND 10000),
  max_refund_bps INTEGER NOT NULL DEFAULT 5000 CHECK(max_refund_bps BETWEEN 0 AND 10000),
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settlement_ledger (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id TEXT,
  external_ref TEXT,
  source TEXT NOT NULL,
  store_token TEXT NOT NULL,
  wallet TEXT NOT NULL DEFAULT '',
  gross_cents INTEGER NOT NULL CHECK(gross_cents >= 0),
  refund_cents INTEGER NOT NULL DEFAULT 0 CHECK(refund_cents >= 0),
  net_cents INTEGER NOT NULL CHECK(net_cents >= 0),
  currency TEXT NOT NULL,
  payment_reference TEXT NOT NULL,
  settlement_reference TEXT NOT NULL DEFAULT '',
  settlement_at INTEGER NOT NULL,
  evidence_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('SETTLED','REFUNDED','REVERSED','DISPUTED')),
  observed_at INTEGER NOT NULL,
  UNIQUE(source,order_id),
  UNIQUE(source,external_ref)
);
CREATE INDEX IF NOT EXISTS idx_settlement_business ON settlement_ledger(business_id,settlement_at DESC);

CREATE TABLE IF NOT EXISTS external_transactions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  store_token TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  product_service_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  currency TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('CREATED','PAID','SETTLED','REFUNDED','REVERSED','CANCELLED')),
  payment_reference TEXT NOT NULL DEFAULT '',
  settlement_reference TEXT NOT NULL DEFAULT '',
  external_ref TEXT NOT NULL,
  evidence_url TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(business_id,external_ref)
);
CREATE INDEX IF NOT EXISTS idx_external_tx_business ON external_transactions(business_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  expected_net_cents INTEGER NOT NULL,
  ledger_net_cents INTEGER NOT NULL,
  difference_cents INTEGER NOT NULL,
  reconciliation_bps INTEGER NOT NULL,
  qualifying_count INTEGER NOT NULL,
  refund_cents INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PASS','FAIL')),
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reconciliation_business ON reconciliation_runs(business_id,created_at DESC);

CREATE TABLE IF NOT EXISTS validation_snapshots (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100),
  reason_json TEXT NOT NULL DEFAULT '[]',
  settled_count INTEGER NOT NULL DEFAULT 0,
  net_settled_cents INTEGER NOT NULL DEFAULT 0,
  latest_settlement_at INTEGER,
  reconciliation_bps INTEGER NOT NULL DEFAULT 0,
  refund_bps INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_validation_business ON validation_snapshots(business_id,created_at DESC);

CREATE TABLE IF NOT EXISTS distribution_manifests (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  series_id TEXT NOT NULL,
  basis TEXT NOT NULL,
  eligible_revenue_cents INTEGER NOT NULL,
  reserve_cents INTEGER NOT NULL,
  distributable_cents INTEGER NOT NULL,
  investor_allocation_bps INTEGER NOT NULL,
  reserve_bps INTEGER NOT NULL,
  snapshot_hash TEXT NOT NULL,
  manifest_hash TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'AWAITING_AUTHORIZED_FUNDING',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_business_audit_ts ON audit_log(ts DESC);
