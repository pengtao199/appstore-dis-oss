mod commands;
mod config;
mod github;
mod scripts;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::get_platform,
            commands::load_script_state,
            commands::save_settings,
            commands::save_profiles,
            commands::load_app_config,
            commands::save_app_config,
            commands::pick_file,
            commands::run_bootstrap,
            commands::run_deploy,
            commands::check_repo_access,
            commands::fetch_recent_run,
            commands::open_external
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window.show()?;
                window.set_focus()?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run tauri application");
}
