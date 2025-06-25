#!/bin/bash

BASE_BRANCH="origin/develop"

# 이전 릴리즈 브랜치
PREV_ANIME_BRANCH="art/ani-r4"
PREV_ENV_BRANCH="art/env-r4"

# 새로운 릴리즈 브랜치
NEW_ANIME_BRANCH="art/ani-r5"
NEW_ENV_BRANCH="art/env-r5"

CHERRYPICK_COMMITS=(
  87e89de0fd2297358572a57565db951088d98327
  f15d0ae4e23b1fe90cc356775bd95cf3348876c2
)

git checkout -b $NEW_ANIME_BRANCH $BASE_BRANCH

git merge origin/$PREV_ANIME_BRANCH -X theirs --no-edit
git merge origin/$PREV_ENV_BRANCH -X theirs --no-edit

for commit in "${CHERRYPICK_COMMITS[@]}"; do
  git cherry-pick $commit
done

git push --set-upstream origin $NEW_ANIME_BRANCH

git checkout -b $NEW_ENV_BRANCH $NEW_ANIME_BRANCH
git push --set-upstream origin $NEW_ENV_BRANCH

# Slack Webhook URL (변경 필요)
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/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"
SLACK_MESSAGE="아래 브렌치들은 개인용 테스트 브렌치입니다.
	✅ \`$NEW_ANIME_BRANCH\`, \`$NEW_ENV_BRANCH\` 브랜치가 생성 및 푸시 완료되었습니다.
- 기준 브랜치: \`$BASE_BRANCH\`
- 병합된 브랜치: \`$PREV_ANIME_BRANCH\`, \`$PREV_ENV_BRANCH\`
메세지 전송 테스트입니다."

curl -X POST -H 'Content-type: application/json' --data "{\"text\":\"$SLACK_MESSAGE\"}" $SLACK_WEBHOOK_URL

echo "✅ 모든 작업 완료 및 Slack 공지 전송됨"