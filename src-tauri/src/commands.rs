use tauri::State;
use crate::db::{Database, RfidItem};
use serde_json::Value as JsonValue;

#[tauri::command]
pub fn lookup_rfid_local(tag: String, db: State<Database>) -> Result<Option<RfidItem>, String> {
    db.lookup_rfid_item(&tag)
        .map_err(|e| format!("Erro ao buscar tag no cache local: {}", e))
}

#[tauri::command]
pub fn cache_rfid_item(item: RfidItem, db: State<Database>) -> Result<(), String> {
    db.upsert_rfid_item(&item)
        .map_err(|e| format!("Erro ao salvar item no cache: {}", e))
}

#[tauri::command]
pub fn bulk_cache_rfid_items(items: Vec<RfidItem>, db: State<Database>) -> Result<usize, String> {
    db.bulk_upsert_rfid_items(&items)
        .map_err(|e| format!("Erro ao salvar itens em lote: {}", e))
}

#[tauri::command]
pub fn queue_operation(
    operation_type: String,
    payload: String,
    db: State<Database>,
) -> Result<i64, String> {
    db.queue_operation(&operation_type, &payload)
        .map_err(|e| format!("Erro ao enfileirar operação: {}", e))
}

#[tauri::command]
pub fn get_pending_operations(
    limit: Option<usize>,
    db: State<Database>,
) -> Result<Vec<crate::db::PendingOperation>, String> {
    let limit = limit.unwrap_or(100);
    db.get_pending_operations(limit)
        .map_err(|e| format!("Erro ao buscar operações pendentes: {}", e))
}

#[tauri::command]
pub fn delete_operation(id: i64, db: State<Database>) -> Result<(), String> {
    db.delete_operation(id)
        .map_err(|e| format!("Erro ao deletar operação: {}", e))
}

#[tauri::command]
pub fn increment_retry_count(id: i64, error: String, db: State<Database>) -> Result<(), String> {
    db.increment_retry_count(id, &error)
        .map_err(|e| format!("Erro ao incrementar contador de retry: {}", e))
}

#[tauri::command]
pub fn get_pending_count(db: State<Database>) -> Result<i64, String> {
    db.get_pending_count()
        .map_err(|e| format!("Erro ao contar operações pendentes: {}", e))
}

#[tauri::command]
pub fn get_last_sync(entity: String, db: State<Database>) -> Result<i64, String> {
    db.get_last_sync(&entity)
        .map_err(|e| format!("Erro ao buscar última sincronização: {}", e))
}

#[tauri::command]
pub fn update_sync_log(entity: String, count: i64, db: State<Database>) -> Result<(), String> {
    db.update_sync_log(&entity, count)
        .map_err(|e| format!("Erro ao atualizar log de sincronização: {}", e))
}

#[tauri::command]
pub fn get_db_stats(db: State<Database>) -> Result<JsonValue, String> {
    db.get_stats()
        .map_err(|e| format!("Erro ao buscar estatísticas: {}", e))
}

