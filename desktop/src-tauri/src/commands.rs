use rfd::FileDialog;
use serde::Serialize;
use tauri::AppHandle;

use crate::config::{
    load_app_config_file, load_script_state_file, save_app_config_file, save_profiles_file,
    save_settings_file, normalize_repo_input, AppConfig, Profile, ScriptSettings, ScriptState,
};
use crate::github::{check_repo_access as github_check_repo_access, fetch_recent_run as github_fetch_recent_run};
use crate::scripts::{run_bootstrap_with_sync, run_command};

#[derive(Debug, Clone, Serialize)]
pub struct PlatformInfo {
    pub os: String,
}

#[tauri::command]
pub fn get_platform() -> PlatformInfo {
    PlatformInfo {
        os: std::env::consts::OS.to_string(),
    }
}

#[tauri::command]
pub fn load_script_state() -> Result<ScriptState, String> {
    load_script_state_file()
}

#[tauri::command]
pub fn save_settings(repo: String, branch: String) -> Result<(), String> {
    save_settings_file(&ScriptSettings {
        repo: normalize_repo_input(&repo)?,
        branch,
    })
}

#[tauri::command]
pub fn save_profiles(profiles: Vec<Profile>) -> Result<(), String> {
    save_profiles_file(&profiles)
}

#[tauri::command]
pub fn load_app_config() -> Result<AppConfig, String> {
    load_app_config_file()
}

#[tauri::command]
pub fn save_app_config(config: AppConfig) -> Result<(), String> {
    save_app_config_file(&config)
}

#[tauri::command]
pub fn pick_file(kind: String) -> Option<String> {
    let dialog = match kind.as_str() {
        "ipa" => FileDialog::new().add_filter("IPA", &["ipa"]),
        "p8" => FileDialog::new().add_filter("P8", &["p8"]),
        _ => FileDialog::new(),
    };
    dialog.pick_file().map(|path| path.display().to_string())
}

#[tauri::command]
pub fn run_bootstrap(
    app: AppHandle,
    repo: String,
    branch: String,
    github_token: String,
) -> Result<(), String> {
    run_bootstrap_with_sync(app, repo, branch, github_token)
}

#[tauri::command]
pub fn run_deploy(
    app: AppHandle,
    profile: String,
    ipa_path: String,
    repo: String,
    branch: String,
    github_token: String,
) -> Result<(), String> {
    let normalized_repo = normalize_repo_input(&repo)?;
    let args = if cfg!(target_os = "windows") {
        vec![
            "-Profile".into(),
            profile,
            "-IpaPath".into(),
            ipa_path,
            "-Repo".into(),
            normalized_repo,
            "-Branch".into(),
            branch,
        ]
    } else {
        vec![
            "--profile".into(),
            profile,
            ipa_path,
            "--repo".into(),
            normalized_repo,
            "--branch".into(),
            branch,
        ]
    };
    let script_name = if cfg!(target_os = "windows") {
        ".\\scripts\\deploy.ps1"
    } else {
        "./scripts/deploy.sh"
    };

    run_command(app, script_name, args, github_token)
}

#[tauri::command]
pub async fn check_repo_access(repo: String, token: String) -> Result<crate::github::RepoCheckResult, String> {
    github_check_repo_access(&repo, &token).await
}

#[tauri::command]
pub async fn fetch_recent_run(
    repo: String,
    token: String,
) -> Result<Option<crate::github::RecentRunSummary>, String> {
    github_fetch_recent_run(&repo, &token).await
}

#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
    webbrowser::open(&url).map_err(|err| err.to_string())?;
    Ok(())
}
