# sh — UE 프로젝트 운영 (Bash)

**UE 관련: 예.** CINEVStudio 아트 브랜치 생성과 릴리스 Slack 알림.

같은 용도의 다른 플랫폼 구현: [`../bat/`](../bat/README.md) (배치), [`../ps1/`](../ps1/README.md) (PowerShell)

## 어디에 있나

- 아트 브랜치(`art/anime-`, `art/env-`)를 cherry-pick과 함께 만들려면? → [`create-art-branches.sh`](create-art-branches.sh)
- 브랜치 생성 결과를 Slack에 알리려면? → [`slack-notify.sh`](slack-notify.sh) — `SLACK_WEBHOOK_URL` 환경변수 필요

## 알려진 문제

- 브랜치 프리픽스가 두 파일에서 어긋난다. `create-art-branches.sh`는 `art/anime-`, `slack-notify.sh`는 `art/ani-`를 쓴다.
