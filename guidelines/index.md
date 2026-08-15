# anju 가이드라인 인덱스

이 레포에서 작업하기 전에 읽는 문서. `CLAUDE.md`와 `AGENTS.md`는 이 파일을 가리키기만 한다.

## 문서 목록

| 문서 | 내용 |
| --- | --- |
| [map.md](map.md) | "X는 어디에 있나" 위치 색인. 파일을 찾을 때는 여기부터 |
| [folder-rules.md](folder-rules.md) | 폴더 생성·이동·삭제 규칙 |

각 최상위 폴더에는 `README.md`가 있고, 첫 줄에 **UE 관련 여부**를 적어 둔다.

## Project

UE Python 자동화 도구 모음. 에셋, 카메라, 캐릭터, 셰이더, 빌드 자동화 등. 각 모듈은 독립적으로 동작하며 브랜치 간 호환성을 유지한다.

## Structure

```
python/                       # UE Python 모듈
├── action_manager/           # 액션 시퀀스
├── actor_manager/            # 에디터 내 액터 조작
├── anime_manager/            # VRM 변환, 아웃라인, 머티리얼 인스턴스
├── asset_manager/            # 스켈레탈 메시 교체, 미사용 에셋 삭제
├── blueprint_tools/          # 블루프린트 자동화
├── camera_manager/           # 액터 정렬, 종횡비, 스크린 퍼센티지
├── character_tool/           # 캐릭터 파이프라인
├── git_gui/                  # Git GUI
├── git_manager/              # UE 내부 Git 조작
├── material_tools/           # 머티리얼 편집
├── motion_manager/           # 애니메이션 도구
├── preset_manager/           # 프리셋 커스터마이징, 프리뷰 파이프라인
├── quick_screen_shot/        # 멀티 해상도 캡처, 배치 크롭
├── shipping_manager/         # 빌드 쉬핑, 크리에이터 런처/쉬퍼
├── sm_path_to_csv/           # 스태틱 메시 경로 CSV 추출
├── sprite_sheet_generator/   # 이미지 시퀀스 → 스프라이트 시트
├── tag_manager/              # 에셋 태깅
├── texture_manager/          # 텍스처 유틸리티
├── user_character_manager/   # CINEV 캐릭터 크리에이터 GUI
├── vroid_character_creator/  # VRoid 캐릭터 생성
└── env/                      # 환경 설정
web/                          # 정적 웹 랩
├── micro-graphic-generator/  # 타이포그래픽 마이크로 그래픽 제네레이터
├── cel-lab/                  # 실시간 셀셰이딩 플레이그라운드
├── monolith/                 # 모노크롬 복셀 타이포그래피
├── type-tape/                # 타이포그래피 리본 랩
├── render-target/            # Three.js 렌더 타겟
└── v0-no-css/                # CSS 없는 마크업 실험
webgl/                        # WebGL (보이드 시뮬레이션)
interactive/                  # 인터랙티브 실험 (flow)
hlsl/                         # HLSL 셰이더 (카툰, SDF 섀도우, 워터)
glsl/                         # GLSL 셰이더 (툰, 리플)
bat/                          # Windows 배치 (Git, LFS, 리다이렉터)
sh/                           # Shell 스크립트 (아트 브랜치, Slack)
ps1/                          # PowerShell (콘텐츠 언락, 아트 브랜치)
module/                       # 언어 무관 재사용 모듈 (pmx2vrm)
ae/                           # After Effects 스크립트
api-test/                     # API 실험 (nz-downloader)
hackathon/                    # 해커톤 작업
csv/, parameters/, logs/      # 데이터·산출물
guidelines/                   # 작업 규칙 문서
```

## Conventions

- **Python**: `snake_case`, `import unreal` 기반 독립 실행 스크립트
- **에셋**: `DA_` 프리픽스 (Data Asset), 포워드 슬래시 경로
- **모듈 독립성**: 모듈 간 의존 금지. 각 모듈은 단독 동작
- **커밋**: `type(scope): message` (예: `feat(creator): add auto source patching`)
- **폴더**: [folder-rules.md](folder-rules.md) 참조

## GUI Work

GUI/UI 작업 시 디자인 시스템 참조: `~/.claude/standards/design-system.md`

## PMX-VRM Converter Workflow

- **작업 환경:** anju repo의 Python 버전에서 작업
- **테스트:** 반드시 스킬(`/pmx-convert-vrm`, `/cocv-validate-vrm` 등)을 통해서만 실행
- **커밋 순서:**
  1. Python 변경사항을 TypeScript BK(backend) 버전에 로컬라이징
  2. Python 변경사항을 TypeScript FE(frontend) 버전에 로컬라이징
  3. `/cocv-sync-ta-tools`로 ta-tools에 싱크
  4. ta-tools 커밋 먼저
  5. anju 커밋
