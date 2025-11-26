use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, Command as StdCommand, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use walkdir::WalkDir;

const BACKEND_META_FILE: &str = ".bundle-meta.json";

#[derive(Default)]
pub struct BackendController {
    started: AtomicBool,
    tx: Mutex<Option<Sender<BackendCommand>>>,
}

enum BackendCommand {
    Shutdown,
}

#[derive(Serialize)]
struct BackendStatus {
    state: &'static str,
    message: Option<String>,
    timestamp: i64,
}

#[derive(Debug, Deserialize)]
struct BackendMeta {
    hash: String,
    #[allow(dead_code)]
    generated_at: Option<String>,
    #[allow(dead_code)]
    node_version: Option<String>,
}

impl BackendController {
    pub fn start(&self, app_handle: &AppHandle) {
        if self.started.swap(true, Ordering::SeqCst) {
            return;
        }

        let (tx, rx) = mpsc::channel();
        {
            let mut guard = self.tx.lock().unwrap();
            *guard = Some(tx);
        }

        let handle = app_handle.clone();
        thread::spawn(move || backend_worker(handle, rx));
    }

    pub fn shutdown(&self) {
        if let Some(sender) = self.tx.lock().unwrap().take() {
            let _ = sender.send(BackendCommand::Shutdown);
        }
    }
}

fn backend_worker(app_handle: AppHandle, rx: Receiver<BackendCommand>) {
    let Some(template_dir) = app_handle.path_resolver().resolve_resource("backend") else {
        eprintln!("❌ Recursos do backend não encontrados no pacote.");
        return;
    };

    let data_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
    let runtime_dir = data_dir.join("backend-runtime");

    if let Err(err) = ensure_backend_runtime(&template_dir, &runtime_dir) {
        eprintln!("❌ Falha ao preparar backend: {err}");
        emit_status(
            &app_handle,
            "error",
            Some(format!("Preparação falhou: {err}")),
        );
        return;
    }

    emit_status(
        &app_handle,
        "prepared",
        Some(format!("Backend em {:?}", runtime_dir)),
    );

    loop {
        match rx.try_recv() {
            Ok(BackendCommand::Shutdown) | Err(mpsc::TryRecvError::Disconnected) => {
                emit_status(&app_handle, "stopped", Some("Aplicação encerrada".into()));
                break;
            }
            Err(mpsc::TryRecvError::Empty) => {}
        }

        match spawn_backend_child(&runtime_dir) {
            Ok(mut child) => {
                let pid = child.id();
                emit_status(
                    &app_handle,
                    "running",
                    Some(format!("Backend iniciado (PID {pid})")),
                );

                let mut shutdown_requested = false;
                loop {
                    match rx.recv_timeout(Duration::from_secs(2)) {
                        Ok(BackendCommand::Shutdown) => {
                            shutdown_requested = true;
                            let _ = child.kill();
                            let _ = child.wait();
                            emit_status(&app_handle, "stopped", Some("Backend encerrado".into()));
                            break;
                        }
                        Err(RecvTimeoutError::Timeout) => match child.try_wait() {
                            Ok(Some(status)) => {
                                emit_status(
                                    &app_handle,
                                    "stopped",
                                    Some(format!("Processo saiu com {:?}", status.code())),
                                );
                                break;
                            }
                            Ok(None) => {
                                continue;
                            }
                            Err(err) => {
                                emit_status(
                                    &app_handle,
                                    "error",
                                    Some(format!("Erro ao verificar backend: {err}")),
                                );
                                break;
                            }
                        },
                        Err(RecvTimeoutError::Disconnected) => {
                            let _ = child.kill();
                            let _ = child.wait();
                            return;
                        }
                    }
                }

                if shutdown_requested {
                    return;
                }

                thread::sleep(Duration::from_secs(2));
                emit_status(
                    &app_handle,
                    "restarting",
                    Some("Reiniciando backend".into()),
                );
            }
            Err(err) => {
                emit_status(
                    &app_handle,
                    "error",
                    Some(format!("Falha ao iniciar backend: {err}")),
                );

                match rx.recv_timeout(Duration::from_secs(5)) {
                    Ok(BackendCommand::Shutdown) | Err(RecvTimeoutError::Disconnected) => {
                        emit_status(&app_handle, "stopped", Some("Encerrado".into()));
                        break;
                    }
                    Err(RecvTimeoutError::Timeout) => {
                        continue;
                    }
                }
            }
        }
    }
}

fn ensure_backend_runtime(template_dir: &Path, runtime_dir: &Path) -> io::Result<()> {
    let template_meta = read_backend_meta(&template_dir.join(BACKEND_META_FILE))?;
    let runtime_meta_path = runtime_dir.join(BACKEND_META_FILE);
    let mut needs_copy = true;

    if runtime_meta_path.exists() {
        if let Ok(meta) = read_backend_meta(&runtime_meta_path) {
            if meta.hash == template_meta.hash {
                needs_copy = false;
            }
        }
    }

    if needs_copy {
        let preserved_config = read_optional_file(&runtime_dir.join("rfid-config.json"));
        if runtime_dir.exists() {
            fs::remove_dir_all(runtime_dir)?;
        }
        copy_dir_recursive(template_dir, runtime_dir)?;
        if let Some(config_contents) = preserved_config {
            fs::write(runtime_dir.join("rfid-config.json"), config_contents)?;
        }
    }

    Ok(())
}

fn read_backend_meta(path: &Path) -> io::Result<BackendMeta> {
    let mut file = File::open(path)?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    let meta: BackendMeta = serde_json::from_str(&contents).map_err(|err| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("Metadata inválido em {:?}: {err}", path),
        )
    })?;
    Ok(meta)
}

fn read_optional_file(path: &Path) -> Option<String> {
    fs::read_to_string(path).ok()
}

fn copy_dir_recursive(source: &Path, destination: &Path) -> io::Result<()> {
    for entry in WalkDir::new(source) {
        let entry = entry?;
        let relative_path = entry.path().strip_prefix(source).unwrap();
        let target_path = destination.join(relative_path);
        if entry.file_type().is_dir() {
            fs::create_dir_all(&target_path)?;
        } else if entry.file_type().is_file() {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(entry.path(), &target_path)?;
        }
    }
    Ok(())
}

fn spawn_backend_child(runtime_dir: &Path) -> io::Result<Child> {
    let server_path = runtime_dir.join("scale-server.cjs");
    if !server_path.exists() {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            format!(
                "Arquivo scale-server.cjs não encontrado em {:?}",
                server_path
            ),
        ));
    }

    let node_binary = detect_node_binary(runtime_dir);

    let log_path = runtime_dir.join("backend.log");
    if let Some(parent) = log_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let stdout_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)?;
    let stderr_file = stdout_file.try_clone()?;

    let mut command = StdCommand::new(node_binary);
    command
        .arg(server_path)
        .current_dir(runtime_dir)
        .env("NODE_ENV", "production")
        .stdout(Stdio::from(stdout_file))
        .stderr(Stdio::from(stderr_file));

    command.spawn()
}

fn detect_node_binary(runtime_dir: &Path) -> PathBuf {
    if let Ok(custom) = std::env::var("ECOLAV_NODE_PATH") {
        let candidate = PathBuf::from(custom);
        if candidate.exists() {
            return candidate;
        }
    }

    let bundled_windows = runtime_dir.join("node").join("node.exe");
    if bundled_windows.exists() {
        return bundled_windows;
    }

    let bundled_unix = runtime_dir.join("node").join("bin").join("node");
    if bundled_unix.exists() {
        return bundled_unix;
    }

    if cfg!(target_os = "windows") {
        PathBuf::from("node.exe")
    } else {
        PathBuf::from("node")
    }
}

fn emit_status(app_handle: &AppHandle, state: &'static str, message: Option<String>) {
    let payload = BackendStatus {
        state,
        message,
        timestamp: Utc::now().timestamp_millis(),
    };
    let _ = app_handle.emit_all("backend-status", payload);
}
