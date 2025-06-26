#!/usr/bin/env bash

readonly ANIME_BRANCH_PREFIX="art/ani-"
readonly ENV_BRANCH_PREFIX="art/env-"

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
  escaped_message=$(echo "$message" | sed 's/\"/\\\\\"/g' | sed 's/\\\\/\\\\\\\\/g')
  local payload
  payload="{\"text\":\"$escaped_message\"}"

  echo "Sending Slack notification..."
  curl --silent --show-error -X POST -H 'Content-type: application/json; charset=utf-8' \
       --data "$payload" "$SLACK_WEBHOOK_URL"
  echo # Add a newline for cleaner output
}

# Add this block to allow direct execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  slack_notify "$@"
fi 