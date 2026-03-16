CREATE TABLE IF NOT EXISTS overdue_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL DEFAULT '',
  id_card TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  overdue_amount TEXT DEFAULT '0',
  overdue_periods INTEGER DEFAULT 0,
  overdue_date TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  reported_by TEXT DEFAULT '',
  tenant_id INTEGER REFERENCES tenants(id),
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX idx_overdue_reports_name ON overdue_reports (customer_name);
CREATE INDEX idx_overdue_reports_id_card ON overdue_reports (id_card);
CREATE INDEX idx_overdue_reports_phone ON overdue_reports (phone);
