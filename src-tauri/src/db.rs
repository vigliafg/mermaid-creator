use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::models::{
    Attachment, AttachmentImport, Conversation, Diagram, DiagramBoard, DiagramInput, DiagramVersion,
    Message,
};

/// Limite della scena serializzata: oltre, l'autosave fallisce con un messaggio
/// esplicito invece di gonfiare il DB.
pub const MAX_BOARD_BYTES: usize = 25 * 1024 * 1024;

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn new_id() -> String {
    Uuid::new_v4().to_string()
}

fn config_data_dir() -> Option<String> {
    let path = dirs::config_dir()?
        .join("mermaid-creator")
        .join("config.json");
    let raw = fs::read_to_string(path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&raw).ok()?;
    value.get("data_dir")?.as_str().map(ToOwned::to_owned)
}

pub fn resolve_data_dir(app_data_dir: &Path) -> Result<PathBuf, String> {
    let env_dir = std::env::var("MERMAID_CREATOR_DATA_DIR")
        .ok()
        .filter(|s| !s.trim().is_empty());
    let cfg_dir = config_data_dir().filter(|s| !s.trim().is_empty());

    let (dir, external) = match (env_dir, cfg_dir) {
        (Some(value), _) => (PathBuf::from(value), true),
        (None, Some(value)) => (PathBuf::from(value), true),
        _ => (app_data_dir.to_path_buf(), false),
    };

    if external {
        let sentinel = dir.join(".mermaid-creator-volume");
        if !sentinel.exists() {
            return Err(format!(
                "Data dir esterna non valida: manca il sentinella in {}. Disco non montato?",
                dir.display()
            ));
        }
    }

    fs::create_dir_all(&dir).map_err(|e| format!("Impossibile creare la data dir: {e}"))?;
    fs::create_dir_all(dir.join("attachments"))
        .map_err(|e| format!("Impossibile creare attachments: {e}"))?;
    fs::create_dir_all(dir.join("backups"))
        .map_err(|e| format!("Impossibile creare backups: {e}"))?;
    Ok(dir)
}

pub fn init(app_data_dir: &Path) -> Result<(PathBuf, Connection), String> {
    let data_dir = resolve_data_dir(app_data_dir)?;
    let db_path = data_dir.join("mermaid-creator.db");
    let mut conn = Connection::open(&db_path).map_err(|e| format!("Apertura DB fallita: {e}"))?;
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| format!("WAL fallito: {e}"))?;
    conn.pragma_update(None, "synchronous", "NORMAL")
        .map_err(|e| format!("PRAGMA synchronous fallito: {e}"))?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(|e| format!("PRAGMA foreign_keys fallito: {e}"))?;
    conn.busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|e| format!("busy_timeout fallito: {e}"))?;
    migrate(&mut conn)?;
    conn.execute(
        "UPDATE messages SET status='interrupted' WHERE status='streaming'",
        [],
    )
    .map_err(|e| format!("Recupero stream interrotti fallito: {e}"))?;
    Ok((data_dir, conn))
}

const SCHEMA_V1: &str = r#"
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        model_id TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'complete',
        model_id TEXT NOT NULL DEFAULT '',
        target_diagram_id TEXT,
        usage_json TEXT,
        error TEXT,
        created_at INTEGER NOT NULL,
        UNIQUE(conversation_id, seq)
    );

    CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        message_id TEXT,
        ordinal INTEGER NOT NULL DEFAULT 0,
        kind TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime TEXT NOT NULL DEFAULT '',
        size INTEGER NOT NULL DEFAULT 0,
        storage_path TEXT,
        extracted_text TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS diagrams (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        message_id TEXT,
        ordinal INTEGER NOT NULL DEFAULT 0,
        title TEXT NOT NULL,
        source TEXT NOT NULL,
        diagram_type TEXT NOT NULL DEFAULT 'unknown',
        in_library INTEGER NOT NULL DEFAULT 0,
        favorite INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS diagram_versions (
        id TEXT PRIMARY KEY,
        diagram_id TEXT NOT NULL,
        version_no INTEGER NOT NULL,
        source TEXT NOT NULL,
        origin TEXT NOT NULL,
        created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conv_seq
        ON messages(conversation_id, seq);
    CREATE INDEX IF NOT EXISTS idx_attachments_message
        ON attachments(message_id);
    CREATE INDEX IF NOT EXISTS idx_diagrams_conv
        ON diagrams(conversation_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_diagrams_message
        ON diagrams(message_id);
    CREATE INDEX IF NOT EXISTS idx_diagram_versions
        ON diagram_versions(diagram_id, version_no);
"#;

/// Migrazione additiva: lavagna Excalidraw separata dal diagramma e snapshot
/// della lavagna dentro le versioni esistenti.
const SCHEMA_V2: &str = r#"
    ALTER TABLE diagram_versions ADD COLUMN board_snapshot TEXT;

    CREATE TABLE IF NOT EXISTS diagram_boards (
        diagram_id TEXT PRIMARY KEY,
        scene_json TEXT NOT NULL,
        origin TEXT NOT NULL,
        base_source TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );
"#;

/// Applica le migrazioni in transazione: `user_version` viene aggiornata solo
/// insieme allo schema, così un errore non lascia un DB a metà.
fn migrate(conn: &mut Connection) -> Result<(), String> {
    let version: i64 = conn
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    if version < 1 {
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        tx.execute_batch(SCHEMA_V1)
            .map_err(|e| format!("Migrazione v1 fallita: {e}"))?;
        tx.pragma_update(None, "user_version", 1)
            .map_err(|e| format!("Versione schema fallita: {e}"))?;
        tx.commit().map_err(|e| format!("Commit migrazione v1 fallito: {e}"))?;
    }

    if version < 2 {
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        tx.execute_batch(SCHEMA_V2)
            .map_err(|e| format!("Migrazione v2 fallita: {e}"))?;
        tx.pragma_update(None, "user_version", 2)
            .map_err(|e| format!("Versione schema fallita: {e}"))?;
        tx.commit().map_err(|e| format!("Commit migrazione v2 fallito: {e}"))?;
    }

    Ok(())
}

fn map_conversation(row: &rusqlite::Row<'_>) -> rusqlite::Result<Conversation> {
    Ok(Conversation {
        id: row.get(0)?,
        title: row.get(1)?,
        model_id: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

pub fn list_conversations(conn: &Connection) -> Result<Vec<Conversation>, String> {
    let mut stmt = conn
        .prepare("SELECT id,title,model_id,created_at,updated_at FROM conversations ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], map_conversation)
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())
}

pub fn create_conversation(
    conn: &Connection,
    title: &str,
    model_id: &str,
) -> Result<Conversation, String> {
    let now = now_ms();
    let item = Conversation {
        id: new_id(),
        title: title.to_string(),
        model_id: model_id.to_string(),
        created_at: now,
        updated_at: now,
    };
    conn.execute(
        "INSERT INTO conversations(id,title,model_id,created_at,updated_at) VALUES (?1,?2,?3,?4,?5)",
        params![item.id, item.title, item.model_id, item.created_at, item.updated_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(item)
}

pub fn get_conversation(conn: &Connection, id: &str) -> Result<Option<Conversation>, String> {
    conn.query_row(
        "SELECT id,title,model_id,created_at,updated_at FROM conversations WHERE id=?1",
        params![id],
        map_conversation,
    )
    .optional()
    .map_err(|e| e.to_string())
}

pub fn rename_conversation(conn: &Connection, id: &str, title: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE conversations SET title=?1, updated_at=?2 WHERE id=?3",
        params![title, now_ms(), id],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

pub fn delete_conversation(conn: &mut Connection, id: &str, data_dir: &Path) -> Result<(), String> {
    let paths: Vec<String> = {
        let mut stmt = conn
            .prepare(
                "SELECT a.storage_path FROM attachments a
                 JOIN messages m ON m.id = a.message_id
                 WHERE m.conversation_id=?1 AND a.storage_path IS NOT NULL",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![id], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|e| e.to_string())?
    };

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE diagrams SET conversation_id=NULL, message_id=NULL
         WHERE conversation_id=?1 AND in_library=1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM diagram_boards WHERE diagram_id IN
         (SELECT id FROM diagrams WHERE conversation_id=?1 AND in_library=0)",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM diagram_versions WHERE diagram_id IN
         (SELECT id FROM diagrams WHERE conversation_id=?1 AND in_library=0)",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM diagrams WHERE conversation_id=?1 AND in_library=0",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM attachments WHERE message_id IN
         (SELECT id FROM messages WHERE conversation_id=?1)",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM messages WHERE conversation_id=?1", params![id])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM conversations WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;

    for rel in paths {
        let _ = fs::remove_file(data_dir.join(rel));
    }
    Ok(())
}

fn map_message(row: &rusqlite::Row<'_>) -> rusqlite::Result<Message> {
    Ok(Message {
        id: row.get(0)?,
        conversation_id: row.get(1)?,
        seq: row.get(2)?,
        role: row.get(3)?,
        content: row.get(4)?,
        status: row.get(5)?,
        model_id: row.get(6)?,
        target_diagram_id: row.get(7)?,
        usage_json: row.get(8)?,
        error: row.get(9)?,
        created_at: row.get(10)?,
        attachments: Vec::new(),
    })
}

pub fn attachments_for_message(
    conn: &Connection,
    message_id: &str,
) -> Result<Vec<Attachment>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id,message_id,ordinal,kind,filename,mime,size,storage_path,extracted_text,created_at
             FROM attachments WHERE message_id=?1 ORDER BY ordinal, created_at",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![message_id], |row| {
            let path: Option<String> = row.get(7)?;
            Ok(Attachment {
                id: row.get(0)?,
                message_id: row.get(1)?,
                ordinal: row.get(2)?,
                kind: row.get(3)?,
                filename: row.get(4)?,
                mime: row.get(5)?,
                size: row.get(6)?,
                has_file: path.is_some(),
                extracted_text: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())
}

pub fn list_messages(conn: &Connection, conversation_id: &str) -> Result<Vec<Message>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id,conversation_id,seq,role,content,status,model_id,target_diagram_id,
                    usage_json,error,created_at
             FROM messages WHERE conversation_id=?1 ORDER BY seq",
        )
        .map_err(|e| e.to_string())?;
    let base = stmt
        .query_map(params![conversation_id], map_message)
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    let mut messages = Vec::with_capacity(base.len());
    for mut message in base {
        message.attachments = attachments_for_message(conn, &message.id)?;
        messages.push(message);
    }
    Ok(messages)
}

pub fn create_message(
    conn: &Connection,
    conversation_id: &str,
    role: &str,
    content: &str,
    status: &str,
    model_id: &str,
    target_diagram_id: Option<&str>,
) -> Result<Message, String> {
    let seq: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(seq),0)+1 FROM messages WHERE conversation_id=?1",
            params![conversation_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let now = now_ms();
    let item = Message {
        id: new_id(),
        conversation_id: conversation_id.to_string(),
        seq,
        role: role.to_string(),
        content: content.to_string(),
        status: status.to_string(),
        model_id: model_id.to_string(),
        target_diagram_id: target_diagram_id.map(ToOwned::to_owned),
        usage_json: None,
        error: None,
        created_at: now,
        attachments: Vec::new(),
    };
    conn.execute(
        "INSERT INTO messages(id,conversation_id,seq,role,content,status,model_id,target_diagram_id,created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![
            item.id,
            item.conversation_id,
            item.seq,
            item.role,
            item.content,
            item.status,
            item.model_id,
            item.target_diagram_id,
            item.created_at
        ],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE conversations SET updated_at=?1, model_id=?2 WHERE id=?3",
        params![now, model_id, conversation_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(item)
}

pub fn update_message(
    conn: &Connection,
    id: &str,
    content: &str,
    status: &str,
    usage_json: Option<&str>,
    error: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "UPDATE messages SET content=?1, status=?2, usage_json=?3, error=?4 WHERE id=?5",
        params![content, status, usage_json, error, id],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

pub fn link_attachments(conn: &Connection, ids: &[String], message_id: &str) -> Result<(), String> {
    for (index, id) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE attachments SET message_id=?1, ordinal=?2 WHERE id=?3",
            params![message_id, index as i64, id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn extension_for(filename: &str, mime: &str) -> String {
    if let Some(ext) = filename.rsplit('.').next() {
        let clean: String = ext
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .take(8)
            .collect();
        if !clean.is_empty() && clean != filename {
            return clean.to_lowercase();
        }
    }
    match mime {
        "image/png" => "png".into(),
        "image/jpeg" => "jpg".into(),
        "image/webp" => "webp".into(),
        "image/gif" => "gif".into(),
        _ => "bin".into(),
    }
}

pub fn import_attachment(
    conn: &Connection,
    data_dir: &Path,
    input: AttachmentImport,
) -> Result<Attachment, String> {
    let id = new_id();
    let now = now_ms();
    let mut storage_path: Option<String> = None;
    let mut size = input.text.len() as i64;

    if let Some(encoded) = input.data_base64.as_deref() {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .map_err(|e| format!("Allegato base64 non valido: {e}"))?;
        if bytes.len() > 25 * 1024 * 1024 {
            return Err("Allegato troppo grande (max 25 MB)".into());
        }
        let ext = extension_for(&input.filename, &input.mime);
        let rel = format!("attachments/{id}.{ext}");
        let full = data_dir.join(&rel);
        fs::write(&full, &bytes).map_err(|e| format!("Scrittura allegato fallita: {e}"))?;
        size = bytes.len() as i64;
        storage_path = Some(rel);
    }

    conn.execute(
        "INSERT INTO attachments(id,message_id,ordinal,kind,filename,mime,size,storage_path,extracted_text,created_at)
         VALUES (?1,NULL,0,?2,?3,?4,?5,?6,?7,?8)",
        params![
            id,
            input.kind,
            input.filename,
            input.mime,
            size,
            storage_path,
            input.text,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Attachment {
        id,
        message_id: None,
        ordinal: 0,
        kind: input.kind,
        filename: input.filename,
        mime: input.mime,
        size,
        has_file: storage_path.is_some(),
        extracted_text: input.text,
        created_at: now,
    })
}

pub fn attachment_preview(conn: &Connection, data_dir: &Path, id: &str) -> Result<String, String> {
    let (path, mime): (Option<String>, String) = conn
        .query_row(
            "SELECT storage_path,mime FROM attachments WHERE id=?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| e.to_string())?;
    let Some(path) = path else {
        return Err("Allegato senza file".into());
    };
    let bytes =
        fs::read(data_dir.join(path)).map_err(|e| format!("Lettura allegato fallita: {e}"))?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:{mime};base64,{encoded}"))
}

fn map_diagram(row: &rusqlite::Row<'_>) -> rusqlite::Result<Diagram> {
    Ok(Diagram {
        id: row.get(0)?,
        conversation_id: row.get(1)?,
        message_id: row.get(2)?,
        ordinal: row.get(3)?,
        title: row.get(4)?,
        source: row.get(5)?,
        diagram_type: row.get(6)?,
        in_library: row.get::<_, i64>(7)? != 0,
        favorite: row.get::<_, i64>(8)? != 0,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

pub fn list_diagrams(conn: &Connection, conversation_id: &str) -> Result<Vec<Diagram>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id,conversation_id,message_id,ordinal,title,source,diagram_type,
                    in_library,favorite,created_at,updated_at
             FROM diagrams WHERE conversation_id=?1 ORDER BY ordinal, created_at",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![conversation_id], map_diagram)
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())
}

pub fn get_diagram(conn: &Connection, id: &str) -> Result<Option<Diagram>, String> {
    conn.query_row(
        "SELECT id,conversation_id,message_id,ordinal,title,source,diagram_type,
                in_library,favorite,created_at,updated_at
         FROM diagrams WHERE id=?1",
        params![id],
        map_diagram,
    )
    .optional()
    .map_err(|e| e.to_string())
}

pub fn list_library(conn: &Connection, query: &str) -> Result<Vec<Diagram>, String> {
    let q = query.trim();
    let pattern = format!("%{q}%");
    let mut stmt = conn
        .prepare(
            "SELECT id,conversation_id,message_id,ordinal,title,source,diagram_type,
                    in_library,favorite,created_at,updated_at
             FROM diagrams
             WHERE in_library=1 AND (?1='' OR title LIKE ?2 OR source LIKE ?2)
             ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![q, pattern], map_diagram)
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())
}

fn next_version_no(tx: &rusqlite::Transaction<'_>, diagram_id: &str) -> Result<i64, String> {
    tx.query_row(
        "SELECT COALESCE(MAX(version_no),0)+1 FROM diagram_versions WHERE diagram_id=?1",
        params![diagram_id],
        |r| r.get(0),
    )
    .map_err(|e| e.to_string())
}

fn insert_version(
    tx: &rusqlite::Transaction<'_>,
    diagram_id: &str,
    source: &str,
    origin: &str,
    board_snapshot: Option<&str>,
) -> Result<(), String> {
    let version_no = next_version_no(tx, diagram_id)?;
    let id = new_id();
    let now = now_ms();
    tx.execute(
        "INSERT INTO diagram_versions(id,diagram_id,version_no,source,origin,board_snapshot,created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![id, diagram_id, version_no, source, origin, board_snapshot, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn fallback_title(index: i64) -> String {
    format!("Diagramma {}", index + 1)
}

pub fn diagrams_sync(
    conn: &mut Connection,
    conversation_id: &str,
    message_id: &str,
    target_id: Option<&str>,
    items: &[DiagramInput],
) -> Result<Vec<Diagram>, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let now = now_ms();

    for (index, item) in items.iter().enumerate() {
        let ordinal = item.ordinal;
        let title = if item.title.trim().is_empty() {
            fallback_title(index as i64)
        } else {
            item.title.trim().to_string()
        };
        let dtype = if item.diagram_type.trim().is_empty() {
            "unknown".to_string()
        } else {
            item.diagram_type.trim().to_string()
        };

        let target_existing = if index == 0 {
            if let Some(target) = target_id {
                tx.query_row(
                    "SELECT id,conversation_id,message_id,ordinal,title,source,diagram_type,
                            in_library,favorite,created_at,updated_at
                     FROM diagrams WHERE id=?1",
                    params![target],
                    map_diagram,
                )
                .optional()
                .map_err(|e| e.to_string())?
            } else {
                None
            }
        } else {
            None
        };

        if let Some(existing) = target_existing {
            tx.execute(
                "UPDATE diagrams SET title=?1, source=?2, diagram_type=?3, message_id=?4,
                        conversation_id=?5, updated_at=?6 WHERE id=?7",
                params![
                    title,
                    item.source,
                    dtype,
                    message_id,
                    conversation_id,
                    now,
                    existing.id
                ],
            )
            .map_err(|e| e.to_string())?;
            if existing.source != item.source {
                insert_version(&tx, &existing.id, &item.source, "ai", None)?;
            }
            continue;
        }

        let existing = tx
            .query_row(
                "SELECT id,conversation_id,message_id,ordinal,title,source,diagram_type,
                        in_library,favorite,created_at,updated_at
                 FROM diagrams WHERE message_id=?1 AND ordinal=?2 LIMIT 1",
                params![message_id, ordinal],
                map_diagram,
            )
            .optional()
            .map_err(|e| e.to_string())?;

        if let Some(existing) = existing {
            tx.execute(
                "UPDATE diagrams SET title=?1, source=?2, diagram_type=?3, updated_at=?4
                 WHERE id=?5",
                params![title, item.source, dtype, now, existing.id],
            )
            .map_err(|e| e.to_string())?;
            if existing.source != item.source {
                insert_version(&tx, &existing.id, &item.source, "ai", None)?;
            }
        } else {
            let id = new_id();
            tx.execute(
                "INSERT INTO diagrams(id,conversation_id,message_id,ordinal,title,source,
                        diagram_type,in_library,favorite,created_at,updated_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,0,0,?8,?9)",
                params![
                    id,
                    conversation_id,
                    message_id,
                    ordinal,
                    title,
                    item.source,
                    dtype,
                    now,
                    now
                ],
            )
            .map_err(|e| e.to_string())?;
            insert_version(&tx, &id, &item.source, "ai", None)?;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    list_diagrams(conn, conversation_id)
}

pub fn save_diagram_version(
    conn: &mut Connection,
    id: &str,
    source: &str,
    title: Option<&str>,
) -> Result<Diagram, String> {
    let current = get_diagram(conn, id)?.ok_or_else(|| "Diagramma non trovato".to_string())?;
    let new_title = title
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(&current.title)
        .to_string();
    let board = get_board(conn, id)?;
    let last_snapshot: Option<String> = conn
        .query_row(
            "SELECT board_snapshot FROM diagram_versions
             WHERE diagram_id=?1 ORDER BY version_no DESC LIMIT 1",
            params![id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .flatten();
    let board_scene = board.as_ref().map(|item| item.scene_json.as_str());
    let changed =
        current.source != source || board_scene.map(str::to_string) != last_snapshot;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE diagrams SET title=?1, source=?2, updated_at=?3 WHERE id=?4",
        params![new_title, source, now_ms(), id],
    )
    .map_err(|e| e.to_string())?;
    if changed {
        insert_version(&tx, id, source, "user", board_scene)?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    get_diagram(conn, id)?.ok_or_else(|| "Diagramma non trovato".to_string())
}

pub fn set_diagram_flags(
    conn: &Connection,
    id: &str,
    in_library: Option<bool>,
    favorite: Option<bool>,
) -> Result<Diagram, String> {
    let current = get_diagram(conn, id)?.ok_or_else(|| "Diagramma non trovato".to_string())?;
    let lib = in_library.unwrap_or(current.in_library);
    let fav = favorite.unwrap_or(current.favorite);
    conn.execute(
        "UPDATE diagrams SET in_library=?1, favorite=?2, updated_at=?3 WHERE id=?4",
        params![lib as i64, fav as i64, now_ms(), id],
    )
    .map_err(|e| e.to_string())?;
    get_diagram(conn, id)?.ok_or_else(|| "Diagramma non trovato".to_string())
}

pub fn delete_diagram(conn: &mut Connection, id: &str) -> Result<(), String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM diagram_boards WHERE diagram_id=?1", params![id])
        .map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM diagram_versions WHERE diagram_id=?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM diagrams WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list_versions(conn: &Connection, diagram_id: &str) -> Result<Vec<DiagramVersion>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id,diagram_id,version_no,source,origin,board_snapshot,created_at
             FROM diagram_versions WHERE diagram_id=?1 ORDER BY version_no DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![diagram_id], |row| {
            Ok(DiagramVersion {
                id: row.get(0)?,
                diagram_id: row.get(1)?,
                version_no: row.get(2)?,
                source: row.get(3)?,
                origin: row.get(4)?,
                board_snapshot: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())
}

pub fn restore_version(
    conn: &mut Connection,
    diagram_id: &str,
    version_id: &str,
) -> Result<Diagram, String> {
    let (source, snapshot): (String, Option<String>) = conn
        .query_row(
            "SELECT source,board_snapshot FROM diagram_versions WHERE id=?1 AND diagram_id=?2",
            params![version_id, diagram_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE diagrams SET source=?1, updated_at=?2 WHERE id=?3",
        params![source, now_ms(), diagram_id],
    )
    .map_err(|e| e.to_string())?;
    if let Some(scene) = snapshot.as_deref() {
        if scene.len() > MAX_BOARD_BYTES {
            return Err("Snapshot lavagna troppo grande (max 25 MB)".into());
        }
        let current: Option<(String, Option<String>)> = tx
            .query_row(
                "SELECT origin,base_source FROM diagram_boards WHERE diagram_id=?1",
                params![diagram_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        match current {
            Some((origin, _)) => {
                let base = if origin == "manual" {
                    None
                } else {
                    Some(source.as_str())
                };
                tx.execute(
                    "UPDATE diagram_boards SET scene_json=?1, base_source=?2, updated_at=?3
                     WHERE diagram_id=?4",
                    params![scene, base, now_ms(), diagram_id],
                )
                .map_err(|e| e.to_string())?;
            }
            None => {
                tx.execute(
                    "INSERT INTO diagram_boards(diagram_id,scene_json,origin,base_source,created_at,updated_at)
                     VALUES (?1,?2,'diagram',?3,?4,?4)",
                    params![diagram_id, scene, source.as_str(), now_ms()],
                )
                .map_err(|e| e.to_string())?;
            }
        }
    }
    insert_version(&tx, diagram_id, &source, "restore", snapshot.as_deref())?;
    tx.commit().map_err(|e| e.to_string())?;
    get_diagram(conn, diagram_id)?.ok_or_else(|| "Diagramma non trovato".to_string())
}

fn map_board(row: &rusqlite::Row<'_>) -> rusqlite::Result<DiagramBoard> {
    Ok(DiagramBoard {
        diagram_id: row.get(0)?,
        scene_json: row.get(1)?,
        origin: row.get(2)?,
        base_source: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

pub fn get_board(conn: &Connection, diagram_id: &str) -> Result<Option<DiagramBoard>, String> {
    conn.query_row(
        "SELECT diagram_id,scene_json,origin,base_source,created_at,updated_at
         FROM diagram_boards WHERE diagram_id=?1",
        params![diagram_id],
        map_board,
    )
    .optional()
    .map_err(|e| e.to_string())
}

fn validate_board_scene(scene_json: &str) -> Result<(), String> {
    if scene_json.trim().is_empty() {
        return Err("Scena lavagna vuota".into());
    }
    if scene_json.len() > MAX_BOARD_BYTES {
        return Err("Lavagna troppo grande (max 25 MB)".into());
    }
    let value: serde_json::Value =
        serde_json::from_str(scene_json).map_err(|e| format!("Scena lavagna non valida: {e}"))?;
    if !value.is_object() {
        return Err("Scena lavagna non valida: atteso un oggetto JSON".into());
    }
    Ok(())
}

/// Crea o sostituisce una lavagna, impostando anche origine e base source.
/// Usata alla creazione, alla rigenerazione e al ripristino.
pub fn create_board(
    conn: &Connection,
    diagram_id: &str,
    scene_json: &str,
    origin: &str,
    base_source: Option<&str>,
) -> Result<DiagramBoard, String> {
    if origin != "diagram" && origin != "manual" {
        return Err(format!("Origine lavagna non valida: {origin}"));
    }
    validate_board_scene(scene_json)?;
    get_diagram(conn, diagram_id)?.ok_or_else(|| "Diagramma non trovato".to_string())?;
    let now = now_ms();
    let base = if origin == "manual" { None } else { base_source };
    conn.execute(
        "INSERT INTO diagram_boards(diagram_id,scene_json,origin,base_source,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?5)
         ON CONFLICT(diagram_id) DO UPDATE SET
             scene_json=excluded.scene_json,
             origin=excluded.origin,
             base_source=excluded.base_source,
             updated_at=excluded.updated_at",
        params![diagram_id, scene_json, origin, base, now],
    )
    .map_err(|e| e.to_string())?;
    get_board(conn, diagram_id)?.ok_or_else(|| "Lavagna non trovata".to_string())
}

/// Autosave: aggiorna solo scena e timestamp. Origine e base source restano
/// quelli impostati alla creazione/rigenerazione.
pub fn save_board_scene(
    conn: &Connection,
    diagram_id: &str,
    scene_json: &str,
) -> Result<DiagramBoard, String> {
    validate_board_scene(scene_json)?;
    let changed = conn
        .execute(
            "UPDATE diagram_boards SET scene_json=?1, updated_at=?2 WHERE diagram_id=?3",
            params![scene_json, now_ms(), diagram_id],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("Lavagna non trovata".into());
    }
    get_board(conn, diagram_id)?.ok_or_else(|| "Lavagna non trovata".to_string())
}

pub fn delete_board(conn: &Connection, diagram_id: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM diagram_boards WHERE diagram_id=?1",
        params![diagram_id],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key=?1",
        params![key],
        |r| r.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings(key,value) VALUES (?1,?2)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![key, value],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

pub fn settings_map(conn: &Connection) -> Result<HashMap<String, String>, String> {
    let mut stmt = conn
        .prepare("SELECT key,value FROM settings")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;
    let mut map = HashMap::new();
    for row in rows {
        let (k, v) = row.map_err(|e| e.to_string())?;
        map.insert(k, v);
    }
    Ok(map)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn open_v1() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA_V1).unwrap();
        conn.pragma_update(None, "user_version", 1).unwrap();
        conn
    }

    fn migrated() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        conn
    }

    fn insert_diagram(conn: &Connection, id: &str, conversation_id: Option<&str>, in_library: bool) {
        conn.execute(
            "INSERT INTO diagrams(id,conversation_id,message_id,ordinal,title,source,
                    diagram_type,in_library,favorite,created_at,updated_at)
             VALUES (?1,?2,NULL,0,'Test','flowchart LR\n A-->B','flowchart',?3,0,1,1)",
            params![id, conversation_id, in_library as i64],
        )
        .unwrap();
    }

    fn scene(label: &str) -> String {
        format!(
            r##"{{"type":"excalidraw","version":2,"source":"test","elements":[{{"id":"{label}"}}],"appState":{{"viewBackgroundColor":"#fff"}},"files":{{}}}}"##
        )
    }

    fn versions(conn: &Connection, id: &str) -> Vec<DiagramVersion> {
        list_versions(conn, id).unwrap()
    }

    #[test]
    fn migrates_v1_to_v2_preserving_data() {
        let mut conn = open_v1();
        insert_diagram(&conn, "d1", None, false);
        conn.execute(
            "INSERT INTO diagram_versions(id,diagram_id,version_no,source,origin,created_at)
             VALUES ('v1','d1',1,'flowchart LR\n A-->B','ai',1)",
            [],
        )
        .unwrap();

        migrate(&mut conn).unwrap();

        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, 2);
        assert_eq!(get_diagram(&conn, "d1").unwrap().unwrap().title, "Test");
        let old = versions(&conn, "d1");
        assert_eq!(old.len(), 1);
        assert_eq!(old[0].source, "flowchart LR\n A-->B");
        assert!(old[0].board_snapshot.is_none());
        assert!(get_board(&conn, "d1").unwrap().is_none());
    }

    #[test]
    fn failed_v2_migration_does_not_bump_user_version() {
        let mut conn = open_v1();
        // Simula uno schema parziale: la ALTER TABLE della v2 fallisce.
        conn.execute_batch("ALTER TABLE diagram_versions ADD COLUMN board_snapshot TEXT;")
            .unwrap();

        assert!(migrate(&mut conn).is_err());
        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, 1);
    }

    #[test]
    fn board_crud_keeps_origin_and_base_source_on_autosave() {
        let conn = migrated();
        insert_diagram(&conn, "d1", None, false);

        let created = create_board(&conn, "d1", &scene("a"), "diagram", Some("src-1")).unwrap();
        assert_eq!(created.origin, "diagram");
        assert_eq!(created.base_source.as_deref(), Some("src-1"));
        assert!(get_board(&conn, "d1").unwrap().is_some());

        let saved = save_board_scene(&conn, "d1", &scene("b")).unwrap();
        assert_eq!(saved.scene_json, scene("b"));
        assert_eq!(saved.origin, "diagram");
        assert_eq!(saved.base_source.as_deref(), Some("src-1"));
        assert_eq!(saved.created_at, created.created_at);

        delete_board(&conn, "d1").unwrap();
        assert!(get_board(&conn, "d1").unwrap().is_none());
    }

    #[test]
    fn manual_board_has_no_base_source() {
        let conn = migrated();
        insert_diagram(&conn, "d1", None, false);
        let board = create_board(&conn, "d1", &scene("a"), "manual", Some("ignored")).unwrap();
        assert_eq!(board.origin, "manual");
        assert!(board.base_source.is_none());
    }

    #[test]
    fn rejects_oversized_and_invalid_scenes() {
        let conn = migrated();
        insert_diagram(&conn, "d1", None, false);
        assert!(create_board(&conn, "d1", "not json", "manual", None).is_err());
        assert!(create_board(&conn, "d1", "", "manual", None).is_err());
        let huge = "x".repeat(MAX_BOARD_BYTES + 1);
        assert!(create_board(&conn, "d1", &huge, "manual", None)
            .unwrap_err()
            .contains("troppo grande"));
    }

    #[test]
    fn deleting_a_diagram_removes_board_and_versions() {
        let mut conn = migrated();
        insert_diagram(&conn, "d1", None, false);
        create_board(&conn, "d1", &scene("a"), "manual", None).unwrap();
        save_diagram_version(&mut conn, "d1", "flowchart LR\n A-->B", None).unwrap();

        delete_diagram(&mut conn, "d1").unwrap();
        assert!(get_board(&conn, "d1").unwrap().is_none());
        assert!(versions(&conn, "d1").is_empty());
    }

    #[test]
    fn deleting_a_conversation_removes_boards_but_keeps_library_diagrams() {
        let mut conn = migrated();
        let conv = create_conversation(&conn, "Chat", "").unwrap();
        insert_diagram(&conn, "ephemeral", Some(&conv.id), false);
        insert_diagram(&conn, "kept", Some(&conv.id), true);
        create_board(&conn, "ephemeral", &scene("a"), "manual", None).unwrap();
        create_board(&conn, "kept", &scene("b"), "manual", None).unwrap();

        delete_conversation(&mut conn, &conv.id, &std::env::temp_dir()).unwrap();
        assert!(get_diagram(&conn, "ephemeral").unwrap().is_none());
        assert!(get_board(&conn, "ephemeral").unwrap().is_none());
        assert!(get_diagram(&conn, "kept").unwrap().is_some());
        assert!(get_board(&conn, "kept").unwrap().is_some());
    }

    #[test]
    fn version_is_created_when_only_the_board_changes() {
        let mut conn = migrated();
        insert_diagram(&conn, "d1", None, false);
        create_board(&conn, "d1", &scene("a"), "diagram", Some("flowchart LR\n A-->B")).unwrap();

        save_diagram_version(&mut conn, "d1", "flowchart LR\n A-->B", None).unwrap();
        assert_eq!(versions(&conn, "d1").len(), 1);

        // Stesso sorgente, scena diversa: nuova versione con snapshot.
        save_board_scene(&conn, "d1", &scene("b")).unwrap();
        save_diagram_version(&mut conn, "d1", "flowchart LR\n A-->B", None).unwrap();
        let list = versions(&conn, "d1");
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].board_snapshot.as_deref(), Some(scene("b").as_str()));

        // Nessun cambiamento: non si crea una terza versione.
        save_diagram_version(&mut conn, "d1", "flowchart LR\n A-->B", None).unwrap();
        assert_eq!(versions(&conn, "d1").len(), 2);
    }

    #[test]
    fn restoring_a_version_with_snapshot_restores_both_sides() {
        let mut conn = migrated();
        insert_diagram(&conn, "d1", None, false);
        let base = "flowchart LR\n A-->B";
        conn.execute(
            "UPDATE diagrams SET source=?1 WHERE id='d1'",
            params![base],
        )
        .unwrap();
        create_board(&conn, "d1", &scene("saved"), "diagram", Some(base)).unwrap();
        save_diagram_version(&mut conn, "d1", base, None).unwrap();
        let version_id = versions(&conn, "d1")[0].id.clone();

        // L'utente modifica entrambi i lati.
        conn.execute(
            "UPDATE diagrams SET source='flowchart LR\n A-->C' WHERE id='d1'",
            [],
        )
        .unwrap();
        save_board_scene(&conn, "d1", &scene("edited")).unwrap();

        restore_version(&mut conn, "d1", &version_id).unwrap();
        let diagram = get_diagram(&conn, "d1").unwrap().unwrap();
        let board = get_board(&conn, "d1").unwrap().unwrap();
        assert_eq!(diagram.source, base);
        assert_eq!(board.scene_json, scene("saved"));
        assert_eq!(board.origin, "diagram");
        assert_eq!(board.base_source.as_deref(), Some(base));
    }

    #[test]
    fn restoring_without_snapshot_leaves_the_board_untouched() {
        let mut conn = migrated();
        insert_diagram(&conn, "d1", None, false);
        let current = "flowchart LR\n A-->B";
        conn.execute("UPDATE diagrams SET source=?1 WHERE id='d1'", params![current])
            .unwrap();
        conn.execute(
            "INSERT INTO diagram_versions(id,diagram_id,version_no,source,origin,created_at)
             VALUES ('old','d1',1,'flowchart LR\n X-->Y','user',1)",
            [],
        )
        .unwrap();
        create_board(&conn, "d1", &scene("manual-work"), "diagram", Some(current)).unwrap();

        restore_version(&mut conn, "d1", "old").unwrap();
        let board = get_board(&conn, "d1").unwrap().unwrap();
        assert_eq!(board.scene_json, scene("manual-work"));
        // Il client calcola stale: base_source non coincide col sorgente ripristinato.
        assert_ne!(board.base_source.as_deref(), Some("flowchart LR\n X-->Y"));
    }
}
