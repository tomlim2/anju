# CLAUDE.md

## Project

UE Python 자동화 도구 모음. 에셋, 카메라, 캐릭터, 셰이더, 빌드 자동화 등. 각 모듈은 독립적으로 동작하며 브랜치 간 호환성을 유지한다.

## Structure

```
python/                  # UE Python 모듈 (20개)
├── anime_manager/       # VRM 변환, 아웃라인, 머티리얼 인스턴스
├── asset_manager/       # 스켈레탈 메시 교체, 미사용 에셋 삭제
├── camera_manager/      # 액터 정렬, 종횡비, 스크린 퍼센티지
├── preset_manager/      # 프리셋 커스터마이징, 프리뷰 파이프라인
├── user_character_manager/  # CINEV 캐릭터 크리에이터 GUI
├── shipping_manager/    # 빌드 쉬핑, 크리에이터 런처/쉬퍼
├── quick_screen_shot/   # 멀티 해상도 캡처, 배치 크롭
├── sprite_sheet_generator/  # 이미지 시퀀스 → 스프라이트 시트
├── texture_manager/     # 텍스처 유틸리티
├── material_tools/      # 머티리얼 편집
├── motion_manager/      # 애니메이션 도구
├── actor_manager/       # 에디터 내 액터 조작
├── action_manager/      # 액션 시퀀스
├── blueprint_tools/     # 블루프린트 자동화
├── tag-manager/         # 에셋 태깅
├── git_manager/         # UE 내부 Git 조작
├── gitGUI/              # Git GUI
├── character-tool/      # 캐릭터 파이프라인
├── sm-path-to-csv/      # 스태틱 메시 경로 CSV 추출
└── env/                 # 환경 설정
hlsl/                    # HLSL 셰이더 (카툰, SDF 섀도우, 워터)
glsl/                    # GLSL 셰이더 (툰, 리플)
bat/                     # Windows 배치 (Git, LFS, 리다이렉터)
sh/                      # Shell 스크립트 (아트 브랜치, Slack)
ps1/                     # PowerShell (콘텐츠 언락, 아트 브랜치)
web/                     # Three.js (렌더 타겟)
webgl/                   # WebGL (보이드 시뮬레이션)
```

## Conventions

- **Python**: `snake_case`, `import unreal` 기반 독립 실행 스크립트
- **에셋**: `DA_` 프리픽스 (Data Asset), 포워드 슬래시 경로
- **모듈 독립성**: 모듈 간 의존 금지. 각 모듈은 단독 동작
- **커밋**: `type(scope): message` (예: `feat(creator): add auto source patching`)

## GUI Work

GUI/UI 작업 시 디자인 시스템 참조: `~/.claude/standards/design-system.md`
