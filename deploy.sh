#!/usr/bin/env bash
set -euo pipefail

# iOS IPA relay deploy script
# 1) Create a temporary GitHub Release
# 2) Upload IPA + App Store Connect API materials
# 3) Trigger GitHub Action for cloud upload

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILES_DIR="${SCRIPT_DIR}/profiles"
ACCOUNTS_FILE="${PROFILES_DIR}/accounts.json"
SETTINGS_FILE="${PROFILES_DIR}/settings.env"

usage() {
  cat <<'USAGE'
Usage:
  Interactive wizard (recommended):
    ./deploy.sh

  Profile mode:
    ./deploy.sh --profile <name> <ipa_path> [--repo <owner/repo>] [--branch <branch>] [--check]

  Helpers:
    ./deploy.sh --list-profiles

Examples:
  ./deploy.sh
  ./deploy.sh --profile dev_a ./build/app.ipa
  ./deploy.sh --profile dev_b ./build/app.ipa --repo your-org/your-private-repo --branch main --check
USAGE
}

log_step() {
  echo "[progress] $1"
}

die() {
  echo "$1" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing command: $1"
}

trim_value() {
  local v="$1"
  v="${v#${v%%[![:space:]]*}}"
  v="${v%${v##*[![:space:]]}}"
  if [[ ${#v} -ge 2 && "${v:0:1}" == '"' && "${v: -1}" == '"' ]]; then
    v="${v:1:${#v}-2}"
  fi
  if [[ ${#v} -ge 2 && "${v:0:1}" == "'" && "${v: -1}" == "'" ]]; then
    v="${v:1:${#v}-2}"
  fi
  printf '%s' "$v"
}

ensure_storage() {
  mkdir -p "$PROFILES_DIR"
  if [[ ! -f "$ACCOUNTS_FILE" ]]; then
    echo '{"accounts":[]}' > "$ACCOUNTS_FILE"
  fi
  jq -e '.accounts and (.accounts|type=="array")' "$ACCOUNTS_FILE" >/dev/null 2>&1 || {
    echo '{"accounts":[]}' > "$ACCOUNTS_FILE"
  }
}

infer_repo_from_git_remote() {
  local url path
  url="$(git -C "$SCRIPT_DIR" config --get remote.origin.url 2>/dev/null || true)"

  if [[ "$url" =~ ^git@github\.com:(.+)\.git$ ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
    return
  fi

  if [[ "$url" =~ ^https://github\.com/(.+)\.git$ ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
    return
  fi

  if [[ "$url" =~ ^https://github\.com/(.+)$ ]]; then
    path="${BASH_REMATCH[1]}"
    path="${path%/}"
    printf '%s' "$path"
    return
  fi

  printf '%s' "your-org/your-private-repo"
}

load_settings() {
  REPO_DEFAULT="$(infer_repo_from_git_remote)"
  BRANCH_DEFAULT="main"
  if [[ -f "$SETTINGS_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$SETTINGS_FILE"
    REPO_DEFAULT="${REPO:-$REPO_DEFAULT}"
    BRANCH_DEFAULT="${BRANCH:-$BRANCH_DEFAULT}"
  fi
}

save_settings() {
  cat > "$SETTINGS_FILE" <<SETTINGS
REPO="$REPO_DEFAULT"
BRANCH="$BRANCH_DEFAULT"
SETTINGS
}

setup_settings_interactive_if_needed() {
  load_settings
  if [[ -f "$SETTINGS_FILE" ]]; then
    return
  fi

  echo "Initialize default repository settings (enter to keep defaults)"

  read -r -p "Default repo [${REPO_DEFAULT}]: " input_repo
  input_repo="$(trim_value "${input_repo:-}")"
  if [[ -n "$input_repo" ]]; then
    REPO_DEFAULT="$input_repo"
  fi

  read -r -p "Default branch [${BRANCH_DEFAULT}]: " input_branch
  input_branch="$(trim_value "${input_branch:-}")"
  if [[ -n "$input_branch" ]]; then
    BRANCH_DEFAULT="$input_branch"
  fi

  save_settings
  echo "Saved settings: repo=${REPO_DEFAULT}, branch=${BRANCH_DEFAULT}"
}

list_profiles() {
  ensure_storage
  local count
  count="$(jq -r '.accounts | length' "$ACCOUNTS_FILE")"

  if [[ "$count" -eq 0 ]]; then
    echo "No profile found. Run ./deploy.sh to create one."
    return 0
  fi

  echo "Available profiles:"
  jq -r '.accounts[] | "- \(.name) | \(.email) | key:\(.key_id)"' "$ACCOUNTS_FILE"
}

profile_exists() {
  local name="$1"
  jq -e --arg name "$name" '.accounts[] | select(.name == $name)' "$ACCOUNTS_FILE" >/dev/null
}

resolve_unique_profile_name() {
  local base="$1"
  local idx=1
  local candidate="$base"

  while profile_exists "$candidate"; do
    idx=$((idx + 1))
    candidate="${base}_${idx}"
  done

  printf '%s' "$candidate"
}

read_required() {
  local prompt="$1"
  local value=""
  while true; do
    read -r -p "$prompt" value
    value="$(trim_value "$value")"
    if [[ -n "$value" ]]; then
      printf '%s' "$value"
      return
    fi
    echo "Cannot be empty." >&2
  done
}

create_account_interactive() {
  local name email issuer_id key_id p8_path base_name tmp_json

  printf '\nCreate a new App Store Connect account profile:\n'
  email="$(read_required '1) Developer email: ')"
  issuer_id="$(read_required '2) Issuer ID: ')"
  key_id="$(read_required '3) Key ID: ')"

  while true; do
    p8_path="$(read_required '4) P8 path (drag into terminal): ')"
    p8_path="$(trim_value "$p8_path")"
    if [[ -f "$p8_path" ]]; then
      break
    fi
    echo "File not found: $p8_path"
  done

  base_name="${email%@*}"
  base_name="${base_name//[^a-zA-Z0-9_-]/_}"
  [[ -n "$base_name" ]] || base_name="dev"

  read -r -p "Profile name (default: ${base_name}): " name
  name="$(trim_value "${name:-}")"
  if [[ -z "$name" ]]; then
    name="$base_name"
  fi
  name="$(resolve_unique_profile_name "$name")"

  tmp_json="$(mktemp)"
  jq --arg name "$name" \
     --arg email "$email" \
     --arg issuer_id "$issuer_id" \
     --arg key_id "$key_id" \
     --arg p8_path "$p8_path" \
     '.accounts += [{name:$name,email:$email,issuer_id:$issuer_id,key_id:$key_id,p8_path:$p8_path}]' \
     "$ACCOUNTS_FILE" > "$tmp_json"
  mv "$tmp_json" "$ACCOUNTS_FILE"

  echo "Saved profile: $name ($email)"
  SELECTED_PROFILE="$name"
  SELECTED_EMAIL="$email"
  SELECTED_ISSUER_ID="$issuer_id"
  SELECTED_KEY_ID="$key_id"
  SELECTED_P8_PATH="$p8_path"
}

select_saved_account_interactive() {
  local count selection index account_json
  count="$(jq -r '.accounts | length' "$ACCOUNTS_FILE")"
  [[ "$count" -gt 0 ]] || die "No saved profiles."

  printf '\nSaved profiles:\n'
  jq -r '.accounts | to_entries[] | "[\(.key+1)] \(.value.name) | \(.value.email)"' "$ACCOUNTS_FILE"

  while true; do
    read -r -p "Select profile number: " selection
    selection="$(trim_value "${selection:-}")"
    [[ "$selection" =~ ^[0-9]+$ ]] || { echo "Please input a number."; continue; }
    index=$((selection - 1))
    if (( index < 0 || index >= count )); then
      echo "Out of range."
      continue
    fi

    account_json="$(jq -e -r --argjson idx "$index" '.accounts[$idx]' "$ACCOUNTS_FILE")"
    SELECTED_PROFILE="$(printf '%s' "$account_json" | jq -r '.name')"
    SELECTED_EMAIL="$(printf '%s' "$account_json" | jq -r '.email')"
    SELECTED_ISSUER_ID="$(printf '%s' "$account_json" | jq -r '.issuer_id')"
    SELECTED_KEY_ID="$(printf '%s' "$account_json" | jq -r '.key_id')"
    SELECTED_P8_PATH="$(printf '%s' "$account_json" | jq -r '.p8_path')"
    [[ -f "$SELECTED_P8_PATH" ]] || die "Saved p8 not found: $SELECTED_P8_PATH"
    break
  done
}

choose_account_interactive() {
  local count action
  ensure_storage
  setup_settings_interactive_if_needed

  count="$(jq -r '.accounts | length' "$ACCOUNTS_FILE")"
  if [[ "$count" -eq 0 ]]; then
    echo "No profile found, creating one now."
    create_account_interactive
    return
  fi

  printf '\nSelect action:\n'
  echo "[1] Use saved profile"
  echo "[2] Create new profile"

  while true; do
    read -r -p "Input 1 or 2 (default 1): " action
    action="$(trim_value "${action:-}")"
    if [[ -z "$action" || "$action" == "1" ]]; then
      select_saved_account_interactive
      return
    fi
    if [[ "$action" == "2" ]]; then
      create_account_interactive
      return
    fi
    echo "Only supports 1 or 2."
  done
}

load_profile_by_name() {
  local name="$1"
  ensure_storage

  local account_json
  account_json="$(jq -e -r --arg name "$name" '.accounts[] | select(.name == $name)' "$ACCOUNTS_FILE")" || {
    die "profile not found: $name"
  }

  SELECTED_PROFILE="$(printf '%s' "$account_json" | jq -r '.name')"
  SELECTED_EMAIL="$(printf '%s' "$account_json" | jq -r '.email')"
  SELECTED_ISSUER_ID="$(printf '%s' "$account_json" | jq -r '.issuer_id')"
  SELECTED_KEY_ID="$(printf '%s' "$account_json" | jq -r '.key_id')"
  SELECTED_P8_PATH="$(printf '%s' "$account_json" | jq -r '.p8_path')"
  [[ -f "$SELECTED_P8_PATH" ]] || die "p8 not found: $SELECTED_P8_PATH"
}

prompt_ipa_interactive() {
  local ipa_input
  printf '\nDrag the IPA file into terminal and press enter:\n' >&2
  read -r ipa_input
  ipa_input="$(trim_value "$ipa_input")"
  [[ -n "$ipa_input" ]] || die "ipa path is empty"
  [[ -f "$ipa_input" ]] || die "ipa not found: $ipa_input"
  printf '%s' "$ipa_input"
}

assert_repo_is_private() {
  local repo="$1"
  local token="$2"
  local visibility

  visibility="$(curl -fsSL \
    -H "Authorization: Bearer $token" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$repo" | jq -r '.private')"

  if [[ "$visibility" != "true" ]]; then
    die "Repository must be private: $repo"
  fi
}

perform_upload() {
  local ipa_path="$1"
  local p8_path="$2"
  local issuer_id="$3"
  local key_id="$4"
  local repo="$5"
  local branch="$6"

  log_step "Checking local dependencies"
  require_cmd curl
  require_cmd jq
  require_cmd git

  log_step "Loading GitHub credentials"
  TOKEN="${GH_TOKEN:-}"
  if [[ -z "$TOKEN" ]]; then
    TOKEN="$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | awk -F= '/^password=/{print $2}')"
  fi
  [[ -n "$TOKEN" ]] || die "No GitHub token found. Set GH_TOKEN first."

  log_step "Verifying repository visibility"
  assert_repo_is_private "$repo" "$TOKEN"

  TAG="deliver-$(date +%Y%m%d-%H%M%S)-$RANDOM"
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT

  log_step "Preparing temporary local files"
  cp "$ipa_path" "$TMP_DIR/package.ipa"
  cp "$p8_path" "$TMP_DIR/AuthKey.p8"
  printf '%s' "$issuer_id" > "$TMP_DIR/issuer_id.txt"
  printf '%s' "$key_id" > "$TMP_DIR/key_id.txt"

  create_payload="$(jq -n \
    --arg tag "$TAG" \
    --arg name "$TAG" \
    --arg target "$branch" \
    '{tag_name:$tag,name:$name,target_commitish:$target,prerelease:true,draft:false}')"

  log_step "Creating temporary Release: $TAG"
  release_json="$(curl -fsSL \
    -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$repo/releases" \
    -d "$create_payload")"

  release_id="$(printf '%s' "$release_json" | jq -r '.id // empty')"
  upload_url_raw="$(printf '%s' "$release_json" | jq -r '.upload_url // empty')"
  upload_url="${upload_url_raw%%\{*}"
  [[ -n "$release_id" && -n "$upload_url" ]] || die "Failed to create release in $repo"

  upload_asset() {
    local filepath="$1"
    local filename="$2"
    local content_type="$3"

    log_step "Uploading asset: $filename"
    curl -fsSL \
      -X POST \
      -H "Authorization: Bearer $TOKEN" \
      -H "Accept: application/vnd.github+json" \
      -H "Content-Type: $content_type" \
      --data-binary @"$filepath" \
      "$upload_url?name=$filename" \
      >/dev/null
  }

  upload_asset "$TMP_DIR/package.ipa" package.ipa application/octet-stream
  upload_asset "$TMP_DIR/AuthKey.p8" AuthKey.p8 text/plain
  upload_asset "$TMP_DIR/issuer_id.txt" issuer_id.txt text/plain
  upload_asset "$TMP_DIR/key_id.txt" key_id.txt text/plain

  dispatch_payload="$(jq -n \
    --arg ref "$branch" \
    --arg tag "$TAG" \
    '{ref:$ref,inputs:{release_tag:$tag}}')"

  log_step "Triggering GitHub Actions workflow"
  curl -fsSL \
    -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$repo/actions/workflows/upload.yml/dispatches" \
    -d "$dispatch_payload" \
    >/dev/null

  log_step "Triggered successfully, waiting cloud upload"
  echo "profile: $SELECTED_PROFILE"
  echo "email: $SELECTED_EMAIL"
  echo "release tag: $TAG"
  echo "workflow dispatched. check: https://github.com/$repo/actions"
}

PROFILE=""
OVERRIDE_REPO=""
OVERRIDE_BRANCH=""
CHECK_ONLY=0
LIST_ONLY=0
POSITIONAL=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      [[ $# -ge 2 ]] || die "--profile requires a value"
      PROFILE="$2"
      shift 2
      ;;
    --repo)
      [[ $# -ge 2 ]] || die "--repo requires a value"
      OVERRIDE_REPO="$2"
      shift 2
      ;;
    --branch)
      [[ $# -ge 2 ]] || die "--branch requires a value"
      OVERRIDE_BRANCH="$2"
      shift 2
      ;;
    --check)
      CHECK_ONLY=1
      shift
      ;;
    --list-profiles)
      LIST_ONLY=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      while [[ $# -gt 0 ]]; do
        POSITIONAL+=("$1")
        shift
      done
      ;;
    -*)
      die "unknown option: $1"
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

if (( LIST_ONLY == 1 )); then
  list_profiles
  exit 0
fi

load_settings

IPA_PATH=""
if [[ -z "$PROFILE" && ${#POSITIONAL[@]} -eq 0 ]]; then
  choose_account_interactive
  IPA_PATH="$(prompt_ipa_interactive)"
else
  [[ -n "$PROFILE" ]] || die "missing required option: --profile <name> (or run ./deploy.sh for interactive mode)"
  (( ${#POSITIONAL[@]} >= 1 )) || die "profile mode requires <ipa_path>"
  IPA_PATH="$(trim_value "${POSITIONAL[0]}")"
  [[ -n "$IPA_PATH" ]] || die "ipa path is empty"
  [[ -f "$IPA_PATH" ]] || die "ipa not found: $IPA_PATH"

  load_profile_by_name "$PROFILE"
fi

REPO="${OVERRIDE_REPO:-$REPO_DEFAULT}"
BRANCH="${OVERRIDE_BRANCH:-$BRANCH_DEFAULT}"

[[ -n "$SELECTED_P8_PATH" ]] || die "p8 path is empty"
[[ -n "$SELECTED_ISSUER_ID" ]] || die "issuer_id is empty"
[[ -n "$SELECTED_KEY_ID" ]] || die "key_id is empty"
[[ -n "$REPO" ]] || die "repo is empty"
[[ -n "$BRANCH" ]] || die "branch is empty"

if (( CHECK_ONLY == 1 )); then
  log_step "Checking local dependencies"
  require_cmd curl
  require_cmd jq
  require_cmd git

  echo "check passed"
  echo "profile=$SELECTED_PROFILE"
  echo "email=$SELECTED_EMAIL"
  echo "ipa=$IPA_PATH"
  echo "p8=$SELECTED_P8_PATH"
  echo "repo=$REPO"
  echo "branch=$BRANCH"
  exit 0
fi

perform_upload "$IPA_PATH" "$SELECTED_P8_PATH" "$SELECTED_ISSUER_ID" "$SELECTED_KEY_ID" "$REPO" "$BRANCH"
