PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
PRAGMA synchronous=NORMAL;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS challenges (
  wallet TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_wallet ON sessions(wallet);

CREATE TABLE IF NOT EXISTS stores (
  token TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Physical commerce',
  full_address TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  contact TEXT,
  opening_hours TEXT,
  storefront_photo_url TEXT NOT NULL,
  business_registration_url TEXT NOT NULL,
  merchant_identity_url TEXT NOT NULL,
  catalog_url TEXT,
  asset_verified INTEGER NOT NULL DEFAULT 0 CHECK(asset_verified IN (0,1)),
  store_verified INTEGER NOT NULL DEFAULT 0 CHECK(store_verified IN (0,1)),
  trade_enabled INTEGER NOT NULL DEFAULT 0 CHECK(trade_enabled IN (0,1)),
  status TEXT NOT NULL DEFAULT 'UNVERIFIED',
  registry_hash TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_address ON stores(lower(full_address));

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  store_token TEXT NOT NULL REFERENCES stores(token) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  pickup INTEGER NOT NULL DEFAULT 1 CHECK(pickup IN (0,1)),
  shipping INTEGER NOT NULL DEFAULT 1 CHECK(shipping IN (0,1)),
  image_url TEXT,
  updated_at INTEGER NOT NULL,
  UNIQUE(store_token, sku)
);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_token, active);

CREATE TABLE IF NOT EXISTS inventory (
  product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  on_hand INTEGER NOT NULL DEFAULT 0 CHECK(on_hand >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved >= 0 AND reserved <= on_hand),
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  wallet TEXT,
  currency TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  fulfillment TEXT NOT NULL CHECK(fulfillment IN ('pickup','shipping')),
  destination_json TEXT NOT NULL DEFAULT '{}',
  items_json TEXT NOT NULL,
  quote_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_quotes_expiry ON quotes(expires_at);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  quote_id TEXT NOT NULL UNIQUE REFERENCES quotes(id),
  currency TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  fulfillment TEXT NOT NULL,
  contact_json TEXT NOT NULL,
  destination_json TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  payment_mode TEXT NOT NULL,
  payment_reference TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  paid_at INTEGER,
  completed_at INTEGER,
  cancelled_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_orders_wallet ON orders(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  store_token TEXT NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  qty INTEGER NOT NULL CHECK(qty > 0),
  PRIMARY KEY(order_id, product_id)
);

CREATE TABLE IF NOT EXISTS idempotency (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(scope, key)
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
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts DESC);
