use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::config::{github_https_url, normalize_repo_input, repo_root, save_settings_file, ScriptSettings};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptEvent {
    pub kind: String,
    pub line: String,
}

fn emit(app: &AppHandle, kind: &str, line: impl Into<String>) -> Result<(), String> {
    app.emit(
        "script-output",
        ScriptEvent {
            kind: kind.to_string(),
            line: line.into(),
        },
    )
    .map_err(|err| err.to_string())
}

fn run_child_and_emit(app: &AppHandle, mut command: Command) -> Result<(), String> {
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    let mut child = command.spawn().map_err(|err| err.to_string())?;
    let stdout = child.stdout.take().ok_or_else(|| "missing child stdout".to_string())?;
    let stderr = child.stderr.take().ok_or_else(|| "missing child stderr".to_string())?;

    let app_stdout = app.clone();
    let out_thread = std::thread::spawn(move || -> Result<(), String> {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            emit(&app_stdout, "stdout", line.map_err(|err| err.to_string())?)?;
        }
        Ok(())
    });

    let app_stderr = app.clone();
    let err_thread = std::thread::spawn(move || -> Result<(), String> {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            emit(&app_stderr, "stderr", line.map_err(|err| err.to_string())?)?;
        }
        Ok(())
    });

    let status = child.wait().map_err(|err| err.to_string())?;
    out_thread
        .join()
        .map_err(|_| "stdout worker thread panicked".to_string())??;
    err_thread
        .join()
        .map_err(|_| "stderr worker thread panicked".to_string())??;

    emit(app, "exit", format!("process exited with {}", status))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("script failed with {}", status))
    }
}

pub fn run_command(
    app: AppHandle,
    command_name: &str,
    args: Vec<String>,
    github_token: String,
) -> Result<(), String> {
    let root = repo_root()?;
    let mut command = if cfg!(target_os = "windows") {
        let mut inner = Command::new("powershell");
        inner.args(["-ExecutionPolicy", "Bypass", "-File", command_name]);
        inner.args(args);
        inner
    } else {
        let mut inner = Command::new("sh");
        inner.arg(command_name);
        inner.args(args);
        inner
    };

    command.current_dir(root);
    command.env("GH_TOKEN", github_token);
    run_child_and_emit(&app, command)
}

pub fn run_bootstrap_with_sync(
    app: AppHandle,
    repo: String,
    branch: String,
    github_token: String,
) -> Result<(), String> {
    let normalized_repo = normalize_repo_input(&repo)?;
    if github_token.trim().is_empty() {
        return Err("GitHub token is required".to_string());
    }

    save_settings_file(&ScriptSettings {
        repo: normalized_repo.clone(),
        branch: branch.clone(),
    })?;

    emit(&app, "stdout", "[progress] Saving local repository settings")?;
    emit(&app, "stdout", "[progress] Syncing current template to the target private repository")?;

    let root = repo_root()?;
    let auth = STANDARD.encode(format!("x-access-token:{github_token}"));
    let mut command = Command::new("git");
    command.current_dir(root);
    command.args([
        "-c",
        &format!("http.extraHeader=Authorization: Basic {auth}"),
        "push",
        "--set-upstream",
        &github_https_url(&normalized_repo),
        &format!("HEAD:refs/heads/{branch}"),
    ]);

    let result = run_child_and_emit(&app, command);
    if result.is_ok() {
        emit(&app, "stdout", format!("[progress] Repository initialized: {normalized_repo}@{branch}"))?;
    }
    result
}
