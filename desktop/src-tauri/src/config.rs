use std::fs;
use std::path::{Path, PathBuf};

use dirs::{config_dir, home_dir};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScriptSettings {
    pub repo: String,
    pub branch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Profile {
    pub name: String,
    pub email: String,
    pub issuer_id: String,
    pub key_id: String,
    pub p8_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProfilesFile {
    pub accounts: Vec<Profile>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RecentRun {
    pub profile: Option<String>,
    pub release_tag: Option<String>,
    pub workflow_url: Option<String>,
    pub status: Option<String>,
    pub conclusion: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub github_token: String,
    pub last_profile: String,
    pub last_ipa_path: String,
    pub last_run: Option<RecentRun>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScriptState {
    pub settings: ScriptSettings,
    pub profiles: Vec<Profile>,
}

pub fn repo_root() -> Result<PathBuf, String> {
    let current = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    current
        .parent()
        .and_then(Path::parent)
        .map(Path::to_path_buf)
        .ok_or_else(|| "failed to resolve repository root".to_string())
}

pub fn profiles_dir() -> Result<PathBuf, String> {
    Ok(repo_root()?.join("profiles"))
}

pub fn accounts_path() -> Result<PathBuf, String> {
    Ok(profiles_dir()?.join("accounts.json"))
}

pub fn settings_path() -> Result<PathBuf, String> {
    Ok(profiles_dir()?.join("settings.env"))
}

pub fn workflow_path() -> Result<PathBuf, String> {
    Ok(repo_root()?.join(".github").join("workflows").join("upload.yml"))
}

pub fn ensure_profiles_storage() -> Result<(), String> {
    let dir = profiles_dir()?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    }
    Ok(())
}

pub fn load_profiles() -> Result<Vec<Profile>, String> {
    ensure_profiles_storage()?;
    let path = accounts_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(path).map_err(|err| err.to_string())?;
    if raw.trim().is_empty() {
        return Ok(Vec::new());
    }
    let parsed: ProfilesFile = serde_json::from_str(&raw).map_err(|err| err.to_string())?;
    Ok(parsed.accounts)
}

pub fn save_profiles_file(profiles: &[Profile]) -> Result<(), String> {
    ensure_profiles_storage()?;
    let body = ProfilesFile {
        accounts: profiles.to_vec(),
    };
    let raw = serde_json::to_string_pretty(&body).map_err(|err| err.to_string())?;
    fs::write(accounts_path()?, format!("{raw}\n")).map_err(|err| err.to_string())
}

pub fn load_settings_file() -> Result<ScriptSettings, String> {
    ensure_profiles_storage()?;
    let mut settings = ScriptSettings {
        repo: infer_repo_from_git_remote().unwrap_or_default(),
        branch: "main".to_string(),
    };
    let path = settings_path()?;
    if !path.exists() {
        return Ok(settings);
    }
    let raw = fs::read_to_string(path).map_err(|err| err.to_string())?;
    for line in raw.lines() {
        if let Some(value) = line.strip_prefix("REPO=") {
            settings.repo = strip_wrapped_quotes(value);
        } else if let Some(value) = line.strip_prefix("BRANCH=") {
            settings.branch = strip_wrapped_quotes(value);
        }
    }
    Ok(settings)
}

pub fn save_settings_file(settings: &ScriptSettings) -> Result<(), String> {
    ensure_profiles_storage()?;
    let raw = format!(
        "REPO=\"{}\"\nBRANCH=\"{}\"\n",
        settings.repo, settings.branch
    );
    fs::write(settings_path()?, raw).map_err(|err| err.to_string())
}

pub fn load_script_state_file() -> Result<ScriptState, String> {
    Ok(ScriptState {
        settings: load_settings_file()?,
        profiles: load_profiles()?,
    })
}

pub fn app_config_path() -> Result<PathBuf, String> {
    let base = config_dir()
        .or_else(home_dir)
        .ok_or_else(|| "failed to resolve application config directory".to_string())?;
    Ok(base.join("appstore-disktop").join("config.json"))
}

pub fn load_app_config_file() -> Result<AppConfig, String> {
    let path = app_config_path()?;
    if !path.exists() {
        return Ok(AppConfig::default());
    }
    let raw = fs::read_to_string(path).map_err(|err| err.to_string())?;
    if raw.trim().is_empty() {
        return Ok(AppConfig::default());
    }
    serde_json::from_str(&raw).map_err(|err| err.to_string())
}

pub fn save_app_config_file(config: &AppConfig) -> Result<(), String> {
    let path = app_config_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let raw = serde_json::to_string_pretty(config).map_err(|err| err.to_string())?;
    fs::write(path, format!("{raw}\n")).map_err(|err| err.to_string())
}

fn strip_wrapped_quotes(value: &str) -> String {
    value.trim().trim_matches('"').trim_matches('\'').to_string()
}

fn infer_repo_from_git_remote() -> Result<String, String> {
    let root = repo_root()?;
    let output = std::process::Command::new("git")
        .current_dir(root)
        .args(["config", "--get", "remote.origin.url"])
        .output()
        .map_err(|err| err.to_string())?;

    if !output.status.success() {
        return Ok(String::new());
    }

    let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if let Some(value) = url
        .strip_prefix("git@github.com:")
        .and_then(|value| value.strip_suffix(".git"))
    {
        return Ok(value.to_string());
    }
    if let Some(value) = url
        .strip_prefix("https://github.com/")
        .and_then(|value| value.strip_suffix(".git"))
    {
        return Ok(value.to_string());
    }
    if let Some(value) = url.strip_prefix("https://github.com/") {
        return Ok(value.trim_end_matches('/').to_string());
    }

    Ok(String::new())
}
