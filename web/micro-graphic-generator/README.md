# Micro Graphic Generator

## 목표

브라우저에서 새로고침하거나 Random 버튼을 누를 때마다 다른 타이포그래픽 기반 마이크로 그래픽을 생성한다. 도구는 최대한 단순하게 유지한다. 정적 HTML과 native ES module, 흑백 중심, 한글과 영어 혼합, PNG/SVG 내보내기가 핵심이다.

완성 포스터보다는 기술 라벨, SF 인터페이스 조각, 제조 스티커, 상태 카드, 바코드, 작은 시스템 다이어그램 같은 시각 조각을 만든다. 나중에 더 큰 그래픽, UI 텍스처, 진 페이지, 모션 소스, Cargo 스타일 쇼케이스에 재료로 붙일 수 있는 결과물을 목표로 한다.

## 동기

매번 손으로 하나씩 디자인하지 않고, 작은 타이포그래픽 그래픽을 많이 뽑아보는 것이 출발점이다. 중요한 것은 한 장의 완벽한 이미지가 아니라 Random을 여러 번 눌렀을 때 예기치 않게 좋은 구도가 나오는 흐름이다.

이 제너레이터는 다음 용도로 쓴다.

- 손으로 계획하기 어려운 시각적 우연을 모은다.
- 시스템 라벨, 코드, 포트, 배지, 검증 마크를 중심으로 개인적인 그래픽 언어를 만든다.
- 한글과 영어가 기술적인 레이아웃 안에서 섞일 때의 리듬을 테스트한다.
- 빌드 단계나 디자인 앱 없이 빠르게 PNG/SVG 재료를 뽑는다.
- 좋은 결과의 seed를 기록해서 나중에 방향성을 다시 이어간다.

## 현재 범위

- `index.html`은 markup과 `src/app.js` entry만 가지며, 생성 규칙과 renderer는 `src/` native ES module로 분리한다.
- SVG 기반 렌더링.
- Random 버튼으로 현재 mode의 새 랜덤 seed 생성.
- 캔버스 클릭으로 새 결과 생성.
- Compose 버튼으로 조합 가능한 디자인 토큰 모드 전환.
- Grid 버튼으로 block outline 표시 여부 전환. seed와 token 배치는 유지하며 export에도 현재 상태 반영.
- Tone 버튼으로 light/dark 반전.
- 화면 크기 기준 2x PNG 내보내기.
- SVG 내보내기로 벡터 후작업 가능.
- 화면 모서리에 seed 표시, export 파일명에도 seed 포함.

## 실행 및 기준선 테스트

공식 실행 계약은 `localhost-only`다. 현재 앱은 native ES module을 사용하므로 개발과 검토는 정적 HTTP 서버를 통해 수행하며 `file://` 직접 실행은 지원하지 않는다. 계약 원본은 `tests/launch-contract.json`이다.

테스트 harness는 Node.js 18 이상을 요구한다.

```bash
npm install
npm run test:generator:install
npm run test:generator
npm run test:generator:soak
```

`test:generator`는 pure/architecture contract, 고정 seed fixture, UI interaction, SVG/PNG export, 5개 visual reference와 Random 100회를 검사한다. `test:generator:soak`는 같은 검사를 Random 1,000회로 확장한다. 브라우저 lifecycle과 port `4191`은 Playwright가 소유하므로 테스트 중 별도 서버를 실행하지 않는다.

## 리팩터링 체크포인트

Phase 0~7의 리팩터링과 필수 gate가 완료됐다. 현재 완료 범위, 검증 수치, checkpoint commit은 `REFACTORING_PLAN.md`의 `구현 체크포인트`를 source of truth로 사용한다.

## Architecture

`index.html`에는 화면 markup과 `src/app.js` module entry만 둔다. production bundler는 사용하지 않으며 localhost 정적 서버에서 native ES module을 직접 로드한다.

- `config.js`: token size, stroke, typeface, ordered block policy의 단일 source다.
- `vocabulary.js`: 다국어 단어와 가짜 data label만 소유한다.
- `token-library.js`: vocabulary를 typography token group과 graphic descriptor로 조립한다.
- `random.js`, `token-model.js`, `layout.js`, `grid-layout.js`: DOM 없는 계산과 data contract를 담당한다.
- `typography.js`, `svg.js`, `graphics.js`: typography style/metric, 낮은 수준 SVG helper, graphic primitive를 담당한다.
- `grid-selection.js`: block plan을 받아 token과 deterministic fallback을 선택한다. SVG를 만들지 않는다.
- `grid-renderer.js`: grid plan을 detached SVG tree로 만든다. `getBBox()`나 mounted DOM을 사용하지 않는다.
- `grid-finalizer.js`: mount 이후 typography overflow, position nudge, footprint별 size 동기화만 수행한다.
- `validation.js`: DOM을 읽어 rule별 structured result를 반환하며 DOM과 console을 변경하지 않는다.
- `catalog-renderer.js`, `export.js`: Compose catalog와 PNG/SVG export를 각각 소유한다.
- `app.js`: state, mount, controls, validation reporting을 조정하는 유일한 application shell이다.

핵심 generation 흐름은 `plan blocks → select tokens → render detached SVG → mount → finalize typography → validate/report` 순서다. random draw는 planning/selection에만 허용하며 finalization, validation, export는 PRNG state를 변경하지 않는다.

## 용어

- 용어는 디자인/그래픽/웹에서 이미 쓰는 표현을 우선 사용한다. 기존 용어로 설명하기 어려울 때만 새 이름을 만든다.
- `Canvas`: 브라우저 화면 전체. 실제 PNG/SVG export 대상이다.
- `Component`: Canvas 안에 하나만 배치되는 그래픽 단위. Component border line을 가진다.
- `Aspect ratio`: Component의 가로:세로 비율. 현재 `1:1`, `2:3`, `2:5`, `3:2`, `5:2`, `4:3`, `3:4`를 쓰며, 이 비율에 따라 3×3 cell 크기가 달라진다.
- `Stroke`: Component 외곽선 방식. 현재 `stroke`, `no-stroke`, `corner-stroke` 세 가지를 쓴다.
- `Graphic primitive`: Component를 구성하는 작은 그래픽 재료. barcode, pseudo-QR, mini table, wave graph, label, badge, symbol 등이 여기에 속한다.
- `Display keyword`: `REPORT`, `STATUS`, `MODULE`, `ACCESS`처럼 제목이나 상태 문구처럼 읽히는 영어 keyword다. data value가 아니며 SUIT English role을 쓴다.
- `Layout grid`: Component safe area를 가로 3열, 세로 3행으로 나눈 보이지 않는 좌표계다.
- `Grid block`: 3×3 cell 중 하나 이상의 직사각형 영역을 점유하고 token 하나를 소유하는 단위다.
- `Grid plan`: block geometry, position, selected token, fallback token을 담은 renderer 입력 data다.
- `Finalization`: mounted SVG의 실제 `getBBox()`를 읽고 작은 size fallback과 position nudge를 적용하는 단계다.
- `Seed`: 랜덤 결과를 다시 추적하기 위한 값. 화면 왼쪽 아래에 표시한다.

## 현재 시각 규칙

- 기본은 단색 전경/배경.
- Canvas 배경에는 랜덤 선, 점, scan line, pattern, blur 같은 texture나 effect를 넣지 않는다.
- 영문과 한글은 SUIT, 한자와 중국어는 Glow Sans SC를 기본으로 쓰며 code/data view는 Noto Sans Mono로 분리한다.
- 한글/한자 키워드는 굵은 display label처럼 쓴다.
- 작은 메타데이터, 가짜 조직명, 포트, revision badge, serial, code를 조합한다.
- 조직명은 `@CARGO SYSTEMS`처럼 표기하고, 앞에 의미 없는 랜덤 symbol prefix를 붙이지 않는다.
- 선과 도형에는 turbulence, displacement, blur 같은 SVG filter나 post-process를 적용하지 않는다.
- Component border line은 `stroke`, `no-stroke`, `corner-stroke` 중 하나로 정하고, 내부에는 별도의 큰 layout box를 반복해서 만들지 않는다.
- stroke weight는 `thin`, `thick` 두 단계로 정의하지만 현재는 `thin`만 사용한다. `thick`은 예약 token이며 렌더링하지 않는다.
- Component border와 내부 content 사이에는 `PADDING_TOKENS.large` 기반 safe area를 둔다.
- 각 block의 token content box는 block footprint와 `MARGIN_TOKENS.small`을 기준으로 계산한다. primitive 내부 여백은 `PADDING_TOKENS.small`을 쓴다.
- 디자인 토큰 사이의 간격은 `MARGIN_TOKENS.small`, `MARGIN_TOKENS.medium`, `MARGIN_TOKENS.large`만 쓴다.
- 모든 display token, greeting token, date/time token, data token은 자신이 받은 padded box 안에서만 spawn한다. 긴 문자는 `maxWidth` 기준으로 축소한다.
- Block typography는 실제 폰트 메트릭으로 1차 평가하고, SVG 렌더 뒤 `getBBox()`로 content box를 다시 평가한다. 경계를 넘으면 단어·typeface·position은 유지하고 다음 작은 token size로 단계적으로 다시 렌더한다. 빈 block 생성은 현재 보류하며, `small 8px`에서도 실패하면 짧은 cell index data token으로 교체한다.
- 텍스트 정렬은 `left`, `center`, `right` 세 가지만 허용한다. SVG의 `start`, `middle`, `end`는 내부 변환값으로만 쓴다.
- 디자인 토큰은 `small`, `medium`, `large`, `xlarge`, `xxlarge`, `xxxlarge` 여섯 크기 단계로 나누고, 크기 단계가 한 행을 어떻게 점유하는지 정한다.
- 토큰의 형태는 `typography`, `graphic`으로 나누고 기능은 `content`, `data`, `symbol`, `sign`으로 별도 기록한다.
- 모든 `typography` token은 `typeface` role을 필수로 기록한다. `graphic` token에는 `typeface`를 넣지 않는다.
- typography weight는 `normal`, `bold` 두 단계만 쓰며, `content`이면서 `large`, `xlarge`, `xxlarge`, `xxxlarge`인 token만 `bold`다. 나머지는 모두 `normal`이다.
- 모든 block token의 가로 배치 축은 `left`, `center`, `right`, 세로 배치 축은 `top`, `middle`, `bottom`만 쓴다. block마다 token은 정확히 하나다.
- `Composable Categories` mode는 조합 재료로 사용할 수 있는 `content`, `data`, `symbol`의 form/function category와 가능한 category 조합만 보여주는 catalog view다.
- barcode, pseudo-QR, mini table, wave graph, label, badge, symbol을 재사용 가능한 graphic primitive로 둔다.
- 복잡한 컨트롤보다 Component 변주를 우선한다.

## Visual System Process

시각 시스템은 한 번에 완성하지 않고, 작은 결정을 하나씩 확정하면서 맞춰나간다. 새로 정한 룰은 코드와 문서에 같이 반영한다.

- 먼저 현재 쓰는 element를 관찰하고 이름과 경계를 정한다.
- 그다음 typography, grid, stroke, primitive, density 순서로 하나씩 룰을 고정한다.
- 확정한 룰은 `현재 시각 규칙` 또는 해당 시스템 섹션에 적는다.
- 아직 확정하지 않은 항목은 `Visual System Decisions`나 `Rule Gap Inventory`에 남겨둔다.
- 룰을 바꾸면 코드의 extension point와 README의 운영 문서를 같이 업데이트한다.
- 좋은 결과가 나온 seed는 룰 검증용 reference로 남긴다.

## Padding System

안쪽 grid를 만들기 전 단계로, 모든 Component 내부 배치는 세 단계 padding token을 먼저 따른다. padding은 보이지 않는 안전 영역이며, graphic primitive나 text token을 직접 장식하기 위한 선이 아니다.

- `large`: Component border와 token 사이의 safe area다. 3×3 layout grid의 모든 cell은 이 영역 안에서만 좌표를 만든다.
- `medium`: catalog와 graphic primitive 내부에서 관련 요소 묶음을 분리할 때 사용하는 중간 여백이다.
- `small`: barcode, pseudo-QR, mini table, wave 같은 detail primitive의 내부 여백이다.

일반 SVG text helper는 `maxWidth`를 받을 수 있지만, grid typography는 연속 scale이나 `textLength`를 사용하지 않는다. grid selection과 finalization은 정의된 여섯 token size 사이에서만 단조 감소하고, 각 block의 content box 안에 token 하나만 렌더한다.

## Margin System

margin은 Component, grid block, primitive 내부 요소 사이의 거리다. padding이 외곽에서 안쪽으로 확보하는 안전 영역이라면 margin은 형제 요소 사이의 관계를 정한다.

- `small`: 하나의 token 내부에서 쓰는 최소 숨구멍이다. label text inset, micro badge text inset, mini table cell inset, barcode caption gap처럼 아주 가까운 요소 사이에 쓴다.
- `medium`: catalog section, pseudo-QR 설명, 관련 primitive 요소 사이의 기본 거리다.
- `large`: 서로 다른 정보 덩어리나 판독성을 위해 크게 비워야 하는 거리다. barcode quiet zone처럼 가장자리와 data mark 사이를 띄울 때 쓴다.

새 primitive를 만들 때 임의 숫자로 `+ 9`, `- 14` 같은 간격을 넣지 않는다. 간격이 필요하면 `marginSize(w, h, "small" | "medium" | "large")`를 먼저 쓰고, 그 값이 시각적으로 맞지 않을 때 token 값 자체를 조정한다.

## Alignment System

텍스트 정렬은 `left`, `center`, `right` 세 가지 token만 허용한다. 코드에서는 `TEXT_ALIGNMENTS`와 `resolveTextAlignment()`가 이 세 값을 SVG `text-anchor` 값으로 변환한다.

- `left`: 기본값이다. header, label, table cell, serial, code caption처럼 읽기 시작점이 중요한 token에 쓴다.
- `center`: badge, specimen word, strip 중앙 숫자처럼 중앙 축이 레이아웃 기준일 때만 쓴다.
- `right`: 오른쪽 edge에 붙는 명시적인 값이나 숫자 column이 필요할 때만 쓴다.

`textNode()` 호출부에서는 `anchor`, `start`, `middle`, `end`를 직접 쓰지 않는다. 새 텍스트를 추가할 때는 필요한 경우에만 `align: "center"` 또는 `align: "right"`를 명시하고, 나머지는 기본 `left`에 둔다.

## Token Size System

디자인 토큰은 시각적 중요도와 행 점유 방식에 따라 `small`, `medium`, `large`, `xlarge`, `xxlarge`, `xxxlarge`로 나눈다. 코드에서는 `DESIGN_TOKEN_SIZES`와 `tokenSize` 속성으로 기록한다.

- `small`: 조직명, revision badge, serial, barcode caption, table cell, port/code caption처럼 보조 정보다. 한 행에 최대 두 개까지 올 수 있고, 기본 조합은 `left` + `right`다. 작은 토큰이 하나만 있을 때는 `left`, `center`, `right` 중 하나에 단독 배치할 수 있다.
- `medium`: `STATUS`, `REPORT`, section label, subtitle, short command처럼 중간 위계의 정보다. 한 행에 하나만 둔다. 좌/중/우 정렬은 가능하지만 같은 행에서 다른 토큰과 나란히 놓지 않는다.
- `large`: main display word, 큰 숫자, date/time display처럼 한 component에서 시선을 먼저 받는 정보다. 무조건 한 행에 하나만 두고, medium과 명확히 구분되도록 크게 운용한다. 큰 토큰 행에는 small badge나 caption을 얹지 않는다.
- `xlarge`: 64px 특대 토큰이다. greeting과 `STATUS`처럼 강한 display typography에 쓴다.
- `xxlarge`: 128px 초대형 토큰이다. 짧은 한글 hero, `ACCESS`, `OUTPUT`, 독립 한자처럼 화면을 장악해야 하는 typography에만 쓴다.
- `xxxlarge`: 256px 최대 typography 토큰이다. `2x3`, `3x2` block 전용이며 기존 xxlarge hero token의 크기 변형만 사용하고 새 문자를 만들지 않는다.

작은 요소만 같은 행에서 왼쪽 정렬과 오른쪽 정렬을 동시에 가질 수 있다. 중간/큰/특대/초대형 요소는 행을 독점한다.

상위 토큰 수량은 코드의 `MAJOR_TOKEN_RULES`를 따른다. 일반 primary에서는 `large` 이상 major token을 최대 하나만 허용한다. 다만 block footprint가 직접 size를 정하는 `3x1`·`1x3`의 xxlarge와 `2x3`·`3x2`의 xxxlarge는 이 수량에서 제외하고 각 block에 하나씩 허용한다.

이 규칙은 Component-level stacking 기준이다. barcode caption, mini table cell처럼 graphic primitive 내부에서 생기는 작은 data token은 해당 primitive의 내부 grid를 따른다.

`Composable Categories` mode는 조합 가능한 category와 category 조합을 검토하기 위한 단일 catalog view다. `TOKEN MAP`은 form을 행, function을 열로 놓아 전체 8개 category를 한 번에 보여준다. 조합 가능한 값은 `COMPOSE`, 값이 아직 없으면 `EMPTY`, 완성 의미 단위는 `SIGN`으로 구분한다. `RULE GROUPS`는 전체 규칙을 `TAXONOMY`, `PLACEMENT`, `COMPOSE` 세 묶음으로 정리한다. 하단에는 가능한 2-category, 3-category 조합을 모두 한 행씩 나열한다. 각 행의 sample은 category마다 token 하나만 seed 기반으로 선택하며 Random을 누를 때 갱신된다.

## Token Taxonomy

토큰은 하나의 flat category로 분류하지 않고 형태와 기능을 서로 다른 축으로 기록한다. 같은 기능도 typography 또는 graphic 형태로 표현될 수 있기 때문이다.

### Form

- `typography`: 문자 glyph로 만들어진 token이다. `typeface`, `weight`, `size`를 필수 시각 속성으로 가진다.
- `graphic`: 선, 면, 도형으로 만들어진 token이다. barcode, pseudo-QR, table, wave, badge container가 여기에 속한다. `typeface`를 갖지 않는다.

### Function

- `content`: title, display keyword, organization name, date/time처럼 읽을 내용을 전달한다.
- `data`: code, serial, port, revision, table cell, barcode처럼 식별하거나 측정하는 값을 전달한다.
- `symbol`: 화살표, check, cross, status dot처럼 문맥 안에서 의미를 얻는 원자 기호다. 현재 generator에는 독립 symbol token이 아직 없다.
- `sign`: status, warning, verification, access result처럼 의미가 완성된 표시다. `QC PASS`, `INPUT VERIFIED`, `ACCESS GRANTED`, greeting이 여기에 속한다.

`symbol`은 다른 token과 조합할 수 있는 원자 재료고, `sign`은 사용자에게 상태나 행동 의미를 전달하는 완성 단위다. sign은 typography 하나로 만들 수도 있고 graphic container와 typography를 조합해 만들 수도 있다.

### Context

- `component`: 일반 생성 layout에 직접 배치되는 token이다.
- `primitive-detail`: graphic primitive 내부 grid를 따르는 caption, table cell, barcode digit 같은 token이다.
- `catalog-ui`: Composable Categories mode의 section title, category, count처럼 catalog를 설명하기 위한 UI token이다. 생성 layout의 수량 검사에서는 제외한다.

SVG에는 `data-token-form`, `data-token-function`, `data-token-role`, `data-token-context`를 기록한다. typography에는 `data-token-typeface`도 기록한다. `validateRenderedTokenRules()`는 typeface가 없는 typography, 분류되지 않은 size token, major token 수량 초과를 렌더 후 검사한다.

## Token Placement System

디자인 토큰은 자유 좌표에 흩뿌리지 않고 `left`, `center`, `right` 세 alignment slot 중 하나에 붙인다. 이 규칙은 텍스트뿐 아니라 label, badge, strip 같은 작은 그래픽 토큰에도 적용한다.

- `left`: box의 왼쪽 edge를 기준으로 쌓는다.
- `center`: box의 중앙 축을 기준으로 쌓는다.
- `right`: box의 오른쪽 edge를 기준으로 쌓는다.

block origin과 footprint가 alignment를 결정한다. 왼쪽·오른쪽 경계에 닿는 block은 해당 edge를, 3열 전체를 차지하는 block은 center를 쓴다. 세로도 같은 방식으로 top·bottom·middle을 결정한다. `1x3`, `3x1`, `2x3`, `3x2`의 center/middle 규칙은 ordered block policy가 명시적으로 덮어쓴다.

grid token은 `data-token-placement="position-only"`, `data-token-scale="1"`을 유지하며 `scale()` transform을 사용하지 않는다. `1x3` typography에서 한글·한자는 글자별 `glyph-sideways-stack`만 사용하고, 영문과 숫자형 fallback만 `whole-rotate`를 사용한다.

## Typography System

현재 폰트 시스템은 SUIT를 메인 타입페이스로 두고 영문·한글·generator UI에 사용한다. 한자·중국어에는 Glow Sans SC, mono에는 Noto Sans Mono를 사용한다. 코드에서는 `TYPEFACES`와 `resolveTypeface()`로 관리한다.

weight token은 `normal`, `bold` 두 개만 허용한다. `bold`는 function이 `content`이고 size가 `large`, `xlarge`, `xxlarge`, `xxxlarge`인 typography에만 적용한다. `small`, `medium`과 `data`, `symbol`, `sign`, catalog UI는 모두 `normal`이다. 실제 렌더 값은 `normal 400`, `large/xlarge bold 700`, `xxlarge/xxxlarge bold 900`을 기본으로 사용한다. 단, `3x1`, `1x3`, `3x2`, `2x3` block 안에서 실제 크기가 `xlarge`가 된 content typography는 900을 사용한다. 코드에서는 `fontWeightForToken()`이 token label을, `fontWeightValueForToken()`과 block context override가 실제 숫자 weight를 결정한다. SVG에는 `data-token-weight="normal|bold"`를 기록하며 `validateRenderedTokenRules()`가 size/function/block 조합과 실제 weight를 함께 검사한다.

모든 UI와 SVG typography의 line-height는 `1`로 고정한다. CSS 전역 규칙과 `textNode()`의 SVG `line-height` 속성에 동일하게 적용하며 size나 role별 예외를 두지 않는다.

`form: "typography"`인 token은 아래 typeface role 중 하나를 반드시 명시한다. 브라우저 fallback만으로 typeface를 결정하지 않는다.

- `english`: `"SUIT"`를 기본으로 쓰고 `"Noto Sans"`를 fallback으로 둔다. 브랜드명, 영문 title, warning phrase, status phrase, display keyword에 쓴다.
- `mono`: `"Noto Sans Mono"`를 기본으로 쓴다. code, serial, port, table, numeric data, data view에 쓴다.
- `korean`: `"SUIT"`를 기본으로 쓰고 `"Noto Sans KR"`를 fallback으로 둔다. 한글이 포함된 텍스트는 자동으로 이 role을 쓴다.
- `hanja`: `"Glow Sans SC"`를 기본으로 쓰고 `"Noto Sans SC"`, `"Noto Sans KR"` 순서로 fallback한다. 현재 독립 한자 display typography에는 `林`을 일반 content keyword로 허용한다.
- `chinese`: `"Glow Sans SC"`를 기본으로 쓰고 `"Noto Sans SC"`를 fallback으로 둔다. `你好?`, `刷新`, 중국어 날짜 표기처럼 Simplified Chinese glyph가 필요한 token에 쓴다.
- `ui`: generator controls와 seed label에 쓰는 UI font다. SUIT를 기본으로 쓰고 Noto Sans, Noto Sans KR, Noto Sans SC 순서로 fallback한다.

`textNode()`는 텍스트 안의 한글/한자를 감지해서 font role을 자동 선택한다. code/data view처럼 의미상 mono가 필요한 경우에는 `typeface: "mono"`로 직접 지정한다.

`REPORT`, `STATUS`, `MODULE`, `ACCESS` 같은 요소는 `display keyword`다. 이들은 code나 data view가 아니므로 `typeface: "english"`를 명시하고 SUIT English role로 표시한다. display keyword는 글자 사이에 임의 공백을 넣거나 과한 tracking을 주지 않고, 단어 그대로 조판한다.

`안녕?`, `你好?`, `HELLO?`는 greeting typography다. 인사말은 `greetingTokens`에 `{ value, typeface }` 형태로 묶고, display typography 후보에만 넣는다. barcode, serial, table, code 같은 data view에는 넣지 않는다.

사용자가 제공한 action text에서는 반복 목적어 `it`을 제외하고 중복 단어를 합쳐 62개의 고유 표현을 추출한다. `QUICK`은 `빠르게 / QUICK / 快速`으로 한 번만 포함한다. `visualTokens.actionTokens`는 각 항목을 `{ korean, english, chinese }`로 묶어 의미 대응을 유지한다. 예시는 `구매 / BUY / 购买`, `분해 / BREAK / 拆解`, `추출 / RIP / 提取`, `종료 / LEAVE / 退出`이다.

`actionTypographyTokens()`는 세 언어를 모두 `content / action-keyword` typography로 만든다. 일반 display에서는 `large 32px`, `3x1`·`1x3` block에서는 `xxlarge 128px`, `3x2`·`2x3` block에서는 `xxxlarge 256px` 후보로 사용한다. block에는 고유 크기로 들어가는 번역만 선택하며 fitting이나 scale 변형은 하지 않는다.

HTTP 상태 코드는 `200`, `301`, `400`, `403`, `404`, `500`, `503`의 7개를 `sign / status-code` 보조 typography로 사용한다. `small 8px`와 `medium 16px`에 분산하고 일반 block의 sign 후보로만 조합한다. `STATUS` 역시 `medium / sign / status`로만 사용하며 hero 후보에는 넣지 않는다.

웹에서 보기 위해 SUIT 2.0.5의 Regular/Bold/Heavy, Glow Sans SC 0.93 Normal 폭의 Regular/Bold/Heavy 서브셋, 그리고 `Noto Sans`, `Noto Sans KR`, `Noto Sans SC`, `Noto Sans Mono`를 `fonts/` 안에 로컬 파일로 번들한다. SUIT와 Glow Sans SC는 SIL Open Font License 1.1이며 라이선스 원문을 각각 `fonts/SUIT-OFL.txt`, `fonts/GlowSansSC-OFL.txt`에 함께 둔다. Glow Sans SC 서브셋은 현재 중국어 action token, 인사말, 날짜·숫자 문자와 `林`을 포함한다. HTML은 `./fonts/fonts.css`를 import하고, SVG export도 같은 CSS 파일을 절대 URL로 넣는다. 외부 폰트 요청을 기다리지 않도록 하기 위한 결정이며, 앱은 로컬 폰트의 400/700/900 weight가 붙은 뒤 첫 렌더가 되도록 `document.fonts.load()`와 `document.fonts.ready`를 짧게 기다린다.

중국어/한자 glyph가 Glow Sans SC 서브셋에 없으면 `Noto Sans SC`, `Noto Sans KR` 순서로 fallback한다. 현재 vocabulary를 늘릴 때는 Glow Sans SC 서브셋의 문자 범위도 함께 갱신한다.

### Date And Refresh Time Typography

오늘 날짜와 리프레시된 시간도 display typography로 취급한다. `token-library.js`의 날짜 token factory가 브라우저 로컬 시간의 `Date()`를 기준으로 한국어, 영어, 중국어 표기를 만든다.

- 한국어 예: `2026년 7월 5일`, `2026년 7월 5일 오후 3시 24분`, `갱신 15:24:03`, `타임스탬프 1783232643000`.
- 영어 예: `JULY 5, 2026`, `JULY 5, 2026 15:24:03`, `REFRESHED 15:24:03`, `TIMESTAMP 1783232643000`.
- 중국어 예: `2026年7月5日`, `二〇二六年七月五日`, `刷新 15:24:03`, `时间戳 1783232643000`.

날짜/시간 표기는 `primary` 또는 `content` cell의 단일 typography token으로만 들어간다. barcode, serial, code, table, QR, port 같은 data/graphic token 내부에는 넣지 않는다. 중국어/한자는 날짜 표기와 다국어 action keyword에 사용하며, 독립 display keyword로는 `林`을 허용한다. 날짜/시간은 오늘과 리프레시 시점에 따라 변하므로, 같은 seed라도 날짜나 시간이 다르면 완전히 동일한 typography가 재현되지 않을 수 있다.

## Grid Pipeline

모든 Component는 `PADDING_TOKENS.large` 안쪽 safe area를 가로 3열 × 세로 3행으로 나눈다. column과 row는 `0`, `1`, `2`를 쓰고, cell 번호는 왼쪽 위에서 오른쪽 아래로 행 우선 순서인 `1`부터 `9`까지 사용한다. grid line은 실제로 그리지 않고 좌표 계산에만 사용하며 cell과 block 사이 gap은 `0`이다.

```text
1 2 3
4 5 6
7 8 9
```

각 렌더는 9개 cell을 아래 footprint 중 2-5개의 직사각형 block으로 빈틈없이 나눈다.

- `1x1`, `2x2`, `1x2`, `1x3`, `2x3`, `2x1`, `3x1`, `3x2`만 허용한다. `3x3` 단일 block은 사용하지 않는다.
- `grid-layout.js`의 `buildGridBlockLayout()`은 block이 겹치거나 3x3 경계를 벗어나지 않으면서 1-9 cell을 정확히 한 번씩 덮도록 패킹한다.
- 각 block에는 token 하나가 반드시 들어간다. `grid-selection.js`는 block마다 `primary`, `content`, `data`, `sign`, `graphic` 후보를 탐색하고 content box에 맞는 token과 deterministic fallback을 함께 만든다.
- `Random`을 누를 때 component ratio, block 조합, block 위치, token이 모두 다시 생성된다.
- `barcode`와 `pseudo-qr`는 Component 안에서 각각 최대 하나만 사용할 수 있다. 한 block에서 선택되면 이후 block 후보에서 제외한다.
- 가장 면적이 큰 block 중 하나를 `primary` 후보로 정한다. `GRID_PRIMARY_CHANCE`는 현재 `1`이며 `primary`는 최대 하나다.
- `primary`는 block 면적에 따라 `large`, `xlarge`, `xxlarge` content를 우선 사용한다. 선택한 typography가 block을 넘으면 같은 단어와 typeface를 유지한 채 다음 작은 design token size로 내린다.
- `2x2` block은 graphic을 허용하지 않고 `xxlarge 128px` 또는 `xxxlarge 256px`에서 시작한다. block의 현재 origin에 따른 left/center/right와 top/middle/bottom anchor 및 inset은 변경하지 않는다. 요청 크기가 넘치면 다음 작은 token size로 단계적으로 내린다.
- `3x1`, `1x3` block은 graphic을 허용하지 않고 `xxlarge 128px`에서 시작한다. block 위치와 관계없이 horizontal `center`, vertical `middle` anchor에 배치한다. `1x3` 영문은 단어 전체를 오른쪽 90도로 회전하고, 한글·한자는 각 glyph를 오른쪽으로 돌려 위에서 아래로 쌓는 세로 조판만 사용한다. 같은 component 안에서 동일한 `3x1` 또는 `1x3` token 중 하나가 작은 size로 내려가면 같은 footprint의 나머지도 가장 작은 실제 size로 통일한다.
- `2x3`, `3x2` block은 graphic을 허용하지 않고 `xxxlarge 256px`에서 시작한다. block 위치와 관계없이 horizontal `center`, vertical `middle` anchor를 유지하며, 넘치면 다음 작은 token size로 내린다.
- block이 3열 전체를 차지하면 가로 center, 왼쪽 경계에 닿으면 left, 오른쪽 경계에 닿으면 right anchor를 사용한다.
- block이 3행 전체를 차지하면 세로 middle, 위 경계에 닿으면 top, 아래 경계에 닿으면 bottom anchor를 사용한다.
- block은 token renderer에 `x`, `y`, `align`, `verticalAlign` position만 넘긴다. block 크기로 token geometry를 다시 계산하지 않는다.
- 각 block 외곽은 현재 조합을 알아볼 수 있도록 `thin` stroke와 낮은 opacity로 표시한다. `Grid` 토글로 outline만 숨길 수 있으며 block과 token 배치는 유지한다.
- typography token은 `typographyToken()`의 `intrinsic.fontSize`, graphic token은 `token-library.js`의 graphic descriptor가 가진 `intrinsic.width/height`를 그대로 사용한다.
- typography intrinsic size는 `small 8px`, `medium 16px`, `large 32px`, `xlarge 64px`, `xxlarge 128px`, `xxxlarge 256px`를 사용한다.
- size별 예외나 개별 font size override는 허용하지 않는다.
- barcode, pseudo-QR, table, wave를 포함한 graphic token은 `medium` 또는 `large`만 사용한다. `large`는 `medium`의 가로세로를 같은 비율로 1.5배 확장한다.
- barcode 숫자 typography는 barcode 크기와 관계없이 항상 `small 8px`를 사용한다. 별도 fitting이나 다른 크기는 허용하지 않는다.
- random block grid에서는 연속적인 font fit, `textLength`, SVG `scale()`을 적용하지 않는다. typography overflow는 `256 → 128 → 64 → 32 → 16 → 8px`의 정의된 token size만 사용해 해결한다.
- SVG에는 `data-layout-mode="random-blocks"`, 각 block의 footprint, origin, 점유 cell, 좌표, 가로·세로 anchor, token kind를 기록한다. token에는 `data-token-requested-size`와 `data-token-size-fallback`을 기록해 요청 크기와 실제 fallback 여부를 추적한다.

`validation.js`의 `VALIDATION_RULES`는 taxonomy, typeface, weight, line-height, stroke, grid structure, block policy, size fallback, placement, orientation, fit, duplicate, graphic size, barcode caption을 개별 rule id로 검사한다. validator는 structured result만 반환하며 `app.js`의 `reportValidationResults()`만 SVG metadata와 console warning을 기록한다.

## Layout Archetype

`Layout archetype`은 Component 안쪽 정보 구조를 정하는 상위 분류다. 하나의 Component는 우선 하나의 archetype을 가진다. archetype은 시각 스타일 이름이 아니라 정보의 목적을 정하는 이름이다.

- `Title`: 이름, 제목, 대표 키워드 중심. 큰 display type, 짧은 subtitle, 작은 code를 쓴다. 내부에 표나 많은 수치를 넣지 않는다.
- `Data`: 표, 성분표, 그래프, 수치 묶음처럼 정보를 읽게 하는 구성. mini table, wave graph, dense numeric label을 쓴다. 제목은 보조 역할로 둔다.
- `Critical info`: 가격, barcode, serial, receipt, ticket, access code처럼 정확성이 중요해 보이는 정보. barcode, ID, code, amount, timestamp를 명확히 배치한다. 장식보다 판독성을 우선한다.
- `Status`: 현재 상태를 알려주는 구성. `PASS`, `READY`, `ONLINE`, `RUNNING`, `IDLE`, `GREEN`, `YELLOW`, `RED` 같은 상태값을 중심에 둔다. 경고보다 운영 상태 표시에 가깝다.
- `Identity`: 브랜드, 조직, 제품, 유닛, 배지, 태그 같은 식별 정보. logo-like symbol, organization name, badge, SKU, lot number를 쓴다.
- `Warning`: 위험, 오류, 금지, 만료, 접근 거부처럼 주의나 행동을 요구하는 정보. `WARNING`, `ERROR`, `EXPIRED`, `ACCESS DENIED`, `DO NOT USE` 같은 강한 문구를 쓴다.
- `Instruction`: 순서, 체크리스트, 절차 안내. step number, arrow, short command, checklist mark를 쓴다.
- `Verification`: 인증, 승인, 검수, 스탬프, 확인 코드. `VERIFIED`, `APPROVED`, `QC PASS`, signature-like mark, stamp, reference code를 쓴다.

## Visual System Decisions

아래 항목은 구현 전에 차례대로 정해야 하는 시각 시스템 룰이다. 새 룰을 추가할 때마다 이 섹션이나 이터레이션 로그에 기록한다.

- `Typography`: 한글/영어 폰트 조합, `normal`/`bold` 적용 범위, 숫자와 코드의 자간, 대문자 tracking, 한글 display type의 크기 기준.
- `Type scale`: Canvas 크기와 Component 크기에 따라 title, subtitle, metadata, numeric value, caption이 어떤 크기 범위를 갖는지.
- `Hierarchy`: Component 안에서 1순위 정보, 2순위 정보, 보조 정보가 어떤 순서와 크기로 보이는지.
- `Alignment`: `left`, `center`, `right` 중 어떤 정렬을 어느 token class에서 쓸지. 그 외 임의 정렬은 만들지 않는다.
- `Token size`: `small`, `medium`, `large`, `xlarge`, `xxlarge`, `xxxlarge`가 footprint와 정보 위계에 어떻게 대응하는지.
- `Token placement`: block별 `left`, `center`, `right`와 `top`, `middle`, `bottom` anchor, `1x3` orientation을 어떤 token class에 허용할지.
- `Grid`: Component safe area, 3×3 column/row, gap 0, block content inset과 dense layout의 최소 여백.
- `Aspect ratio behavior`: `1:1`, `2:3`, `2:5`, `3:2`, `5:2`, `4:3`, `3:4` 각각에 어울리는 정보 구조와 금지할 구조.
- `Layout archetype mapping`: 각 archetype이 주로 사용할 aspect ratio, typography, primitive, density, stroke mode.
- `Stroke`: `stroke`, `no-stroke`, `corner-stroke`의 선 두께, corner length, inset, dash 사용 여부.
- `Stroke weight`: `STROKE_WEIGHTS`는 `thin`, `thick`을 정의하고 `ACTIVE_STROKE_WEIGHTS`는 현재 `thin`만 허용한다. line, rect, polyline과 Component border는 공통 stroke helper를 사용한다.
- `Internal dividers`: Component border 외의 내부 구분선, dashed line, underline, measurement line을 언제 쓸지.
- `Graphic primitive library`: barcode, pseudo-QR, mini table, wave graph, badge, stamp, icon, divider, coordinate mark의 사용 조건.
- `Primitive scale`: primitive가 Component 안에서 차지할 상대 크기, 최소/최대 크기, caption과의 거리.
- `Density`: sparse, balanced, dense 같은 밀도 단계. 각 단계별 정보량, 여백, primitive 개수.
- `Whitespace`: Component 안쪽 여백이 디자인 요소인지, 빈 공간을 얼마나 남길지, 비율별 최소 여백.
- `Tone`: light/dark 모드의 배경색, ink 색, 대비, export 시 유지 규칙.
- `Color`: 기본 흑백 외 accent color 사용 여부, status/warning/critical info에서 색이 의미를 갖는 방식.
- `Iconography`: 기호, 아이콘, logo-like mark의 종류, 크기, 위치, 의미 없는 장식 허용 범위.
- `Language mix`: 한글/영어/숫자/코드가 어떤 비율로 섞이는지, archetype별 주 언어.
- `Data realism`: barcode, pseudo-QR, serial, price, status, graph가 실제 데이터처럼 보여야 하는지, 단순 visual fake로 둘지.
- `Legibility`: 작게 출력해도 읽혀야 하는 정보와 장식적 mark의 구분.
- `Export`: PNG scale, SVG 편집 가능성, 파일명 규칙, seed/aspect ratio/stroke/archetype 기록 방식.
- `Interaction`: 현재 Random, Compose, Grid, PNG, SVG, Tone 외에 archetype lock, aspect ratio lock, stroke lock, seed input을 둘지.
- `Curation`: 좋은 결과를 저장하는 기준, seed log 형식, reject할 결과의 조건.

## Current Module System

현재 element와 실행 책임은 아래 module 층위로 정리한다.

- `Policy/Data`: `config.js`, `vocabulary.js`가 rule과 raw data를 소유한다.
- `Token contracts`: `token-model.js`, `token-library.js`, `typography.js`가 token 생성, size fallback, typeface/weight/metric 해석을 소유한다.
- `Pure geometry`: `layout.js`, `grid-layout.js`가 padding, alignment, footprint packing과 coverage를 계산한다.
- `SVG primitives`: `svg.js`, `graphics.js`가 낮은 수준 node와 barcode, pseudo-QR, table, wave, badge를 만든다.
- `Grid pipeline`: `grid-selection.js`, `grid-renderer.js`, `grid-finalizer.js`가 선택, detached SVG 생성, mounted typography 보정을 순서대로 수행한다.
- `Rule inspection`: `validation.js`가 renderer metadata와 실제 bounds를 읽어 rule별 결과를 만든다.
- `Application surfaces`: `catalog-renderer.js`, `export.js`, `app.js`가 Compose 화면, export, UI orchestration을 담당한다.

## Boundary Contracts

- `config.js`와 `vocabulary.js`는 DOM과 application state를 참조하지 않는다.
- `random.js`, `token-model.js`, `layout.js`, `grid-layout.js`는 pure module이며 browser global을 참조하지 않는다.
- `grid-layout.js`는 vocabulary, Canvas metric, SVG를 알지 않고 cell/footprint geometry만 반환한다.
- `grid-selection.js`는 plain object plan만 만들며 SVG node를 만들지 않는다. token 중복 Set을 변경할 수 있는 유일한 grid 단계다.
- `grid-renderer.js`는 detached SVG tree만 만들며 `getBBox()`와 mounted DOM을 사용하지 않는다.
- `grid-finalizer.js`는 전달받은 mounted Component 내부 typography만 변경한다. random과 vocabulary를 사용하지 않고 selection이 준비한 fallback만 소비한다.
- `validation.js`는 DOM을 읽을 수 있지만 수정하거나 random을 소비하지 않는다.
- `app.js`만 Canvas mount, controls, seed label, validation metadata와 console reporting을 변경한다.
- `export.js`는 현재 SVG를 복제할 뿐 render나 random state를 다시 실행하지 않는다.
- leaf module은 `app.js`를 import하지 않으며 source module graph에는 cycle이 없어야 한다.

## Extension Points

새 요소를 추가할 때는 아래 owner를 기준으로 변경한다.

- 새 단어, 조직명, action 번역, 날짜 label: `vocabulary.js`의 `visualTokens`에 추가한다.
- 새 typography/graphic 후보 조합: `token-library.js`의 group 또는 descriptor factory에 추가한다.
- 새 token size, typeface, stroke, spacing: `config.js`를 변경하고 `token-model.js` 또는 `typography.js` resolver test를 함께 갱신한다.
- 새 footprint 또는 footprint rule: ordered `GRID_BLOCK_POLICIES` 한 곳에 추가한다. 별도 footprint 배열을 만들지 않는다.
- 새 token 선택 전략: `grid-selection.js`에서 plain selection contract를 확장한다. renderer 안에서 후보를 다시 고르지 않는다.
- 새 graphic primitive: `graphics.js`에 추가하고 `grid-renderer.js`와 `catalog-renderer.js`의 descriptor dispatch를 연결한다.
- 새 validation rule: `validation.js`에 `{ rule, valid, nodes, detail }` 결과를 반환하는 validator를 만들고 `VALIDATION_RULES`에 등록한다.
- 새 Compose section: `catalog-renderer.js`에 추가하며 생성 Component state를 변경하지 않는다.
- 새 export 형식: `export.js`에 추가하고 export 전후 PRNG/fingerprint 불변 test를 작성한다.
- 새 Component ratio: `app.js`의 `componentTemplates`에 `{ label, ratio, scale }`을 추가한다.
- 새 border mode: `config.js`의 `componentBorderModes`와 `app.js`의 `renderComponentBorder()`를 함께 갱신한다.
- 새 application mode나 control: `app.js`의 state transition과 event binding을 변경하고 왕복 fingerprint test를 추가한다.

## Rule Gap Inventory

현재 코드에는 아직 룰 없이 감으로 쓰는 그래픽 파트가 많다. 아래 목록은 앞으로 각 파트의 사용 조건, 크기, 위치, 밀도, 금지 조건을 정하기 위한 인벤토리다.

### Active Graphic Parts

현재 화면 생성에 직접 영향을 주는 파트다.

- `renderComponentBorder`: Component 외곽선이다. `stroke`, `no-stroke`, `corner-stroke` 세 가지가 있다.
- `label`: 테두리 또는 반전 fill을 가진 짧은 title strip이다.
- `microBadge`: `V1.2`, `REV A`, `BUILD 859` 같은 작은 badge다.
- `barcode`: 실제 스캔 보장 데이터가 아닌 UPC/EAN-like visual fake barcode다. quiet zone, guard bar, 95-module pattern, human-readable caption을 갖는다.
- `pseudoQr`: 실제 스캔용이 아닌 pseudo-QR graphic이다.
- `miniTable`: lot/spec/freq/load 같은 가짜 data table이다.
- `wave`: 작은 signal graph 또는 stock graph처럼 보이는 line chart다.
- `grid pipeline`: Component safe area를 직사각형 block으로 패킹하고 각 block에 typography 또는 graphic token 하나를 선택·렌더·보정한다.

### Unruled Decisions Per Part

- `renderComponentBorder`: border mode별 권장 aspect ratio, 선 두께, corner length 기준.
- `label`: title 용도인지, status badge 용도인지, 단순 divider인지.
- `microBadge`: revision/build/version만 허용할지, status나 warning에도 쓸지.
- `barcode`: Critical info 전용인지, Identity/Verification에서도 쓸지. 현재는 UPC/EAN-like visual fake로 쓰며 실제 스캔 가능성은 보장하지 않는다.
- `pseudoQr`: 실제 QR처럼 보이는 것을 허용할지, pseudo-QR로 명확히 유지할지.
- `miniTable`: Data archetype 전용으로 묶을지, 다른 archetype의 보조 정보로도 쓸지.
- `wave`: signal/status/data 중 어느 의미로 쓸지.
- `grid pipeline`: token kind별 출현 비율과 aspect ratio별 block 조합을 어떻게 제한할지.

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
- random block의 token kind별 밀도와 footprint 가중치 규칙을 추가한다.
- 기본은 흑백으로 유지하되 accent color 모드를 하나 추가한다.
- 한글 기술 단어와 짧은 문장 조각을 더 늘린다.
- square, story, wallpaper, free viewport export size option을 추가한다.
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
- 2026-07-11: token taxonomy를 form(`typography`, `graphic`)과 function(`content`, `data`, `symbol`, `sign`) 두 축으로 분리하고 typography의 typeface role을 필수화.
- 2026-07-11: `QC PASS`, verification/status phrase, code/port caption을 semantic role에 맞게 재분류하고 catalog UI와 primitive detail context를 분리.
- 2026-07-11: 기존 Tokens catalog를 `All Tokens` 단일 모드로 확장하고 typography 전체, graphic data token, label, badge와 taxonomy count를 한 화면에 표시.
- 2026-07-11: catalog를 `Composable Tokens` mode로 좁히고 조합 가능한 `content`, `data`, `symbol`만 표시하며 완성 단위인 `sign`은 제외.
- 2026-07-11: Compose 화면을 category와 가능한 조합 목록 중심으로 바꾸고, 각 조합의 실제 token sample은 Random seed마다 하나씩 교체하도록 수정.
- 2026-07-11: Compose 화면에 taxonomy, typeface, size, placement, spacing, 조합 규칙을 한 번에 확인하는 `COMPOSITION_RULES` 목록 추가.
- 2026-07-11: 전체 token category를 form × function matrix로 바꾸고 `COMPOSE`, `EMPTY`, `SIGN` 상태와 세 rule group으로 시각적 위계를 정리.
- 2026-07-11: typography weight를 `normal`, `bold` 두 token으로 제한하고 SVG metadata 및 렌더 검증에 반영.
- 2026-07-11: `bold` 적용 대상을 `large`/`xlarge` 크기의 `content` typography로 제한하고 나머지 token은 `normal`로 고정.
- 2026-07-11: stroke weight를 `thin`, `thick`으로 정의하고 현재 렌더 및 검증은 `thin`만 허용하도록 통합.
- 2026-07-11: Canvas의 랜덤 선, 점, scan line, dot pattern과 controls blur를 제거하고 단색 배경만 유지.
- 2026-07-11: SVG turbulence/displacement filter와 모든 rough 옵션을 제거하고 원본 vector geometry만 렌더하도록 변경.
- 2026-07-11: Component safe area를 3×3 grid로 통일하고 cell마다 token 하나만 배치하는 일곱 occupancy pattern을 추가.
- 2026-07-11: 이름이 있는 occupancy pattern을 제거하고 9개 cell을 매번 독립적으로 랜덤 생성하도록 단순화.
- 2026-07-11: random grid의 각 cell이 비어 있을 수 있게 하고 occupied cell만 token을 렌더하도록 수정.
- 2026-07-11: 장식용 눈금 graphic token과 관련 renderer, 문서 규칙을 제거.
- 2026-07-11: random grid cell은 position만 전달하고 typography와 graphic token은 자체 intrinsic size로 렌더하도록 변경.
- 2026-07-11: 모든 graphic token 크기를 medium 또는 large로 제한하고 large는 원래 비율을 유지한 1.5배로 정의.
- 2026-07-11: barcode 숫자를 barcode 크기와 관계없이 항상 small 8px로 고정.
- 2026-07-11: 3×3 cell을 1-9 행 우선 번호로 정의하고 각 행을 top, middle, bottom 세로 anchor에 맞춰 배치.
- 2026-07-11: 3×3 cell을 2-5개의 직사각형 block으로 패킹하고 block마다 token 하나를 배치하는 random block grid로 확장.
- 2026-07-11: Grid 토글로 random block outline만 표시하거나 숨기고 현재 상태를 export에 반영.
- 2026-07-11: random block grid의 cell과 block 사이 gap을 0으로 변경해 모든 경계가 맞닿도록 수정.
- 2026-07-11: `2x3`, `3x2` block에서 graphic과 기존 size를 제외하고 새 `xxxlarge 256px` typography만 허용.
- 2026-07-11: typography scale에 `xxlarge 128px`를 추가하고 짧은 hero content를 초대형 후보로 분리.
- 2026-07-11: typography scale에 `xxxlarge 256px`를 추가하고 2x3, 3x2 block 전용으로 분리.
- 2026-07-11: xxxlarge용 임의 `?`, `0` fallback을 제거하고 기존 xxlarge hero token의 256px 변형만 사용하도록 수정.
- 2026-07-11: `3x1`, `1x3` block을 center/middle anchor의 xxlarge 128px typography 전용으로 변경.
- 2026-07-11: 1x3 token을 90도 회전하고 3x1/1x3 생성에 최소 두 개의 적합 hero 후보를 요구해 독립 한자 `林` 편중을 완화.
- 2026-07-12: `林`의 `hero-glyph` 예외를 제거하고 action vocabulary와 동일한 `large / xxlarge / xxxlarge` 일반 content 후보 레벨로 조정.
- 2026-07-12: HTTP 상태 코드 7개를 small/medium 보조 sign token으로 추가하고 `STATUS`의 xlarge hero 분류를 제거.
- 2026-07-12: 한 구성 안에서 대소문자와 공백을 정규화한 동일 typography 문자열의 중복 선택을 금지.
- 2026-07-12: SUIT 2.0.5 Regular/Bold를 메인 타입페이스로 지정해 영문·한글·generator UI에 적용하고 Noto Sans 계열은 역할별 fallback으로 유지.
- 2026-07-12: 한자와 중국어 typography를 Glow Sans SC 0.93 Normal 폭의 400/700 서브셋으로 변경하고 Noto Sans SC를 fallback으로 유지.
- 2026-07-12: `2x2` block의 위치 anchor를 유지하면서 token을 `xxlarge 128px` 또는 `xxxlarge 256px` typography로 제한.
- 2026-07-12: `xxlarge`, `xxxlarge` content typography의 실제 font weight를 900으로 변경하고 SUIT/Glow Sans SC Heavy 파일을 추가.
- 2026-07-12: 모든 UI와 SVG typography의 line-height를 `1`로 고정.
- 2026-07-12: block을 넘는 typography를 같은 단어·typeface로 유지하면서 다음 작은 design token size로 단계적으로 fallback하도록 변경.
- 2026-07-12: block typography에 실제 폰트 메트릭과 렌더 후 SVG 경계 평가 phase를 추가해 `CODE`, `NAME`처럼 추정 폭보다 넓은 글자도 다음 크기로 fallback하도록 보강.
- 2026-07-12: 빈 block 생성을 보류하고 최소 `small 8px`까지 내려도 실패한 typography는 짧은 cell index data token으로 교체하도록 변경.
- 2026-07-12: `1x3` 세로 block의 한글·중국어 typography에 전체 90도 회전과 glyph별 오른쪽 회전 세로 조판 두 가지 분기를 추가하고 영문은 기존 전체 회전만 유지.
- 2026-07-12: `1x3` 한글·한자 typography의 전체 90도 회전 분기를 제거하고 glyph별 세로 조판만 유지.
- 2026-07-12: 같은 component의 `3x1` 또는 `1x3` typography가 서로 다른 크기로 fallback되면 footprint별 가장 작은 실제 size로 일괄 통일하고, `3x1`·`1x3`·`3x2`·`2x3` block 안의 `xlarge` content만 900 weight를 사용하도록 변경.
- 2026-07-11: `3x2`, `2x3` block의 xxxlarge token anchor를 center/middle로 고정.
- 2026-07-12: 제공된 action text에서 62개 고유 표현을 추출하고 한글·영어·중국어 대응 token을 large, xxlarge, xxxlarge display 후보에 추가.
