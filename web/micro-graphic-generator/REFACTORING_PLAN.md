# Micro Graphic Generator Refactoring Plan

## 문서 상태

- 상태: Complete
- 작성일: 2026-07-12
- 마지막 갱신: 2026-07-12
- 대상: `web/micro-graphic-generator`
- 기준 커밋: `7d73699 Refine adaptive grid typography`
- 원칙: 시각 결과와 token rule을 바꾸지 않는 구조 개선부터 진행한다.

## 구현 체크포인트

이 문서는 초기 설계와 완료 조건을 보존한다. 아래 표는 현재 working tree에서 실제로 구현·검증된 범위를 나타낸다.

| Phase | 상태 | 현재 결과 |
| --- | --- | --- |
| Phase 0. Baseline 잠금 | 완료 | `localhost-only` 계약, fixed seed/primitive/export fixture, Playwright runner와 Random 100회 gate를 추가했다. |
| Phase 1. 설정과 vocabulary 추출 | 완료 | CSS, token/config policy, vocabulary를 각각 `styles.css`, `config.js`, `vocabulary.js`로 분리했다. |
| Phase 2. Pure core 추출 | 완료 | PRNG, token model, layout/grid packing을 모듈화하고 1,000-seed packing pure test를 추가했다. |
| Phase 3. SVG와 primitive 추출 | 완료 | SVG helper, typography resolver, graphic primitive를 분리하고 primitive SVG snapshot을 고정했다. |
| Phase 4. Grid pipeline 분리 | 완료 | selection, detached rendering, mounted finalization을 분리하고 random-free cell-index fallback 계약을 고정했다. |
| Phase 5. Validator 분리 | 완료 | read-only rule registry와 structured result를 도입하고 앱만 validation metadata를 기록하게 했다. Random 1,000회 soak도 통과했다. |
| Phase 6. Catalog/export/app shell 분리 | 완료 | Compose catalog, PNG/SVG export, app orchestration을 분리하고 `index.html` inline script를 제거했다. Export 전후 PRNG 불변 assertion도 통과했다. |
| Phase 7. 정리와 문서 갱신 | 완료 | legacy 코드와 중복 구현을 제거하고 README module boundary/extension point, visual reference, 모바일 UI 검증을 갱신했다. |

### 현재 검증 결과

- `npm run test:generator`: 통과
- Node pure/architecture test: 13개 통과
- Playwright browser test: 19개 통과
- Random generation: 1,000회 연속 violation 0
- fixed seed structural fingerprint, primitive SVG hash, light/dark 및 grid on/off PNG hash: 모두 기준선 유지
- light/dark 및 grid on/off SVG 실제 다운로드와 PNG export 전후 PRNG state 및 structural fingerprint: 동일
- `1440x900`, `900x1200`, `390x844` generator/Compose/light/dark/grid visual reference 5개: 통과
- 모바일 Compose controls 6개와 seed label의 viewport/text overflow 검사: 통과
- module dependency cycle: 0
- validation metadata writer: `app.js` 한 곳

### 완료 메모

- 이 refactoring scope의 필수 구현과 gate는 모두 완료됐다.
- Phase별 독립 커밋 대신 사용자 요청에 따라 Phase 0~6을 `5e1afc9` checkpoint commit으로 통합했다. Phase 7과 최종 gate는 후속 완료 커밋에 기록한다.
- 새 vocabulary, visual policy, interaction 기능은 이 문서의 refactoring 완료 여부와 분리된 후속 feature 작업으로 다룬다.

## 1. 목적

현재 generator는 빠른 시각 실험을 위해 `index.html` 한 파일에 UI, vocabulary, token 정의, SVG helper, graphic primitive, 3x3 block layout, typography fitting, validation, export를 함께 두고 있다. 이 방식은 초기 실험에는 효율적이었지만, rule이 늘어나면서 한 가지 변경이 selection, render, post-render finalization, validation, documentation에 동시에 영향을 주기 시작했다.

이번 refactoring의 목적은 다음과 같다.

1. 현재 seed 기반 결과와 시각 규칙을 보존한다.
2. block별 규칙을 선언형 policy로 모은다.
3. token 선택과 SVG 렌더링, 렌더 후 평가를 분리한다.
4. 규칙 검증 결과가 어떤 rule에서 실패했는지 바로 알 수 있게 한다.
5. 새 token, footprint, orientation을 기존 코드 수정 범위를 넓히지 않고 추가할 수 있게 한다.
6. framework와 bundler 없이 현재의 가벼운 실행 방식을 유지한다.

## 2. 리팩터링 전 기준 상태

아래 규모와 책임은 기준 커밋 `7d73699` 당시 상태다. 현재 구조는 위 `구현 체크포인트`와 README의 `Architecture`를 따른다.

### 규모

- `index.html`: 약 2,938줄
- `README.md`: 약 497줄
- 함수: 149개
- 상위 설정 상수: 36개
- vocabulary/data 영역: 약 117줄
- 3x3 grid, selection, typography fit 영역: 약 625줄
- catalog 영역: 약 330줄
- post-render validation, export, app 영역: 약 570줄

### 현재 책임

`index.html`은 아래 책임을 동시에 가진다.

- 디자인 token과 block rule 정의
- 다국어 vocabulary와 날짜 token 생성
- seeded random 상태 관리
- typography/graphic token 모델 생성
- SVG element helper
- barcode, pseudo-QR, table, wave renderer
- 3x3 block packing과 token selection
- Canvas font metrics 기반 1차 fit
- SVG `getBBox()` 기반 2차 fit
- size fallback, 위치 보정, 그룹 size 동기화
- 세로 orientation 분기
- token rule validation
- Compose catalog rendering
- PNG/SVG export
- DOM event와 application state 관리

### 주요 결합 지점

1. **Block rule 분산**

   `1x3`, `3x1`, `2x3`, `3x2`, `2x2` 규칙이 footprint helper, candidate selection, render metadata, post-render correction, validator에 나뉘어 있다.

2. **Selection과 render의 상호 의존**

   token이 block에 맞는지는 Canvas metric으로 먼저 판단하지만, 최종 결과는 DOM에 붙인 뒤 `getBBox()`로 다시 판단한다. 두 단계가 같은 size, weight, orientation policy를 공유해야 한다.

3. **Contextual typography rule**

   `xlarge`는 기본 700이지만 `3x1`, `1x3`, `3x2`, `2x3` 안에서는 900이다. 동일한 `3x1`과 `1x3`은 footprint별 가장 작은 실제 size로 각각 통일하며, `1x3` 한글·중국어에는 두 가지 세로 orientation이 있다.

4. **Validator의 단일 대형 함수화**

   `validateRenderedTokenRules()` 안에서 taxonomy, weight, layout, footprint, size, orientation, barcode, duplicate rule을 한 번에 검사한다. 실패 시 `invalid-layout-grid` 하나로 합쳐지는 경우가 있어 원인 추적이 어렵다.

5. **전역 mutable state**

   `seed`, `random`, mode, tone, outline, active component 정보가 전역 변수로 공유된다. 함수 호출 순서가 seed 재현성에 직접 영향을 준다.

## 3. 범위

### 포함

- 파일과 모듈 경계 정리
- block policy 선언형 구조 도입
- token model, generation context, selection state 명시화
- pure function 추출
- validation rule registry 분리
- seeded result를 보호하는 characterization test 추가
- export와 UI event 코드 분리
- 문서 구조 정리

### 제외

- 새로운 visual token 추가
- vocabulary 변경
- layout 확률 변경
- 새로운 footprint 추가
- 색상, stroke, spacing, typeface 변경
- React/Vue/Svelte 등 framework 도입
- Vite/Webpack 등 bundler 도입
- SVG geometry나 export 포맷 변경

## 4. 보존해야 할 규칙

리팩터링 중 아래 동작은 regression으로 취급한다.

- 모든 component는 3x3 cell을 2-5개 block으로 빈틈없이 덮는다.
- block마다 token은 정확히 하나이며 빈 block은 현재 만들지 않는다.
- 같은 component 안에서 typography 문자열은 중복되지 않는다.
- barcode와 pseudo-QR은 각각 최대 하나다.
- typography size는 `8, 16, 32, 64, 128, 256px` 단계만 사용한다.
- overflow는 다음 작은 size로만 해결하며 SVG `scale()`을 사용하지 않는다.
- size fallback 이후에도 넘치면 position만 최소 보정한다.
- 같은 component의 동일 `3x1` 또는 `1x3` typography는 footprint별 가장 작은 실제 size로 통일한다.
- `1x3` 영문은 단어 전체를 오른쪽 90도로 회전한다.
- `1x3` 한글·중국어는 전체 회전 또는 glyph별 sideways stack을 사용한다.
- `3x1`, `1x3`, `3x2`, `2x3` 안의 실제 `xlarge` content는 900이다.
- 그 외 `xlarge` content는 700이고 `xxlarge`, `xxxlarge` content는 900이다.
- 모든 SVG text의 line-height는 `1`이다.
- active stroke는 `thin`만 사용한다.
- Random은 seed 기반이며 동일한 환경에서 재현 가능해야 한다.
- PNG/SVG export는 화면의 tone과 grid outline 상태를 반영한다.

## 5. 최종 구조

Phase 0에서 지원 launch contract를 먼저 확정한다.

- localhost 정적 서버가 공식 실행 경로로 승인되면 native ES module을 사용한다.
- `file://` 직접 실행을 계속 지원해야 하면 native ES module 분리를 시작하지 않는다. classic `defer` script 분리 또는 단일 배포 파일 유지 방안을 먼저 결정한다.
- 어떤 경로를 선택해도 bundler와 production build step은 추가하지 않는다.

localhost 실행 계약을 승인하고 아래 구조로 구현했다.

```text
micro-graphic-generator/
├── index.html
├── styles.css
├── README.md
├── REFACTORING_PLAN.md
├── fonts/
├── src/
│   ├── app.js
│   ├── config.js
│   ├── vocabulary.js
│   ├── token-library.js
│   ├── random.js
│   ├── token-model.js
│   ├── typography.js
│   ├── svg.js
│   ├── graphics.js
│   ├── grid-layout.js
│   ├── grid-selection.js
│   ├── grid-renderer.js
│   ├── grid-finalizer.js
│   ├── catalog-renderer.js
│   ├── validation.js
│   └── export.js
└── tests/
    ├── fixtures/
    │   ├── baseline.json
    │   ├── export-baseline.json
    │   ├── primitive-baseline.json
    │   └── visual/*.png
    ├── launch-contract.json
    ├── playwright.config.mjs
    ├── pure.test.mjs
    ├── generator.spec.mjs
    ├── run-tests.mjs
    └── static-server.mjs
```

Test command의 owner는 repository root `package.json`과 `package-lock.json`이다. generator 하위에 두 번째 manifest를 만들지 않는다. Phase 0에서 root manifest에 아래 script와 dev dependency를 추가한다.

```json
{
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "test:generator:install": "playwright install chromium",
    "test:generator": "node web/micro-graphic-generator/tests/run-tests.mjs",
    "test:generator:soak": "node web/micro-graphic-generator/tests/run-tests.mjs --soak"
  },
  "devDependencies": {
    "@playwright/test": "<pinned-version>"
  }
}
```

`tests/playwright.config.mjs`의 `webServer.command`는 `node web/micro-graphic-generator/tests/static-server.mjs`를 사용하고 `reuseExistingServer: false`로 둔다. server의 고정 기본값은 `127.0.0.1:4191`이고 browser test base URL은 `http://127.0.0.1:4191/web/micro-graphic-generator/`이며 test runner가 server 시작과 종료를 소유한다.

Phase 0 결정은 `tests/launch-contract.json`에 아래 값 중 하나로 기록한다.

```json
{ "mode": "localhost-only" }
```

또는

```json
{ "mode": "direct-file-required" }
```

Playwright에는 HTTP project와 direct-file project를 분리한다. HTTP project는 항상 localhost base URL을 사용한다. `direct-file-required`이면 `tests/run-tests.mjs`가 direct-file project도 필수로 실행하며, 이 project는 Node `pathToFileURL()`로 실제 repository의 `web/micro-graphic-generator/index.html?test=1` URL을 만들어 `page.goto()`한다. direct-file project가 실패하면 localhost project의 성공 여부와 관계없이 전체 gate를 실패시킨다.

### 의존 방향

아래 표기에서 `A → B`는 A가 B를 import하거나 명시적 input으로 소비한다는 뜻이다.

```text
app
├── token-library → config + token-model + vocabulary input
├── catalog-renderer → config + layout + token-model + svg
├── grid-layout → config + layout + random input
├── grid-selection → config + grid-layout + layout + token-model + typography
├── grid-renderer → config + graphics + grid-layout + random replay + svg + token-model + typography
├── grid-finalizer → config + grid-layout
├── validation → config + grid-layout + token-model + typography
└── export → config
```

`grid-layout`은 cell packing, coverage, footprint, alignment 계산만 담당하며 `document`, `window`, Canvas, SVG, vocabulary를 참조하지 않는다. Canvas metric과 candidate pool이 필요한 선택은 browser-bound `grid-selection`이 담당한다. `grid-renderer`는 SVG tree 생성까지만 담당하고 mount는 `app`이 수행한다. mount 이후 `getBBox()`와 DOM mutation이 필요한 size fallback, position correction, size synchronization은 `grid-finalizer`만 담당한다. leaf module은 `app`을 import하지 않으며, typography style과 measurement는 `typography`의 명시적 interface를 통해서만 사용한다.

### 최종 naming map

- `grid-layout`: cell, footprint, packing, anchor 관계만 계산한다.
- `grid-selection`: vocabulary 후보와 token을 선택하지만 SVG를 만들지 않는다.
- `grid-renderer`: detached component SVG tree를 만들지만 mount하거나 `getBBox()`를 호출하지 않는다.
- `grid-finalizer`: mounted component SVG 내부 typography만 보정한다.
- `app`: Canvas background, component mount, controls, seed label, validation reporting을 orchestration한다.
- 제거한 legacy content renderer 이름은 grid module과 extension point에 재사용하지 않는다.

Phase 7에서 README의 `Random block grid layer`와 `Layout renderer` 설명을 위 네 grid module로 교체하고, migration 완료 후 umbrella term을 새 extension point 이름으로 사용하지 않는다.

## 6. 핵심 설계

### 6.1 Block policy 통합

footprint 조건문을 여러 함수에 반복하지 않고 하나의 policy table에서 읽는다.

```js
export const GRID_BLOCK_POLICIES = [
  {
    footprint: "1x1",
    candidatePolicy: "mixed",
    requestedSizes: null,
    allowGraphic: true,
    align: "edge-derived",
    verticalAlign: "edge-derived",
    rotation: 0,
    orientationModes: ["none"],
    sizeSyncScope: null,
    xlargeWeight: null
  },
  {
    footprint: "2x2",
    candidatePolicy: "oversized-typography",
    requestedSizes: ["xxlarge", "xxxlarge"],
    allowGraphic: false,
    align: "edge-derived",
    verticalAlign: "edge-derived",
    rotation: 0,
    orientationModes: ["none"],
    sizeSyncScope: null,
    xlargeWeight: null
  },
  {
    footprint: "1x2",
    candidatePolicy: "mixed",
    requestedSizes: null,
    allowGraphic: true,
    align: "edge-derived",
    verticalAlign: "edge-derived",
    rotation: 0,
    orientationModes: ["none"],
    sizeSyncScope: null,
    xlargeWeight: null
  },
  {
    footprint: "1x3",
    candidatePolicy: "centered-hero",
    requestedSizes: ["xxlarge"],
    allowGraphic: false,
    align: "center",
    verticalAlign: "middle",
    rotation: 90,
    orientationModes: ["whole-rotate", "glyph-sideways-stack"],
    englishOrientationModes: ["whole-rotate"],
    sizeSyncScope: "footprint:1x3",
    xlargeWeight: 900
  },
  {
    footprint: "2x3",
    candidatePolicy: "maximum-typography",
    requestedSizes: ["xxxlarge"],
    allowGraphic: false,
    align: "center",
    verticalAlign: "middle",
    rotation: 0,
    orientationModes: ["none"],
    sizeSyncScope: null,
    xlargeWeight: 900
  },
  {
    footprint: "2x1",
    candidatePolicy: "mixed",
    requestedSizes: null,
    allowGraphic: true,
    align: "edge-derived",
    verticalAlign: "edge-derived",
    rotation: 0,
    orientationModes: ["none"],
    sizeSyncScope: null,
    xlargeWeight: null
  },
  {
    footprint: "3x1",
    candidatePolicy: "centered-hero",
    requestedSizes: ["xxlarge"],
    allowGraphic: false,
    align: "center",
    verticalAlign: "middle",
    rotation: 0,
    orientationModes: ["none"],
    sizeSyncScope: "footprint:3x1",
    xlargeWeight: 900
  },
  {
    footprint: "3x2",
    candidatePolicy: "maximum-typography",
    requestedSizes: ["xxxlarge"],
    allowGraphic: false,
    align: "center",
    verticalAlign: "middle",
    rotation: 0,
    orientationModes: ["none"],
    sizeSyncScope: null,
    xlargeWeight: 900
  }
];

export const GRID_BLOCK_POLICY_BY_FOOTPRINT = new Map(
  GRID_BLOCK_POLICIES.map(policy => [policy.footprint, policy])
);
```

`GRID_BLOCK_POLICIES`는 허용된 8개 footprint와 seed-sensitive packing 순서의 단일 ordered source다. packing은 배열 순서를 그대로 보존하고, lookup이 필요한 consumer는 파생된 `GRID_BLOCK_POLICY_BY_FOOTPRINT`만 사용한다. implicit default와 별도 footprint 배열은 두지 않는다. `1x3`과 `3x1`의 `sizeSyncScope`는 서로 다른 key를 사용해 cross-synchronization을 금지한다. selection, rendering, finalization, validation은 모두 이 policy source를 사용한다.

### 6.2 Generation context와 selection state

전역 변수 대신 한 generation cycle의 immutable input, stateful PRNG, token 선택 중 누적되는 mutable state를 분리한다.

```js
const generationContext = {
  seed,
  viewport,
  mode,
  tone,
  showGrid,
  now
};

const randomSource = createSeededRandom(seed);

const selectionState = {
  usedUniqueTokenRoles: new Set(),
  usedTypographyWordKeys: new Set()
};
```

`generationContext`는 생성 후 변경하지 않으며 `now`를 포함해 날짜 token도 테스트에서 고정할 수 있게 한다. draw state를 갖는 `randomSource`만 stateful random dependency로 전달한다. `usedUniqueTokenRoles`에는 `UNIQUE_GRID_TOKEN_ROLES`에 등록된 role만 들어간다. `usedTypographyWordKeys`에는 typography 문자열을 NFKC 정규화하고 trim, 공백 병합, 대문자화한 key만 들어간다. 두 Set은 `grid-selection`만 변경하며 renderer와 finalizer는 읽거나 쓰지 않는다.

### 6.3 Planning, rendering, finalization 분리

pipeline을 아래 다섯 단계로 고정한다.

1. `planGrid()` - 3x3 block packing
2. `selectTokenForBlock()` - policy와 Canvas metric 기반 후보 선택
3. `renderGridPlan()` - SVG 생성과 metadata 기록
4. `app.mountComponentSvg()` - 생성된 SVG root를 document에 mount
5. `finalizeRenderedGridTypography()` - mounted SVG의 `getBBox()`를 읽고 fallback, position correction, uniform size 동기화를 수행

`planGrid()`와 `selectTokenForBlock()`의 입출력만 plain object contract로 고정하며 DOM node를 포함하지 않는다. `renderGridPlan()`은 detached SVG root를 반환하고, `app`이 mount한 뒤 `grid-finalizer`가 해당 root 내부만 변경한다. `grid-finalizer`는 Canvas background, Component border, controls, seed label을 변경하지 않는다.

각 block의 selection result는 선택된 `tokenPlan`과 random-free `fallbackTokenPlan`을 함께 가진다.

```js
{
  tokenPlan,
  fallbackTokenPlan: {
    value: String(block.cells[0]),
    role: "cell-index",
    tokenFunction: sourceSize === "small" ? "data" : "content",
    typefaceRole: "mono",
    requestedSize: sourceSize,
    actualSize: fittedFallbackSize,
    orientationMode: blockPolicy.rotation === 90 ? "whole-rotate" : "none",
    resolvedTypographyStyle
  }
}
```

`fallbackTokenPlan`은 `grid-selection`이 `token-model` helper와 같은 deterministic fit search로 미리 만들며 random을 호출하지 않는다. `actualSize`는 fallback의 최초 fit 결과이고 `resolvedTypographyStyle`은 그 size와 orientation으로 해석한 값이다. `1x3` fallback은 기존 token의 glyph-stack 여부를 상속하지 않고 항상 `whole-rotate`를 명시한다. `grid-finalizer`는 smallest size에서도 fit되지 않을 때 이 plan과 `typography` resolver, low-level `svg` helper를 사용해 현재 block token group 내부만 교체하고, 추가 축소가 필요하면 전달받은 `actualSize`에서 시작한다. finalizer는 vocabulary pool을 다시 탐색하거나 새로운 semantic token을 만들지 않는다.

Finalization은 현재 size 단계 수에 묶인 단조 감소 loop를 그대로 보존한다.

1. 최대 `DESIGN_TOKEN_SIZE_ORDER.length + 1` pass를 실행한다.
2. 각 pass는 overflow correction 후 footprint size synchronization을 실행한다.
3. synchronization이 변경을 만들지 않으면 즉시 종료한다.
4. loop 종료 후 overflow correction을 정확히 한 번 더 실행한다.
5. fallback은 현재 size index보다 작은 index로만 이동하며 finalizer는 random을 호출하지 않는다.

따라서 종료 조건은 `no-size-sync-change` 또는 bounded pass exhaustion이고, unbounded convergence loop를 허용하지 않는다.

### 6.4 Typography style contract

`typography.js`는 typography style과 metric의 단일 resolver다.

```js
const resolvedTypographyStyle = resolveTypographyStyle({
  token,
  blockPolicy,
  orientationMode,
  actualSize
});
```

반환값은 최소한 `typefaceRole`, `fontFamily`, `fontSize`, `tokenWeight`, `fontWeight`, `lineHeight`, `orientationMode`, `rotation`을 가진다. `grid-selection`은 이 값으로 Canvas pre-fit을 측정하고 selection plain object에 포함한다. `grid-renderer`는 같은 값을 SVG attribute로 기록한다. fallback으로 `actualSize`가 바뀌면 `grid-finalizer`가 `typography.js`를 다시 호출하며 weight, baseline, orientation을 자체 계산하지 않는다. baseline과 bounding metric은 `measureTypography()`와 `resolveTypographyBaseline()` interface로만 얻는다.

### 6.5 Validation rule registry

하나의 대형 boolean 식 대신 rule별 함수를 둔다.

```js
const VALIDATION_RULES = [
  validateTaxonomy,
  validateTypeface,
  validateWeight,
  validateBlockCoverage,
  validateBlockTokenCount,
  validateTypographyFit,
  validateUniformFootprintSize,
  validateOrientation,
  validateUniqueWords,
  validateUniqueGraphics
];
```

각 validator는 다음 형식으로 결과를 반환한다.

```js
{
  rule: "grid.uniform-size.1x3",
  valid: false,
  nodes: ["block-1", "block-2"],
  detail: "Expected xlarge, found xxlarge"
}
```

`validation.js`의 validator는 DOM을 읽을 수 있지만 수정하지 않으며 structured result만 반환한다. expected typeface, weight, line-height, baseline, orientation을 검사하는 validator는 `typography.resolveTypographyStyle()`과 metric interface를 소비하며 style rule을 재계산하거나 복제하지 않는다. `app.reportValidationResults(art, results)`가 유일하게 `data-rule-violations`, `data-rule-violation-list`, console warning을 기록한다.

### 6.6 Seed 안정성

함수 이동 과정에서 `random()` 호출 횟수와 순서를 바꾸지 않는다.

- `pick()`, `chance()`, `shuffled()` 호출 순서를 유지한다.
- object iteration 순서에 random 결과를 의존하지 않는다.
- 새 validation은 random을 호출하지 않는다.
- export는 render random state를 소비하지 않는다.
- Phase 0 test hook은 PRNG wrapper의 draw count와 serializable state를 관찰만 하며 draw를 추가하지 않는다.
- 구조 변경 전후 seed fingerprint를 비교한다.

## 7. 실행 단계

### Phase 0. Baseline 잠금

목표: 리팩터링 전 현재 동작을 관찰 가능한 계약으로 만든다.

작업:

- 현재 앱을 localhost와 `file://` 두 경로에서 실행해 실제 지원 상태를 기록한다.
- Phase 1 전에 launch contract를 결정한다. localhost-only를 승인하지 않았다면 native module 추출을 시작하지 않는다.
- 선택한 값을 `tests/launch-contract.json`에 저장하고 test runner가 HTTP/direct-file project 선택의 source of truth로 사용하게 한다.
- baseline capture 전에 현재 validator의 uniform-size 비교가 `3x1`과 `1x3`을 합치지 않고 footprint/requested-size group별로 검사하는지 고정한다. 이 contract correction은 별도 선행 변경으로 검증한다.
- browser automation을 위해 root `package.json`에 pinned `@playwright/test`만 dev dependency로 추가하고 lockfile을 갱신한다. production dependency와 bundler는 추가하지 않는다.
- `npm install` 뒤 `npm run test:generator:install`로 Chromium을 설치하는 bootstrap 절차를 README에 기록한다.
- Node built-in `http` 기반 `tests/static-server.mjs`와 `playwright.config.mjs`를 추가하고 Playwright `webServer`가 port 4191 server lifecycle을 소유하게 한다.
- 대표 seed fixture를 만든다.
- component ratio와 주요 footprint 조합을 포함한다.
- `1x3` 전체 회전, glyph stack, size fallback, uniform size 사례를 포함한다.
- `3x1`과 `1x3`은 유효한 3x3 packing에서 서로 교차해 같은 component에 공존할 수 없으므로, synthetic group entry를 사용하는 pure test로 두 footprint key가 cross-synchronize되지 않음을 검증한다.
- `3x1`, `1x3`, `3x2`, `2x3`의 contextual 900 사례를 포함한다.
- DOM metadata를 정규화한 structural fingerprint helper를 만든다.
- 날짜와 viewport는 fixture에서 고정한다.
- `?test=1`에서만 활성화되는 최소 test hook을 추가해 current seed, PRNG draw count/state, normalized fingerprint를 읽을 수 있게 한다. hook은 random을 호출하거나 production render 순서를 바꾸지 않는다.
- Random 반복 smoke test를 만든다.
- `tests/run-tests.mjs`가 pure test, fixture test, browser smoke를 순서대로 실행하게 한다.

Fixture schema는 아래 필드를 필수로 한다.

```json
{
  "schemaVersion": 1,
  "name": "three-horizontal-heroes",
  "seed": 305419896,
  "now": "2026-07-12T00:00:00.000Z",
  "viewport": { "width": 1440, "height": 900 },
  "mode": "random",
  "tone": "light",
  "grid": true,
  "expected": {
    "componentRatio": "5:2",
    "borderMode": "stroke",
    "blocks": [
      {
        "footprint": "3x1",
        "cells": [1, 2, 3],
        "role": "action-keyword",
        "value": "UPDATE",
        "requestedSize": "xxlarge",
        "actualSize": "xlarge",
        "weight": 900,
        "orientation": "none",
        "fit": true
      }
    ]
  }
}
```

Fingerprint는 dynamic SVG node id와 export URL을 제외하고 component ratio, border mode, block footprint/cells, token role/value, requested/actual size, weight, orientation, fit, tone, grid 상태만 정규화한다.

실행 명령:

```bash
npm install
npm run test:generator:install
npm run test:generator        # pure + fixture + browser interaction + Random 100회
npm run test:generator:soak   # 위 검사 + Random 1,000회
```

완료 조건:

- launch contract가 `localhost-only` 또는 `direct-file-required`로 문서에 기록돼 있다.
- `direct-file-required`이면 실제 absolute `file://.../index.html?test=1` Playwright project가 필수 gate로 통과한다.
- root manifest와 lockfile에 Node `>=18`, pinned Playwright dev dependency와 세 generator script가 기록돼 있다.
- 기준 seed마다 block footprint, token text, requested/actual size, weight, orientation이 기록된다.
- 100회 Random에서 violation, empty block, unfit token이 0이다.
- `npm run test:generator`가 한 명령으로 baseline과 100회 browser gate를 통과한다.
- SVG export는 background/ink, font CSS URL, tone, grid outline opacity를 fixture와 비교한다.
- PNG export는 width/height가 viewport의 정확히 2배인지 확인하고 light/dark 및 grid on/off fixture의 기준 pixel/hash와 비교한다.

### Phase 1. 설정과 vocabulary 추출

목표: 동작 변경 없이 data와 rule 정의를 분리한다.

작업:

- Phase 0의 launch contract가 localhost-only로 승인됐는지 확인한다. direct-file-required이면 module 추출 대신 승인된 compatibility 경로를 따른다.
- CSS를 `styles.css`로 이동한다.
- token size, spacing, font, stroke 설정을 `src/config.js`로 이동한다.
- 다국어 단어와 status code를 `src/vocabulary.js`로 이동한다.
- ordered `GRID_BLOCK_POLICIES`와 파생 lookup을 도입하되 기존 footprint 순서와 helper 결과를 동일하게 유지한다.
- 기존 상수 이름을 가능한 한 유지한다.

완료 조건:

- 선택한 launch path에서 app과 font가 정상 로드된다.
- baseline fingerprint가 모두 동일하다.
- `index.html`에는 markup과 module entry만 남기기 시작한다.
- rule source가 `config.js` 한 곳으로 줄어든다.

### Phase 2. Pure core 추출

목표: DOM 없이 검증할 수 있는 계산을 분리한다.

작업:

- PRNG와 random helper를 `random.js`로 이동한다.
- token normalization과 taxonomy를 `token-model.js`로 이동한다.
- grid packing, footprint coverage, alignment 계산을 `grid-layout.js`로 이동한다.
- pure rule unit test를 Node `node:test` 기반 `.mjs`로 작성한다.

완료 조건:

- 3x3 packing을 1,000 seed 실행했을 때 overlap과 누락이 0이다.
- 같은 seed의 block plan이 기존과 동일하다.
- pure module이 `document`, `window`, SVG node를 참조하지 않는다.

### Phase 3. SVG와 primitive 추출

목표: rendering helper와 graphic primitive를 독립시킨다.

작업:

- `make`, `textNode`, `line`, `rect`, `polyline`을 `svg.js`로 이동한다.
- typography metric, typeface, baseline 계산을 `typography.js`로 이동한다.
- barcode, pseudo-QR, mini table, wave, badge를 `graphics.js`로 이동한다.
- primitive 내부 token metadata contract를 고정한다.

완료 조건:

- primitive별 SVG snapshot이 기존과 동일하다.
- barcode caption은 항상 small 8px다.
- graphic size는 medium 또는 large만 사용한다.

### Phase 4. Grid pipeline 분리

목표: 가장 위험한 block selection/render/finalization 흐름을 명시적인 pipeline으로 바꾼다.

작업:

- `grid-layout.js`는 packing, coverage, footprint, alignment까지만 유지한다.
- candidate pool, Canvas metric pre-fit, token selection을 browser-bound `grid-selection.js`에 둔다.
- `grid-selection.js`는 vocabulary/token pool과 `typography.measureTypography()` interface를 명시적 입력으로 받으며 `grid-layout.js`가 이를 역으로 import하지 않게 한다.
- `grid-selection.js`가 각 block에 requested/actual size, orientation, resolved style을 포함한 deterministic `fallbackTokenPlan`을 만들고 fallback 생성 중 random을 호출하지 않게 한다.
- detached SVG block/token 생성을 `grid-renderer.js`에 둔다.
- mounted SVG의 typography fallback, position correction, footprint별 size synchronization을 `grid-finalizer.js`에 둔다.
- Canvas pre-fit, SVG render, mounted SVG finalization이 같은 `resolvedTypographyStyle` contract를 사용하게 한다.
- size fallback을 별도 함수로 만든다.
- position nudge를 별도 함수로 만든다.
- `3x1`·`1x3` footprint별 uniform size resolution을 별도 pass로 만든다.
- finalization loop는 `DESIGN_TOKEN_SIZE_ORDER.length + 1` pass 상한, no-change 조기 종료, 마지막 overflow correction 1회 계약을 유지한다.

완료 조건:

- `grid-layout.js`가 `document`, `window`, Canvas, SVG, vocabulary를 import하지 않는다.
- `grid-selection.js`가 packing을 재구현하지 않고 `grid-layout.js` 결과만 소비한다.
- `grid-renderer.js`가 `getBBox()`를 호출하거나 mounted DOM을 수정하지 않는다.
- `grid-finalizer.js`가 전달받은 mounted component SVG root 바깥을 수정하지 않는다.
- `grid-finalizer.js`가 selection의 `fallbackTokenPlan`만 사용하며 vocabulary selection이나 token-model 생성을 반복하지 않는다.
- `grid-finalizer.js`가 fallback의 전달된 `actualSize`와 `orientationMode`에서 시작하며 `1x3` cell-index fallback을 항상 `whole-rotate`로 렌더한다.
- finalization pass 수가 size 단계 기반 상한을 넘지 않고 no-change에서 종료된다.
- selection 결과가 `resolvedTypographyStyle`을 포함하고 renderer/finalizer가 typeface, weight, baseline, orientation 규칙을 중복 구현하지 않는다.
- `CODE`, `NAME`, 긴 다국어 action이 block을 넘지 않는다.
- 같은 `3x1` 또는 `1x3` 그룹의 actual size가 footprint별 하나로 통일된다.
- 영문 glyph stack이 0이다.
- contextual `xlarge 900`이 지정 footprint에서만 발생한다.
- scale metadata는 항상 1이고 SVG transform에 `scale()`이 없다.

### Phase 5. Validator 분리

목표: rule 실패 원인을 개별적으로 찾을 수 있게 한다.

작업:

- `validation.js`에 rule registry를 만든다.
- taxonomy, weight, layout, fit, duplicate, graphic rule을 분리한다.
- `invalid-layout-grid`를 세부 rule id로 나눈다.
- validator가 DOM을 변경하거나 random을 소비하지 못하게 한다.
- `app.reportValidationResults()`만 validation metadata와 console output을 기록하게 한다.

완료 조건:

- 기존 rule을 모두 개별 validator가 커버한다.
- validator는 structured result만 반환하며 DOM attribute와 console을 변경하지 않는다.
- typography 관련 validator가 `typography` resolver를 소비하고 style/metric rule을 복제하지 않는다.
- `app.reportValidationResults()`가 validation metadata와 console output의 유일한 writer다.
- 의도적으로 rule 하나를 깨면 해당 rule id 하나가 실패한다.
- 정상 Random 1,000회에서 violation이 0이다.

### Phase 6. Catalog, export, app shell 분리

목표: 생성 엔진과 UI 동작을 분리한다.

작업:

- Compose 화면을 `catalog-renderer.js`로 이동한다.
- PNG/SVG export를 `export.js`로 이동한다.
- DOM query, event binding, state transition을 `app.js`로 이동한다.
- `index.html` inline script를 제거한다.

완료 조건:

- Random, Compose, Grid, PNG, SVG, Tone이 기존과 동일하게 동작한다.
- resize와 font loading 후 재렌더가 정상이다.
- export 결과가 현재 화면과 같은 tone/grid 상태를 가진다.
- Tone과 Grid toggle 전후에는 seed와 component plan/token fingerprint가 유지된다.
- Compose 왕복과 viewport resize 왕복은 원래 viewport로 돌아왔을 때 같은 seed fingerprint를 복원한다.
- font-ready 재렌더와 PNG/SVG export는 test hook의 PRNG draw count/state를 변경하지 않는다.

### Phase 7. 정리와 문서 갱신

목표: 임시 compatibility code를 제거하고 새 extension point를 문서화한다.

작업:

- 더 이상 쓰지 않는 legacy content panel helper를 조사해 제거 여부를 결정한다.
- 중복 상수와 compatibility wrapper를 제거한다.
- README의 코드 위치 설명을 새 module 기준으로 바꾼다.
- token 추가, block rule 추가, validator 추가 방법을 문서화한다.

완료 조건:

- `index.html`은 markup과 entry import 중심으로 축소된다.
- 같은 rule이 둘 이상의 module에 중복 정의되지 않는다.
- 새 footprint policy를 ordered `GRID_BLOCK_POLICIES` 한 곳에서 추가하고 validator는 파생 lookup을 소비한다.

## 8. 테스트 전략

### Pure tests

- PRNG 재현성
- footprint packing과 coverage
- alignment와 cell numbering
- size fallback order
- `fallbackTokenPlan`의 requested/actual size, `1x3` whole-rotate orientation, resolved style과 PRNG draw 0
- synthetic `3x1`/`1x3` uniform group key isolation
- contextual weight resolution
- orientation eligibility
- duplicate word normalization
- UPC checksum/pattern

### Browser structural tests

- fixed viewport에서 seed fixture 렌더
- block/token metadata fingerprint 비교
- `data-rule-violations="0"`
- empty block 0
- unfit token 0
- typography group에 `scale()` 없음
- 지정 footprint의 xlarge 900
- 그 외 xlarge 700
- `3x1`·`1x3` footprint별 uniform actual size
- 영어 glyph stack 0
- Tone toggle 전후 seed/layout/token fingerprint 유지
- Grid toggle 전후 seed/layout/token fingerprint 유지, outline 상태만 변경
- Compose 진입 후 component mode 복귀 시 원래 fingerprint 복원
- viewport A → B → A resize 왕복 시 A fingerprint 복원
- `document.fonts.ready` 이후 동일 seed 재렌더 fingerprint를 유지하고 PRNG가 같은 seed에서 기대 draw count/state로 reset됨
- smallest-size overflow를 강제한 fixture가 precomputed cell-index fallback을 렌더하고, `1x3` whole-rotate를 유지하며, 현재 token group만 교체하고, vocabulary/token-model 호출 및 PRNG draw count/state를 늘리지 않음
- PNG/SVG export 전후 seed, PRNG draw count/state, random-dependent fingerprint 유지
- Random 클릭은 새 seed와 새 fingerprint를 생성하고 draw count/state가 새 seed 기준으로 reset됨

### Export tests

- SVG에 현재 background/ink color와 font CSS URL이 포함됨
- SVG의 block outline opacity가 Grid on/off 상태와 일치함
- SVG light/dark fixture가 서로 다른 tone 값을 가짐
- PNG width와 height가 현재 viewport의 정확히 2배임
- PNG light/dark 기준 pixel이 현재 tone과 일치함
- PNG grid on/off fixture의 image hash가 다르고 각 reference와 일치함
- export 실행 전후 component fingerprint가 동일함

### Visual tests

다음 viewport에서 reference screenshot을 유지한다.

- Desktop landscape: `1440x900`
- Desktop portrait-like: `900x1200`
- Narrow mobile: `390x844`

reference는 모든 Random 결과를 고정하지 않고 아래 대표 상태만 둔다.

- 3개의 `1x3` vertical block
- `2x3` 또는 `3x2` oversized block
- mixed typography/graphic layout
- Compose catalog
- light/dark tone
- grid outline on/off

## 9. PR 및 커밋 단위

한 번에 전체 파일을 분해하지 않는다. 아래 순서로 작은 PR 또는 커밋을 만든다.

1. `test(generator): capture refactor baselines`
2. `refactor(generator): extract configuration and vocabulary`
3. `refactor(generator): extract random and grid planning core`
4. `refactor(generator): extract svg and graphic renderers`
5. `refactor(generator): isolate grid evaluation pipeline`
6. `refactor(generator): split validation rules`
7. `refactor(generator): extract catalog export and app shell`
8. `docs(generator): update architecture and extension points`

각 단계는 독립적으로 되돌릴 수 있어야 하며, 단계 사이에 baseline test가 깨진 상태를 남기지 않는다.

## 10. 위험과 대응

### Random 호출 순서 변경

위험: 같은 seed에서 다른 block/token이 나올 수 있다.

대응: Phase 0 fingerprint를 먼저 만들고, 함수 이동 단계에서는 random 호출 순서를 변경하지 않는다. 확률 조정은 별도 feature 작업으로 분리한다.

### Font metric 차이

위험: module load나 font ready 시점이 바뀌면 fallback size가 달라질 수 있다.

대응: `start()`는 `document.fonts.ready` 이후 첫 render라는 현재 계약을 유지한다. Canvas pre-fit과 SVG evaluation은 같은 resolved weight/typeface를 사용한다.

### Native module 로딩

위험: `file://` 직접 열기에서는 browser CORS 정책으로 module import가 실패할 수 있다.

대응: Phase 0에서 현재 localhost와 `file://` 실행 상태를 모두 기록하고 지원 계약을 먼저 결정한다. localhost-only가 명시적으로 승인된 경우에만 native ES module 구조로 이동한다. direct-file-required이면 classic script 분리 또는 단일 배포 파일 유지 방안을 선택할 때까지 Phase 1을 시작하지 않는다.

### Export style 누락

위험: CSS 분리 후 SVG export가 font/style을 포함하지 못할 수 있다.

대응: export test에서 font CSS URL, current color, tone, grid opacity를 검사한다.

### 순환 의존

위험: typography가 grid를 알고 grid가 typography를 아는 구조가 생길 수 있다.

대응: typography는 style/metric의 단일 resolver이며 footprint context는 `GRID_BLOCK_POLICY_BY_FOOTPRINT`를 통해 명시적으로 주입한다. selection, renderer, finalizer는 resolved style contract를 공유한다.

## 11. 완료 정의

리팩터링은 아래 조건을 모두 충족할 때 완료한다.

- launch contract가 문서화되고 선택한 경로에서 자동 테스트가 통과한다.
- current visual policy가 ordered `GRID_BLOCK_POLICIES`와 validation rule registry에 명시돼 있다.
- `index.html` inline application script가 제거돼 있다.
- pure core, detached DOM renderer, mounted DOM finalizer 경계가 분리돼 있다.
- fixed seed structural baseline이 모두 통과한다.
- Random 1,000회에서 violation, empty block, unfit token이 0이다.
- interaction sequence와 export state test가 통과한다.
- desktop/mobile reference screenshot에서 overlap과 잘림이 없다.
- PNG/SVG export가 정상 동작한다.
- README가 새 module과 extension point를 설명한다.
- 구현 checkpoint와 최종 완료 커밋이 검증 범위와 commit granularity 예외를 문서화한다.

## 12. 초기 권장 시작점 기록

첫 구현은 **Phase 0과 Phase 1까지만** 진행한다.

이 두 단계에서 seed baseline과 ordered `GRID_BLOCK_POLICIES`를 먼저 확보하면 이후 파일 분리는 비교적 기계적인 작업이 된다. 반대로 baseline 없이 바로 module을 나누면 random 호출 순서, font loading, post-render finalization이 동시에 바뀌어 시각 regression의 원인을 찾기 어렵다.
