use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Manager, State, WindowEvent};

mod backend;
mod commands;
mod db;

use backend::BackendController;
use db::Database;

// Estado global para armazenar o último peso lido
struct ScaleState {
    last_weight: Arc<Mutex<f64>>,
    connected: Arc<Mutex<bool>>,
}

#[tauri::command]
fn read_scale_weight(state: State<ScaleState>) -> Result<(f64, bool), String> {
    let weight = *state.last_weight.lock().unwrap();
    let connected = *state.connected.lock().unwrap();
    Ok((weight, connected))
}

#[tauri::command]
fn start_scale_reader(
    port: String,
    _baud_rate: u32,
    state: State<ScaleState>,
) -> Result<String, String> {
    use std::io::BufRead;
    use std::thread;

    let last_weight = Arc::clone(&state.last_weight);
    let connected = Arc::clone(&state.connected);

    // Criar thread para ler continuamente da porta serial
    thread::spawn(move || {
        loop {
            match std::fs::File::open(&port) {
                Ok(file) => {
                    *connected.lock().unwrap() = true;
                    let reader = std::io::BufReader::new(file);
                    for line in reader.lines() {
                        if let Ok(data) = line {
                            let data = data.trim();
                            // Formato H/L: H0000.15 ou L0000.10
                            if data.len() > 1
                                && (data.starts_with('H')
                                    || data.starts_with('L')
                                    || data.starts_with('h')
                                    || data.starts_with('l'))
                            {
                                let weight_str = &data[1..]; // Pular primeiro caractere (H ou L)
                                if let Ok(weight) = weight_str.parse::<f64>() {
                                    *last_weight.lock().unwrap() = weight;
                                }
                            }
                        }
                    }
                }
                Err(_) => {
                    *connected.lock().unwrap() = false;
                    thread::sleep(Duration::from_secs(2));
                }
            }
            thread::sleep(Duration::from_millis(100));
        }
    });

    Ok("Scale reader started".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Servidor será iniciado pelo launcher (ecolav-completo)
    // Não iniciar automaticamente aqui para evitar conflitos de caminho

    // Inicializar banco de dados SQLite
    let app_data_dir = tauri::api::path::app_data_dir(&tauri::Config::default())
        .unwrap_or_else(|| std::env::current_dir().unwrap().join(".data"));

    std::fs::create_dir_all(&app_data_dir).ok();
    let db_path = app_data_dir.join("ecolav.db");

    let database = Database::new(db_path).expect("Falha ao inicializar banco de dados SQLite");

    println!("✅ Banco de dados SQLite inicializado");

    tauri::Builder::default()
        .manage(ScaleState {
            last_weight: Arc::new(Mutex::new(0.0)),
            connected: Arc::new(Mutex::new(false)),
        })
        .manage(database)
        .manage(BackendController::default())
        .setup(|_app| {
            #[cfg(not(debug_assertions))]
            {
                let handle = _app.handle();
                let controller = _app.state::<BackendController>();
                controller.start(&handle);
            }
            Ok(())
        })
        .on_window_event(|event| {
            if let WindowEvent::CloseRequested { .. } = event.event() {
                let controller = event.window().state::<BackendController>();
                controller.shutdown();
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_scale_weight,
            start_scale_reader,
            commands::lookup_rfid_local,
            commands::cache_rfid_item,
            commands::bulk_cache_rfid_items,
            commands::queue_operation,
            commands::get_pending_operations,
            commands::delete_operation,
            commands::increment_retry_count,
            commands::get_pending_count,
            commands::get_last_sync,
            commands::update_sync_log,
            commands::get_db_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
