# python — UE 자동화 모듈

**UE 관련: 예.** 이 레포의 중심. 각 모듈은 단독으로 동작하며 모듈 간 의존이 없다.

다만 **전부 UE 에디터 안에서 도는 것은 아니다.** `import unreal` 여부로 갈린다.

## 에디터 안에서 실행 (`import unreal`)

- 액션 시퀀스? → [`action_manager/`](action_manager/)
- 에디터 내 액터 조작? → [`actor_manager/`](actor_manager/)
- VRM 변환·아웃라인·머티리얼 인스턴스? → [`anime_manager/`](anime_manager/) (모듈 중 최대, .py 30개)
- 스켈레탈 메시 교체·미참조 에셋 삭제·머티리얼 재컴파일? → [`asset_manager/`](asset_manager/)
- 블루프린트 자동화? → [`blueprint_tools/`](blueprint_tools/)
- 액터 정렬·종횡비·스크린 퍼센티지? → [`camera_manager/`](camera_manager/)
- 캐릭터 파이프라인 유틸? → [`character_tool/`](character_tool/)
- 머티리얼 편집 보조? → [`material_tools/`](material_tools/)
- 애니메이션 도구? → [`motion_manager/`](motion_manager/)
- 프리셋 커스터마이징·프리뷰 파이프라인? → [`preset_manager/`](preset_manager/)
- 멀티 해상도 캡처·마스크 배치 크롭? → [`quick_screen_shot/`](quick_screen_shot/) ([README](quick_screen_shot/README.md))
- 에셋 태깅? → [`tag_manager/`](tag_manager/)
- 텍스처 유틸리티? → [`texture_manager/`](texture_manager/)
- 환경 설정? → [`env/`](env/)

## 에디터 밖에서 실행 (`import unreal` 없음)

셸이나 별도 GUI로 도는 스탠드얼론 스크립트다. UE 에디터에 붙이지 않는다.

- UE 내부 Git 조작? → [`git_manager/`](git_manager/)
- Git GUI? → [`git_gui/`](git_gui/)
- 빌드 쉬핑·크리에이터 런처? → [`shipping_manager/`](shipping_manager/) — 설정 파일은 gitignore 대상
- 스태틱/스켈레탈 메시 경로 CSV 생성? → [`sm_path_to_csv/`](sm_path_to_csv/) — `to-csv/clothes.csv`를 읽어 에셋 경로 문자열을 만든다
- 이미지 시퀀스 → 스프라이트 시트? → [`sprite_sheet_generator/`](sprite_sheet_generator/)
- CINEV 캐릭터 크리에이터 GUI? → [`user_character_manager/`](user_character_manager/) ([README](user_character_manager/README.md), [한국어](user_character_manager/README_KO.md))
- VRoid 캐릭터 생성? → [`vroid_character_creator/`](vroid_character_creator/)

## 주의

- `preset_manager/customize_presets/`에 `.sav` 357개가 추적되고 있다. 레포 전체 파일의 절반 이상이며, 코드가 아니라 UE 세이브 데이터다.
- 규약: `snake_case`, 모듈 간 의존 금지. [`../guideline/index.md`](../guideline/index.md) 참조.
