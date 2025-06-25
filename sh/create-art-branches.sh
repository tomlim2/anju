#!/usr/bin/env bash

set -e
set -u
set -o pipefail

readonly BASE_BRANCH="origin/develop"
readonly ANIME_BRANCH_PREFIX="art/ani-"
readonly ENV_BRANCH_PREFIX="art/env-"
readonly CHERRYPICK_COMMITS=(
  "f303b0d7798b92931444476f1e9c494a4baee663"
)

log() {
  echo "✅  $1"
}
send_slack_notification() {
  local message="$1"
  # Source the slack_notify.sh script for notification
  if [[ -f "$(dirname "$0")/slack_notify.sh" ]]; then
    source "$(dirname "$0")/slack_notify.sh"
    slack_notify "$message"
  else
    log "slack_notify.sh not found. Skipping notification."
  fi
}

# --- Main Script Logic ---

main() {
  # --- 1. Validate Input ---
  if [[ $# -ne 2 ]]; then
    echo "Usage: $0 <prev_release_version> <new_release_version>"
    echo "Example: $0 4 5   or   $0 a b"
    exit 1
  fi

  local prev_release_num=$1
  local new_release_num=$2

  # --- 2. Define Branch Names ---
  log "Clean up"
  git reset --hard
  git clean -f -d

  local new_anime_branch="${ANIME_BRANCH_PREFIX}${new_release_num}"
  local new_env_branch="${ENV_BRANCH_PREFIX}${new_release_num}"
  local prev_anime_branch="${ANIME_BRANCH_PREFIX}${prev_release_num}"
  local prev_env_branch="${ENV_BRANCH_PREFIX}${prev_release_num}"

  log "Starting branch creation for release r${new_release_num}..."
  log "  - New ANIME branch: ${new_anime_branch}"
  log "  - New ENV branch:   ${new_env_branch}"

  # --- 3. Create New Anime Branch ---
  log "Creating new branch '$new_anime_branch' from '$BASE_BRANCH'."
  git checkout "$BASE_BRANCH"
  git branch "$new_anime_branch"
  git switch "$new_anime_branch"

  # --- 4. Merge Previous Release Branches ---
  log "Merging previous anime branch 'origin/$prev_anime_branch'."
  git merge "origin/$prev_anime_branch" -X theirs --no-edit
  log "Merging previous environment branch 'origin/$prev_env_branch'."
  git merge "origin/$prev_env_branch" -X theirs --no-edit

  # --- 5. Cherry-Pick Commits ---
  if [[ ${#CHERRYPICK_COMMITS[@]} -gt 0 ]]; then
    log "Cherry-picking ${#CHERRYPICK_COMMITS[@]} commit(s)..."
    for commit in "${CHERRYPICK_COMMITS[@]}"; do
      log "  - Picking $commit"
      git cherry-pick "$commit" -X theirs --no-edit
    done
  else
    log "No commits to cherry-pick."
  fi

  # --- 6. Push New Anime Branch ---
  log "Pushing '$new_anime_branch' to origin."
  git push --set-upstream origin "$new_anime_branch"

  # --- 7. Create and Push New Env Branch ---
  log "Creating and pushing '$new_env_branch'."
  git checkout -b "$new_env_branch" "$new_anime_branch"
  git push --set-upstream origin "$new_env_branch"

  log "All tasks completed successfully!"
}

# Run the main function with all script arguments
main "$@"