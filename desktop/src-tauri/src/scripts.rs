use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::config::repo_root;

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

    if status.success() {
        emit(&app, "exit", format!("process exited with {}", status))?;
        Ok(())
    } else {
        emit(&app, "exit", format!("process exited with {}", status))?;
        Err(format!("script failed with {}", status))
    }
}
