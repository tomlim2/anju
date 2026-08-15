# 셸 스크립트 규칙

`bat/`, `ps1/`, `sh/` 세 폴더에 해당한다.

## 세 폴더는 같은 용도다

플랫폼만 다르다. 전부 **CINEVStudio(UE) 레포의 Git/LFS/브랜치 운영**이다.
새 스크립트를 어디에 둘지는 언어로 정한다.

| 폴더 | 실행 환경 |
| --- | --- |
| `bat/` | Windows cmd |
| `ps1/` | PowerShell |
| `sh/` | Bash (macOS/Linux/Git Bash) |

**세 폴더에 같은 기능을 다 만들지 않는다.** 실제로 쓰는 환경에만 만든다.
이미 아트 브랜치 생성이 `ps1/`과 `sh/` 양쪽에 있고, 둘의 브랜치 프리픽스가 어긋나 있다.

## 하드코딩

이 폴더들의 가장 큰 문제다. 새로 쓸 때는 최소한 파일 맨 위로 올린다.

```bash
readonly REPO_URL="https://gitlab.cinamon.me/cinev/CINEVStudio.git"
readonly ENGINE_DIR="D:/unreal/base/UE_5.3"
```

- **경로** — 엔진·프로젝트 경로가 로직 중간에 박혀 있으면 다른 PC에서 못 돈다
- **팀원 계정명** — `ps1/unlock_all_contents_by_name.ps1`에 6명이 박혀 있다. 인자로 받는 편이 낫다
- **버전 문자열** — 브랜치 버전(`0.7.0`)이 상수로 박혀 있다. 인자로 받는다

## 파괴적 작업

이 스크립트들은 남의 작업을 날릴 수 있다. LFS lock 해제, `reset --hard`, `lfs prune`이 그렇다.

- 무엇을 지울지 **먼저 출력하고** 실행한다
- 대상이 전체인 작업(`unlock_all`)은 실행 전에 확인을 받는다
- `sh/`는 `set -e`, `set -u`, `set -o pipefail`로 시작한다. 이미 `create-art-branches.sh`가 그렇게 한다

## 비밀값

Webhook URL, 토큰, 비밀번호를 파일에 쓰지 않는다. 환경변수로 받고, 없으면 멈춘다.
`sh/slack-notify.sh`가 `SLACK_WEBHOOK_URL`을 이렇게 처리한다.

## 검증

배치와 PowerShell은 오타가 나도 조용히 넘어가는 경우가 많다. 커밋 전에 한 번은 돌려 본다.
`bat/reset_git.bat`은 `git resest --hard`라는 오타 때문에 **아무 일도 하지 않는다.**
누구도 실행해 보지 않았다는 뜻이다.

## 각 폴더의 현재 상태

폴더별 스크립트 목록과 알려진 문제는 각 README에 있다.

- [`bat/README.md`](../bat/README.md)
- [`ps1/README.md`](../ps1/README.md)
- [`sh/README.md`](../sh/README.md)
