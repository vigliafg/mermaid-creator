mod commands;
mod db;
mod models;
mod openrouter;
mod prompts;
mod research;
mod secrets;
mod state;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Impossibile determinare app_data_dir: {e}"))?;
            let (data_dir, connection) = db::init(&app_data_dir)?;
            app.manage(state::AppState::new(connection, data_dir));

            // Fit the window to the monitor before maximizing. This keeps the
            // composer and titlebar usable even on small/high-DPI work areas
            // and on compositors that ignore the initial size.
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let scale = monitor.scale_factor().max(1.0);
                    let size = monitor.size();
                    let logical_width = size.width as f64 / scale;
                    let logical_height = size.height as f64 / scale;
                    let width = (logical_width - 80.0).clamp(900.0, 1280.0);
                    let height = (logical_height - 120.0).clamp(540.0, 820.0);
                    let origin = monitor.position();
                    let x = origin.x as f64 / scale + (logical_width - width) / 2.0;
                    let y = origin.y as f64 / scale + (logical_height - height) / 2.0;
                    let _ = window.set_size(tauri::LogicalSize::new(width, height));
                    let _ = window.set_position(tauri::LogicalPosition::new(x, y));
                }
                let _ = window.maximize();
            }
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
            commands::message_update_content,
            commands::diagram_repair,
            commands::diagrams_list,
            commands::library_list,
            commands::diagram_get,
            commands::diagrams_sync,
            commands::diagram_save_version,
            commands::diagram_restore,
            commands::diagram_set_flags,
            commands::diagram_set_feedback,
            commands::diagram_delete,
            commands::diagram_versions,
            commands::board_get,
            commands::board_create,
            commands::board_save,
            commands::board_delete,
            commands::board_library_load,
            commands::board_library_save,
            commands::board_library_catalog_load,
            commands::board_library_catalog_save,
            commands::save_file,
            commands::app_info,
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("Errore avvio Mermaid Creator: {error}");
        std::process::exit(1);
    }
}
