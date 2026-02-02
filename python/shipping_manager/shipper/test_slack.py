"""Slack 연동 테스트 스크립트"""
import os
import json
import urllib.request
from pathlib import Path


def load_shared_config():
    """Load shared Slack config from claude config."""
    # Load .env
    env_path = Path.home() / ".claude" / "config" / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ[key.strip()] = value.strip()

    # Load slack.json
    slack_config_path = Path.home() / ".claude" / "config" / "slack.json"
    if slack_config_path.exists():
        with open(slack_config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


SLACK_CONFIG = load_shared_config()

def test_slack():
    bot_token = os.environ.get('SLACK_BOT_TOKEN', '')
    channel = os.environ.get('SLACK_CHANNEL', '')

    print("=== Slack 연동 테스트 ===\n")

    # 환경변수 확인
    print(f"SLACK_BOT_TOKEN: {'설정됨 (' + bot_token[:20] + '...)' if bot_token else '❌ 미설정'}")
    print(f"SLACK_CHANNEL: {channel if channel else '❌ 미설정'}")
    print()

    if not bot_token or not channel:
        print("❌ 환경변수가 설정되지 않았습니다.")
        print("   .env 파일을 확인하세요.")
        return

    # 테스트 메시지 전송
    print("테스트 메시지 전송 중...")

    try:
        payload = {
            "channel": channel,
            "text": "🧪 [테스트] Slack 연동 테스트 메시지입니다.",
            "username": SLACK_CONFIG.get("bot_username", "아트 아르리므"),
        }
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            "https://slack.com/api/chat.postMessage",
            data=data,
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": f"Bearer {bot_token}"
            }
        )
        response = urllib.request.urlopen(req, timeout=10)
        result = json.loads(response.read().decode('utf-8'))

        if result.get('ok'):
            print(f"✅ 성공! 메시지 전송됨 (ts: {result.get('ts')})")

            # 스레드 테스트
            thread_ts = result.get('ts')
            print("\n스레드 댓글 테스트 중...")

            payload2 = {
                "channel": channel,
                "text": "📝 스레드 댓글 테스트입니다.",
                "thread_ts": thread_ts,
                "username": SLACK_CONFIG.get("bot_username", "아트 아르리므"),
            }
            data2 = json.dumps(payload2).encode('utf-8')
            req2 = urllib.request.Request(
                "https://slack.com/api/chat.postMessage",
                data=data2,
                headers={
                    "Content-Type": "application/json; charset=utf-8",
                    "Authorization": f"Bearer {bot_token}"
                }
            )
            response2 = urllib.request.urlopen(req2, timeout=10)
            result2 = json.loads(response2.read().decode('utf-8'))

            if result2.get('ok'):
                print("✅ 스레드 댓글도 성공!")
            else:
                print(f"❌ 스레드 댓글 실패: {result2.get('error')}")

        else:
            print(f"❌ 실패: {result.get('error')}")
            if result.get('error') == 'channel_not_found':
                print("   → 채널 ID가 올바르지 않거나 봇이 채널에 초대되지 않았습니다.")
            elif result.get('error') == 'invalid_auth':
                print("   → Bot Token이 올바르지 않습니다.")
            elif result.get('error') == 'not_in_channel':
                print("   → 봇을 채널에 초대해주세요. (/invite @봇이름)")

    except Exception as e:
        print(f"❌ 오류: {e}")


if __name__ == "__main__":
    test_slack()
    input("\nEnter를 눌러 종료...")
