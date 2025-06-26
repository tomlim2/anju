#!/usr/bin/env bash

set -e
set -u
set -o pipefail

readonly ANIME_BRANCH_PREFIX="art/anime-"
readonly ENV_BRANCH_PREFIX="art/env-"
readonly CHERRYPICK_COMMITS=(
)

log() {
  echo "✅  $1"
}

slack_notify() {
	local new_version=$1
	local new_anime_branch="${ANIME_BRANCH_PREFIX}${new_version}"
	local new_env_branch="${ENV_BRANCH_PREFIX}${new_version}"

	if [[ -z "${SLACK_WEBHOOK_URL:-}" ]]; then
		echo "SLACK_WEBHOOK_URL environment variable not set. Skipping notification."
		return
	fi

	local message=":yum::yum::yum::yum::yum::yum: <!here> 새로운 아트 브랜치가 생성되었습니다: \`$new_anime_branch\` (from \`$new_env_branch\`)"
	local escaped_message
	escaped_message=$(echo "$message" | sed 's/\"/\\\"/g' | sed 's/\\/\\\\/g')
	local payload
	payload="{\"text\":\"$escaped_message\"}"

	echo "Sending Slack notification..."
	curl --silent --show-error -X POST -H 'Content-type: application/json; charset=utf-8' \
			 --data "$payload" "$SLACK_WEBHOOK_URL"
	echo # Add a newline for cleaner output
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

	# Confirm current branch
	local current_branch
	current_branch=$(git branch --show-current)
	echo "You are now on branch: $current_branch"
	read -p "Continue? (Y/n): " confirm
	if [[ "$confirm" =~ ^[Nn]$ ]]; then
		echo "Aborted by user."
		exit 1
	fi

	# --- 3. Create New Anime Branch ---
	log "Creating new branch '$new_anime_branch'"
	git switch -c "$new_anime_branch"

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
	git switch -c "$new_env_branch" "$new_anime_branch"
	git push --set-upstream origin "$new_env_branch"

	# --- 8. Send Slack Notification ---
	read -p "Send Slack notification? (Y/n): " slack_confirm
	if [[ "$slack_confirm" =~ ^[Nn]$ ]]; then
		log "Skipping Slack notification."
	else
		slack_notify "$new_release_num"
	fi

	log "All tasks completed successfully!"
}

# Run the main function with all script arguments
main "$@"