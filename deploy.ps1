param(
    [string]$Profile,
    [string]$IpaPath,
    [string]$Repo,
    [string]$Branch,
    [switch]$Check,
    [switch]$ListProfiles
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProfilesDir = Join-Path $ScriptDir "profiles"
$AccountsFile = Join-Path $ProfilesDir "accounts.json"
$SettingsFile = Join-Path $ProfilesDir "settings.env"

function Show-Usage {
    @"
Usage:
  Interactive wizard (recommended):
    .\deploy.ps1

  Profile mode:
    .\deploy.ps1 -Profile <name> -IpaPath <ipa_path> [-Repo <owner/repo>] [-Branch <branch>] [-Check]

  Helpers:
    .\deploy.ps1 -ListProfiles

Examples:
  .\deploy.ps1
  .\deploy.ps1 -Profile dev_a -IpaPath C:\build\app.ipa
  .\deploy.ps1 -Profile dev_b -IpaPath C:\build\app.ipa -Repo your-org/your-private-repo -Branch main -Check
"@
}

function Write-Step([string]$Message) {
    Write-Host "[progress] $Message"
}

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "missing command: $Name"
    }
}

function Ensure-Storage {
    New-Item -ItemType Directory -Force -Path $ProfilesDir | Out-Null
    if (-not (Test-Path $AccountsFile)) {
        '{"accounts":[]}' | Set-Content -Path $AccountsFile -Encoding UTF8
        return
    }

    try {
        $content = Get-Content -Raw -Path $AccountsFile | ConvertFrom-Json
        if ($null -eq $content.accounts) {
            throw "invalid"
        }
    } catch {
        '{"accounts":[]}' | Set-Content -Path $AccountsFile -Encoding UTF8
    }
}

function Get-AccountsData {
    Ensure-Storage
    return Get-Content -Raw -Path $AccountsFile | ConvertFrom-Json
}

function Save-AccountsData($Data) {
    $Data | ConvertTo-Json -Depth 5 | Set-Content -Path $AccountsFile -Encoding UTF8
}

function Get-OriginRepo {
    try {
        $url = (git -C $ScriptDir config --get remote.origin.url 2>$null)
    } catch {
        $url = $null
    }

    if ([string]::IsNullOrWhiteSpace($url)) {
        return "your-org/your-private-repo"
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

    return "your-org/your-private-repo"
}

function Load-Settings {
    $repoDefault = Get-OriginRepo
    $branchDefault = "main"

    if (Test-Path $SettingsFile) {
        foreach ($line in Get-Content -Path $SettingsFile) {
            if ($line -match '^REPO="?(.*?)"?$') {
                $repoDefault = $Matches[1]
            }
            if ($line -match '^BRANCH="?(.*?)"?$') {
                $branchDefault = $Matches[1]
            }
        }
    }

    return @{
        Repo = $repoDefault
        Branch = $branchDefault
    }
}

function Resolve-PathSafe([string]$PathValue) {
    if ([string]::IsNullOrWhiteSpace($PathValue)) {
        return $null
    }
    return (Resolve-Path -Path $PathValue).Path
}

function Read-Required([string]$Prompt) {
    while ($true) {
        $value = Read-Host $Prompt
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value.Trim()
        }
        Write-Host "Cannot be empty."
    }
}

function Get-UniqueProfileName([string]$BaseName, $Accounts) {
    $candidate = $BaseName
    $index = 1
    $names = @($Accounts | ForEach-Object { $_.name })

    while ($names -contains $candidate) {
        $index++
        $candidate = "${BaseName}_$index"
    }

    return $candidate
}

function Create-AccountInteractive {
    $data = Get-AccountsData
    $accounts = @($data.accounts)

    Write-Host ""
    Write-Host "Create a new App Store Connect account profile:"
    $email = Read-Required "1) Developer email"
    $issuerId = Read-Required "2) Issuer ID"
    $keyId = Read-Required "3) Key ID"

    while ($true) {
        try {
            $p8Input = Read-Required "4) P8 path"
            $resolvedP8 = Resolve-PathSafe $p8Input
            break
        } catch {
            Write-Host "File not found: $p8Input"
        }
    }

    $baseName = ($email -split '@')[0] -replace '[^a-zA-Z0-9_-]', '_'
    if ([string]::IsNullOrWhiteSpace($baseName)) {
        $baseName = "dev"
    }

    $name = Read-Host "Profile name (default: $baseName)"
    if ([string]::IsNullOrWhiteSpace($name)) {
        $name = $baseName
    }
    $name = Get-UniqueProfileName $name.Trim() $accounts

    $newAccount = [PSCustomObject]@{
        name = $name
        email = $email
        issuer_id = $issuerId
        key_id = $keyId
        p8_path = $resolvedP8
    }

    $data.accounts = @($accounts + $newAccount)
    Save-AccountsData $data

    Write-Host "Saved profile: $name ($email)"
    return $newAccount
}

function Select-SavedAccountInteractive {
    $data = Get-AccountsData
    $accounts = @($data.accounts)

    if ($accounts.Count -eq 0) {
        throw "No saved profiles."
    }

    Write-Host ""
    Write-Host "Saved profiles:"
    for ($i = 0; $i -lt $accounts.Count; $i++) {
        Write-Host ("[{0}] {1} | {2}" -f ($i + 1), $accounts[$i].name, $accounts[$i].email)
    }

    while ($true) {
        $selection = Read-Host "Select profile number"
        if ($selection -notmatch '^\d+$') {
            Write-Host "Please input a number."
            continue
        }

        $index = [int]$selection - 1
        if ($index -lt 0 -or $index -ge $accounts.Count) {
            Write-Host "Out of range."
            continue
        }

        $selected = $accounts[$index]
        if (-not (Test-Path $selected.p8_path)) {
            throw "Saved p8 not found: $($selected.p8_path)"
        }
        return $selected
    }
}

function Choose-AccountInteractive {
    $data = Get-AccountsData
    $count = @($data.accounts).Count

    if ($count -eq 0) {
        Write-Host "No profile found, creating one now."
        return Create-AccountInteractive
    }

    Write-Host ""
    Write-Host "Select action:"
    Write-Host "[1] Use saved profile"
    Write-Host "[2] Create new profile"

    while ($true) {
        $action = Read-Host "Input 1 or 2 (default 1)"
        if ([string]::IsNullOrWhiteSpace($action) -or $action -eq "1") {
            return Select-SavedAccountInteractive
        }
        if ($action -eq "2") {
            return Create-AccountInteractive
        }
        Write-Host "Only supports 1 or 2."
    }
}

function Load-ProfileByName([string]$Name) {
    $data = Get-AccountsData
    $account = @($data.accounts | Where-Object { $_.name -eq $Name }) | Select-Object -First 1
    if ($null -eq $account) {
        throw "profile not found: $Name"
    }
    if (-not (Test-Path $account.p8_path)) {
        throw "p8 not found: $($account.p8_path)"
    }
    return $account
}

function Prompt-IpaInteractive {
    while ($true) {
        try {
            Write-Host ""
            $ipaInput = Read-Required "IPA path"
            return Resolve-PathSafe $ipaInput
        } catch {
            Write-Host "ipa not found: $ipaInput"
        }
    }
}

function Get-GitHubToken {
    if (-not [string]::IsNullOrWhiteSpace($env:GH_TOKEN)) {
        return $env:GH_TOKEN
    }

    try {
        $inputData = "protocol=https`nhost=github.com`n`n"
        $output = $inputData | git credential fill 2>$null
        foreach ($line in $output) {
            if ($line -like "password=*") {
                return $line.Substring(9)
            }
        }
    } catch {
    }

    throw "No GitHub token found. Set GH_TOKEN first."
}

function Invoke-GitHubJsonRequest {
    param(
        [string]$Method,
        [string]$Uri,
        [string]$Token,
        $Body
    )

    $params = @{
        Method = $Method
        Uri = $Uri
        Headers = @{
            Authorization = "Bearer $Token"
            Accept = "application/vnd.github+json"
        }
    }

    if ($null -ne $Body) {
        $params.ContentType = "application/json"
        $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
    }

    return Invoke-RestMethod @params
}

function Assert-RepoPrivate([string]$RepoName, [string]$Token) {
    $repoInfo = Invoke-GitHubJsonRequest -Method "GET" -Uri "https://api.github.com/repos/$RepoName" -Token $Token
    if (-not $repoInfo.private) {
        throw "Repository must be private: $RepoName"
    }
}

function Upload-Asset {
    param(
        [string]$UploadUrl,
        [string]$Token,
        [string]$FilePath,
        [string]$FileName,
        [string]$ContentType
    )

    Write-Step "Uploading asset: $FileName"
    Invoke-WebRequest `
        -Method POST `
        -Uri "$UploadUrl?name=$FileName" `
        -Headers @{
            Authorization = "Bearer $Token"
            Accept = "application/vnd.github+json"
        } `
        -ContentType $ContentType `
        -InFile $FilePath `
        | Out-Null
}

function Perform-Upload {
    param(
        [string]$ResolvedIpaPath,
        $Account,
        [string]$RepoName,
        [string]$BranchName
    )

    Write-Step "Checking local dependencies"
    Require-Command git

    Write-Step "Loading GitHub credentials"
    $token = Get-GitHubToken

    Write-Step "Verifying repository visibility"
    Assert-RepoPrivate -RepoName $RepoName -Token $token

    $tag = "deliver-{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), (Get-Random -Maximum 100000)
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

    try {
        Write-Step "Preparing temporary local files"
        $tempIpa = Join-Path $tempDir "package.ipa"
        $tempP8 = Join-Path $tempDir "AuthKey.p8"
        $tempIssuer = Join-Path $tempDir "issuer_id.txt"
        $tempKey = Join-Path $tempDir "key_id.txt"

        Copy-Item -Path $ResolvedIpaPath -Destination $tempIpa
        Copy-Item -Path $Account.p8_path -Destination $tempP8
        Set-Content -Path $tempIssuer -Value $Account.issuer_id -Encoding ascii -NoNewline
        Set-Content -Path $tempKey -Value $Account.key_id -Encoding ascii -NoNewline

        $release = Invoke-GitHubJsonRequest -Method "POST" -Uri "https://api.github.com/repos/$RepoName/releases" -Token $token -Body @{
            tag_name = $tag
            name = $tag
            target_commitish = $BranchName
            prerelease = $true
            draft = $false
        }

        if ($null -eq $release.id -or [string]::IsNullOrWhiteSpace($release.upload_url)) {
            throw "Failed to create release in $RepoName"
        }

        $uploadUrl = ($release.upload_url -replace '\{.*$', '')

        Upload-Asset -UploadUrl $uploadUrl -Token $token -FilePath $tempIpa -FileName "package.ipa" -ContentType "application/octet-stream"
        Upload-Asset -UploadUrl $uploadUrl -Token $token -FilePath $tempP8 -FileName "AuthKey.p8" -ContentType "text/plain"
        Upload-Asset -UploadUrl $uploadUrl -Token $token -FilePath $tempIssuer -FileName "issuer_id.txt" -ContentType "text/plain"
        Upload-Asset -UploadUrl $uploadUrl -Token $token -FilePath $tempKey -FileName "key_id.txt" -ContentType "text/plain"

        Write-Step "Triggering GitHub Actions workflow"
        Invoke-GitHubJsonRequest -Method "POST" -Uri "https://api.github.com/repos/$RepoName/actions/workflows/upload.yml/dispatches" -Token $token -Body @{
            ref = $BranchName
            inputs = @{
                release_tag = $tag
            }
        } | Out-Null

        Write-Step "Triggered successfully, waiting cloud upload"
        Write-Host "profile: $($Account.name)"
        Write-Host "email: $($Account.email)"
        Write-Host "release tag: $tag"
        Write-Host "workflow dispatched. check: https://github.com/$RepoName/actions"
    } finally {
        if (Test-Path $tempDir) {
            Remove-Item -Path $tempDir -Recurse -Force
        }
    }
}

if ($args -contains "-h" -or $args -contains "--help") {
    Show-Usage
    exit 0
}

if ($ListProfiles) {
    $data = Get-AccountsData
    $accounts = @($data.accounts)
    if ($accounts.Count -eq 0) {
        Write-Host "No profile found. Run .\deploy.ps1 to create one."
        exit 0
    }
    Write-Host "Available profiles:"
    foreach ($account in $accounts) {
        Write-Host "- $($account.name) | $($account.email) | key:$($account.key_id)"
    }
    exit 0
}

$settings = Load-Settings
$selectedAccount = $null
$resolvedIpaPath = $null

if ([string]::IsNullOrWhiteSpace($Profile) -and [string]::IsNullOrWhiteSpace($IpaPath)) {
    $selectedAccount = Choose-AccountInteractive
    $resolvedIpaPath = Prompt-IpaInteractive
} else {
    if ([string]::IsNullOrWhiteSpace($Profile)) {
        throw "missing required option: -Profile <name> (or run .\deploy.ps1 for interactive mode)"
    }
    if ([string]::IsNullOrWhiteSpace($IpaPath)) {
        throw "profile mode requires -IpaPath <ipa_path>"
    }

    $selectedAccount = Load-ProfileByName $Profile
    $resolvedIpaPath = Resolve-PathSafe $IpaPath
}

$targetRepo = if ([string]::IsNullOrWhiteSpace($Repo)) { $settings.Repo } else { $Repo }
$targetBranch = if ([string]::IsNullOrWhiteSpace($Branch)) { $settings.Branch } else { $Branch }

if ([string]::IsNullOrWhiteSpace($targetRepo)) {
    throw "repo is empty"
}
if ([string]::IsNullOrWhiteSpace($targetBranch)) {
    throw "branch is empty"
}

if ($Check) {
    Write-Step "Checking local dependencies"
    Require-Command git

    Write-Host "check passed"
    Write-Host "profile=$($selectedAccount.name)"
    Write-Host "email=$($selectedAccount.email)"
    Write-Host "ipa=$resolvedIpaPath"
    Write-Host "p8=$($selectedAccount.p8_path)"
    Write-Host "repo=$targetRepo"
    Write-Host "branch=$targetBranch"
    exit 0
}

Perform-Upload -ResolvedIpaPath $resolvedIpaPath -Account $selectedAccount -RepoName $targetRepo -BranchName $targetBranch
