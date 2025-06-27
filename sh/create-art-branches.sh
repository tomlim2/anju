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

	local message="<!here>
아래 아트 브렌치 분기 완료하였습니다!
:bmo::bmo::bmo::bmo::bmo::bmo::bmo::bmo::bmo:
\`$new_anime_branch\`
\`$new_env_branch\`
:bmo::bmo::bmo::bmo::bmo::bmo::bmo::bmo::bmo:
브랜치 이동 후 바이너리 다운로드를 진행해주세요!
바이너리는 약 20분 후에 생성됩니다. ($(date -d '+20 minutes' '+%H:%M') 예상)

이전 릴리즈 브랜치의 커밋들은 체리픽되었습니다.
"
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
	log "Validating input parameters..."
	if [[ $# -ne 2 ]]; then
		echo "Usage: $0 <prev_release_version> <new_release_version>"
		echo "Example: $0 4 5   or   $0 a b"
	exit 1
	fi

	local prev_release_num=$1
	local new_release_num=$2

	# --- 2. Define Branch Names ---
	local new_anime_branch="${ANIME_BRANCH_PREFIX}${new_release_num}"
	local new_env_branch="${ENV_BRANCH_PREFIX}${new_release_num}"
	local prev_anime_branch="${ANIME_BRANCH_PREFIX}${prev_release_num}"
	local prev_env_branch="${ENV_BRANCH_PREFIX}${prev_release_num}"

	log "Starting branch creation for release ${new_release_num}..."
	log "  - New ANIME branch: ${new_anime_branch}"
	log "  - New ENV branch:   ${new_env_branch}"

	# --- 2.5 Check if branches already exist ---
	log "Checking if branches already exist..."
	if git show-ref --verify --quiet "refs/heads/$new_anime_branch"; then
		echo "Error: Branch '$new_anime_branch' already exists."
		exit 1
	fi
	if git show-ref --verify --quiet "refs/heads/$new_env_branch"; then
		echo "Error: Branch '$new_env_branch' already exists."
		exit 1
	fi
	# if ! git show-ref --verify --quiet "refs/heads/$prev_anime_branch"; then
	# 	echo "Error: Previous ANIME branch '$prev_anime_branch' does not exist."
	# 	exit 1
	# fi
	# if ! git show-ref --verify --quiet "refs/heads/$prev_env_branch"; then
	# 	echo "Error: Previous ENV branch '$prev_env_branch' does not exist."
	# 	exit 1
	# fi

	# --- 2.75 Check if current branch is clean ---
	log "Cleaning up working directory..."
	git reset --hard
	git clean -f -d

	# --- 2.8 Confirm Current Branch ---
	log "Checking current branch..."
	local current_branch
	current_branch=$(git branch --show-current)
	echo "New branches will be based on: $current_branch"
	read -p "Continue? (Y/n): " confirm
	if [[ "$confirm" =~ ^[Nn]$ ]]; then
		echo "Aborted by user."
		exit 1
	fi

	# --- 3. Create New Anime Branch ---
	log "Creating new branch '$new_anime_branch'"
	git switch -c "$new_anime_branch"

	# --- 4. Merge Previous Release Branches ---
	# log "Merging previous anime branch 'origin/$prev_anime_branch'."
	# git merge "origin/$prev_anime_branch" -X theirs --no-edit
	# log "Merging previous environment branch 'origin/$prev_env_branch'."
	# git merge "origin/$prev_env_branch" -X theirs --no-edit

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

	# --- 9. Delete Previous Release Branches ---
	log "Deleting remote branches..."
	if git show-ref --verify --quiet "refs/remotes/origin/$prev_anime_branch"; then
		log "Deleting remote branch 'origin/$prev_anime_branch'"
		git push origin --delete "$prev_anime_branch"
	fi
	if git show-ref --verify --quiet "refs/remotes/origin/$prev_env_branch"; then
		log "Deleting remote branch 'origin/$prev_env_branch'"
		git push origin --delete "$prev_env_branch"
	fi

	log "All tasks completed successfully!"
}

# Run the main function with all script arguments
main "$@"