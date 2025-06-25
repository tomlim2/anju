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

echo "✅ 브랜치 생성 및 병합 완료: $NEW_ANIME_BRANCH, $NEW_ENV_BRANCH"