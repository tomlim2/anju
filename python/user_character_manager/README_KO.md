# CINEV Character Creator GUI

CINEV 사용자 캐릭터를 생성하기 위한 Python GUI 도구입니다.
VRM 파일과 메타데이터 JSON을 기반으로 UE 커맨들릿을 실행하여 캐릭터 에셋을 만듭니다.

## 요구사항

- Python 3.x (tkinter 내장)
- Unreal Engine CINEV 설치
- CINEV Studio 프로젝트 파일 (.uproject)

## 실행 방법

```bash
python character_creator_gui.py
```

## 사용법

### 1단계: 경로 설정 (최초 1회)

경로는 자동 저장되어 다음 실행 시 그대로 유지됩니다.

| 항목 | 설명 |
|------|------|
| **UE_CINEV Directory** | UE 엔진 설치 폴더 (예: `E:\UE_CINEV`) |
| **Project File** | `.uproject` 파일 경로 |
| **Output Folder** | 캐릭터 출력 폴더 |

### 2단계: 캐릭터 정보 입력

1. **Gender** 선택 (Female / Male)
2. **Scaling Method** 선택 (Original / CineV)
3. **Model Source** 선택 (None / VRM / VRoid / Zepeto)
4. **Display Name** 입력
5. **"Generate & Save JSON"** 클릭
   - JSON이 UserCharacter 폴더에 자동 저장됩니다
   - 파일명 형식: `DisplayName_YYYYMMDD_HHMMSS.json`

### 3단계: 캐릭터 생성

1. **JSON File**: 생성한 JSON 파일 선택
2. **VRM File**: `.vrm` 캐릭터 모델 선택
3. **"Build & Create"** 클릭
   - 소스 패치 → 에디터 빌드 → 커맨들릿 실행 순서로 진행
4. 출력 콘솔에서 진행 상황 확인

## 버튼 설명

| 버튼 | 기능 |
|------|------|
| **Build & Create** | 소스 패치 → 빌드 → 커맨들릿 실행 (전체 과정) |
| **Open Zen Dashboard** | UE ZenDashboard 실행 |

## 사전 확인 사항

### ZenServer (필수)
캐릭터 생성 전 ZenServer가 포트 8558에서 실행 중이어야 합니다.
실행되지 않으면 자동으로 차단됩니다. **Open Zen Dashboard** 버튼으로 먼저 실행하세요.

### 자동 소스 패치
`CinevCreateUserCharacterCommandlet.cpp`를 빌드 전에 자동 패치합니다:
- 빌드 전: `InitializeWorldAndGameInstance()` → `InitializeWorldAndGameInstance(FString(), false, false)`
- 커맨들릿 완료 후: 원본으로 자동 복원

GameViewport 없이 에디터 맵 로드 시 크래시를 방지하기 위한 처리입니다.

## 우측 패널: assets.info 편집기

- 캐릭터 프리셋 목록을 트리뷰로 표시 (Preset ID, Display Name, Scaling 등)
- `.character` 바이너리 파일에서 메타데이터 자동 추출
- 엔트리 추가/수정/삭제 가능
- 변경 시 자동 저장 (Ctrl+S 지원)

## 주요 파일 위치

JSON과 VRM 파일은 아래 경로에 위치해야 합니다:

```
프로젝트폴더\Saved\SaveGames\UserCharacter\
```

예시:
```
E:\CINEVStudio\CINEVStudio\
  └── Saved\
      └── SaveGames\
          └── UserCharacter\
              ├── meicat_20251114_081729.json
              └── meicat_20251114_081729.vrm
```

앱이 자동으로 처리합니다:
- **JSON**: UserCharacter 폴더에 직접 생성
- **VRM**: 어디서든 선택 가능 — 실행 시 자동으로 UserCharacter 폴더로 이동

## 설정 파일

경로 설정은 `character_creator_config.json`에 자동 저장됩니다.
초기화하려면 이 파일을 삭제하면 됩니다.
