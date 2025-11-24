use rusqlite::{Connection, Result as SqlResult, params};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RfidItem {
    pub id: String,
    pub tag: String,
    pub tid: Option<String>,
    pub linen_item_id: Option<String>,
    pub linen_item_name: Option<String>,
    pub linen_item_sku: Option<String>,
    pub full_number: Option<String>,
    pub batch_number: Option<i32>,
    pub piece_number: Option<i32>,
    pub status: Option<String>,
    pub client_id: Option<String>,
    pub client_name: Option<String>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingOperation {
    pub id: i64,
    pub operation_type: String,
    pub payload: String,
    pub created_at: i64,
    pub retry_count: i32,
    pub last_error: Option<String>,
}

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(db_path: PathBuf) -> SqlResult<Self> {
        let conn = Connection::open(db_path)?;
        
        // Executar migrations
        Self::run_migrations(&conn)?;
        
        Ok(Database {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    fn run_migrations(conn: &Connection) -> SqlResult<()> {
        let migration_sql = include_str!("../migrations/001_initial.sql");
        conn.execute_batch(migration_sql)?;
        Ok(())
    }

    // ==================== RFID ITEMS ====================
    
    pub fn lookup_rfid_item(&self, tag: &str) -> SqlResult<Option<RfidItem>> {
        let conn = self.conn.lock().unwrap();
        let normalized = tag.to_uppercase().replace(" ", "");
        
        let mut stmt = conn.prepare(
            "SELECT id, tag, tid, linen_item_id, linen_item_name, linen_item_sku, 
                    full_number, batch_number, piece_number, status, client_id, client_name, updated_at
             FROM rfid_items 
             WHERE tag = ?1 OR tid = ?1 
             ORDER BY updated_at DESC
             LIMIT 1"
        )?;
        
        let result = stmt.query_row(params![normalized], |row| {
            Ok(RfidItem {
                id: row.get(0)?,
                tag: row.get(1)?,
                tid: row.get(2)?,
                linen_item_id: row.get(3)?,
                linen_item_name: row.get(4)?,
                linen_item_sku: row.get(5)?,
                full_number: row.get(6)?,
                batch_number: row.get(7)?,
                piece_number: row.get(8)?,
                status: row.get(9)?,
                client_id: row.get(10)?,
                client_name: row.get(11)?,
                updated_at: row.get(12)?,
            })
        });
        
        match result {
            Ok(item) => Ok(Some(item)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn upsert_rfid_item(&self, item: &RfidItem) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute(
            "INSERT INTO rfid_items 
             (id, tag, tid, linen_item_id, linen_item_name, linen_item_sku, 
              full_number, batch_number, piece_number, status, client_id, client_name, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
             ON CONFLICT(id) DO UPDATE SET
                tag = excluded.tag,
                tid = excluded.tid,
                linen_item_id = excluded.linen_item_id,
                linen_item_name = excluded.linen_item_name,
                linen_item_sku = excluded.linen_item_sku,
                full_number = excluded.full_number,
                batch_number = excluded.batch_number,
                piece_number = excluded.piece_number,
                status = excluded.status,
                client_id = excluded.client_id,
                client_name = excluded.client_name,
                updated_at = excluded.updated_at",
            params![
                item.id, item.tag, item.tid, item.linen_item_id, item.linen_item_name,
                item.linen_item_sku, item.full_number, item.batch_number, item.piece_number,
                item.status, item.client_id, item.client_name, item.updated_at
            ],
        )?;
        
        Ok(())
    }

    pub fn bulk_upsert_rfid_items(&self, items: &[RfidItem]) -> SqlResult<usize> {
        let conn = self.conn.lock().unwrap();
        let tx = conn.unchecked_transaction()?;
        
        let mut count = 0;
        for item in items {
            tx.execute(
                "INSERT INTO rfid_items 
                 (id, tag, tid, linen_item_id, linen_item_name, linen_item_sku, 
                  full_number, batch_number, piece_number, status, client_id, client_name, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                 ON CONFLICT(id) DO UPDATE SET
                    tag = excluded.tag,
                    tid = excluded.tid,
                    linen_item_id = excluded.linen_item_id,
                    linen_item_name = excluded.linen_item_name,
                    linen_item_sku = excluded.linen_item_sku,
                    full_number = excluded.full_number,
                    batch_number = excluded.batch_number,
                    piece_number = excluded.piece_number,
                    status = excluded.status,
                    client_id = excluded.client_id,
                    client_name = excluded.client_name,
                    updated_at = excluded.updated_at",
                params![
                    item.id, item.tag, item.tid, item.linen_item_id, item.linen_item_name,
                    item.linen_item_sku, item.full_number, item.batch_number, item.piece_number,
                    item.status, item.client_id, item.client_name, item.updated_at
                ],
            )?;
            count += 1;
        }
        
        tx.commit()?;
        Ok(count)
    }

    // ==================== PENDING OPERATIONS ====================
    
    pub fn queue_operation(&self, operation_type: &str, payload: &str) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp();
        
        conn.execute(
            "INSERT INTO pending_operations (operation_type, payload, created_at) 
             VALUES (?1, ?2, ?3)",
            params![operation_type, payload, now],
        )?;
        
        Ok(conn.last_insert_rowid())
    }

    pub fn get_pending_operations(&self, limit: usize) -> SqlResult<Vec<PendingOperation>> {
        let conn = self.conn.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "SELECT id, operation_type, payload, created_at, retry_count, last_error
             FROM pending_operations
             ORDER BY created_at ASC
             LIMIT ?1"
        )?;
        
        let ops = stmt.query_map(params![limit], |row| {
            Ok(PendingOperation {
                id: row.get(0)?,
                operation_type: row.get(1)?,
                payload: row.get(2)?,
                created_at: row.get(3)?,
                retry_count: row.get(4)?,
                last_error: row.get(5)?,
            })
        })?;
        
        ops.collect()
    }

    pub fn delete_operation(&self, id: i64) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM pending_operations WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn increment_retry_count(&self, id: i64, error: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp();
        
        conn.execute(
            "UPDATE pending_operations 
             SET retry_count = retry_count + 1, last_error = ?2, last_retry_at = ?3
             WHERE id = ?1",
            params![id, error, now],
        )?;
        
        Ok(())
    }

    pub fn get_pending_count(&self) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM pending_operations",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    // ==================== SYNC LOG ====================
    
    pub fn get_last_sync(&self, entity: &str) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        
        let result = conn.query_row(
            "SELECT last_sync_at FROM sync_log WHERE entity = ?1",
            params![entity],
            |row| row.get(0),
        );
        
        match result {
            Ok(timestamp) => Ok(timestamp),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(0),
            Err(e) => Err(e),
        }
    }

    pub fn update_sync_log(&self, entity: &str, count: i64) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp();
        
        conn.execute(
            "INSERT INTO sync_log (entity, last_sync_at, last_sync_count)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(entity) DO UPDATE SET
                last_sync_at = excluded.last_sync_at,
                last_sync_count = excluded.last_sync_count",
            params![entity, now, count],
        )?;
        
        Ok(())
    }

    // ==================== STATS ====================
    
    pub fn get_stats(&self) -> SqlResult<serde_json::Value> {
        let conn = self.conn.lock().unwrap();
        
        let rfid_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM rfid_items",
            [],
            |row| row.get(0),
        )?;
        
        let pending_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM pending_operations",
            [],
            |row| row.get(0),
        )?;
        
        let last_sync: i64 = conn.query_row(
            "SELECT MAX(last_sync_at) FROM sync_log",
            [],
            |row| row.get(0),
        ).unwrap_or(0);
        
        Ok(serde_json::json!({
            "rfid_items_cached": rfid_count,
            "pending_operations": pending_count,
            "last_sync_timestamp": last_sync,
        }))
    }
}

