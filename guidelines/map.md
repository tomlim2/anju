# MAP — 어디에 있나

anju 레포의 위치 색인. **설명하지 않고 위치만 알려준다.** 설명이 필요하면 각 폴더의 `README.md`로 간다.

이 레포의 경계선은 하나다: **UE 관련인가 아닌가.**

---

## UE 관련

### 프로젝트 운영 (셸에서 실행)

CINEVStudio 레포의 Git/LFS/브랜치 운영. 같은 용도가 실행 플랫폼별로 세 폴더에 나뉘어 있다.

- Windows 배치는? → [`bat/`](../bat/README.md)
- PowerShell은? → [`ps1/`](../ps1/README.md)
- Bash는? → [`sh/`](../sh/README.md)
- CINEVStudio를 클론하려면? → [`bat/clone_git.bat`](../bat/clone_git.bat)
- LFS lock을 해제하려면? → [`ps1/unlock_all_contents.ps1`](../ps1/unlock_all_contents.ps1)
- 아트 브랜치를 만들려면? → [`sh/create-art-branches.sh`](../sh/create-art-branches.sh) 또는 [`ps1/create_art_branches.ps1`](../ps1/create_art_branches.ps1)
- 리다이렉터를 헤드리스로 정리하려면? → [`bat/redirector_headless.bat`](../bat/redirector_headless.bat)

### 에디터 자동화 (UE 안에서 실행)

- 모듈 전체 목록은? → [`python/`](../python/README.md)
- VRM 변환·아웃라인·머티리얼 인스턴스는? → [`python/anime_manager/`](../python/anime_manager/)
- 메시 교체·미참조 에셋 삭제는? → [`python/asset_manager/`](../python/asset_manager/)
- 프리셋 커스터마이징은? → [`python/preset_manager/`](../python/preset_manager/)
- 캡처·배치 크롭은? → [`python/quick_screen_shot/`](../python/quick_screen_shot/README.md)
- 에셋 태깅은? → [`python/tag_manager/`](../python/tag_manager/)

### 에디터 밖 Python

`import unreal`이 없는 스탠드얼론 스크립트. 목록은 [`python/README.md`](../python/README.md) 참조.

- 빌드 쉬핑·크리에이터 런처는? → [`python/shipping_manager/`](../python/shipping_manager/)
- 캐릭터 크리에이터 GUI는? → [`python/user_character_manager/`](../python/user_character_manager/README.md)

### 셰이더와 파라미터

- UE 머티리얼 HLSL은? → [`hlsl/`](../hlsl/README.md)
- 툰 셰이딩은? → [`hlsl/cartoon_hlsl.hlsl`](../hlsl/cartoon_hlsl.hlsl)
- 얼굴 SDF 그림자는? → [`hlsl/shadow_sdf.hlsl`](../hlsl/shadow_sdf.hlsl)
- 머티리얼 파라미터 이름 목록은? → [`parameters/`](../parameters/README.md)

### 데이터·부산물

- 캐릭터 프리셋 표는? → [`csv/`](../csv/README.md)
- 과거 실행 로그는? → [`logs/`](../logs/README.md) (폐기 후보)

---

## UE 무관

### 캐릭터 파이프라인

- PMX → VRM 변환은? → [`module/pmx2vrm/`](../module/README.md)
- VRM/GLB API 실험은? → [`api-test/`](../api-test/README.md)

### 웹·그래픽

- 브라우저 랩 전체는? → [`web/`](../web/README.md)
- 마이크로 그래픽 제네레이터는? → [`web/micro-graphic-generator/`](../web/micro-graphic-generator/README.md)
- 절차적 손그림 크리처 그리드는? → [`web/menagerie/`](../web/menagerie/README.md)
- 그 크리처들이 무엇을 참고했는지는? → [`web/menagerie/reference/`](../web/menagerie/reference/README.md)
- menagerie를 고칠 때 지킬 규칙은? → [`web/menagerie/guidelines/`](../web/menagerie/guidelines/README.md)
- menagerie 종족·아키타입은? → [`character/types.md`](../web/menagerie/guidelines/character/types.md)
- menagerie 파츠 전체 목록은? → [`character/parts.md`](../web/menagerie/guidelines/character/parts.md)
- menagerie 모션 전체 목록은? → [`motion/catalog.md`](../web/menagerie/guidelines/motion/catalog.md)
- menagerie 파츠 하나를 눈으로 비교하려면? → 파츠 갤러리 `web/menagerie/gallery.html` ([README § 실행](../web/menagerie/README.md))
- menagerie에서 무엇을 어떤 도구로 판단하나? → [`guidelines/README.md § 무엇으로 판단하나`](../web/menagerie/guidelines/README.md)
- 셀 셰이딩 랩은? → [`web/cel-lab/`](../web/cel-lab/README.md)
- 보이드 시뮬레이션은? → [`webgl/`](../webgl/README.md)
- 유체 시뮬레이션은? → [`interactive/`](../interactive/README.md)
- Substance Painter·웹 셰이더는? → [`glsl/`](../glsl/README.md)

### DCC 툴

- After Effects 스크립트는? → [`ae/`](../ae/README.md)

### 보관

- 해커톤 제출물은? → [`hackathon/`](../hackathon/README.md)

---

## 규칙 문서

- 프로젝트 개요·컨벤션·워크플로는? → [`index.md`](index.md)
- 폴더 생성·이동·삭제 규칙은? → [`folder-rules.md`](folder-rules.md)
- UE Python 모듈은 어떻게 쓰나? → [`python.md`](python.md)
- 새 웹 랩은 어떻게 만드나? → [`web-lab.md`](web-lab.md)
- 셸 스크립트 규칙은? → [`shell.md`](shell.md)
- 이 색인은? → [`map.md`](map.md)

---

## 갱신 규칙

파일이나 폴더가 **이동하면 같은 커밋에서 이 파일을 갱신한다.** 색인은 틀리는 순간 없느니만 못하다.
기계가 읽는 색인을 따로 만들 경우 이 파일에서 생성한다. 손으로 관리하는 색인을 둘 이상 두지 않는다.
