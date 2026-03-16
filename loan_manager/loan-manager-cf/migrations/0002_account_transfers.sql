CREATE TABLE IF NOT EXISTS account_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  from_account TEXT NOT NULL,
  to_account TEXT NOT NULL,
  amount TEXT NOT NULL,
  transfer_date TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX idx_account_transfers_tenant ON account_transfers (tenant_id);
