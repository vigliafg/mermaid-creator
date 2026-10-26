use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use tokio_util::sync::CancellationToken;

use crate::research;
use crate::secrets;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub http: reqwest::Client,
    pub research_http: reqwest::Client,
    pub cancels: Mutex<HashMap<String, CancellationToken>>,
    pub memory_key: Mutex<Option<String>>,
    pub data_dir: PathBuf,
}

impl AppState {
    pub fn new(db: Connection, data_dir: PathBuf) -> Self {
        let http = reqwest::Client::builder()
            .user_agent("MermaidCreator/0.1 (Tauri)")
            .connect_timeout(std::time::Duration::from_secs(20))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        Self {
            db: Mutex::new(db),
            http,
            research_http: research::build_client(),
            cancels: Mutex::new(HashMap::new()),
            memory_key: Mutex::new(None),
            data_dir,
        }
    }

    pub fn key(&self) -> Result<String, String> {
        if let Some(value) = self
            .memory_key
            .lock()
            .map_err(|_| "Stato key non disponibile")?
            .clone()
        {
            return Ok(value);
        }
        match secrets::get_key() {
            Ok(Some(value)) => Ok(value),
            Ok(None) => Err("Nessuna API key OpenRouter configurata".into()),
            Err(e) => Err(e),
        }
    }

    pub fn remember_key(&self, key: &str) {
        if let Ok(mut guard) = self.memory_key.lock() {
            *guard = Some(key.to_string());
        }
    }

    pub fn forget_key(&self) {
        if let Ok(mut guard) = self.memory_key.lock() {
            *guard = None;
        }
    }

    pub fn register_cancel(&self, request_id: &str) -> Result<CancellationToken, String> {
        let token = CancellationToken::new();
        self.cancels
            .lock()
            .map_err(|_| "Stato cancellazione non disponibile")?
            .insert(request_id.to_string(), token.clone());
        Ok(token)
    }

    pub fn unregister_cancel(&self, request_id: &str) {
        if let Ok(mut guard) = self.cancels.lock() {
            guard.remove(request_id);
        }
    }

    pub fn cancel(&self, request_id: &str) {
        if let Ok(guard) = self.cancels.lock() {
            if let Some(token) = guard.get(request_id) {
                token.cancel();
            }
        }
    }
}
