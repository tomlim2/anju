# Micro Graphic Generator

## 목표

브라우저에서 새로고침하거나 Lucky 버튼을 누를 때마다 다른 타이포그래픽 기반 마이크로 그래픽을 생성한다. 도구는 최대한 단순하게 유지한다. 일단은 HTML 한 파일, 흑백 중심, 한글과 영어 혼합, PNG/SVG 내보내기가 핵심이다.

완성 포스터보다는 기술 라벨, SF 인터페이스 조각, 제조 스티커, 상태 카드, 바코드, 작은 시스템 다이어그램 같은 시각 조각을 만든다. 나중에 더 큰 그래픽, UI 텍스처, 진 페이지, 모션 소스, Cargo 스타일 쇼케이스에 재료로 붙일 수 있는 결과물을 목표로 한다.

## 동기

매번 손으로 하나씩 디자인하지 않고, 작은 타이포그래픽 그래픽을 많이 뽑아보는 것이 출발점이다. 중요한 것은 한 장의 완벽한 이미지가 아니라 Lucky를 여러 번 눌렀을 때 예기치 않게 좋은 구도가 나오는 흐름이다.

이 제너레이터는 다음 용도로 쓴다.

- 손으로 계획하기 어려운 시각적 우연을 모은다.
- 시스템 라벨, 코드, 포트, 배지, 검증 마크를 중심으로 개인적인 그래픽 언어를 만든다.
- 한글과 영어가 기술적인 레이아웃 안에서 섞일 때의 리듬을 테스트한다.
- 빌드 단계나 디자인 앱 없이 빠르게 PNG/SVG 재료를 뽑는다.
- 좋은 결과의 seed를 기록해서 나중에 방향성을 다시 이어간다.

## 현재 범위

- `index.html` 단일 파일 앱.
- SVG 기반 렌더링.
- Lucky 버튼으로 새 랜덤 seed 생성.
- 캔버스 클릭으로 새 결과 생성.
- Tone 버튼으로 light/dark 반전.
- 화면 크기 기준 2x PNG 내보내기.
- SVG 내보내기로 벡터 후작업 가능.
- 화면 모서리에 seed 표시, export 파일명에도 seed 포함.

## 용어

- 용어는 디자인/그래픽/웹에서 이미 쓰는 표현을 우선 사용한다. 기존 용어로 설명하기 어려울 때만 새 이름을 만든다.
- `Canvas`: 브라우저 화면 전체. 실제 PNG/SVG export 대상이다.
- `Component`: Canvas 안에 하나만 배치되는 그래픽 단위. Component border line을 가진다.
- `Aspect ratio`: Component의 가로:세로 비율. 현재 `1:1`, `2:3`, `2:5`, `3:2`, `5:2`, `4:3`, `3:4`를 쓰며, 이 비율이 내부 디자인 요소들의 배치를 정한다.
- `Stroke`: Component 외곽선 방식. 현재 `stroke`, `no-stroke`, `corner-stroke` 세 가지를 쓴다.
- `Graphic primitive`: Component를 구성하는 작은 그래픽 재료. barcode, pseudo-QR, tick mark, mini table, wave graph, label, badge, symbol 등이 여기에 속한다.
- `Layout renderer`: Component 안쪽 내용을 그리는 함수. 예: `singleLayout`, `focusPanelLayout`, `specimenLayout`.
- `Seed`: 랜덤 결과를 다시 추적하기 위한 값. 화면 왼쪽 아래에 표시한다.

## 현재 시각 규칙

- 기본은 단색 전경/배경.
- 시스템 텍스트는 monospaced 영어를 쓴다.
- 한글 키워드는 굵은 display label처럼 쓴다.
- 작은 메타데이터, 가짜 조직명, 포트, revision badge, serial, code를 조합한다.
- 선은 살짝 거칠게 만들어 너무 깨끗한 UI처럼 보이지 않게 한다.
- Component border line은 `stroke`, `no-stroke`, `corner-stroke` 중 하나로 정하고, 내부에는 별도의 큰 layout box를 반복해서 만들지 않는다.
- barcode, pseudo-QR, tick mark, mini table, wave graph, label, badge, symbol을 재사용 가능한 graphic primitive로 둔다.
- 복잡한 컨트롤보다 Component 변주를 우선한다.

## Layout Archetype

`Layout archetype`은 Component 안쪽 정보 구조를 정하는 상위 분류다. 하나의 Component는 우선 하나의 archetype을 가진다. archetype은 시각 스타일 이름이 아니라 정보의 목적을 정하는 이름이다.

- `Title`: 이름, 제목, 대표 키워드 중심. 큰 display type, 짧은 subtitle, 작은 code를 쓴다. 내부에 표나 많은 수치를 넣지 않는다.
- `Data`: 표, 성분표, 그래프, 수치 묶음처럼 정보를 읽게 하는 구성. mini table, wave graph, tick mark, dense numeric label을 쓴다. 제목은 보조 역할로 둔다.
- `Critical info`: 가격, barcode, serial, receipt, ticket, access code처럼 정확성이 중요해 보이는 정보. barcode, ID, code, amount, timestamp를 명확히 배치한다. 장식보다 판독성을 우선한다.
- `Status`: 현재 상태를 알려주는 구성. `PASS`, `READY`, `ONLINE`, `RUNNING`, `IDLE`, `GREEN`, `YELLOW`, `RED` 같은 상태값을 중심에 둔다. 경고보다 운영 상태 표시에 가깝다.
- `Identity`: 브랜드, 조직, 제품, 유닛, 배지, 태그 같은 식별 정보. logo-like symbol, organization name, badge, SKU, lot number를 쓴다.
- `Warning`: 위험, 오류, 금지, 만료, 접근 거부처럼 주의나 행동을 요구하는 정보. `WARNING`, `ERROR`, `EXPIRED`, `ACCESS DENIED`, `DO NOT USE` 같은 강한 문구를 쓴다.
- `Instruction`: 순서, 체크리스트, 절차 안내. step number, arrow, short command, checklist mark를 쓴다.
- `Verification`: 인증, 승인, 검수, 스탬프, 확인 코드. `VERIFIED`, `APPROVED`, `QC PASS`, signature-like mark, stamp, reference code를 쓴다.

## Visual System Decisions

아래 항목은 구현 전에 차례대로 정해야 하는 시각 시스템 룰이다. 새 룰을 추가할 때마다 이 섹션이나 이터레이션 로그에 기록한다.

- `Typography`: 한글/영어 폰트 조합, display/body/code용 weight, 숫자와 코드의 자간, 대문자 tracking, 한글 display type의 크기 기준.
- `Type scale`: Canvas 크기와 Component 크기에 따라 title, subtitle, metadata, numeric value, caption이 어떤 크기 범위를 갖는지.
- `Hierarchy`: Component 안에서 1순위 정보, 2순위 정보, 보조 정보, texture 정보가 어떤 순서와 크기로 보이는지.
- `Alignment`: 좌상단 기준, 중앙 기준, 양끝 정렬, baseline 정렬, barcode와 caption의 붙는 방식.
- `Grid`: Component 내부 margin, safe area, column, row, gutter, baseline grid, dense layout에서의 최소 간격.
- `Aspect ratio behavior`: `1:1`, `2:3`, `2:5`, `3:2`, `5:2`, `4:3`, `3:4` 각각에 어울리는 정보 구조와 금지할 구조.
- `Layout archetype mapping`: 각 archetype이 주로 사용할 aspect ratio, typography, primitive, density, stroke mode.
- `Stroke`: `stroke`, `no-stroke`, `corner-stroke`의 선 두께, corner length, inset, roughness, dash 사용 여부.
- `Internal dividers`: Component border 외의 내부 구분선, dashed line, underline, measurement line을 언제 쓸지.
- `Graphic primitive library`: barcode, pseudo-QR, tick mark, mini table, wave graph, badge, stamp, icon, divider, coordinate mark의 사용 조건.
- `Primitive scale`: primitive가 Component 안에서 차지할 상대 크기, 최소/최대 크기, caption과의 거리.
- `Density`: sparse, balanced, dense 같은 밀도 단계. 각 단계별 정보량, 여백, primitive 개수.
- `Whitespace`: Component 안쪽 여백이 디자인 요소인지, 빈 공간을 얼마나 남길지, 비율별 최소 여백.
- `Tone`: light/dark 모드의 배경색, ink 색, 대비, export 시 유지 규칙.
- `Color`: 기본 흑백 외 accent color 사용 여부, status/warning/critical info에서 색이 의미를 갖는 방식.
- `Texture`: 배경 노이즈, 얇은 선, 점, 스캔 느낌을 Canvas 전체에 둘지 Component 내부에 둘지.
- `Roughness`: 선을 얼마나 흔들지, 어떤 요소에는 roughness를 쓰지 않을지.
- `Iconography`: 기호, 아이콘, logo-like mark의 종류, 크기, 위치, 의미 없는 장식 허용 범위.
- `Language mix`: 한글/영어/숫자/코드가 어떤 비율로 섞이는지, archetype별 주 언어.
- `Data realism`: barcode, QR, serial, price, status, graph가 실제 데이터처럼 보여야 하는지, 단순 visual fake로 둘지.
- `Legibility`: 작게 출력해도 읽혀야 하는 정보와 texture처럼 읽히지 않아도 되는 정보의 구분.
- `Export`: PNG scale, SVG 편집 가능성, 파일명 규칙, seed/aspect ratio/stroke/archetype 기록 방식.
- `Interaction`: Lucky, Tone 외에 archetype lock, aspect ratio lock, stroke lock, seed input을 둘지.
- `Curation`: 좋은 결과를 저장하는 기준, seed log 형식, reject할 결과의 조건.

## Rule Gap Inventory

현재 코드에는 아직 룰 없이 감으로 쓰는 그래픽 파트가 많다. 아래 목록은 앞으로 각 파트의 사용 조건, 크기, 위치, 밀도, 금지 조건을 정하기 위한 인벤토리다.

### Active Graphic Parts

현재 화면 생성에 직접 영향을 주는 파트다.

- `textureLayer`: Canvas 전체에 얇은 랜덤 선, 점, 가끔 수평 scan line을 뿌린다. Component와 관계없는 배경 texture다.
- `componentBorder`: Component 외곽선이다. `stroke`, `no-stroke`, `corner-stroke` 세 가지가 있다.
- `panel`: 조직명, icon, badge, status/title, 큰 code 또는 한글 단어, 보조 텍스트, barcode/QR/wave/table/ticks 중 하나를 조합하는 핵심 content block이다.
- `label`: 테두리 또는 반전 fill을 가진 짧은 title strip이다.
- `microBadge`: `V1.2`, `REV A`, `BUILD 859` 같은 작은 badge다.
- `ticks`: 자 또는 measurement line처럼 보이는 tick mark다.
- `barcode`: 실제 데이터가 아닌 visual fake barcode다.
- `qr`: 실제 스캔용이 아닌 pseudo-QR graphic이다.
- `miniTable`: lot/spec/freq/load 같은 가짜 data table이다.
- `wave`: 작은 signal graph 또는 stock graph처럼 보이는 line chart다.
- `singleLayout`: 넓은 비율에서 중앙 strip, code, port, barcode를 배치하는 layout renderer다.
- `specimenLayout`: 큰 한글/영어 단어, barcode, code line을 중앙에 배치하는 layout renderer다.
- `focusPanelLayout`: Component 안에 하나의 `panel`을 크게 넣는 layout renderer다.

### Unruled Decisions Per Part

- `textureLayer`: Canvas 전체에 둘지, Component 내부에만 둘지, export에서 유지할지.
- `componentBorder`: border mode별 권장 aspect ratio, 선 두께, corner length, roughness 기준.
- `panel`: 하나의 panel이 layout renderer인지, primitive인지, archetype별 template인지.
- `label`: title 용도인지, status badge 용도인지, 단순 divider인지.
- `microBadge`: revision/build/version만 허용할지, status나 warning에도 쓸지.
- `ticks`: measurement 의미를 갖게 할지, decorative rhythm으로 둘지.
- `barcode`: Critical info 전용인지, Identity/Verification에서도 쓸지.
- `qr`: 실제 QR처럼 보이는 것을 허용할지, pseudo-QR로 명확히 유지할지.
- `miniTable`: Data archetype 전용으로 묶을지, 다른 archetype의 보조 정보로도 쓸지.
- `wave`: signal/status/data 중 어느 의미로 쓸지.
- `singleLayout`: `Critical info`인지 `Instruction`인지 `Verification`인지 역할을 정해야 한다.
- `specimenLayout`: `Title`인지 `Identity`인지 역할을 정해야 한다.
- `focusPanelLayout`: `panel`의 mode에 따라 archetype을 바꿀지, 별도 archetype renderer로 쪼갤지.

## 추적 방법

생성 결과가 마음에 들면 아래 항목을 기록한다.

- export 파일명.
- 화면 모서리에 표시된 seed.
- tone 상태: light 또는 dark.
- 시각적으로 좋았던 점.
- 강화하거나 제거하고 싶은 규칙.

예시:

```text
micro-graphic-1f3a91c2.svg
SEED 1F3A91C2
dark
Good: sparse central strip, strong code rhythm.
Change: add more wide Korean/English mixed title options.
```

## 다음 실험

- 저장한 seed를 다시 입력해서 복원할 수 있게 한다.
- sparse, dense, label, specimen, texture-heavy 방향을 고르는 작은 preset을 추가한다.
- 기본은 흑백으로 유지하되 accent color 모드를 하나 추가한다.
- 한글 기술 단어와 짧은 문장 조각을 더 늘린다.
- square, story, wallpaper, free viewport export size preset을 추가한다.
- 선택한 seed를 모아두는 saved-gallery JSON 또는 text log를 만든다.
- 낮은 확률로만 나오는 Easter egg를 몇 개 심는다.

## 당장 하지 않을 것

- 프레임워크 도입.
- A4 같은 물리 페이지 제약.
- 무거운 UI 패널.
- Canva/Figma 같은 디자인 앱 의존.
- 실제 스캔 가능한 QR/barcode 데이터. 필요해지기 전까지는 시각 요소로만 둔다.

## 이터레이션 로그

- 2026-07-05: Lucky, Tone, PNG export, SVG export, seed display, 한글/영어 단어, rough SVG primitive, 다섯 가지 layout mode를 가진 초기 HTML generator 추가.
- 2026-07-05: 다음 세션에서도 목표와 실험 방향을 잃지 않도록 이 추적 문서 추가.
- 2026-07-05: `Canvas`, `Component`, `Aspect ratio`, `Stroke`, `Graphic primitive`, `Layout renderer`, `Seed` 용어 정의 추가.
- 2026-07-05: Component `Aspect ratio` 후보를 `1:1`, `2:3`, `2:5`, `3:2`, `5:2`, `4:3`, `3:4`로 정리.
- 2026-07-05: Component `Stroke`를 `stroke`, `no-stroke`, `corner-stroke` 세 가지로 정의하고 seed 표시에도 기록.
- 2026-07-05: 새 용어를 만들기보다 디자인/그래픽/웹의 기존 용어를 우선 사용한다는 원칙 추가.
- 2026-07-05: Component 내부 정보 구조를 정하는 `Layout archetype` 8종(`Title`, `Data`, `Critical info`, `Status`, `Identity`, `Warning`, `Instruction`, `Verification`) 정의.
- 2026-07-05: 아직 룰 없이 쓰는 active graphic parts를 `Rule Gap Inventory`로 정리.
- 2026-07-05: 보류/legacy graphic parts인 `frame`, `sun`, `gridLayout`, `stripLayout` 삭제.
