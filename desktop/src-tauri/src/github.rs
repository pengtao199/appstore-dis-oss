use reqwest::header::{ACCEPT, AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};

use crate::config::{normalize_repo_input, workflow_path};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoCheckResult {
    pub ok: bool,
    pub private: bool,
    pub has_workflow: bool,
    pub actions_url: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RecentRunSummary {
    pub status: Option<String>,
    pub conclusion: Option<String>,
    pub html_url: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RepoInfo {
    private: bool,
    html_url: String,
}

#[derive(Debug, Deserialize)]
struct WorkflowRun {
    status: Option<String>,
    conclusion: Option<String>,
    html_url: Option<String>,
    created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WorkflowRunsResponse {
    workflow_runs: Vec<WorkflowRun>,
}

fn client(_token: &str) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .build()
        .map_err(|err| err.to_string())
}

pub async fn check_repo_access(repo: &str, token: &str) -> Result<RepoCheckResult, String> {
    let normalized_repo = match normalize_repo_input(repo) {
        Ok(value) => value,
        Err(message) => {
            return Ok(RepoCheckResult {
                ok: false,
                private: false,
                has_workflow: false,
                actions_url: None,
                message,
            })
        }
    };

    if token.trim().is_empty() {
        return Ok(RepoCheckResult {
            ok: false,
            private: false,
            has_workflow: false,
            actions_url: None,
            message: "GitHub token is required".to_string(),
        });
    }

    let client = client(token)?;
    let response = client
        .get(format!("https://api.github.com/repos/{normalized_repo}"))
        .header(USER_AGENT, "appstore-disktop")
        .header(ACCEPT, "application/vnd.github+json")
        .header(AUTHORIZATION, format!("Bearer {token}"))
        .send()
        .await
        .map_err(|err| err.to_string())?;

    if response.status() == reqwest::StatusCode::FORBIDDEN {
        return Ok(RepoCheckResult {
            ok: false,
            private: false,
            has_workflow: workflow_path()?.exists(),
            actions_url: Some(format!("https://github.com/{normalized_repo}/actions")),
            message: "GitHub rejected the request (403). Check repo/workflow token scopes.".to_string(),
        });
    }

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Ok(RepoCheckResult {
            ok: false,
            private: false,
            has_workflow: workflow_path()?.exists(),
            actions_url: Some(format!("https://github.com/{normalized_repo}/actions")),
            message: "GitHub token is invalid or expired".to_string(),
        });
    }

    if !response.status().is_success() {
        return Ok(RepoCheckResult {
            ok: false,
            private: false,
            has_workflow: workflow_path()?.exists(),
            actions_url: Some(format!("https://github.com/{normalized_repo}/actions")),
            message: format!("GitHub API returned {}", response.status()),
        });
    }

    let repo_info = response.json::<RepoInfo>().await.map_err(|err| err.to_string())?;
    let has_workflow = workflow_path()?.exists();

    if !repo_info.private {
        return Ok(RepoCheckResult {
            ok: false,
            private: false,
            has_workflow,
            actions_url: Some(format!("{}/actions", repo_info.html_url)),
            message: "Repository must be private".to_string(),
        });
    }

    if !has_workflow {
        return Ok(RepoCheckResult {
            ok: false,
            private: true,
            has_workflow: false,
            actions_url: Some(format!("{}/actions", repo_info.html_url)),
            message: "Local workflow file .github/workflows/upload.yml is missing".to_string(),
        });
    }

    Ok(RepoCheckResult {
        ok: true,
        private: true,
        has_workflow: true,
        actions_url: Some(format!("{}/actions", repo_info.html_url)),
        message: "Repository is reachable and ready".to_string(),
    })
}

pub async fn fetch_recent_run(repo: &str, token: &str) -> Result<Option<RecentRunSummary>, String> {
    if token.trim().is_empty() || repo.trim().is_empty() {
        return Ok(None);
    }
    let normalized_repo = normalize_repo_input(repo)?;

    let client = client(token)?;
    let response = client
        .get(format!(
            "https://api.github.com/repos/{normalized_repo}/actions/workflows/upload.yml/runs?per_page=1"
        ))
        .header(USER_AGENT, "appstore-disktop")
        .header(ACCEPT, "application/vnd.github+json")
        .header(AUTHORIZATION, format!("Bearer {token}"))
        .send()
        .await
        .map_err(|err| err.to_string())?;

    if !response.status().is_success() {
        return Ok(None);
    }

    let payload = response
        .json::<WorkflowRunsResponse>()
        .await
        .map_err(|err| err.to_string())?;

    Ok(payload.workflow_runs.into_iter().next().map(|run| RecentRunSummary {
        status: run.status,
        conclusion: run.conclusion,
        html_url: run.html_url,
        created_at: run.created_at,
    }))
}
