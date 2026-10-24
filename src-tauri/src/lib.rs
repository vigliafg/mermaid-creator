mod commands;
mod db;
mod models;
mod openrouter;
mod secrets;
mod state;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Impossibile determinare app_data_dir: {e}"))?;
            let (data_dir, connection) = db::init(&app_data_dir)?;
            app.manage(state::AppState::new(connection, data_dir));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::key_status,
            commands::key_set,
            commands::key_test,
            commands::key_delete,
            commands::models_list,
            commands::settings_get,
            commands::settings_all,
            commands::settings_set,
            commands::conversations_list,
            commands::conversation_create,
            commands::conversation_rename,
            commands::conversation_delete,
            commands::messages_list,
            commands::attachment_import,
            commands::attachment_preview,
            commands::attachment_delete,
            commands::chat_send,
            commands::chat_cancel,
            commands::diagrams_list,
            commands::library_list,
            commands::diagram_get,
            commands::diagrams_sync,
            commands::diagram_save_version,
            commands::diagram_restore,
            commands::diagram_set_flags,
            commands::diagram_delete,
            commands::diagram_versions,
            commands::save_file,
            commands::app_info,
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("Errore avvio Mermaid Creator: {error}");
        std::process::exit(1);
    }
}
