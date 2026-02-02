# CINEV Creator Shipper

**Version:** 0.1.0

CINEV Creator 패키지 빌드 및 배포 GUI 도구.

## Overview

Unreal Engine 프로젝트를 패키징하고 NAS에 업로드하는 GUI 애플리케이션.
Slack 알림을 통해 빌드 상태를 팀에 공유합니다.

## Requirements

- Python 3.10+
- tkinter (Python 기본 포함)
- Unreal Engine (커스텀 빌드)

## Configuration

### 1. shipping_config.json

로컬 프로젝트 설정:

```json
{
  "ue_engine_dir": "D:/UE_CINEV",
  "project_path": "D:/Project/CINEVStudio",
  "output_path": "D:/Packages",
  "nas_path": "\\\\nas.example.com\\Packages",
  "branch": "production/main"
}
```

| 필드 | 설명 |
|------|------|
| `ue_engine_dir` | Unreal Engine 루트 경로 |
| `project_path` | .uproject 파일이 있는 프로젝트 경로 |
| `output_path` | 패키지 출력 경로 |
| `nas_path` | NAS 업로드 경로 (선택) |
| `branch` | 기본 브랜치 |

### 2. Slack 설정 (공유 config 사용)

이 도구는 `~/.claude/config/`의 공유 Slack 설정을 사용합니다:

**~/.claude/config/.env:**
```
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_CHANNEL=C01234567
```

**~/.claude/config/slack.json:**
```json
{
  "bot_username": "아트 아르리므"
}
```

> **Note:** Slack 설정은 다른 Claude 스킬들과 공유됩니다 (art-create, art-notice 등).

## Usage

### GUI 실행

```bash
python shipping_gui.py
# 또는
shipping_manager.bat
```

### 워크플로우

1. **브랜치 입력** - 패키징할 브랜치 이름 입력
2. **검증 및 업데이트** - Git 체크아웃 및 pull
3. **쉬핑 시작** - 패키징 → 압축 → 업로드

### Slack 알림

빌드 과정에서 자동으로 Slack 알림 전송:

1. **시작 알림** - 새 메시지로 빌드 시작 알림
2. **프로젝트 명세** - 스레드에 브랜치/커밋 정보
3. **완료/실패 알림** - 스레드에 결과 전송

## Files

```
shipper/
├── shipping_gui.py         # 메인 GUI 애플리케이션
├── shipping_config.json    # 로컬 프로젝트 설정
├── shipping_manager.bat    # 실행 스크립트
├── test_slack.py           # Slack 연동 테스트
├── test_slack.bat          # 테스트 실행 스크립트
└── last_duration.json      # 마지막 빌드 시간 (ETA 계산용)
```

## Slack Bot Permissions

필요한 Slack Bot 권한:
- `chat:write` - 메시지 전송
- `chat:write.customize` - 커스텀 봇 이름 사용

## Troubleshooting

### Slack 연결 테스트

```bash
python test_slack.py
```

### 공통 오류

| 오류 | 해결 |
|------|------|
| `SLACK_BOT_TOKEN 미설정` | `~/.claude/config/.env` 확인 |
| `channel_not_found` | 채널 ID 확인 및 봇 초대 |
| `not_in_channel` | `/invite @봇이름`으로 채널에 봇 초대 |

## Integration with Claude Skills

이 도구는 Claude Code의 아트 스킬들과 Slack 설정을 공유합니다:

- `/art-create` - 아트 브랜치 생성
- `/art-notice` - 아트 채널 알림
- `/art-merge-notice` - 머지 예정 알림
- `/art-merge-done` - 머지 완료 알림

모든 도구가 동일한 봇 이름 (`아트 아르리므`)으로 메시지를 전송합니다.
