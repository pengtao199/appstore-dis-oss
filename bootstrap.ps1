param(
    [string]$Repo,
    [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProfilesDir = Join-Path $ScriptDir "profiles"
$AccountsFile = Join-Path $ProfilesDir "accounts.json"
$SettingsFile = Join-Path $ProfilesDir "settings.env"

function Show-Usage {
    @"
Usage:
  .\bootstrap.ps1 [-Repo owner/repo] [-Branch main]

Examples:
  .\bootstrap.ps1
  .\bootstrap.ps1 -Repo your-org/your-private-repo
  .\bootstrap.ps1 -Repo your-org/your-private-repo -Branch main
"@
}

function Get-OriginRepo {
    try {
        $url = (git -C $ScriptDir config --get remote.origin.url 2>$null)
    } catch {
        $url = $null
    }

    if ([string]::IsNullOrWhiteSpace($url)) {
        return $null
    }

    if ($url -match '^git@github\.com:(.+)\.git$') {
        return $Matches[1]
    }
    if ($url -match '^https://github\.com/(.+)\.git$') {
        return $Matches[1]
    }
    if ($url -match '^https://github\.com/(.+)$') {
        return $Matches[1].TrimEnd('/')
    }

    return $null
}

if ($args -contains "-h" -or $args -contains "--help") {
    Show-Usage
    exit 0
}

if (-not (Test-Path (Join-Path $ScriptDir ".git"))) {
    throw "Please run bootstrap inside a git repository clone."
}

if ([string]::IsNullOrWhiteSpace($Repo)) {
    $Repo = Get-OriginRepo
}

if ([string]::IsNullOrWhiteSpace($Repo)) {
    throw "Cannot infer repo from origin. Pass -Repo owner/repo."
}

New-Item -ItemType Directory -Force -Path $ProfilesDir | Out-Null

if (-not (Test-Path $AccountsFile)) {
    '{"accounts":[]}' | Set-Content -Path $AccountsFile -Encoding UTF8
}

@(
    "REPO=`"$Repo`""
    "BRANCH=`"$Branch`""
) | Set-Content -Path $SettingsFile -Encoding UTF8

Write-Host "Bootstrap completed."
Write-Host "repo=$Repo"
Write-Host "branch=$Branch"
Write-Host "next: run .\deploy.ps1"
