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
- Tokens 버튼으로 디자인 토큰 카탈로그 모드 전환.
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
- `Content detail`: Content block 안쪽 하단에 들어가는 정보 묶음. barcode detail, pseudo-QR detail, table detail, wave detail, ticks detail이 여기에 속한다.
- `Display keyword`: `REPORT`, `STATUS`, `MODULE`, `ACCESS`처럼 제목이나 상태 문구처럼 읽히는 영어 keyword다. data value가 아니며 Noto Sans English role을 쓴다.
- `Layout renderer`: Component 안쪽 내용을 그리는 함수. 예: `renderStripLayout`, `renderPanelLayout`, `renderSpecimenLayout`.
- `Seed`: 랜덤 결과를 다시 추적하기 위한 값. 화면 왼쪽 아래에 표시한다.

## 현재 시각 규칙

- 기본은 단색 전경/배경.
- 영문, 한글, 한자는 모두 Noto Sans 계열을 기본으로 쓰되, code/data view는 mono로 분리한다.
- 한글/한자 키워드는 굵은 display label처럼 쓴다.
- 작은 메타데이터, 가짜 조직명, 포트, revision badge, serial, code를 조합한다.
- 조직명은 `@CARGO SYSTEMS`처럼 표기하고, 앞에 의미 없는 랜덤 symbol prefix를 붙이지 않는다.
- 선은 살짝 거칠게 만들어 너무 깨끗한 UI처럼 보이지 않게 한다.
- Component border line은 `stroke`, `no-stroke`, `corner-stroke` 중 하나로 정하고, 내부에는 별도의 큰 layout box를 반복해서 만들지 않는다.
- Component border와 내부 content 사이에는 `PADDING_TOKENS.large` 기반 safe area를 둔다.
- Content block 안쪽 텍스트와 badge는 `PADDING_TOKENS.medium`, detail primitive는 `PADDING_TOKENS.small` 기준으로 배치한다.
- 디자인 토큰 사이의 간격은 `MARGIN_TOKENS.small`, `MARGIN_TOKENS.medium`, `MARGIN_TOKENS.large`만 쓴다.
- 모든 display token, greeting token, date/time token, data token은 자신이 받은 padded box 안에서만 spawn한다. 긴 문자는 `maxWidth` 기준으로 축소한다.
- 텍스트 정렬은 `left`, `center`, `right` 세 가지만 허용한다. SVG의 `start`, `middle`, `end`는 내부 변환값으로만 쓴다.
- 디자인 토큰은 `small`, `medium`, `large`, `xlarge` 네 크기 단계로 나누고, 크기 단계가 한 행을 어떻게 점유하는지 정한다.
- 모든 디자인 토큰의 배치 축도 `left`, `center`, `right` 세 가지만 쓴다. 토큰은 세 축 위에서 테트리스 블록처럼 행 단위로 쌓일 수 있고, 작은 spin 회전은 허용한다.
- `Tokens` mode는 현재 vocabulary, date/time token, metadata token, graphic primitive 샘플을 한 화면에 모아보는 catalog view다.
- barcode, pseudo-QR, tick mark, mini table, wave graph, label, badge, symbol을 재사용 가능한 graphic primitive로 둔다.
- 복잡한 컨트롤보다 Component 변주를 우선한다.

## Visual System Process

시각 시스템은 한 번에 완성하지 않고, 작은 결정을 하나씩 확정하면서 맞춰나간다. 새로 정한 룰은 코드와 문서에 같이 반영한다.

- 먼저 현재 쓰는 element를 관찰하고 이름과 경계를 정한다.
- 그다음 typography, grid, stroke, primitive, density, texture 순서로 하나씩 룰을 고정한다.
- 확정한 룰은 `현재 시각 규칙` 또는 해당 시스템 섹션에 적는다.
- 아직 확정하지 않은 항목은 `Visual System Decisions`나 `Rule Gap Inventory`에 남겨둔다.
- 룰을 바꾸면 코드의 extension point와 README의 운영 문서를 같이 업데이트한다.
- 좋은 결과가 나온 seed는 룰 검증용 reference로 남긴다.

## Padding System

안쪽 grid를 만들기 전 단계로, 모든 Component 내부 배치는 세 단계 padding token을 먼저 따른다. padding은 보이지 않는 안전 영역이며, graphic primitive나 text token을 직접 장식하기 위한 선이 아니다.

- `large`: Component border와 content 사이의 safe area다. `renderPanelLayout`, `renderStripLayout`, `renderSpecimenLayout`이 모두 이 영역 안에서만 좌표를 만든다.
- `medium`: Content block 내부의 header, badge, display keyword, main value, sub value, detail area 기준이다.
- `small`: barcode, pseudo-QR, mini table, wave, tick 같은 detail primitive의 내부 여백이다.

텍스트는 `textNode()`에 `maxWidth`를 넘기는 것을 기본으로 한다. `안녕?`, `你好?`, `HELLO?`, `林`, 날짜/시간처럼 폭이 달라지는 typography도 padded box를 넘지 않도록 font size를 줄이고, 필요한 경우 SVG `textLength`로 마지막 fit을 건다.

`contentPanel`은 `contentZones()`로 vertical zone을 나눈다. `header`, `label`, `main`, `sub`, `detail`은 서로의 영역을 침범하지 않아야 한다. 큰 display word는 `main` zone 높이 안에서만 크기가 정해지고, barcode, QR, table, wave, tick 같은 graphic token은 `detail` zone 안에서만 spawn한다.

## Margin System

margin은 디자인 토큰 사이의 거리다. padding이 Component나 content block 안쪽의 안전 영역이라면, margin은 이미 배치된 token과 다음 token 사이의 관계를 정한다.

- `small`: 하나의 token 내부에서 쓰는 최소 숨구멍이다. label text inset, micro badge text inset, mini table cell inset, barcode caption gap처럼 아주 가까운 요소 사이에 쓴다.
- `medium`: 같은 content block 안에서 관련 token끼리 떨어지는 기본 거리다. `contentZones()`의 header, label, main, sub, detail 사이 gap과 pseudo-QR 옆 설명 텍스트 간격에 쓴다.
- `large`: 서로 다른 정보 덩어리나 판독성을 위해 크게 비워야 하는 거리다. barcode quiet zone처럼 가장자리와 data mark 사이를 띄울 때 쓴다.

새 primitive를 만들 때 임의 숫자로 `+ 9`, `- 14` 같은 간격을 넣지 않는다. 간격이 필요하면 `marginSize(w, h, "small" | "medium" | "large")`를 먼저 쓰고, 그 값이 시각적으로 맞지 않을 때 token 값 자체를 조정한다.

## Alignment System

텍스트 정렬은 `left`, `center`, `right` 세 가지 token만 허용한다. 코드에서는 `TEXT_ALIGNMENTS`와 `resolveTextAlignment()`가 이 세 값을 SVG `text-anchor` 값으로 변환한다.

- `left`: 기본값이다. header, label, table cell, serial, code caption처럼 읽기 시작점이 중요한 token에 쓴다.
- `center`: badge, specimen word, strip 중앙 숫자처럼 중앙 축이 레이아웃 기준일 때만 쓴다.
- `right`: 오른쪽 edge에 붙는 명시적인 값이나 숫자 column이 필요할 때만 쓴다.

`textNode()` 호출부에서는 `anchor`, `start`, `middle`, `end`를 직접 쓰지 않는다. 새 텍스트를 추가할 때는 필요한 경우에만 `align: "center"` 또는 `align: "right"`를 명시하고, 나머지는 기본 `left`에 둔다.

## Token Size System

디자인 토큰은 시각적 중요도와 행 점유 방식에 따라 `small`, `medium`, `large`, `xlarge`로 나눈다. 코드에서는 `DESIGN_TOKEN_SIZES`와 `tokenSize` 속성으로 기록한다.

- `small`: 조직명, revision badge, serial, barcode caption, table cell, port/code caption처럼 보조 정보다. 한 행에 최대 두 개까지 올 수 있고, 기본 조합은 `left` + `right`다. 작은 토큰이 하나만 있을 때는 `left`, `center`, `right` 중 하나에 단독 배치할 수 있다.
- `medium`: `STATUS`, `REPORT`, section label, subtitle, short command처럼 중간 위계의 정보다. 한 행에 하나만 둔다. 좌/중/우 정렬은 가능하지만 같은 행에서 다른 토큰과 나란히 놓지 않는다.
- `large`: main display word, 큰 숫자, date/time display처럼 한 component에서 시선을 먼저 받는 정보다. 무조건 한 행에 하나만 두고, medium과 명확히 구분되도록 크게 운용한다. 큰 토큰 행에는 small badge나 caption을 얹지 않는다.
- `xlarge`: 특대 토큰이다. greeting, 대표 한글/영문 단어, 독립 한자, 아주 큰 code처럼 화면을 장악해야 하는 hero token에만 쓴다. 한 행을 독점하고, large의 약 두 배 체감 크기를 목표로 더 적은 개수와 더 강한 스케일로 운용한다.

작은 요소만 같은 행에서 왼쪽 정렬과 오른쪽 정렬을 동시에 가질 수 있다. 중간/큰/특대 요소는 행을 독점한다. 특히 큰 토큰과 특대 토큰은 content zone의 `main` row를 혼자 차지해야 하며, 다른 토큰이 그 row를 침범하면 안 된다.

상위 토큰 수량은 코드의 `MAJOR_TOKEN_RULES`를 따른다. `large`부터는 major token으로 취급하고, 한 생성 layout 안에서 major token은 총 하나만 허용한다. 즉 `large`와 `xlarge`는 둘 다 pair로 배치하지 않는다.

이 규칙은 Component-level stacking 기준이다. barcode caption, mini table cell처럼 graphic primitive 내부에서 생기는 작은 data token은 해당 primitive의 내부 grid를 따른다.

`Tokens` mode는 이 분류를 검토하기 위한 catalog view다. small, medium, large, xlarge section을 따로 렌더링하고, 하단에 barcode, table, wave, tick, pseudo-QR 같은 graphic primitive 샘플을 함께 둔다. 새 token을 추가했을 때 이 모드에서 한 번에 누락과 밀도를 확인한다. catalog view는 목록 검토가 목적이므로 생성 layout의 xlarge/large 수량 제한을 적용하지 않는다.

## Token Placement System

디자인 토큰은 자유 좌표에 흩뿌리지 않고 `left`, `center`, `right` 세 alignment slot 중 하나에 붙인다. 이 규칙은 텍스트뿐 아니라 label, badge, strip 같은 작은 그래픽 토큰에도 적용한다.

- `left`: box의 왼쪽 edge를 기준으로 쌓는다.
- `center`: box의 중앙 축을 기준으로 쌓는다.
- `right`: box의 오른쪽 edge를 기준으로 쌓는다.

토큰이 여러 개일 때는 한 줄마다 다른 slot을 선택할 수 있다. 이 방식이 현재 시스템에서 말하는 Tetris stacking이다. 예를 들어 header row는 small left/right pair, label row는 right, main display row는 center, sub row는 left처럼 각 행이 서로 다른 축에 붙을 수 있다. 단, 임의의 x 좌표를 만들지는 않는다.

spin은 토큰 자체에 주는 작은 회전이다. spin은 alignment를 대체하지 않는다. 먼저 `left`, `center`, `right` 중 하나로 붙인 다음, 그 token의 중심이나 anchor를 기준으로 살짝 회전한다. 현재 코드는 `SPIN_TOKENS.none`, `SPIN_TOKENS.subtle`, `SPIN_TOKENS.medium`만 둔다.

## Typography System

현재 폰트 시스템은 Noto Sans 계열로 고정한다. 코드에서는 `TYPEFACES`와 `resolveTypeface()`로 관리한다.

- `english`: `"Noto Sans"`를 기본으로 쓴다. 브랜드명, 영문 title, warning phrase, status phrase, display keyword에 쓴다.
- `mono`: `"Noto Sans Mono"`를 기본으로 쓴다. code, serial, port, table, numeric data, data view에 쓴다.
- `korean`: `"Noto Sans KR"`를 기본으로 쓴다. 한글이 포함된 텍스트는 자동으로 이 role을 쓴다.
- `hanja`: `"Noto Sans KR"`를 기본으로 쓰고, 없는 glyph는 `"Noto Sans SC"`로 fallback한다. 독립 한자 display glyph는 원칙적으로 쓰지 않되, 현재는 예외로 `林`만 display typography에 허용한다.
- `chinese`: `"Noto Sans SC"`를 기본으로 쓴다. `你好?`, `刷新`, 중국어 날짜 표기처럼 Simplified Chinese glyph가 필요한 token에 쓴다.
- `ui`: generator controls와 seed label에 쓰는 UI font다. Noto Sans, Noto Sans KR, Noto Sans SC 순서로 fallback한다.

`textNode()`는 텍스트 안의 한글/한자를 감지해서 font role을 자동 선택한다. code/data view처럼 의미상 mono가 필요한 경우에는 `typeface: "mono"`로 직접 지정한다.

`REPORT`, `STATUS`, `MODULE`, `ACCESS` 같은 요소는 `display keyword`다. 이들은 code나 data view가 아니므로 `typeface: "english"`를 명시하고 Noto Sans English role로 표시한다. display keyword는 글자 사이에 임의 공백을 넣거나 과한 tracking을 주지 않고, 단어 그대로 조판한다.

`안녕?`, `你好?`, `HELLO?`는 greeting typography다. 인사말은 `greetingTokens`에 `{ value, typeface }` 형태로 묶고, display typography 후보에만 넣는다. barcode, serial, table, code 같은 data view에는 넣지 않는다.

웹에서 보기 위해 `Noto Sans`, `Noto Sans KR`, `Noto Sans SC`, `Noto Sans Mono`는 `fonts/` 안에 로컬 파일로 번들한다. HTML은 `./fonts/fonts.css`를 import하고, SVG export도 같은 CSS 파일을 절대 URL로 넣는다. 외부 Google Fonts 요청을 기다리지 않도록 하기 위한 결정이며, 앱은 로컬 폰트가 붙은 뒤 첫 렌더가 되도록 `document.fonts.load()`와 `document.fonts.ready`를 짧게 기다린다.

중국어/한자 glyph가 현재 font-face에 없으면 브라우저가 시스템 fallback font로 빠지면서 같은 `font-weight`라도 덜 굵게 보일 수 있다. 중국어 token은 `Noto Sans SC` subset을 로컬 번들에 추가해 weight mismatch를 줄인다.

### Date And Refresh Time Typography

오늘 날짜와 리프레시된 시간도 display typography로 취급한다. 코드에서는 `todayDateTypographyTokens()`가 브라우저 로컬 시간의 `Date()`를 기준으로 한국어, 영어, 중국어 표기를 만든다.

- 한국어 예: `2026년 7월 5일`, `2026년 7월 5일 오후 3시 24분`, `갱신 15:24:03`, `타임스탬프 1783232643000`.
- 영어 예: `JULY 5, 2026`, `JULY 5, 2026 15:24:03`, `REFRESHED 15:24:03`, `TIMESTAMP 1783232643000`.
- 중국어 예: `2026年7月5日`, `二〇二六年七月五日`, `刷新 15:24:03`, `时间戳 1783232643000`.

날짜/시간 표기는 `contentPanel`의 큰 main value, `renderSpecimenLayout`의 specimen word처럼 제목성 typography 영역에만 들어간다. barcode, serial, code, table, QR detail, port 같은 data view에는 넣지 않는다. 중국어/한자는 날짜 표기 안에서만 허용하는 것을 기본으로 하되, 독립 display glyph는 `林`만 예외로 허용한다. 날짜/시간은 오늘과 리프레시 시점에 따라 변하므로, 같은 seed라도 날짜나 시간이 다르면 완전히 동일한 typography가 재현되지 않을 수 있다.

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
- `Alignment`: `left`, `center`, `right` 중 어떤 정렬을 어느 token class에서 쓸지. 그 외 임의 정렬은 만들지 않는다.
- `Token size`: `small`, `medium`, `large` token이 각각 어떤 행 점유 규칙과 정보 위계를 갖는지.
- `Token placement`: 디자인 토큰이 `left`, `center`, `right` slot에 어떻게 쌓이는지, spin을 어느 token class까지 허용할지.
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
- `Data realism`: barcode, pseudo-QR, serial, price, status, graph가 실제 데이터처럼 보여야 하는지, 단순 visual fake로 둘지.
- `Legibility`: 작게 출력해도 읽혀야 하는 정보와 texture처럼 읽히지 않아도 되는 정보의 구분.
- `Export`: PNG scale, SVG 편집 가능성, 파일명 규칙, seed/aspect ratio/stroke/archetype 기록 방식.
- `Interaction`: Lucky, Tone 외에 archetype lock, aspect ratio lock, stroke lock, seed input을 둘지.
- `Curation`: 좋은 결과를 저장하는 기준, seed log 형식, reject할 결과의 조건.

## Current Element System

현재 쓰는 element는 아래 층위로 정리한다. 위쪽 층위는 아래쪽 층위를 직접 건너뛰지 않는다.

- `Visual tokens`: 단어, 조직명, date/time label, table label, 가짜 data label이다. 코드에서는 `visualTokens`에 모은다. 새 단어나 label은 여기만 수정한다.
- `SVG helpers`: `make`, `textNode`, `line`, `rect`, `polyline`, `defs`처럼 SVG node를 만드는 낮은 수준의 도구다. 의미 있는 디자인 결정을 하지 않는다.
- `Graphic primitives`: `label`, `microBadge`, `ticks`, `barcode`, `pseudoQr`, `miniTable`, `wave`처럼 하나의 작은 그래픽 형태를 그린다.
- `Content details`: `renderBarcodeDetail`, `renderPseudoQrDetail`, `renderTableDetail`, `renderWaveDetail`, `renderTicksDetail`처럼 content block 하단에 들어갈 정보 묶음이다. 코드에서는 `contentDetailModes` registry로 관리한다.
- `Content block`: `contentPanel`이다. header, badge, main value, sub value, detail의 내부 위계를 가진다. Component border는 그리지 않는다.
- `Layout renderers`: `renderStripLayout`, `renderPanelLayout`, `renderSpecimenLayout`이다. Component 안에서 content block과 primitive를 배치한다.
- `Component layer`: `componentTemplates`, `renderComponentBorder`, `renderComponent`다. Component의 ratio, scale, border, layout renderer 선택을 담당한다.
- `Canvas layer`: `renderCanvasTexture`, `render`다. 화면 배경, 전체 texture, export 대상 화면을 담당한다.

## Boundary Contracts

- `visualTokens`는 data source다. 위치, 크기, 획, 레이아웃 결정을 하지 않는다.
- `SVG helpers`는 shape만 만든다. 특정 archetype이나 Component ratio를 알면 안 된다.
- `Graphic primitive`는 전달받은 `g`, `x`, `y`, `w`, `h` 안에서만 그린다. Canvas 배경, Component border, seed label을 만지지 않는다.
- `Content detail renderer`는 content block의 detail 영역만 책임진다. header, main value, Component border를 만들지 않는다.
- `contentPanel`은 하나의 정보 block이다. 내부 정보 위계는 만들 수 있지만 Component 전체의 aspect ratio나 Canvas placement를 결정하지 않는다.
- `Layout renderer`는 Component 내부의 배치만 책임진다. Component border를 직접 그리지 않고, Canvas texture를 만들지 않는다.
- `componentTemplates`는 ratio, scale, layout renderer 연결만 가진다. 실제 SVG node 생성은 renderer에 맡긴다.
- `renderComponent`는 Canvas 안에 Component 하나를 배치하고 Component border를 붙인다. Content detail의 종류를 직접 알지 않는다.
- `render`는 Canvas orchestration만 담당한다. background, texture, Component를 순서대로 붙이고 export에 쓰이는 viewBox를 정한다.

## Extension Points

새 요소를 추가할 때는 아래 위치에만 손대는 것을 기본 규칙으로 한다.

- 새 한글/영어 단어, 조직명, table label: `visualTokens`에 추가한다.
- 새 date/time typography: `todayDateTypographyTokens()`에 추가하고, data detail renderer에서는 호출하지 않는다.
- 새 graphic primitive: primitive 함수를 만든 뒤 content detail이나 layout renderer에서 호출한다.
- 새 content detail: `renderSomethingDetail` 함수를 만들고 `contentDetailModes`에 `{ id, weight, render }`로 등록한다.
- 새 layout renderer: `renderSomethingLayout` 함수를 만들고 필요한 `componentTemplates` 항목에 연결한다.
- 새 Component ratio: `componentTemplates`에 `{ label, ratio, scale, render }`를 추가한다.
- 새 border mode: `componentBorderModes`에 id를 추가하고 `renderComponentBorder`에 그리는 방식을 추가한다.
- Component와 content 안쪽 여백은 `PADDING_TOKENS`와 `paddedBox()`에서 조정한다.
- 디자인 토큰 사이 간격은 `MARGIN_TOKENS`와 `marginSize()`에서 조정한다.
- 디자인 토큰의 크기 단계는 `DESIGN_TOKEN_SIZES`와 `tokenSize`에서 조정한다.
- 디자인 토큰의 좌/중/우 배치와 spin은 `TOKEN_ALIGNMENTS`, `alignedBoxX()`, `alignedTextX()`, `smallTokenPairZones()`, `stackTextToken()`, `spinAngle()`에서 조정한다.
- Tokens catalog에 보이는 token 묶음은 `tokenGalleryItems()`에서 조정한다.
- 새 generator mode는 `appMode`, controls binding, `render()`의 mode 분기에서 추가한다.

## Rule Gap Inventory

현재 코드에는 아직 룰 없이 감으로 쓰는 그래픽 파트가 많다. 아래 목록은 앞으로 각 파트의 사용 조건, 크기, 위치, 밀도, 금지 조건을 정하기 위한 인벤토리다.

### Active Graphic Parts

현재 화면 생성에 직접 영향을 주는 파트다.

- `renderCanvasTexture`: Canvas 전체에 얇은 랜덤 선, 점, 가끔 수평 scan line을 뿌린다. Component와 관계없는 배경 texture다.
- `renderComponentBorder`: Component 외곽선이다. `stroke`, `no-stroke`, `corner-stroke` 세 가지가 있다.
- `contentPanel`: 조직명, badge, status/title, 큰 code 또는 한글 단어, 보조 텍스트, barcode/pseudo-QR/wave/table/ticks 중 하나를 조합하는 핵심 content block이다.
- `label`: 테두리 또는 반전 fill을 가진 짧은 title strip이다.
- `microBadge`: `V1.2`, `REV A`, `BUILD 859` 같은 작은 badge다.
- `ticks`: 자 또는 measurement line처럼 보이는 tick mark다.
- `barcode`: 실제 스캔 보장 데이터가 아닌 UPC/EAN-like visual fake barcode다. quiet zone, guard bar, 95-module pattern, human-readable caption을 갖는다.
- `pseudoQr`: 실제 스캔용이 아닌 pseudo-QR graphic이다.
- `miniTable`: lot/spec/freq/load 같은 가짜 data table이다.
- `wave`: 작은 signal graph 또는 stock graph처럼 보이는 line chart다.
- `renderStripLayout`: 넓은 비율에서 중앙 strip, code, port, barcode를 배치하는 layout renderer다.
- `renderSpecimenLayout`: 큰 한글/영어 단어, barcode, code line을 중앙에 배치하는 layout renderer다.
- `renderPanelLayout`: Component 안에 하나의 `contentPanel`을 크게 넣는 layout renderer다.

### Unruled Decisions Per Part

- `renderCanvasTexture`: Canvas 전체에 둘지, Component 내부에만 둘지, export에서 유지할지.
- `renderComponentBorder`: border mode별 권장 aspect ratio, 선 두께, corner length, roughness 기준.
- `contentPanel`: 하나의 content block인지, archetype별 template으로 쪼갤지.
- `label`: title 용도인지, status badge 용도인지, 단순 divider인지.
- `microBadge`: revision/build/version만 허용할지, status나 warning에도 쓸지.
- `ticks`: measurement 의미를 갖게 할지, decorative rhythm으로 둘지.
- `barcode`: Critical info 전용인지, Identity/Verification에서도 쓸지. 현재는 UPC/EAN-like visual fake로 쓰며 실제 스캔 가능성은 보장하지 않는다.
- `pseudoQr`: 실제 QR처럼 보이는 것을 허용할지, pseudo-QR로 명확히 유지할지.
- `miniTable`: Data archetype 전용으로 묶을지, 다른 archetype의 보조 정보로도 쓸지.
- `wave`: signal/status/data 중 어느 의미로 쓸지.
- `renderStripLayout`: `Critical info`인지 `Instruction`인지 `Verification`인지 역할을 정해야 한다.
- `renderSpecimenLayout`: `Title`인지 `Identity`인지 역할을 정해야 한다.
- `renderPanelLayout`: `contentPanel`의 mode에 따라 archetype을 바꿀지, 별도 archetype renderer로 쪼갤지.

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
- 2026-07-05: 현재 element를 `Visual tokens`, `SVG helpers`, `Graphic primitives`, `Content details`, `Content block`, `Layout renderers`, `Component layer`, `Canvas layer`로 재분류.
- 2026-07-05: boundary contract와 extension point를 문서화하고, 코드 네이밍을 해당 층위에 맞게 정리.
- 2026-07-05: 영문/한글/한자/UI font를 Noto Sans 계열로 통일하고 `TYPEFACES`, `resolveTypeface()` 기반으로 적용.
- 2026-07-05: 브랜드/워닝 문구용 `english`와 code/data view용 `mono`를 분리하고, 데이터 텍스트에 `Noto Sans Mono` 적용.
- 2026-07-05: 시각 시스템을 작은 결정 단위로 맞춰나가는 `Visual System Process` 추가.
- 2026-07-05: 오늘 날짜와 리프레시 시간을 한국어/영어/중국어 display typography로 추가하고 data view와 분리.
- 2026-07-05: 독립 countable typography와 한자 display glyph를 제거하고, 중국어/한자는 날짜 표기 안에서만 허용.
- 2026-07-05: 조직명 앞의 랜덤 symbol prefix를 제거하고 `@ORG SUFFIX` 표기로 고정.
- 2026-07-05: `REPORT` 같은 영어 문구형 요소를 `display keyword`로 정의하고 Noto Sans English role로 고정.
- 2026-07-05: Noto Sans KR fallback 노출을 줄이기 위해 웹폰트 로드 이후 첫 렌더를 실행하도록 보강.
- 2026-07-05: Component safe area와 content 내부 padding을 `componentPadding()`, `contentPadding()`으로 분리.
- 2026-07-05: Google Fonts 네트워크 의존을 제거하고 `fonts/`에 Noto Sans 계열 TTF를 번들해 HTML/SVG export가 같은 로컬 폰트를 쓰도록 변경.
- 2026-07-05: `STATUS`, `MODULE`, `REPORT` 같은 display keyword의 임의 공백/tracking을 제거하고 Noto Sans English role로 단어 그대로 표시.
- 2026-07-05: 독립 한자 display glyph는 `林`만 예외로 허용하고, data view에는 넣지 않도록 `hanjaKeywords`를 display typography 후보에만 연결.
- 2026-07-05: 한국어/중국어/영어 인사말 `안녕?`, `你好?`, `HELLO?`를 `greetingTokens`로 묶고 display typography 후보에만 연결.
- 2026-07-06: `small`, `medium`, `large` padding token을 정의하고 모든 Component layout, content detail, text token이 padded box 안에서만 배치되도록 정리.
- 2026-07-06: `contentZones()`로 `header`, `label`, `main`, `sub`, `detail` vertical zone을 분리해 큰 display word가 작은 text token이나 detail graphic token을 침범하지 않게 정리.
- 2026-07-06: 중국어 token용 `Noto Sans SC` subset을 로컬 폰트로 추가하고 `chinese` role이 이를 먼저 쓰게 변경. 큰 display word는 `maxHeight`도 기준으로 fit하도록 조정.
- 2026-07-06: 텍스트 정렬 token을 `left`, `center`, `right` 세 가지로 제한하고, `textNode()` 호출부에서 SVG `anchor` 직접 사용을 제거.
- 2026-07-06: 오늘 날짜 display typography에 epoch timestamp 표기(`타임스탬프`, `TIMESTAMP`, `时间戳`)를 추가.
- 2026-07-06: barcode primitive를 랜덤 막대에서 UPC/EAN-like 95-module pattern, guard bar, quiet zone, human-readable caption 구조로 변경.
- 2026-07-06: 디자인 토큰 사이 간격을 `MARGIN_TOKENS.small`, `MARGIN_TOKENS.medium`, `MARGIN_TOKENS.large`로 분리하고 label, badge, barcode, table, pseudo-QR 간격에 적용.
- 2026-07-06: 디자인 토큰 배치를 `left`, `center`, `right` alignment slot으로 제한하고, content panel의 토큰을 행 단위로 Tetris stacking 하며 작은 spin 회전을 허용.
- 2026-07-06: 디자인 토큰 크기를 `small`, `medium`, `large`로 분류하고, small token만 한 행에서 left/right pair를 허용하며 large token은 한 행 독점으로 고정.
- 2026-07-06: barcode 위쪽에 겹쳐 보이던 `UPC ####` overlay를 제거하고 하단 human-readable 숫자만 남김.
- 2026-07-06: `Tokens` mode를 추가해 small/medium/large 디자인 토큰과 주요 graphic primitive를 한 화면에서 검토할 수 있게 함.
- 2026-07-07: large token이 medium과 더 강하게 구분되도록 main display, specimen, strip, Tokens catalog의 large scale을 키움.
- 2026-07-07: `xlarge` 특대 token size를 추가하고 greeting, 대표 한글/영문 단어, 독립 한자, hero code를 별도 섹션과 main display 후보로 분리.
- 2026-07-07: `xlarge`를 large의 약 두 배 체감 크기로 키우고, 후보 수를 줄여 hero token처럼 보이게 조정.
- 2026-07-07: 상위 토큰 수량 규칙을 `large` 이상 총 1개로 정리해 생성 layout 안에서 `large`와 `xlarge`가 pair로 나오지 않게 함.
