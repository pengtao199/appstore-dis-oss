#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILES_DIR="${SCRIPT_DIR}/profiles"
ACCOUNTS_FILE="${PROFILES_DIR}/accounts.json"
SETTINGS_FILE="${PROFILES_DIR}/settings.env"

TARGET_REPO=""
TARGET_BRANCH="main"

usage() {
  cat <<'USAGE'
Usage:
  ./bootstrap.sh [--repo owner/repo] [--branch main]

Examples:
  ./bootstrap.sh
  ./bootstrap.sh --repo your-org/your-private-repo
  ./bootstrap.sh --repo your-org/your-private-repo --branch main
USAGE
}

die() {
  echo "$1" >&2
  exit 1
}

trim_value() {
  local v="$1"
  v="${v#${v%%[![:space:]]*}}"
  v="${v%${v##*[![:space:]]}}"
  if [[ ${#v} -ge 2 && "${v:0:1}" == "\"" && "${v: -1}" == "\"" ]]; then
    v="${v:1:${#v}-2}"
  fi
  if [[ ${#v} -ge 2 && "${v:0:1}" == "'" && "${v: -1}" == "'" ]]; then
    v="${v:1:${#v}-2}"
  fi
  printf '%s' "$v"
}

infer_repo_from_origin() {
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
  printf '%s' ""
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      [[ $# -ge 2 ]] || die "--repo requires a value"
      TARGET_REPO="$(trim_value "$2")"
      shift 2
      ;;
    --branch)
      [[ $# -ge 2 ]] || die "--branch requires a value"
      TARGET_BRANCH="$(trim_value "$2")"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

if [[ ! -d "$SCRIPT_DIR/.git" ]]; then
  die "Please run bootstrap inside a git repository clone."
fi

if [[ -z "$TARGET_REPO" ]]; then
  TARGET_REPO="$(infer_repo_from_origin)"
fi

if [[ -z "$TARGET_REPO" ]]; then
  die "Cannot infer repo from origin. Pass --repo owner/repo."
fi

mkdir -p "$PROFILES_DIR"
if [[ ! -f "$ACCOUNTS_FILE" ]]; then
  echo '{"accounts":[]}' > "$ACCOUNTS_FILE"
  chmod 600 "$ACCOUNTS_FILE"
fi

cat > "$SETTINGS_FILE" <<SETTINGS
REPO="$TARGET_REPO"
BRANCH="$TARGET_BRANCH"
SETTINGS
chmod 600 "$SETTINGS_FILE"

chmod +x "$SCRIPT_DIR/deploy.sh" "$SCRIPT_DIR/bootstrap.sh"

echo "Bootstrap completed."
echo "repo=$TARGET_REPO"
echo "branch=$TARGET_BRANCH"
echo "next: run ./deploy.sh"
