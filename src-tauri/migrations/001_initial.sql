-- Cache de itens RFID (tags e peças)
CREATE TABLE IF NOT EXISTS rfid_items (
  id TEXT PRIMARY KEY,
  tag TEXT UNIQUE NOT NULL,
  tid TEXT,
  linen_item_id TEXT,
  linen_item_name TEXT,
  linen_item_sku TEXT,
  full_number TEXT,
  batch_number INTEGER,
  piece_number INTEGER,
  status TEXT,
  client_id TEXT,
  client_name TEXT,
  updated_at INTEGER NOT NULL,
  synced_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_rfid_tag ON rfid_items(tag);
CREATE INDEX IF NOT EXISTS idx_rfid_tid ON rfid_items(tid);
CREATE INDEX IF NOT EXISTS idx_rfid_linen_item ON rfid_items(linen_item_id);
CREATE INDEX IF NOT EXISTS idx_rfid_updated ON rfid_items(updated_at);

-- Cache de produtos (itens de roupa)
CREATE TABLE IF NOT EXISTS linen_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  client_id TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_linen_client ON linen_items(client_id);

-- Cache de setores
CREATE TABLE IF NOT EXISTS sectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  client_id TEXT,
  updated_at INTEGER NOT NULL
);

-- Cache de leitos
CREATE TABLE IF NOT EXISTS beds (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  sector_id TEXT,
  status TEXT,
  client_id TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_beds_sector ON beds(sector_id);

-- Operações pendentes (fila offline)
CREATE TABLE IF NOT EXISTS pending_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_type TEXT NOT NULL, -- 'distribute', 'reception', 'retire', 'associate'
  payload TEXT NOT NULL, -- JSON com dados da operação
  created_at INTEGER NOT NULL,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  last_retry_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_pending_created ON pending_operations(created_at);
CREATE INDEX IF NOT EXISTS idx_pending_type ON pending_operations(operation_type);

-- Log de sincronização
CREATE TABLE IF NOT EXISTS sync_log (
  entity TEXT PRIMARY KEY, -- 'rfid_items', 'linen_items', 'sectors', 'beds'
  last_sync_at INTEGER NOT NULL,
  last_sync_count INTEGER DEFAULT 0,
  last_error TEXT
);

-- Configurações locais
CREATE TABLE IF NOT EXISTS local_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

