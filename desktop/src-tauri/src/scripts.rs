use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

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

fn run_git(current_dir: &Path, args: &[String]) -> Result<(), String> {
    let output = Command::new("git")
        .current_dir(current_dir)
        .args(args)
        .output()
        .map_err(|err| err.to_string())?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let message = if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        format!("git command failed with {}", output.status)
    };

    Err(message)
}

fn git_auth_args(auth: &str) -> Vec<String> {
    vec![
        "-c".into(),
        format!("http.extraHeader=Authorization: Basic {auth}"),
    ]
}

fn ensure_parent(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn copy_dir_all(from: &Path, to: &Path) -> Result<(), String> {
    fs::create_dir_all(to).map_err(|err| err.to_string())?;
    for entry in fs::read_dir(from).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let source = entry.path();
        let target = to.join(entry.file_name());
        if entry.file_type().map_err(|err| err.to_string())?.is_dir() {
            copy_dir_all(&source, &target)?;
        } else {
            ensure_parent(&target)?;
            fs::copy(&source, &target).map_err(|err| err.to_string())?;
        }
    }
    Ok(())
}

fn clear_worktree(path: &Path) -> Result<(), String> {
    for entry in fs::read_dir(path).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        if entry.file_name() == ".git" {
            continue;
        }

        let child = entry.path();
        if entry.file_type().map_err(|err| err.to_string())?.is_dir() {
            fs::remove_dir_all(child).map_err(|err| err.to_string())?;
        } else {
            fs::remove_file(child).map_err(|err| err.to_string())?;
        }
    }
    Ok(())
}

fn stage_minimal_runtime_set(root: &Path, temp_repo: &Path) -> Result<(), String> {
    let keep_paths = [
        ".gitignore",
        ".github/workflows/upload.yml",
        "profiles/.gitkeep",
        "profiles/example.env",
    ];

    for relative in keep_paths {
        let source = root.join(relative);
        if !source.exists() {
            return Err(format!("missing required file for sync: {relative}"));
        }

        let target = temp_repo.join(relative);
        ensure_parent(&target)?;
        fs::copy(&source, &target).map_err(|err| err.to_string())?;
    }

    let scripts_source = root.join("scripts");
    if !scripts_source.exists() {
        return Err("missing required directory for sync: scripts".to_string());
    }
    copy_dir_all(&scripts_source, &temp_repo.join("scripts"))?;

    fs::write(temp_repo.join("README.md"), minimal_private_repo_readme())
        .map_err(|err| err.to_string())?;

    Ok(())
}

fn minimal_private_repo_readme() -> &'static str {
    "# App Store Private Upload Repo

This repository contains the minimum runtime files required for App Store delivery.

Included:
- `.github/workflows/upload.yml`
- `scripts/`
- `profiles/example.env`

Typical local usage:

```bash
./scripts/bootstrap.sh
./scripts/deploy.sh
```

Windows PowerShell:

```powershell
.\\scripts\\bootstrap.ps1
.\\scripts\\deploy.ps1
```
"
}

fn create_temp_repo_dir() -> Result<PathBuf, String> {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| err.to_string())?
        .as_nanos();
    let path = std::env::temp_dir().join(format!("appstore-dis-sync-{nonce}"));
    fs::create_dir_all(&path).map_err(|err| err.to_string())?;
    Ok(path)
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
    let root = repo_root()?;
    let auth = STANDARD.encode(format!("x-access-token:{github_token}"));
    let remote_url = github_https_url(&normalized_repo);
    let temp_repo = create_temp_repo_dir()?;

    let result = (|| -> Result<(), String> {
        emit(&app, "stdout", "[progress] Building minimal runtime sync set")?;
        let init_args = vec!["init".into(), "--initial-branch".into(), branch.clone()];
        run_git(&temp_repo, &init_args)?;
        run_git(
            &temp_repo,
            &["remote".into(), "add".into(), "origin".into(), remote_url.clone()],
        )?;

        emit(&app, "stdout", "[progress] Checking target branch state")?;
        let mut fetch_args = git_auth_args(&auth);
        fetch_args.extend(["fetch".into(), "origin".into(), branch.clone()]);
        let fetched_existing_branch = run_git(&temp_repo, &fetch_args).is_ok();

        if fetched_existing_branch {
            run_git(
                &temp_repo,
                &[
                    "checkout".into(),
                    "-B".into(),
                    branch.clone(),
                    "FETCH_HEAD".into(),
                ],
            )?;
            emit(&app, "stdout", "[progress] Loaded existing target branch history")?;
        } else {
            run_git(
                &temp_repo,
                &["checkout".into(), "--orphan".into(), branch.clone()],
            )?;
            emit(&app, "stdout", "[progress] Target branch not found, creating a fresh history")?;
        }

        clear_worktree(&temp_repo)?;
        stage_minimal_runtime_set(&root, &temp_repo)?;
        emit(
            &app,
            "stdout",
            "[progress] Prepared minimal sync set: workflow, scripts, profiles/example.env, .gitignore, README",
        )?;

        run_git(
            &temp_repo,
            &["config".into(), "user.name".into(), "AppStore DIS".into()],
        )?;
        run_git(
            &temp_repo,
            &[
                "config".into(),
                "user.email".into(),
                "appstore-dis@example.invalid".into(),
            ],
        )?;
        run_git(&temp_repo, &["add".into(), ".".into()])?;

        let status_args: Vec<String> = vec!["status".into(), "--short".into()];
        let status_output = Command::new("git")
            .current_dir(&temp_repo)
            .args(&status_args)
            .output()
            .map_err(|err| err.to_string())?;
        if !status_output.status.success() {
            return Err("failed to inspect staged sync changes".to_string());
        }
        let has_changes = !String::from_utf8_lossy(&status_output.stdout).trim().is_empty();

        if has_changes {
            run_git(
                &temp_repo,
                &[
                    "commit".into(),
                    "-m".into(),
                    "Initialize private upload runtime".into(),
                ],
            )?;
            emit(&app, "stdout", "[progress] Created sync commit for the minimal runtime set")?;
        } else {
            emit(&app, "stdout", "[progress] Target branch already matches the minimal runtime set")?;
        }

        emit(&app, "stdout", "[progress] Syncing minimal runtime set to the target private repository")?;
        let mut push_args = git_auth_args(&auth);
        push_args.extend([
            "push".into(),
            "--set-upstream".into(),
            "origin".into(),
            format!("HEAD:refs/heads/{branch}"),
        ]);
        run_git(&temp_repo, &push_args)?;

        Ok(())
    })();

    if temp_repo.exists() {
        let _ = fs::remove_dir_all(&temp_repo);
    }

    if result.is_ok() {
        emit(
            &app,
            "stdout",
            format!("[progress] Repository initialized with minimal runtime files: {normalized_repo}@{branch}"),
        )?;
    }

    result
}
