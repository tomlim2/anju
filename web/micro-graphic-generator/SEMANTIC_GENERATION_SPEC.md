# Typography-First Composition Generation Specification

## Status

- 상태: Pilot runtime implementation complete, external acceptance pending
- 재작성일: 2026-07-13
- 구현 기준일: 2026-07-14
- 대상: `web/micro-graphic-generator`
- 구현 기준: `6e65642 Add typography-first generator specification` 위 working tree
- 구현 상태: Phase A-E pilot의 runtime, curated/versioned data, deterministic planning/fallback, SVG metadata, trust/conformance tooling, automated evidence와 human-review fixture를 구현했다.
- 리뷰 상태: specification Knitten review-fix Loop 18 종료; implementation final review는 아래 자동 gate 이후 수행한다.
- 근거: `SEMANTIC_CLASSIFICATION_COLD_START_REVIEW.md`의 findings와 typography-first product definition을 반영했다.

이 문서는 이전 `Semantic Composition Generation Specification`을 대체한다. 이전 draft의 full semantic ontology, DIKW facet, 고정 semantic zone, 8개 exclusive archetype은 구현 대상으로 보지 않는다.

### Implementation Checkpoint

| Phase | 상태 | 증거 또는 남은 승인 |
| --- | --- | --- |
| A | 코드와 local candidate activation 완료 | owner ledger 1행과 `--allow-local` verifier 통과. merge-base에서 실행할 별도 reviewed trust-foundation commit은 배포 승인으로 남음 |
| B | 완료 | command/status 2-5 block universe, canonical hash, exact queue, planning oracle와 browser parity 통과 |
| C | 완료 | live plan projection, motif render, mounted finalization/validation, bounded replan/known-good, export metadata 통과 |
| D | 자동 hardening 완료 | 4 motif의 requested/downshifted 8개 cell을 frozen corpus로 확보. perceptual first-read 판정은 Phase E blind review와 함께 대기 |
| E | 도구와 fixture 완료 | expressive range는 통과. 110쌍 blind human review와 qualified translation-ledger adjudication은 사람의 입력이 필요해 pending; 후속 recipe expansion은 활성화하지 않음 |

2026-07-14 자동 증거는 pure `49/49`, browser `25/25`, Chromium Random `1,000/1,000`, expressive-range input `10,000`과 accepted output `10,000`/terminal failure `0`이다. Blind corpus `blind-evaluation:v1:e5e4298b45e1512177`는 60,000 candidate seed, 10,814 baseline-eligible row에서 counterbalanced 110쌍을 고정했고 6개 linguistic stratum과 8개 motif/finalization cell coverage를 통과했다. 전체 acceptance가 아직 false인 유일한 이유는 이 frozen corpus의 qualified human review가 제출되지 않았기 때문이다. 사람의 평가 결과나 별도 trust-root commit을 자동 생성해 통과로 기록하지 않는다.

## Product Definition

이 generator는 문장 생성기나 데이터 시각화 도구가 아니다. 한글, 영문, 중문의 짧은 단어와 문구를 주인공으로 삼아 디지털 시대의 명령, 상태, 신호, 정체성을 모듈형 micro graphic으로 만드는 **다국어 타이포그래픽 신호 생성기**다.

```text
Typography = 말하는 주체
Graphic motif = 억양과 문장부호
3x3 grid = 무대
Seeded generation = 편집자
```

결과는 완성 포스터보다 기술 라벨, SF interface fragment, 제조 sticker, 상태 카드, title unit처럼 더 큰 작업에 붙일 수 있는 독립적인 시각 재료를 목표로 한다.

## Goal

현재의 block-first 무작위 token 조합을 typography-first composition planning으로 전환한다.

1. Component마다 가장 먼저 읽히는 typography hero가 정확히 하나 있어야 한다.
2. support, metadata, graphic motif는 hero의 의미와 시각 위계를 강화해야 한다.
3. 조합은 완전한 문장일 필요는 없지만 설명 가능한 관계 또는 의도적인 긴장감을 가져야 한다.
4. 현재 3x3 physical layout, discrete size, font, orientation, export, seed 계약은 유지해야 한다.
5. Random을 반복했을 때 일관된 시각 언어 안에서 충분히 다른 결과가 나와야 한다.

## Problem

현재 생성 순서는 다음과 같다.

1. 3x3 grid를 2-5개 rectangular block으로 나눈다.
2. block 중 하나를 primary로 고른다.
3. block마다 `content`, `data`, `sign`, `graphic` kind를 고른다.
4. 해당 pool에서 fit하는 token을 선택한다.

개별 token은 physical rule을 지키지만 전체 조합은 하나의 발화로 계획되지 않는다. 이 때문에 hero가 불분명하거나, 같은 종류의 단어가 과도하게 반복되거나, 관계없는 action, state, code가 한 화면에 섞일 수 있다.

반대로 모든 단어에 universal concept, DIKW level, polarity, urgency와 고정 위치를 부여하는 것도 해결책이 아니다. 고립된 단어의 sense와 정서는 context에 따라 달라지고, 한글, 영어, 중국어 대응은 항상 정확한 번역이 아니다. 의미 분류가 커질수록 분류자의 취향이 hard rule로 굳어 결과가 단조로워질 위험이 있다.

따라서 이 spec은 full ontology 대신 **작은 lexical registry + composition recipe + sparse relation + physical planner**를 사용한다.

## Design Principles

1. **Typography leads**: v1 Component의 hero는 항상 typography다. graphic은 hero가 아니다.
2. **Message before layout**: recipe와 visible words를 먼저 고른 뒤 가능한 block plan을 찾는다.
3. **Use before universal concept**: 의미 단위는 보편 개념이 아니라 이 generator에서 승인한 `lexicalUse`다.
4. **Recipe is not semantic truth**: recipe는 결과를 만드는 편집 문법이며 단어의 절대 분류가 아니다.
5. **Plausibility over sentence correctness**: 직접 관계와 연상 가능한 긴장감을 모두 허용한다.
6. **Meaning and encoding stay separate**: 단어 의미가 size나 3x3 위치를 직접 결정하지 않는다.
7. **Graphics support the voice**: QR, barcode, table, wave는 증거가 아니라 시각적 motif다.
8. **Few hard rules, explicit soft preferences**: hard rule은 계약과 물리적 안전에 집중한다.
9. **Deterministic and observable**: 같은 전체 input은 같은 plain object plan과 결과를 만든다.
10. **Curate before scaling**: 좋은 조합과 나쁜 조합을 먼저 수집하고 필요한 규칙만 추가한다.

## Boundary

### In Scope

- 현재 vocabulary를 task-specific `lexicalUse`와 `translationSet` 기준으로 audit한다.
- hero, support, metadata, motif slot을 가진 `CompositionRecipe`를 도입한다.
- 첫 pilot은 `command`와 `status` recipe만 구현한다.
- pair relation은 작은 `prefer`, `avoid`, typed relation set으로 관리한다.
- recipe를 먼저 선택하고 valid lexical tuple과 block placement를 함께 탐색한다.
- same text, same translation set, barcode/QR 중복 규칙을 명시한다.
- `@` mention과 `#` topic tag를 fake identity/topic token으로 지원한다.
- graphic descriptor를 factual `evidence`가 아닌 `motif`로 재분류한다.
- required hero를 보존하는 deterministic fallback을 도입한다.
- structural validation, expressive-range telemetry, blind human review를 분리한다.
- current UI, native ES module, SVG render/export와 3x3 rectangular packing을 유지한다.

### Out of Scope

- full ontology, OWL, knowledge graph inference
- DIKW hierarchy와 universal semantic level
- 모든 단어의 intrinsic polarity, urgency, intent 판정
- 외부 AI, runtime embedding, 사전 API 또는 network NLP
- 자연어 문장 생성, 형태소 분석, free-form user text
- 사용자가 recipe를 선택하는 새 UI
- graphics-first mode 또는 graphic-only Component
- 새 color, typeface, stroke, token size, footprint 도입
- 현재 Compose catalog의 전면 재설계
- framework, bundler 또는 build step 도입

## Terminology

| Term | Contract |
| --- | --- |
| `Visual utterance` | 하나의 Component가 만드는 짧은 시각적 발화다. |
| `Lexical use` | 이 generator에서 승인한 하나의 문자열 사용법이다. 언어, 품사, scope를 포함한다. |
| `Translation set` | 여러 언어의 lexical use를 exact, close, adapted 관계로 연결한다. |
| `Composition recipe` | visual utterance를 만들기 위한 typed slot과 pair rule의 편집 문법이다. |
| `Hero voice` | 가장 먼저 읽혀야 하는 typography slot이다. Component당 정확히 하나다. |
| `Supporting voice` | hero의 대상, 상태, 결과, 반응 또는 맥락을 제공하는 typography다. |
| `Metadata` | code, version, timestamp, mention, hashtag 같은 작은 참조 정보다. |
| `Graphic motif` | barcode, pseudo-QR, table, wave처럼 분위기와 리듬을 만드는 graphic이다. |
| `Composition role` | 현재 plan에서 맡는 `hero`, `support`, `metadata`, `motif` 역할이다. |
| `Prominence` | 현재 plan의 시각 위계인 `primary`, `secondary`, `tertiary`다. |
| `Render taxonomy` | 기존 `form/function/role/context` metadata다. 의미 모델과 별도로 유지한다. |

## Inputs

| Input | Required | Meaning |
| --- | --- | --- |
| `seed` | Yes | valid 후보 사이의 재현 가능한 선택 |
| `generationTimestamp` | Yes | 날짜와 timestamp token을 재현하기 위한 고정 값 |
| Component ratio, viewport, border mode, safe box | Yes | 3x3 packing과 typography fit의 고정 geometry |
| Lexical registry version | Yes | use와 translation membership의 source version |
| Recipe registry version | Yes | recipe records, active recipe IDs, slot과 pair rule의 source version |
| Motif registry version | Yes | graphic motif descriptor와 render contract version |
| Config/policy version | Yes | Node/browser conformance pair, planning/mounted limits, footprint, size, alignment, orientation policy version |
| Composition engine version | Yes | materialization, tuple/layout/rank, arbitration, queue algorithm version |
| Font metrics and asset revision | Yes | pre-render prediction과 mounted font resource identity |
| Owner snapshot revision | Yes | 모든 output owner의 실제 data/source content를 묶은 digest |
| Concrete token library | Yes | typography/graphic form, intrinsic geometry, typeface |
| Typography measurer | Yes | DOM 이전 예상 fit과 orientation 평가 |
| Existing block policy | Yes | footprint별 size, alignment, orientation의 physical source |

Canonical `GenerationInput`:

```js
{
  schemaVersion: 1,
  seed: 305419896,
  generationTimestamp: "2026-07-13T12:00:00+09:00",
  ratio: "3:4",
  borderMode: "corner-stroke",
  viewport: { width: 1440, height: 1200, devicePixelRatio: 2 },
  safeBox: { x: 0, y: 0, width: 720, height: 960 },
  vocabularyVersion: 1,
  recipeVersion: 1,
  motifVersion: 1,
  configVersion: 1,
  compositionEngineVersion: 1,
  fontMetricsVersion: 1,
  fontAssetRevision: "sha256:6d4f...",
  ownerSnapshotRevision: "sha256:ab91..."
}
```

`borderMode` enum은 current renderer의 `stroke | no-stroke | corner-stroke`만 허용한다. stroke geometry가 safe box 안쪽에 그려지는지는 renderer/config의 physical rule이며 별도 `inner` enum을 만들지 않는다. `fontAssetRevision = hashCanonical(sortedFamilyAssetByteHashes)`이며 각 raw asset byte hash는 shared `sha256Hex`로 만든다. URL alias나 날짜 label은 허용하지 않는다. `ownerSnapshotRevision`은 뒤에서 정의하는 canonical `OwnerSnapshotManifest`의 content digest이며 version label을 대신하지 않고 같은 label 아래 content가 바뀌는 사고를 검출한다.

`GenerationInput`은 app이 planner 호출 전에 한 번 만들고 immutable하게 전달하는 유일한 reproducibility input이다. ratio나 border mode를 자동 선택할 때 app은 shared PRNG를 쓰지 않는다. 먼저 seed, timestamp, viewport, vocabulary/recipe/motif/config/composition-engine/font version, font asset revision, owner snapshot revision을 담은 `layoutSeedInput`을 만들고 `keyedValue(deriveSeed(layoutSeedInput, "app-layout"), "ratio" | "borderMode")`를 사용한다. 선택된 geometry로 safe box를 한 번 계산한 뒤 최종 `GenerationInput`을 고정한다.

`config.js`가 `COMPOSITION_POLICY_VERSION`을, `composition-owner-snapshot.js`가 `COMPOSITION_ENGINE_VERSION`과 generated owner manifest를, pure metrics module이 `FONT_METRICS_VERSION`을 소유한다. `generationInputHash`는 shared `hashCanonical(GenerationInput)`이며 plan, SVG, fixture가 같은 input identity를 공유한다. `seed`만으로는 vocabulary, 정책, algorithm/content snapshot, font resource, 실행 시각, viewport를 재현할 수 없다.

### Canonical Bytes And Hashing

`src/canonical-hash.js`가 composition identity용 serialization과 SHA-256의 유일한 runtime/test owner다. API는 synchronous pure `canonicalJson(value) → string`, `utf8Bytes(string) → Uint8Array`, `sha256Hex(bytes) → 64 lowercase hex`, `hashCanonical(value) → "sha256:<hex>"`다. SHA-256 core는 license와 upstream revision을 고정한 audited vendored native-ES implementation을 사용하며 새 package manager, bundler, network import를 요구하지 않는다. planner, runtime/browser code, candidate manifest emitter/verifier, planning verifier와 ordinary Node tests는 identity를 위해 직접 `JSON.stringify`, Node `createHash`, Web Crypto를 호출하지 않는다. app/export code의 raw artifact byte hash도 `"sha256:" + sha256Hex(bytes)`를 사용한다. Direct Node crypto allowlist는 결과만 비교하는 independent test harness와 merge-base에서 추출해 실행하는 bootstrap entrypoint 두 곳뿐이며, bootstrap은 아래 trust-root raw-byte/ledger 검사에만 사용되는 유일한 non-test exception이다.

`canonicalJson`은 RFC 8785 JSON Canonicalization Scheme을 따르되 입력 domain을 더 좁힌다.

- 허용 값은 `null`, boolean, string, finite IEEE-754 number, dense array, own enumerable data-property만 가진 plain object다.
- `undefined`, bigint, symbol, function, sparse array, accessor, custom prototype, `toJSON`, Date/Map/Set/typed-array object, cycle, non-finite number를 reject한다.
- object key는 RFC 8785의 UTF-16 code-unit order로 재귀 정렬하고 array order는 보존한다. number는 ECMAScript shortest round-trippable representation을 쓰며 `-0`은 `0`으로 serialize한다.
- key와 string value는 Unicode normalization을 암묵적으로 하지 않고 exact scalar sequence를 보존한다. unpaired UTF-16 surrogate는 reject한다. meaning-level normalization은 호출자가 identity payload를 만들기 전에 명시적으로 수행한다.
- canonical string은 BOM 없는 UTF-8로 encode한다. 모든 composition digest와 content revision은 `sha256:` prefix를 가진 lowercase hex다.

`tests/fixtures/canonical-hash-vectors.json`은 ASCII/한글/중문, escaped control/quote, astral code point, sorted nested key, array, fraction, exponent, `-0`의 canonical string/UTF-8 hex/SHA-256을 고정한다. Node pure test와 실제 browser test는 같은 module output을 fixture 및 Node `crypto` cross-check와 비교한다. forbidden type, lone surrogate, sparse array, cycle rejection도 양쪽에서 동일해야 한다. 이 module 또는 vendored license/upstream revision이 바뀌면 `compositionEngineVersion`과 owner snapshot을 올린다.

v1 deterministic conformance pair는 `NODE_CONFORMANCE_RUNTIME = "v22.12.0"`과 root package의 pinned Playwright `1.61.1`/project `chromium-http`를 묶은 `BROWSER_CONFORMANCE_PROFILE = "playwright-1.61.1/chromium-http"`다. root `package.json.engines.node`와 `.node-version`은 각각 exact `22.12.0`을 선언하고 CI는 그 file로 runtime을 설치한다. generator test setup은 어떤 fixture보다 먼저 `process.version`, package engine, `.node-version`, Playwright package version과 project ID를 exact 비교하고 하나라도 다르면 실행을 실패시킨다. 이 문서의 “actual browser” 또는 browser parity는 이 exact Node runtime과 exact Chromium profile 사이의 cross-runtime parity를 뜻하며 Firefox/WebKit까지 검증했다는 의미가 아니다. 다른 engine에서도 current UI는 열릴 수 있지만 composition replay/acceptance 지원을 선언하려면 config-versioned conformance pair에 engine/runtime을 추가하고 canonical-hash vectors, structural projection, transformed bounds와 occupancy fixtures를 tolerance 없이 통과시켜야 한다. Node/package/profile/browser revision이 바뀌면 `configVersion`과 owner snapshot을 올린다.

## Outputs

| Output | Persistence | Meaning |
| --- | --- | --- |
| `CompositionPlan` | Runtime/test fixture | recipe, lexical uses, slots, block assignment, requested size |
| `PlannerResult` | Runtime/test fixture | recipe arbitration, initial selection, immutable same-recipe search queue |
| Finalization report | Runtime/SVG metadata | actual size/bounds/occupancy, fallback tier, fit 결과 |
| `AttemptResult` | Runtime/test fixture | envelope, finalization, validation, definitive accept/reject |
| Terminal result | Runtime/test fixture | last attempt, preserved display/export identity, failure reason |
| SVG metadata | Exported SVG | recipe, lexical use, translation set, composition role, prominence |
| Structural validation | Runtime/test | schema, duplicate, hierarchy, physical contract |
| Expressive-range report | Test artifact | recipe, token, language, footprint, fallback 빈도 |
| Human review set | Repository | approved positive/negative examples와 blind comparison 결과 |

## Data Model

### Existing Render Taxonomy

아래 축은 renderer, font weight, catalog 호환을 위해 유지한다.

```text
form      typography | graphic
function  content | data | symbol | sign
context   component | primitive-detail | catalog-ui
role      action-keyword | status-code | barcode | ...
```

이 필드는 token이 어떻게 렌더되는지 설명한다. 새로운 composition meaning을 `function`이나 `role`에서 암묵적으로 추론하지 않는다.

### Lexical Use

```js
{
  id: "upgrade.command.en",
  text: "UPGRADE",
  language: "en",
  script: "latin",
  typeface: "english",
  partOfSpeech: "verb",
  tags: ["action"],
  domains: ["system"],
  marker: null,
  displayClass: "long",
  scopeNote: "Imperative action applied to a system or version.",
  examples: ["UPGRADE + SYSTEM", "UPGRADE + V1.2"],
  counterExamples: ["UPGRADE + FOREST"],
  phrasePackId: null,
  source: "curated",
  reviewStatus: "approved"
}
```

Initial authoring tags:

```text
action | state | result | identity | topic |
modifier | value | reference | greeting
```

Initial soft domains:

```text
system | network | file | media | commerce |
social | production | interface | nature
```

Rules:

- `id`는 registry 안에서 유일하다.
- `language` enum은 전 문서와 runtime에서 `en | ko | zh`, `script` enum은 `latin | hangul | han`이다. lexical record, blind stratum, reviewer qualification, ledger adjudication은 같은 language key를 사용한다.
- recipe compatibility가 달라질 때만 use를 분리한다.
- 한 use는 여러 tag를 가질 수 있다.
- `tags`는 recipe slot compatibility에 사용하고 `domains`는 검색과 authoring suggestion에만 사용한다.
- `displayClass`는 `short | medium | long | phrase`의 authoring fit hint이며 token size를 결정하지 않는다.
- `intent`, `polarity`, `urgency`, `prominence`, size, position은 lexical use에 고정하지 않는다.
- `@...`는 `identity` tag와 `marker: "mention"`을 사용한다.
- `#...`는 `topic` tag와 `marker: "hashtag"`를 사용한다.
- organization과 person은 별도 use이며 `@`를 organization의 장식 prefix로 자동 사용하지 않는다.
- dynamic date, serial, code는 stable family ID, pre-materialization ordinal/key, concrete `instanceKey`를 함께 가진다.
- complete phrase lexical use는 non-null `phrasePackId`를 가진다. 일반 단어는 `null`이다.
- unreviewed use는 pilot recipe의 required slot에 들어갈 수 없다.

### Translation Set

```js
{
  id: "upgrade.command",
  gloss: "Cause a system or product to move to a newer version.",
  members: [
    { lexicalUseId: "upgrade.command.en", equivalence: "exact" },
    { lexicalUseId: "upgrade.command.ko", equivalence: "close" },
    { lexicalUseId: "upgrade.command.zh", equivalence: "exact" }
  ]
}
```

Rules:

- `exact`, `close`, `adapted`를 구분한다.
- 지원 언어마다 member가 반드시 존재할 필요는 없다.
- membership과 equivalence의 source of truth는 translation set이다. lexical use에 같은 정보를 중복 저장하지 않는다.
- 하나의 `lexicalUseId`는 registry 전체에서 최대 한 translation set의 member일 수 있다. 둘 이상의 set에 나타나면 registry validation을 실패시키며 first/last-write 선택을 하지 않는다.
- `composition-model.js`가 uniqueness validation을 통과한 registry에서만 singular lexical-use-to-set index를 파생한다.
- 현재 `actionTokens`의 세 언어 묶음은 exact translation으로 가정하지 않고 전부 재검토한다.
- duplicate suppression은 visible text와 translation set을 별도 key로 검사한다.
- 같은 translation set의 다국어 반복은 기본 금지한다.
- 후속 `multilingual-echo` recipe만 최대 2개 variant를 명시적으로 허용할 수 있다.

Translation-error ledger는 `vocabulary.js`가 lexical/translation records와 함께 소유하고 `vocabularyVersion`으로 함께 versioning한다.

```js
{
  id: "translation-error:upgrade-ko-001",
  translationSetId: "upgrade.command",
  lexicalUseId: "upgrade.command.ko",
  status: "open",
  disposition: null,
  adjudicatorIds: ["reviewer-ko-01", "reviewer-ko-02"],
  evidence: "Scope note does not match the command use."
}
```

`status`는 `open | resolved | waived`다. approved translation member의 “known error”는 ledger에 `open`으로 남은 record를 뜻한다. `resolved`와 `waived`는 두 명의 해당 언어 qualified adjudicator ID와 disposition을 요구한다.

### Relation Edge Registry

`composition-recipes.js`가 recipe와 함께 directed `relationEdges`의 유일한 owner다. edge가 추가·삭제·변경되면 `recipeVersion`을 증가시킨다.

```js
[
  {
    id: "edge.upgrade-acts-on-system",
    from: { translationSetId: "upgrade.command" },
    relation: "actsOn",
    to: { translationSetId: "system.topic" },
    directed: true,
    reviewStatus: "approved"
  },
  {
    id: "edge.access-denied-state-of-system",
    from: { translationSetId: "access-denied.status" },
    relation: "stateOf",
    to: { translationSetId: "system.topic" },
    directed: true,
    reviewStatus: "approved"
  },
  {
    id: "edge.retry-recovery-for-access-denied",
    from: { translationSetId: "retry.command" },
    relation: "recoveryFor",
    to: { translationSetId: "access-denied.status" },
    directed: true,
    reviewStatus: "approved"
  }
]
```

Selector and matching contract:

- `from`과 `to`는 각각 `lexicalUseId | translationSetId | tag` 중 정확히 하나만 가진다.
- `lexicalUseId`는 selected slot의 exact use ID, `translationSetId`는 derived membership, `tag`는 lexical use tag membership과 비교한다.
- edge는 항상 directed다. reverse match가 필요하면 별도 edge record를 작성한다.
- `reviewStatus: "approved"` edge만 generation에 사용한다.
- `alternateOf` edge는 exact `lexicalUseId` endpoint 둘과 non-negative integer `priority`를 추가로 요구한다. `from`이 alternate, `to`가 original use다.
- selector의 canonical key는 실제로 존재하는 sole discriminator와 값의 tuple인 `[kind, value]`다. 예: `["translationSetId", "upgrade.command"]`.
- edge duplicate key는 `[from.kind, from.value, relation, to.kind, to.value]`의 shared `canonicalJson`이다. registry는 이 key나 edge `id`가 같은 record를 중복 허용하지 않으며 lexical-use, translation-set, tag selector 모두 같은 규칙을 쓴다.
- direct clause는 `fromSlot` candidate가 edge `from`, relation name, `toSlot` candidate가 edge `to`를 모두 만족할 때만 match한다.
- `requiredRelations` clause는 `{ fromSlot, relations, toSlot, whenSlotPresent? }`다. unconditional clause는 `whenSlotPresent`를 생략한다. conditional clause의 condition은 cardinality가 `0..1`인 `fromSlot` 또는 `toSlot`과 같아야 하며, 그 slot instance가 선택됐을 때만 active hard gate가 된다. 반대 endpoint는 required slot이어야 한다.
- `pairRules.avoid` record의 exact shape는 `{ id, from, to }`이며 `relation` field를 허용하지 않는다. `from`/`to`는 edge selector와 같은 exclusive discriminator shape를 쓰고 duplicate key는 `[from.kind, from.value, to.kind, to.value]`다.
- avoid matcher는 selected lexical slot instance를 ID ascending으로 정렬한 뒤 모든 ordered distinct pair `(fromInstance, toInstance)`를 `[fromInstance.id, toInstance.id]` ascending으로 검사한다. rule `from`과 `to`가 각각 같은 방향의 candidate를 match하면 relation edge 유무와 무관하게 tuple을 reject한다. self-pair는 검사하지 않고 reverse 방향은 별도 avoid record가 있어야 match한다.
- 여러 avoid가 match하면 rejection reason은 `avoid:<ruleId>:<fromSlotInstanceId>:<toSlotInstanceId>`이고 위 pair order 다음 rule ID order로 stable sort한다. recipe validation은 duplicate rule ID/key와 forbidden `relation` field를 reject한다.
- evaluation order는 recipe-local direct `avoid` reject → 모든 active `requiredRelations` edge gate → edge-backed `prefer` ranking이다. `pairRules`는 edge를 생성하지 않으며 `prefer`나 `requiredRelations`는 relation registry에 없는 relation을 근거로 tuple을 valid하게 만들 수 없다.

Positive direct fixtures:

| Recipe | Hero selector | Relation | Subject selector | Expected |
| --- | --- | --- | --- | --- |
| `command` | `translationSetId=upgrade.command` | `actsOn` | `translationSetId=system.topic` | valid |
| `status` | `translationSetId=access-denied.status` | `stateOf` | `translationSetId=system.topic` | valid |

Conditional recovery fixtures:

| Recovery selector | Relation | Hero selector | Recovery selected | Expected |
| --- | --- | --- | --- | --- |
| `translationSetId=retry.command` | `recoveryFor` | `translationSetId=access-denied.status` | yes | valid |
| `translationSetId=upgrade.command` | none | `translationSetId=access-denied.status` | yes | invalid |
| none | n/a | `translationSetId=access-denied.status` | no | conditional clause inactive |

Avoid fixtures:

| From lexical slot | To lexical slot | Declared avoid | Expected |
| --- | --- | --- | --- |
| `translationSetId=upgrade.command` | `lexicalUseId=forest.topic.en` | same direction | invalid |
| `lexicalUseId=forest.topic.en` | `translationSetId=upgrade.command` | forward only | no avoid match |
| `translationSetId=upgrade.command` | same slot instance | same direction | self-pair skipped |
| `translationSetId=upgrade.command` | `lexicalUseId=system.topic.en` | none | no avoid match |

### Graphic Motif

```js
{
  id: "motif.pseudo-qr",
  graphicType: "pseudo-qr",
  form: "graphic",
  function: "data",
  role: "pseudo-qr",
  motifTags: ["machine-readable-mark"],
  factual: false,
  uniqueWithinComponent: true,
  maxProminence: "secondary",
  occupancySafetyFactor: 1.35,
  occupancyCalibrationRevision: "sha256:7c31..."
}
```

Rules:

- `motifs.js`가 motif record와 `MOTIF_REGISTRY_VERSION`의 유일한 owner다. `GenerationInput.motifVersion`은 이 값을 고정한다.
- fake barcode, pseudo-QR, table, wave는 `evidence`가 아니다.
- initial motif tags는 `machine-readable-mark`, `data-table-look`, `signal-plot-look`, `badge`로 제한한다.
- 실제 data input과 provenance가 생기기 전까지 `factual`은 항상 false다.
- graphic motif는 hero slot과 primary prominence를 가질 수 없다.
- barcode와 pseudo-QR은 각각 Component당 최대 하나다.
- 모든 active motif는 default 없는 finite positive `occupancySafetyFactor`와 calibration revision을 가진다. Initial reviewed values는 `barcode=1.20`, `pseudo-qr=1.35`, `table=0.75`, `wave=0.65`다.
- `tests/fixtures/motif-occupancy-calibration.json`은 exact Chromium profile에서 canonical intrinsic viewBox를 512×512 transparent canvas에 actual fill/stroke/opacity로 render한 모든 declared variant의 opacity-weighted painted-pixel coverage와 p95, factor, typography/product reviewer IDs를 고정한다. active motifs 사이 p95 coverage가 더 큰 family의 factor가 더 작을 수 없다.
- factor는 perceptual truth가 아니라 family별 conservative geometry margin이다. renderer, renderParams, opacity/stroke policy, factor 또는 calibration fixture가 바뀌면 `motifVersion`, calibration revision과 owner snapshot을 함께 올리고 review를 다시 통과한다. Runtime은 canvas를 읽지 않고 approved factor만 plan/context에서 사용한다.

### Composition Recipe

```js
{
  id: "command",
  coherenceMode: "direct",
  blockCount: { min: 2, max: 5 },
  slots: [
    {
      id: "hero",
      compositionRole: "hero",
      cardinality: { min: 1, max: 1 },
      source: "lexical",
      acceptsAnyTag: ["action"],
      prominence: "primary"
    },
    {
      id: "subject",
      compositionRole: "support",
      cardinality: { min: 1, max: 1 },
      source: "lexical",
      acceptsAnyTag: ["topic", "identity"],
      prominence: "secondary"
    },
    {
      id: "meta",
      compositionRole: "metadata",
      cardinality: { min: 0, max: 2 },
      source: "lexical",
      acceptsAnyTag: ["reference", "value"],
      prominence: "tertiary"
    },
    {
      id: "motif",
      compositionRole: "motif",
      cardinality: { min: 0, max: 1 },
      source: "graphic",
      prominence: "secondary"
    }
  ],
  requiredRelations: [
    { fromSlot: "hero", relations: ["actsOn"], toSlot: "subject" }
  ],
  pairRules: {
    prefer: [{
      id: "command.target-affinity",
      from: { translationSetId: "upgrade.command" },
      relation: "actsOn",
      to: { lexicalUseId: "system.topic.en" }
    }],
    avoid: [{
      id: "command.forest-avoid",
      from: { translationSetId: "upgrade.command" },
      to: { lexicalUseId: "forest.topic.en" }
    }]
  },
  layoutPreferences: {
    hero: ["largest-viable-footprint"],
    meta: ["edge", "corner"]
  }
}
```

Recipe는 semantic category가 아니다. 한 결과가 status와 warning의 성격을 함께 가져도 생성에 사용한 recipe만 기록한다.

Cardinality contract:

- `cardinality.min > 0`인 slot definition이 required다. 별도 `required` boolean은 두지 않는다.
- 선택한 slot instance 수는 `blockCount` 범위 안에 있고 최종 block 수와 정확히 같아야 한다.
- slot instance ID는 recipe 안에서 `${slotDefinitionId}-${ordinal}` 형식으로 유일하다. 예: `hero-1`, `meta-1`, `meta-2`.
- 각 slot instance는 정확히 한 block에 배정되고, 각 block은 정확히 한 `slotInstanceId`를 참조한다.
- pilot의 `command`와 `status` recipe는 preserved layout contract의 2, 3, 4, 5 block plan을 모두 표현할 수 있어야 한다.
- `layoutPreferences`의 모든 key는 같은 recipe에 선언된 exact slot definition ID여야 한다. `metadata` 같은 role alias나 unknown key는 recipe validation에서 reject한다.

Normative `status` pilot recipe:

```js
{
  id: "status",
  coherenceMode: "direct",
  blockCount: { min: 2, max: 5 },
  slots: [
    {
      id: "hero",
      compositionRole: "hero",
      cardinality: { min: 1, max: 1 },
      source: "lexical",
      acceptsAnyTag: ["state", "result"],
      prominence: "primary"
    },
    {
      id: "subject",
      compositionRole: "support",
      cardinality: { min: 1, max: 1 },
      source: "lexical",
      acceptsAnyTag: ["topic", "identity"],
      prominence: "secondary"
    },
    {
      id: "recovery",
      compositionRole: "support",
      cardinality: { min: 0, max: 1 },
      source: "lexical",
      acceptsAnyTag: ["action"],
      prominence: "secondary"
    },
    {
      id: "meta",
      compositionRole: "metadata",
      cardinality: { min: 0, max: 1 },
      source: "lexical",
      acceptsAnyTag: ["reference", "value"],
      prominence: "tertiary"
    },
    {
      id: "motif",
      compositionRole: "motif",
      cardinality: { min: 0, max: 1 },
      source: "graphic",
      prominence: "secondary"
    }
  ],
  requiredRelations: [
    { fromSlot: "hero", relations: ["stateOf", "resultOf"], toSlot: "subject" },
    {
      fromSlot: "recovery",
      relations: ["recoveryFor"],
      toSlot: "hero",
      whenSlotPresent: "recovery"
    }
  ],
  pairRules: {
    prefer: [{
      id: "status.recovery-affinity",
      from: { tag: "action" },
      relation: "recoveryFor",
      to: { tag: "state" }
    }],
    avoid: []
  },
  layoutPreferences: {
    hero: ["largest-viable-footprint"],
    meta: ["edge", "corner"]
  }
}
```

Pilot cardinality fixture matrix:

| Recipe | Blocks | Selected slot instances | Canonical cells in slot order |
| --- | ---: | --- | --- |
| `command` | 2 | `hero-1`, `subject-1` | `[1,2,3,4,5,6]`; `[7,8,9]` |
| `command` | 3 | `hero-1`, `subject-1`, `meta-1` | `[1,2,3]`; `[4,5,6]`; `[7,8,9]` |
| `command` | 4 | `hero-1`, `subject-1`, `meta-1`, `meta-2` | `[1,2,4,5]`; `[3]`; `[6]`; `[7,8,9]` |
| `command` | 5 | `hero-1`, `subject-1`, `meta-1`, `meta-2`, `motif-1` | `[1,2,4,5]`; `[3]`; `[6]`; `[7,8]`; `[9]` |
| `status` | 2 | `hero-1`, `subject-1` | `[1,2,3,4,5,6]`; `[7,8,9]` |
| `status` | 3 | `hero-1`, `subject-1`, `recovery-1` | `[1,2,3]`; `[4,5,6]`; `[7,8,9]` |
| `status` | 4 | `hero-1`, `subject-1`, `recovery-1`, `meta-1` | `[1,2,4,5]`; `[3]`; `[6]`; `[7,8,9]` |
| `status` | 5 | `hero-1`, `subject-1`, `recovery-1`, `meta-1`, `motif-1` | `[1,2,4,5]`; `[3]`; `[6]`; `[7,8]`; `[9]` |

각 matrix row는 slot order와 cell list를 zip해 만드는 minimum conformance fixture다. cell list는 rectangular allowed footprint이고 합집합이 1-9이며 중복이 없다. 다른 optional 조합도 schema와 direct relation gate를 만족하면 허용한다.

## Recipe Catalog

| Recipe | Hero requirement | Supporting intent | Phase |
| --- | --- | --- | --- |
| `command` | action typography | target, modifier, version, reference | Pilot |
| `status` | state/result typography 또는 primary-eligible atomic status phrase | subject, recovery action, protocol code | Pilot |
| `process` | action/process typography | related action, result, reference | Expansion |
| `identity` | identity/title typography | state, topic, mention, hashtag | Expansion |
| `signal` | signal/topic/state typography | value, reference, signal motif | Expansion |
| `editorial-fragment` | approved hero typography | evocative but curated support | Experimental |
| `multilingual-echo` | one approved lexical use | same translation set의 language echo | Experimental |

Pilot은 `command`와 `status`만 구현한다. 나머지는 pilot이 current baseline보다 좋은 결과를 만든다는 증거가 생긴 뒤 추가한다.

`coherenceMode`:

- `direct`: 모든 active `requiredRelations` clause가 selected slot instances 사이의 curated typed edge와 일치해야 hard-valid다. `prefer`만 있거나 active edge가 없는 tuple은 valid가 아니다.
- `evocative`: 공통 context나 의도적인 대비가 설명 가능하면 허용한다.
- `random` mode는 없다. 설명할 수 없는 조합은 기존 random baseline에 남고 recipe pipeline에는 들어오지 않는다.

Direct-mode no-match behavior:

- v1의 모든 `requiredRelations` clause에서 `fromSlot`과 `toSlot` definition은 `cardinality.max === 1`이어야 한다. unconditional endpoint는 minimum도 1이고, conditional clause의 optional endpoint만 minimum 0을 허용한다. optional endpoint가 선택되면 유일한 from/to instance pair가 생긴다. repeated slot definition을 required endpoint로 선언한 recipe는 registry validation에서 reject하며 quantified any/every/matching semantics는 v1에 없다.
- 그 유일한 selected from/to lexical-use pair에서 clause의 `relations` 중 하나가 directed relation graph에 존재해야 한다.
- `avoid` match는 required edge가 있어도 항상 reject한다. `prefer`는 hard-valid tuple 사이의 ranking에만 사용한다.
- 한 recipe에 matching tuple이 없으면 planner는 그 recipe에서 candidate 0개를 반환하고 다음 eligible recipe를 평가한다. unmatched direct tuple을 metadata-only plan으로 완화하지 않는다.

## Typography-First Hierarchy Contract

1. Component마다 `hero` slot이 정확히 하나 있다.
2. hero source는 항상 `typography`다.
3. hero는 `primary` prominence를 독점한다.
4. support typography는 hero의 대상, 상태, 결과, 반응 또는 맥락 중 하나를 제공한다.
5. metadata는 code, version, timestamp, mention, hashtag 같은 참조 정보다.
6. motif는 선택 사항이며 pilot에서는 최대 하나다.
7. motif는 가장 큰 typography-only footprint인 `2x3`, `3x2`를 사용할 수 없다.
8. 모든 block에는 direct token이 정확히 하나 있고 empty block은 만들지 않는다.
9. complete phrase는 atomic token으로 유지하고 `phrasePackId`를 기록한다.
10. visual hierarchy는 의미 분류가 아니라 recipe slot과 physical fit의 결과다.

Structural hierarchy comparator:

- discrete typography size order는 `small < medium < large < xlarge < xxlarge < xxxlarge`다.
- token weight label enum은 기존대로 `normal | bold`만 사용한다. SVG에 적용되는 numeric font weight enum은 `400 | 700 | 900`이며 `normal=400`, `bold=700|900`이다.
- content typography의 `large+`는 `bold`다. bold `xxlarge|xxxlarge`는 `900`, bold `large`는 `700`이다. bold `xlarge`는 해당 block policy의 `xlargeWeight === 900`이면 `900`, 아니면 `700`이다. 그 밖의 typography는 `normal/400`이다.
- 모든 support/metadata typography의 actual size는 hero actual size 이하여야 한다.
- support/metadata가 hero와 같은 actual size라면 `actualFontWeight`가 반드시 더 낮아야 한다. numeric order는 `400 < 700 < 900`이다.
- 더 낮은 weight를 만들 수 없으면 해당 support/metadata를 다음 작은 discrete size로 내린다. 그래도 불가능하면 plan을 reject한다.
- motif block area는 hero block area보다 작아야 하고 graphic intrinsic size는 최대 `large`다.
- plan block은 typography에 `requestedWeight`와 `requestedFontWeight`를 기록한다. finalization report block은 `actualWeight`와 `actualFontWeight`를 기록하고 실제 SVG의 `data-token-weight`/`font-weight`와 일치시킨다.
- finalization으로 actual size나 weight가 바뀐 뒤 이 comparator를 다시 적용한다. 하나라도 깨지면 mounted plan은 reject한다.

## Compatibility Rules

### Hard Constraints

- known recipe와 valid schema
- recipe `blockCount`, slot cardinality, unique slot-instance identity 충족
- slot instance와 block의 일대일 참조 및 3x3 완전 피복
- direct recipe의 모든 active `requiredRelations` clause 충족
- hero typography 정확히 하나
- slot이 선언한 source와 accepted tag 충족
- explicit `avoid` pair 금지
- normalized visible text duplicate 금지
- 같은 translation set duplicate 기본 금지
- atomic phrase 내부 분해 금지
- `http-status` code는 protocol status context에서만 status 의미를 가짐
- generic numeric code는 별도 reference use로 취급
- barcode와 pseudo-QR 각각 최대 하나
- graphic hero와 primary graphic 금지
- current footprint, orientation, fit, weight, stroke rule 충족

### Soft Objectives

- hard-required가 아닌 typed relation 또는 curated pair affinity
- hero와 support의 설명 가능한 관계
- recipe slot hierarchy
- language와 script mix
- layout preference
- token usage frequency balance (runtime rank 입력이 아닌 telemetry/editorial review 대상)
- novelty와 expressive range (runtime rank 입력이 아닌 telemetry/editorial review 대상)
- direct coherence와 evocative tension의 recipe별 목표

Initial typed relations:

```text
actsOn | stateOf | resultOf | references |
recoveryFor | modifies | identifies | echoOf | alternateOf
```

relation graph는 exhaustive ontology가 아니다. 실제 good/bad example을 설명하는 edge만 작성한다. broad domain tag는 검색과 후보 축소에만 쓰고 hard compatibility gate로 사용하지 않는다.

pair rule은 recipe 안에서 유일한 stable `id`를 가져야 한다. selector는 `lexicalUseId`, `translationSetId`, `tag` 중 하나를 명시하는 object여야 하며 의미가 불분명한 naked string key는 허용하지 않는다.

## Spatial And Physical Contract

`src/config.js`의 `GRID_BLOCK_POLICY_BY_FOOTPRINT`가 physical source of truth다. composition planner는 이를 복제하거나 덮어쓰지 않는다.

Preserved invariants:

- 3x3 cell을 gap 없이 2-5개 rectangular block으로 완전히 덮는다.
- footprint는 `1x1`, `2x2`, `1x2`, `1x3`, `2x3`, `2x1`, `3x1`, `3x2`만 사용한다.
- token size는 `small 8`, `medium 16`, `large 32`, `xlarge 64`, `xxlarge 128`, `xxxlarge 256px`만 사용한다.
- token intrinsic geometry를 `scale()`, `textLength`, 연속 font size로 왜곡하지 않는다.
- `3x1`, `1x3`, `3x2`, `2x3`는 center/middle policy를 유지한다.
- `2x2`는 origin 기반 position을 유지한다.
- CJK vertical typography는 glyph-sideways-stack, Latin은 whole-rotate의 current policy를 유지한다.
- same footprint sync group에서 하나가 작아지면 같은 requested group의 typography actual size를 함께 맞춘다.
- content typography의 `normal|bold` label, `400|700|900` effective font weight, line-height `1`, active `thin` stroke 규칙을 유지한다.
- block outline toggle은 plan과 token 선택을 바꾸지 않는다.

Position은 universal semantic zone이 아니다.

- hero는 fit 가능한 block 중 가장 강한 hierarchy를 만드는 block을 선호한다.
- support와 metadata는 recipe별 soft layout preference를 사용한다.
- top-right가 항상 status이고 bottom-right가 항상 evidence라는 규칙은 두지 않는다.
- reading order와 balance는 human evaluation 및 recipe preference로 검증한다.

Hard validity, cardinality, required-relation completeness는 rank 항목이 아니라 candidate filter다. filter를 통과한 plan만 아래 canonical pilot rank를 계산한다.

Canonical rank fields:

`composition-plan-validator.js`의 pure `derivePlanRankFacts`가 아래 field 계산과 `PlanRankFacts` 조립의 유일한 owner다. planner는 returned `rankKey`를 비교만 한다.

- `preferRuleMatchCount`: recipe의 각 `pairRules.prefer` rule은 selected lexical slot instance의 ordered pair와 approved relation edge가 selector/relation을 모두 만족하면 1, 아니면 0이다. 한 rule이 여러 pair와 match해도 최대 1이며 모든 rule 값을 합한다.
- `heroSizeRank`: `small=0`, `medium=1`, `large=2`, `xlarge=3`, `xxlarge=4`, `xxxlarge=5`다.
- `heroWeightRank`: hero block의 `requestedFontWeight`가 `400=0`, `700=1`, `900=2`다. `requestedWeight` label만으로 rank를 추론하지 않는다.
- `heroBlockArea`: hero block의 `cells.length`다.
- `minNormalizedFitMargin`: 각 block의 usable box와 predicted final intrinsic bounds로 `min((usableWidth - predictedWidth) / usableWidth, (usableHeight - predictedHeight) / usableHeight)`를 계산하고 plan 전체 최솟값을 취한다. Typography plan block은 footprint policy의 start `requestedSize`를 보존하고, injected pure measurer가 같은 lexical use의 ordered discrete fallback에서 처음 fit하는 size/weight를 predicted final bounds로 사용한다. Motif는 materialized intrinsic bounds를 사용한다. 어떤 typography fallback도 fit하지 않으면 hard-invalid다. `Math.round(value * 1e6) / 1e6`로 정규화하고 `-0`은 `0`으로 바꾼다. hard-valid plan이므로 값은 0 이상이다. fit은 이미 hard gate이므로 이 margin은 fitting plans 사이에서 hero hierarchy 뒤의 여유 공간 tie-breaker다.
- Retained decision은 같은 predicted bounds와 reviewed motif factor로 finalizer와 동일한 정규화 면적 산식을 적용한 보수적 cross-kind preflight도 통과해야 한다. Predicted motif score가 predicted typography hero score보다 크거나 같으면 hard-invalid다. 이 preflight는 명백히 실패할 후보를 mount 전에 제거할 뿐이며, approved font의 실제 transformed bounds를 사용하는 mounted occupancy gate를 대체하지 않는다.
- `layoutPreferenceMatchCount`: 각 declared `<slotDefinitionId, predicate>` pair는 해당 slot definition의 block 중 하나라도 predicate를 만족하면 1, 아니면 0이며 최대 1이다. `largest-viable-footprint`는 `deriveTupleLayoutFacts`가 만든 같은 tuple의 viable layout set에서 해당 slot이 얻을 수 있는 최대 cell count와 같음, `edge`는 block이 3x3 외곽 row/column에 닿음, `corner`는 cell `1|3|7|9` 중 하나를 포함함을 뜻한다. viable set은 reserved known-good와 동일한 layout도 포함한다. reservation은 queue eligibility만 바꾸고 plan-local rank explanation은 바꾸지 않는다. 이 세 predicate 이외의 값은 recipe validation에서 reject한다.

모든 항목은 큰 값이 우선이며 `RankKey`를 다음 순서로 lexicographic compare한다.

```text
[
  preferRuleMatchCount,
  heroSizeRank,
  heroWeightRank,
  heroBlockArea,
  minNormalizedFitMargin,
  layoutPreferenceMatchCount
]
```

정규화된 여섯 값이 모두 같을 때만 top tie다. top tie는 `planId` ascending으로 stable sort한다. `selectionRandomSource()`는 `[0, 1)`의 값 `u`를 정확히 한 번 반환하고 `selectedTieIndex = min(tieCount - 1, floor(u * tieCount))`로 initial plan을 고른다. tie가 하나여도 draw는 한 번 소비한다. 사용 이력, accepted-output 빈도, novelty, diversity는 pilot runtime rank나 planner input에 들어가지 않으며 expressive-range telemetry와 editorial review에서만 다룬다.

### Recipe-First Arbitration

Composition arbitration은 서로 다른 recipe의 plan을 한 rank space에 섞지 않는다.

1. `PlanValidationContext.activeRecipeIds`를 exact canonical order로 읽는다. `composition-recipes.js`가 `recipeVersion`별 non-empty, unique, ascending active set을 소유하며 pilot v1은 `command`, `status`다. universe derivation이나 planner가 registry 전체를 active로 간주하거나 ID를 hard-code하지 않는다.
2. `recipeChoiceValue = keyedValue(deriveSeed(generationInput, "recipe-choice"), "active-pilot")`를 계산한다. 값의 범위는 `[0, 1)`이고 mutable random draw를 소비하지 않는다.
3. `recipeStartIndex = min(recipeCount - 1, floor(recipeChoiceValue * recipeCount))`를 계산하고 active IDs를 그 index부터 rotate해 immutable `recipeOrder`를 만든다.
4. validator-owned `deriveRankedPlanUniverse`가 app이 미리 검증한 `knownGoodPlanByRecipeId`의 plan ID를 complete identity materialization 뒤 reserved로 제외한다. `recipeOrder` 순서대로 complete canonical semantic tuple, hard compatibility, layout, predicted fit을 평가하고 non-reserved hard-valid plan이 하나 이상인 첫 recipe를 `selectedRecipeId`로 고정한다. 이후 recipe는 이 generation에서 plan 후보로 만들지 않는다.
5. ranking, top tie, validator-owned `searchQueue`의 세 ranked tier는 모두 `selectedRecipeId` 안에서만 동작한다. queue reject나 exhaustion은 다른 recipe로 넘어가지 않는다.
6. 모든 recipe가 non-reserved ranked plan 0개이면 `selectedRecipeId: null`인 no-candidate result다. 이때만 app은 `recipeOrder` 순서에서 `knownGoodPlanByRecipeId`의 첫 plan을 한 번 시도한다. ranked queue가 있었던 generation의 known-good lookup은 반드시 `selectedRecipeId`와 같은 reserved plan만 사용한다.

이 계약은 recipe를 전역 semantic category로 만들지 않으면서 한 Component의 발화 의도가 retry 중 command에서 status로 바뀌는 것을 막는다. recipe weighting이나 user selector가 추가되면 `recipeVersion`과 이 arbitration contract를 함께 변경한다.

## Generation Pipeline

```text
1. app이 verified owner manifest를 선택하고 immutable GenerationInput과 generationInputHash 고정
2. GenerationInput에서 recipe-choice/materialization/selection label seed를 각각 파생
3. keyed materialization으로 regular와 known-good static lexical candidate family, graphic motif candidate 생성
4. manifest/version/content identity를 확인한 frozen PlanValidationContext 생성
5. compatible KnownGoodTemplate를 normal plan으로 instantiate/complete-validate해 recipe별 reserved map 고정
6. validator가 canonical semantic tuple 전체에서 first-viable RankedPlanUniverse 고정
7. planner가 최고 동순위 집합의 시작점만 selection stream으로 선택
8. validator가 universe 전체를 exact tier partition한 same-recipe queue 도출
9. composed validation을 통과한 frozen PlannerResult를 app generation snapshot에 보존
10. detached SVG render
11. mount 후 role-preserving size finalization report 생성
12. finalization accept이면 read-only structural/physical validation 실행
13. app이 envelope, finalization, validation을 definitive AttemptResult로 결합
14. attempt telemetry 기록 후 reject이면 app이 max-8 same-recipe ranked prefix 안에서만 다음 cursor로 replan하고 stop reason 뒤 known-good 전환
15. accepted output 또는 terminal failure의 display/export/telemetry 기록
```

bounded candidate space에서는 외부 CSP solver를 도입하지 않는다. stable enumeration과 hard filtering으로 충분하지 않다는 측정 결과가 있을 때만 solver를 검토한다.

## Fallback Contract

Required typography fallback:

```text
mounted same-token discrete size downshift
→ bounded queue prefix {
    same tuple remaining layout plans
    → pre-approved alternate tuple plans
    → remaining direct-valid replan candidates
  }
→ reserved known-good plan
```

Rules:

- `grid-finalizer.js`는 같은 visible token의 size downshift와 position nudge만 수행한다.
- finalizer는 매 mounted attempt마다 `FinalizationReport`를 반환하며 다음 plan을 선택하지 않는다.
- finalizer는 lexical use, translation set, recipe, vocabulary, random을 참조하지 않는다.
- lexical alternate 선택은 render 전에 plan에 기록한다.
- required hero를 neutral metadata나 cell index로 교체하지 않는다.
- required hero가 `small`에서도 fit하지 않으면 해당 plan을 reject한다.
- optional metadata만 같은 metadata slot의 safe alternate를 사용할 수 있다.
- replan과 reserved known-good fallback은 random을 추가 소비하지 않고 stable candidate order를 사용한다.
- `config.js`의 `MAX_MOUNTED_RANKED_ATTEMPTS = 8`이 한 generation에서 DOM에 mount할 ranked queue prefix의 hard limit다. 이 값이 바뀌면 `configVersion`과 owner snapshot을 올린다.
- full `PlannerResult.searchQueue`는 completeness validation과 telemetry를 위해 잘라내지 않는다. app만 `rankedAttemptLimit = min(searchQueue.length, MAX_MOUNTED_RANKED_ATTEMPTS)`를 계산하고 cursor `0..rankedAttemptLimit-1`만 mount한다.
- attempted prefix가 모두 reject되면 `rankedAttemptLimit < searchQueue.length`일 때 `attempt-budget-exhausted`, 같을 때 `queue-exhausted`로 known-good에 즉시 전환한다. remaining queue entry는 mount하지 않는다.
- fallback 후에도 actual lexical hierarchy comparator에서 secondary가 hero보다 강해지거나 mounted cross-kind occupancy safety gate에서 motif가 hero와 같거나 큰 geometry를 가지면 plan을 reject한다.
- normal 1,000-seed soak에서 reserved known-good plan 사용은 0이어야 한다.

Mounted cross-kind occupancy safety contract:

- finalizer는 approved font assets가 ready인 mounted SVG에서 모든 lexical/motif token root의 raw `getBBox()`와 component root 기준 transform matrix를 한 번씩 읽고 네 corner를 component SVG user space로 변환한 axis-aligned final bounds를 만든다. 이 bounds에는 final rotation, position과 downshift가 반영된다. visible root/matrix가 없거나 transformed width/height/safe-box dimension이 finite positive number가 아니면 `physical.invalid-rendered-bounds:<slotInstanceId>`로 plan 전체를 reject한다.
- `grid-finalizer.js`의 pure `deriveMountedOccupancy({ sourceKind, renderedBounds, safeBox, occupancySafetyFactor })`가 계산의 유일한 owner다. lexical call은 exact `1`, motif call은 plan slot에 고정된 reviewed factor만 받을 수 있다. `round6(value)`는 `Math.round(value * 1e6) / 1e6`이며 `-0`을 `0`으로 바꾼다.
- `normalizedArea = round6((renderedBounds.width / safeBox.width) * (renderedBounds.height / safeBox.height))`다.
- `mountedOccupancyScore = round6(normalizedArea * (sourceKind === "motif" ? occupancySafetyFactor : 1))`다. factor는 mounted node의 exact motif plan slot에서 resolve하며 finalizer가 ID별 값을 보충하거나 default할 수 없다.
- typography hero의 `mountedOccupancyScore`는 모든 motif score보다 strictly greater여야 한다. equality도 `hierarchy.motif-occupancy-not-below-hero:<motifSlotInstanceId>`로 reject한다. motif가 없으면 이 gate는 vacuously pass한다.
- transformed AABB와 reviewed per-motif factor도 dense QR과 sparse wave의 perceived attention을 완전히 모델링하지 않는다. 이름 그대로 obvious geometric takeover를 보수적으로 막는 safety gate이며 perceptual first-read proof가 아니다. planning structural hierarchy, motif intrinsic-bounds fit, block-area limit도 그대로 유지하고 실제 first-read는 motif-kind/downshift human-evaluation gate로 검증한다.

`FinalizationReport`:

```js
{
  schemaVersion: 1,
  planId: "plan:sha256:8b7f...",
  attempt: 1,
  candidateSource: "ranked",
  candidateCursor: 0,
  searchTier: "same-tuple-layout",
  fallbackTrigger: null,
  status: "reject",
  failedSlotInstanceIds: ["hero-1"],
  rejectionReasons: ["fit.hero-below-small"],
  blocks: [
    {
      blockId: "block-1",
      slotInstanceId: "hero-1",
      sourceKind: "lexical",
      requestedSize: "xxxlarge",
      requestedWeight: "bold",
      requestedFontWeight: 900,
      actualSize: "small",
      actualWeight: "normal",
      actualFontWeight: 400,
      fallbackTier: 5,
      renderedBounds: { width: 148, height: 30 },
      occupancySafetyFactor: 1,
      occupancyCalibrationRevision: null,
      mountedOccupancyScore: 0.006424,
      fits: false
    },
    {
      blockId: "block-2",
      slotInstanceId: "subject-1",
      sourceKind: "lexical",
      requestedSize: "medium",
      requestedWeight: "normal",
      requestedFontWeight: 400,
      actualSize: "small",
      actualWeight: "normal",
      actualFontWeight: 400,
      fallbackTier: 1,
      renderedBounds: { width: 70, height: 14 },
      occupancySafetyFactor: 1,
      occupancyCalibrationRevision: null,
      mountedOccupancyScore: 0.001418,
      fits: true
    }
  ]
}
```

`FinalizationReport.status`는 mounted size/position/weight finalization, actual lexical hierarchy와 mounted cross-kind occupancy safety만 판정한다. 모든 plan block을 같은 ID order로 기록하며 `sourceKind`, finite positive `renderedBounds.width/height`, exact `occupancySafetyFactor`, `occupancyCalibrationRevision`, `mountedOccupancyScore`를 가진다. lexical block의 factor/revision은 `1/null`이고 requested/actual size, weight label, numeric font weight를 모두 가진다. motif block은 context의 exact reviewed factor/revision을 기록하고 네 weight field는 `null`이다. `fallbackTrigger`는 ranked attempt에서 `null`, known-good attempt에서 app envelope의 exact ranked stop reason이다. finalizer는 그 밖의 rendered structural validator 결과를 이 report에 합치거나 수정하지 않는다.

App-owned attempt envelope:

```js
{
  attempt: 1,
  candidateSource: "ranked",
  candidateCursor: 0,
  searchTier: "same-tuple-layout",
  fallbackTrigger: null,
  planId: "plan:sha256:8b7f..."
}
```

```ts
type RankedStopReason =
  | "no-candidate"
  | "queue-exhausted"
  | "attempt-budget-exhausted";

type AttemptEnvelope = {
  attempt: number;
  candidateSource: "ranked" | "known-good";
  candidateCursor: number;
  searchTier: "same-tuple-layout" | "approved-alternate" | "other-replan" | "known-good";
  fallbackTrigger: RankedStopReason | null;
  planId: string;
};
```

`candidateCursor`, `attempt`, `fallbackTrigger`는 search execution state이므로 `CompositionPlan`에 저장하지 않는다. 모든 envelope는 `attempt === candidateCursor + 1`이다. `candidateSource: "ranked"`는 non-known-good tier, `fallbackTrigger: null`, cursor `0..7`만 허용한다. `candidateSource: "known-good"`는 `searchTier: "known-good"`, non-null trigger, cursor `0..8`만 허용한다. app은 envelope를 finalizer에 전달하고 finalizer는 같은 identity를 report에 복사한다.

App-owned definitive attempt result:

```ts
type ValidationRecord = {
  rule: string;
  valid: boolean;
  nodes: readonly string[];
  detail: string;
};

type AttemptResult = {
  schemaVersion: 1;
  envelope: AttemptEnvelope;
  finalizationReport: FinalizationReport;
  validation: {
    status: "not-run" | "pass" | "fail";
    skipReason: "finalization-rejected" | null;
    results: readonly ValidationRecord[];
  };
  status: "accept" | "reject";
  rejectionReasons: readonly string[];
};
```

`composition-model.js`가 `AttemptResult` schema를 소유하고 app만 record를 조립한다. envelope와 finalization report의 attempt/source/cursor/tier/fallback-trigger/plan identity는 완전히 같아야 한다. finalization이 reject면 validation은 `{ status: "not-run", skipReason: "finalization-rejected", results: [] }`이고 attempt도 reject다. finalization이 accept면 app은 read-only `validation.js`의 모든 rule을 실행하며 failed rule이 없을 때만 `validation.status: "pass"`와 attempt `accept`가 된다. `rejectionReasons`는 finalization reasons를 기존 순서로 먼저 넣고, failed validation rule을 validator 순서대로 `validation:<rule>` 형식으로 붙인 stable de-duplicated 배열이다. app은 ranked `AttemptResult.status === "reject"`이고 다음 cursor가 `rankedAttemptLimit`보다 작을 때만 다음 queue cursor로 이동한다.

Planner return contract:

```ts
type RankKey = readonly [number, number, number, number, number, number];

type InitialSelection =
  | {
      status: "selected";
      generationInputHash: string;
      recipeOrder: readonly string[];
      recipeStartIndex: number;
      selectedRecipeId: string;
      topRankKey: RankKey;
      topTiePlanIds: readonly string[];
      selectedPlanId: string;
      selectedTieIndex: number;
      selectionDrawCount: 1;
    }
  | {
      status: "no-candidate";
      generationInputHash: string;
      recipeOrder: readonly string[];
      recipeStartIndex: number;
      selectedRecipeId: null;
      topRankKey: null;
      topTiePlanIds: readonly [];
      selectedPlanId: null;
      selectedTieIndex: null;
      selectionDrawCount: 0;
    };

type SearchQueueEntry = {
  candidateCursor: number;
  candidateSource: "ranked";
  searchTier: "same-tuple-layout" | "approved-alternate" | "other-replan";
  tupleFingerprint: string;
  planId: string;
  plan: CompositionPlan;
};

type CanonicalSlotDomain = {
  slotInstanceId: string;
  sourceKind: "lexical" | "motif";
  candidateIds: readonly string[];
};

type CardinalityShape = {
  counts: readonly number[];
  totalInstanceCount: number;
  shapeKey: readonly number[];
};

type PlanningComplexityCertificate = {
  recipeId: string;
  maxCanonicalPrefixVisits: number;
  maxLayoutDecisionExpansions: number;
  maxRetainedViableDecisionsPerTuple: number;
  maxRankedPlans: number;
  oracleRevision: string;
  fixtureRevision: string;
};

type RankedPlanRecord = {
  planId: string;
  recipeId: string;
  tupleFingerprint: string;
  rankKey: RankKey;
  plan: CompositionPlan;
};

type RankedPlanUniverse = {
  generationInputHash: string;
  recipeOrder: readonly string[];
  recipeStartIndex: number;
  examinedRecipeIds: readonly string[];
  selectedRecipeId: string | null;
  reservedPlanIds: readonly string[];
  rankedPlans: readonly RankedPlanRecord[];
  universeFingerprint: string;
};

type PlannerResult = {
  schemaVersion: 1;
  generationInputHash: string;
  rankedPlanUniverseFingerprint: string;
  initialSelection: InitialSelection;
  searchQueue: readonly SearchQueueEntry[];
};
```

`composition-model.js`가 위 schema와 base validator를 소유하고 `composition-planner.js`는 immutable `PlannerResult`를 반환한다. 두 variant 모두 `PlanValidationContext.activeRecipeIds`의 exact rotation인 non-empty `recipeOrder`와 범위 안의 `recipeStartIndex`를 가진다. `selected` result는 non-null `selectedRecipeId`, non-empty queue, `searchQueue[0].planId === selectedPlanId`, selected ID의 top-tie membership을 요구한다. 모든 queue entry는 composed validator를 통과한 full `CompositionPlan`을 담고, `entry.plan.recipeId === selectedRecipeId`, `entry.planId === entry.plan.planId`, result/input/plan의 `generationInputHash`가 같아야 한다. entry `tupleFingerprint`는 plan slot projection에 shared `validateTupleCompatibility`를 적용한 valid result의 exact fingerprint다. base validator는 non-empty fingerprint shape를, planner-result composed validation은 context로 exact equality를 검사한다. cursor는 0부터 빈틈없이 증가하고 plan ID는 중복될 수 없다. queue plan ID는 어떤 reserved known-good plan ID와도 같을 수 없고 tier는 `same-tuple-layout → approved-alternate → other-replan` 순서를 역행할 수 없다. `no-candidate`는 “complete-valid plan이 없음”이 아니라 “reserved IDs를 제외한 canonical ranked universe가 비어 있음”을 뜻하며 empty queue, `selectedRecipeId: null`, 위 null/empty plan identity를 정확히 사용한다. known-good plan과 attempt는 planner result에 넣지 않고 app이 queue 소진 또는 no-candidate 뒤에 사용한다.

`composition-plan-validator.js`의 `deriveCanonicalSlotDomains(recipeId, context)`가 ranked enumeration용 unary candidate eligibility의 유일한 owner다. 먼저 recipe가 선언한 slot 순서와 같은 길이의 `counts`를 만들고, 각 count가 해당 slot cardinality 범위에 있으며 합계 `totalInstanceCount`가 recipe `blockCount` 범위에 있는 모든 `CardinalityShape`를 만든다. `shapeKey = [totalInstanceCount, ...counts]`이고 shape는 이 numeric array의 ascending lexicographic order로 순회한다. 각 shape 안에서는 recipe-declared slot order, 그 안에서는 `${slotDefinitionId}-${ordinal}` order로 instance를 만든다. 이 total order 뒤에야 각 instance domain이 `context.rankedCandidateIds`를 candidate-ID ascending으로 순회해 source-kind equality, slot `acceptsAnyTag` intersection, required lexical slot의 approved review status처럼 candidate 하나와 slot 하나만으로 판정 가능한 shared predicates를 적용한다. relation/avoid, visible-text/translation duplicate, pair/phrase coherence처럼 둘 이상의 instance를 참조하는 predicate나 layout/fit/rank/reservation은 domain 계산에 넣지 않는다. `validateTupleCompatibility`는 같은 unary predicates를 다시 검사하며 domain-only 통과를 tuple validity로 취급하지 않는다.

`enumerateCanonicalSemanticTuples(recipeId, context)`는 위 ordered shapes와 frozen `CanonicalSlotDomain`들의 complete Cartesian product를 depth-first canonical order로 lazy yield하는 유일한 owner다. product 전체나 invalid tuple 배열을 먼저 materialize하지 않는다. DFS는 shape마다 root empty assignment부터 instance order로 candidate를 한 개씩 bind한다. 같은 `slotDefinitionId`의 repeated instances는 ordinal 순 candidate ID가 strictly ascending일 때만 canonical하다. 새 candidate가 직전 same-definition candidate ID 이하이면 stable `tuple.noncanonical-repeated-slot:<slotDefinitionId>` reason으로 prefix reject한다. 이 symmetry break는 `(meta-1=A, meta-2=B)`와 `(meta-1=B, meta-2=A)` 중 전자 하나만 남기며 slot ordinal에 별도 의미를 부여하지 않는다.

`validateTupleCompatibilityPrefix(partialAssignment, shape, context)`는 `{ status: "continue" } | { status: "reject", rejectionReasons }`만 반환한다. repeated-slot order는 직전 same-definition candidate가 bind되는 즉시, direct avoid는 양 endpoint가 bind됐을 때, duplicate/phrase predicate는 비교 대상 전부가 bind됐을 때 검사한다. v1 required relation endpoint는 max-one이므로 active clause와 그 unique from/to pair가 bind된 순간 검사한다. helper는 full validator와 같은 primitive predicate/rejection-reason functions를 호출하고 독립 의미 규칙을 구현하지 않는다. 일부 operand가 future instance인 predicate, layout, fit, rank, reservation은 prefix rejection 근거가 될 수 없다. prefix helper는 complete tuple을 accept하지 않으며 모든 complete assignment는 반드시 shared `validateTupleCompatibility`를 통과한 뒤에만 yield된다. 빈 domain이 있는 shape는 product 0개지만 해당 shape의 root visit은 발생한다.

Planning counters는 다음 네 가지다.

- `canonicalPrefixVisits`: empty root를 포함해 DFS가 partial 또는 complete assignment recursion frame에 진입할 때마다 1 증가한다.
- `layoutDecisionExpansions`: compatible tuple의 canonical layout 하나와 각 block의 requested size/alignment/vertical-alignment/orientation policy alternative 하나씩을 묶은 complete raw decision을 만들 때, fit/schema/rank filter 전에 1 증가한다. reject된 raw decision도 포함한다.
- `retainedViableDecisions`: 한 tuple의 `TupleLayoutFacts.viableDecisions`에 동시에 보존된 record 수이며 generation 전체에서는 그 peak를 기록한다.
- `rankedPlans`: complete-valid non-reserved ranked plan을 materialize할 때 1 증가한다. reservation은 이 counter만 줄일 수 있다.

모든 per-recipe counter는 fresh universe derivation마다 0에서 시작한다. `config.js`의 hard limits는 `MAX_CANONICAL_PREFIX_VISITS_PER_RECIPE = 50000`, `MAX_LAYOUT_DECISION_EXPANSIONS_PER_RECIPE = 200000`, `MAX_RETAINED_VIABLE_DECISIONS_PER_TUPLE = 1024`, `MAX_RANKED_PLANS_PER_RECIPE = 4096`다. 이 값은 active snapshot이 넘을 수 없는 release/runtime limit이며 tuple, decision 또는 queue truncation 값이 아니다.

`scripts/verify-planning-complexity.mjs`는 non-runtime independent reference evaluator다. production `composition-plan-validator.js`, `grid-layout.js`, planner 또는 그 helper를 import하지 않고 generated canonical JSON snapshot의 recipe/cardinality/relation/avoid records, candidate records, 3x3 cell bitmasks와 block-policy alternative counts를 직접 해석한다. 별도 depth-first walker와 rectangular-partition reference enumerator로 cardinality shape/order, repeated-slot symmetry, tuple compatibility, prefix visits와 tuple fingerprints를 재구성한다. layout에서는 모든 typography/motif predicted-fit predicate가 pass한다고 가정해 모든 supported geometry를 덮는 raw-decision upper bound와 per-tuple retained upper bound를 계산한다. known-good reservation은 absent 상태를 worst case로 사용한다. 이 oracle은 runtime behavior owner가 아니며 release comparison 전용 duplicated implementation이다.

Release verifier는 active recipe마다 production instrumented all-fit dry run과 independent oracle를 모두 실행한다. exact tuple fingerprint set/order, prefix-visit count와 raw layout-decision count는 서로 같아야 하고, production retained/ranked counts는 oracle all-fit upper bounds 이하여야 한다. Observation policy `production-all-predicted-fit-v2`는 모든 block에서 fit하고 motif보다 강한 synthetic typography bounds `100x100`을 사용해 fit/occupancy pruning 이전의 상한을 유지한다. `PlanningComplexityCertificate`의 네 max field는 oracle이 승인한 upper bounds이고 config limits 이하여야 한다. `oracleRevision`은 reference evaluator source/contract hashes, `fixtureRevision`은 canonical input snapshot, all-fit policy와 expected oracle output의 `hashCanonical` digest다. generated `OwnerSnapshotManifest`는 active recipe마다 exact 한 certificate를 recipe ID ascending으로 가진다. certificate set/count/order/version/revision 또는 comparison이 맞지 않으면 snapshot을 activate하지 않고 `createPlanValidationContext`가 planner 호출 전에 실패한다. limits나 production/oracle derivation이 바뀌면 실제 owner의 `configVersion` 또는 `compositionEngineVersion`과 owner snapshot을 함께 올린다.

Runtime planner derivation과 `validatePlannerResult`의 fresh derivation은 네 counters를 독립 측정해 certificate와 config limits를 assert한다. certified snapshot에서 예상 밖의 breach가 나면 app은 mount 전에 generation을 fail closed하고 stable planning-complexity diagnostic을 기록하며 이전 valid component를 보존한다. 이전 component가 없으면 container를 비운다. truncated universe, partial queue, 거짓 `no-candidate`, half-valid `PlannerResult`는 만들지 않는다. full `searchQueue` completeness 계약은 release-validated bounded snapshot에만 성립하며 검증 중 transient complete collection은 preserved result queue와 fresh validation universe 두 세트를 넘지 않는다.

Release canary는 pruning이 없는 synthetic domains에서 closed-form `sum(product(prefixDomainSizes))`, complete product, all-fit layout alternatives의 exact 값을 고정한다. skipped prefix increment, omitted candidate branch, rejected-alternative undercount와 retained-peak omission을 각각 가진 faulty adapter가 certification에서 실패해야 한다. Active-snapshot test는 independent reference tuple set/order와 production domain/prefix-pruned lazy enumeration을 full exact-equal 비교한다. 이 gate 없이 unary/prefix predicate, layout alternative 또는 counter 위치를 바꿀 수 없다.

`deriveRankedPlanUniverse(context, knownGoodPlanByRecipeId)`는 reserved map의 active-recipe key, recipe identity, complete validity, recipe당 최대 한 plan을 먼저 검사하고 keyed recipe rotation을 만든다. 그 순서대로 각 recipe의 complete lazy canonical tuple → 전체 viable decision → complete-valid plan을 materialize한다. reserved plan ID는 complete plan identity를 만든 뒤에만 제외한다. 서로 다른 tuple/decision에서 같은 plan ID가 나오면 deduplicate하지 않고 identity collision으로 실패한다. non-reserved plan이 처음 존재하는 recipe에서 traversal을 멈추고 그 recipe의 모든 plan을 rank descending, plan ID ascending으로 정렬한다. `examinedRecipeIds`는 그 recipe까지의 exact prefix이고, 모든 recipe가 비면 full `recipeOrder`다. `rankedPlans`는 selected recipe의 완전한 non-reserved plan 집합이며 no-candidate에서는 empty다. `universeFingerprint = hashCanonical({ generationInputHash, recipeOrder, recipeStartIndex, examinedRecipeIds, selectedRecipeId, reservedPlanIds, rankedRecordIdentities })`다.

`deriveCanonicalSearchQueue(universe, selectedPlanId, context)`는 selected plan을 첫 entry로 둔 뒤 같은 tuple의 나머지 plan, approved alternate, other replan을 아래 tier 규칙에 따라 exact partition/sort하고 universe의 모든 `rankedPlans`를 정확히 한 번 포함한다. `composition-plan-validator.js`의 `validatePlannerResult(result, context, knownGoodPlanByRecipeId)`가 이 context-dependent composed result validation의 유일한 owner다. 이 함수는 reserved map을 먼저 complete-validate하고 fresh universe를 다시 도출한다. model base schema와 각 queue plan의 complete validation에 더해 result fingerprint, exact recipe rotation/start/prefix/selected recipe, exact top rank와 sorted tie IDs, selected tie index/member, selected/no-candidate identity를 universe와 비교한다. selected result는 fresh `deriveCanonicalSearchQueue` 출력과 `searchQueue`를 full deep-equal 비교해 membership, order, tier, cursor, tuple fingerprint, plan object를 함께 증명한다. no-candidate result는 fresh universe가 실제로 empty일 때만 허용한다. supplied queue 일부만 검사하거나 planner가 넘긴 candidate list를 validator의 universe 입력으로 재사용할 수 없다. planner는 validator-owned universe와 queue derivation을 소비해 immutable result를 조립한 뒤 이 함수를 통과한 object만 반환하며 app도 test/dev assertion에서 같은 entry point를 사용한다. Phase B의 known-good 미연결 경로는 empty map을 명시적으로 전달한다.

Mounted replan handoff:

1. planner는 validator-owned `deriveRankedPlanUniverse`의 exact output을 받는다. selection stream의 단 한 번의 draw는 selected recipe 최고 rank tie에서 initial plan 하나를 고르는 데만 쓴다.
2. initial plan의 tuple key는 plan slot projection을 shared `validateTupleCompatibility`에 넣어 얻은 `tupleFingerprint = hashCanonical({ recipeId, slots: canonicalResolvedSlots })`다. slot payload는 모든 slot의 resolved lexicalUseId/motifId/candidateId/instanceKey/phrasePackId를 canonical order로 묶고 layout/size를 제외한다.
3. planner는 initial plan ID를 validator-owned `deriveCanonicalSearchQueue`에 전달하고 그 exact immutable output을 `searchQueue`로 반환한다.
4. `same-tuple-layout`: initial plan부터 initial fingerprint와 같은 `tupleFingerprint`의 다른 block/layout plans를 rank와 plan ID 순으로 둔다.
5. `approved-alternate`: initial fingerprint와 다르면서 initial tuple과 recipe/slot-instance set/motif identities가 같고 lexical slot이 최소 하나 달라진 tuple만 들어간다. 달라진 각 lexical slot에는 new use → initial use 방향의 approved `alternateOf` edge가 정확히 하나 있어야 한다. changed slots를 `slotInstanceId`로 정렬한 `[slotInstanceId, edge.priority, newLexicalUseId]` 배열이 `alternatePriorityKey`이며, 이 배열의 lexicographic order → plan rank → plan ID 순으로 정렬한다.
6. `other-replan`: initial fingerprint와 다르고 같은 `selectedRecipeId` 안에서 motif identity가 하나라도 바뀐 tuple, motif만 바뀐 tuple, alternate 조건을 만족하지 않는 lexical tuple을 포함해 아직 사용하지 않은 나머지 non-reserved direct-valid plans를 rank와 plan ID 순으로 둔다. 따라서 motif-only change가 `approved-alternate`에 vacuously 들어갈 수 없고 다른 recipe plan이나 reserved known-good plan은 들어갈 수 없다.
7. queue index가 ranked `candidateCursor`다. app은 definitive ranked `AttemptResult` reject마다 정확히 1 증가시키고 envelope/report/result에 candidate의 `searchTier`, `fallbackTrigger: null`을 기록한다. queue traversal은 random을 추가 소비하지 않는다.
8. app은 `rankedAttemptLimit = min(searchQueue.length, MAX_MOUNTED_RANKED_ATTEMPTS)`만 mount한다. prefix가 모두 reject되면 queue가 더 남았을 때 `attempt-budget-exhausted`, 정확히 끝났을 때 `queue-exhausted`를 고정하고 remaining queue는 실행하지 않는다.
9. 위 stop reason 뒤 `known-good` tier로 이동해 generation 시작 시 이미 instantiate/complete-validate한 `knownGoodPlanByRecipeId.get(selectedRecipeId)`를 한 번 시도한다. fallback 시점에 template을 다시 resolve하거나 plan을 다시 만들지 않는다. 이 attempt는 `candidateSource: "known-good"`, `searchTier: "known-good"`, `candidateCursor: rankedAttemptLimit`, `attempt: rankedAttemptLimit + 1`, `fallbackTrigger: <ranked stop reason>`을 사용한다.
10. known-good plan도 reject되면 이전 valid Component가 있으면 그대로 유지한다. 없으면 container를 비운다. invalid plan은 active/export state에 채택하지 않는다.
11. candidate 사이에서는 whole plan만 교체한다. 한 attempt 안의 slot identity, visible text, block assignment는 변경하지 않는다.

Known-good lifecycle은 context-free template 검증과 generation-scoped plan 검증을 분리한다.

```ts
type KnownGoodTemplate = {
  schemaVersion: 1;
  templateId: string;
  key: {
    recipeId: string;
    ratio: string;
    vocabularyVersion: number;
    recipeVersion: number;
    motifVersion: number;
    configVersion: number;
    compositionEngineVersion: number;
    fontMetricsVersion: number;
    fontAssetRevision: string;
  };
  coherenceMode: "direct";
  slots: readonly KnownGoodTemplateSlot[];
  blocks: readonly KnownGoodTemplateBlock[];
};

type KnownGoodTemplateSlot =
  | {
      id: string;
      slotDefinitionId: string;
      sourceKind: "lexical";
      candidateScope: "static";
      candidateId: string;
    }
  | {
      id: string;
      slotDefinitionId: string;
      sourceKind: "motif";
      candidateScope: "static";
      candidateId: string;
    };

type KnownGoodTemplateBlock = {
  id: string;
  footprint: string;
  cells: readonly number[];
  slotInstanceId: string;
  requestedSize: "small" | "medium" | "large" | "xlarge" | "xxlarge" | "xxxlarge";
  alignment: "left" | "center" | "right";
  verticalAlignment: "top" | "middle" | "bottom";
  orientationMode: "none" | "whole-rotate" | "glyph-sideways-stack";
};
```

`KnownGoodTemplate`는 `CompositionPlan`이 아니다. 모든 slot은 `candidateScope: "static"`을 명시하고 lexical slot은 size-neutral static candidate family ID를, motif slot은 exact static motif candidate ID를 참조한다. dynamic `instanceKey` candidate는 허용하지 않는다. template에는 `generationInput`, `generationInputHash`, `planId`, `decisionTrace`, `tokenId`, requested weight field, actual/finalization field를 저장하지 않는다.

`composition-known-good.js`의 context-free `validateKnownGoodTemplateShape(template)`는 app startup의 registry creation에서 실행된다. 이 validator는 schema/enums와 key shape, unique template/full key/slot/block ID, 2-5 block, slot-block 일대일 참조, rectangular 3x3 complete coverage, static-candidate declaration, forbidden runtime field 부재만 검사한다. `ownerSnapshotRevision`은 key를 포함한 template 어느 위치에도 허용하지 않는다. generation input, candidate index, recipe relation, typography fit을 합성하거나 complete plan validity를 주장하지 않는다. shape-invalid template은 registry에서 제외하고 stable registry/config diagnostic을 남긴다.

각 generation에서 app은 regular candidate와 template이 참조하는 static candidate를 모두 포함한 `PlanValidationContext`를 먼저 만든다. 그 다음 exact ratio와 vocabulary/recipe/motif/config/composition-engine/font-metrics/font-asset tuple이 맞는 template마다 `instantiateKnownGoodTemplate(template, generationInput, context)`를 호출한다. instantiator는 `generationInput === context.generationInput`, `hashCanonical(generationInput) === context.generationInputHash`, verified context manifest의 recomputed root digest가 `generationInput.ownerSnapshotRevision` 및 `context.versions.ownerSnapshotRevision`과 같은지를 먼저 확인한다. owner revision은 template에서 읽거나 비교하지 않는다. 이어서 template slots를 `CompositionTuple`로 resolve하며 shared `validateTupleCompatibility`의 valid result만 `deriveTupleLayoutFacts`에 전달한다. template의 block selector fields인 footprint/cells/slot/requested-size/alignment/vertical-alignment/orientation과 일치하는 viable record가 정확히 하나여야 하며 그 exact derived blocks/rank facts를 사용해 normal `CompositionPlan`을 조립한다. 0개 또는 여러 record가 match하면 template은 invalid다. canonical `planIdentityPayload`/`planId`를 계산하고 `validateCompositionPlan(plan, context)`까지 통과한 plan만 immutable `knownGoodPlanByRecipeId`에 넣는다. compatible template은 recipe당 최대 하나이며 invalid/missing/duplicate template은 map에 없고 registry/config diagnostic으로 기록되며 ranked candidate가 되지 않는다.

이 key 분리는 content-address cycle을 의도적으로 끊는다. `composition-known-good.js` source는 `plan-to-export-runtime` entry에 포함되어 root owner digest에 기여하지만, 그 source 안의 template은 결과 digest를 다시 embed하지 않는다. template compatibility는 semantic version/revision tuple로 고정하고 현재 source closure의 무결성은 generation/context의 verified owner manifest가 독립적으로 보증한다.

app은 이 map을 planner에 전달해 모든 map plan ID를 ranked enumeration에서 예약하고, 같은 map object를 queue exhaustion/attempt-budget exhaustion/no-candidate fallback 때까지 보존한다. 따라서 known-good plan은 queue에 없고 fallback 직전에 재-instantiation되지 않는다.

Terminal generation result:

```js
{
  schemaVersion: 1,
  status: "terminal-failure",
  attemptedGenerationInputHash: "sha256:4ad1...",
  terminalReason: "known-good-rejected",
  rankedStopReason: "attempt-budget-exhausted",
  displayedPlanId: "plan:sha256:previous...",
  displayedStructuralFingerprint: "sha256:previous-svg...",
  preservedPrevious: true,
  exportEligible: true,
  lastAttemptResult: {
    schemaVersion: 1,
    envelope: {
      attempt: 9,
      candidateSource: "known-good",
      candidateCursor: 8,
      searchTier: "known-good",
      fallbackTrigger: "attempt-budget-exhausted",
      planId: "plan:sha256:failed..."
    },
    finalizationReport: {
      schemaVersion: 1,
      planId: "plan:sha256:failed...",
      attempt: 9,
      candidateSource: "known-good",
      candidateCursor: 8,
      searchTier: "known-good",
      fallbackTrigger: "attempt-budget-exhausted",
      status: "accept",
      failedSlotInstanceIds: [],
      rejectionReasons: [],
      blocks: [
        {
          blockId: "block-1",
          slotInstanceId: "hero-1",
          sourceKind: "lexical",
          requestedSize: "xxxlarge",
          requestedWeight: "bold",
          requestedFontWeight: 900,
          actualSize: "xxxlarge",
          actualWeight: "bold",
          actualFontWeight: 900,
          fallbackTier: 0,
          renderedBounds: { width: 520, height: 236 },
          occupancySafetyFactor: 1,
          occupancyCalibrationRevision: null,
          mountedOccupancyScore: 0.177546,
          fits: true
        },
        {
          blockId: "block-2",
          slotInstanceId: "support-1",
          sourceKind: "lexical",
          requestedSize: "medium",
          requestedWeight: "normal",
          requestedFontWeight: 400,
          actualSize: "medium",
          actualWeight: "normal",
          actualFontWeight: 400,
          fallbackTier: 0,
          renderedBounds: { width: 160, height: 46 },
          occupancySafetyFactor: 1,
          occupancyCalibrationRevision: null,
          mountedOccupancyScore: 0.010648,
          fits: true
        }
      ]
    },
    validation: {
      status: "fail",
      skipReason: null,
      results: [
        {
          rule: "composition.slot-block",
          valid: false,
          nodes: ["block-2"],
          detail: "Rendered block metadata does not reference support-1."
        }
      ]
    },
    status: "reject",
    rejectionReasons: ["validation:composition.slot-block"]
  }
}
```

`lastAttemptResult` type은 projection이 아닌 full `AttemptResult | null`이다. 그 안에 complete envelope, finalization report, validation records, definitive status/reasons가 함께 보존된다. terminal result의 non-null `rankedStopReason`은 known-good envelope/report의 `fallbackTrigger`와 같아야 한다. 이전 valid Component가 없으면 `displayedPlanId`와 fingerprint는 `null`, `preservedPrevious`와 `exportEligible`은 false다. app test hook은 original frozen planner result, terminal result, last attempt result, 현재 displayed/export plan ID를 함께 노출해 failed input이 accepted된 것처럼 보이지 않게 한다.

`terminalReason` enum은 `known-good-rejected | no-candidate-no-known-good | queue-exhausted-no-known-good | attempt-budget-exhausted-no-known-good`다. `rankedStopReason` enum은 앞의 `RankedStopReason`과 같다. Non-empty queue의 attempted prefix를 모두 reject한 뒤 같은 selected recipe의 reserved plan이 없으면 stop reason에 따라 `queue-exhausted-no-known-good` 또는 `attempt-budget-exhausted-no-known-good`을 사용하고 `lastAttemptResult`는 마지막 ranked reject를 보존한다. reserved plan을 시도해 reject되면 `terminalReason: "known-good-rejected"`이고 stop reason이 preceding no-candidate/queue/budget path를 구분한다.

No-candidate transition:

1. 모든 recipe가 reserved ID를 제외한 ranked candidate 0개이면 planner는 `searchQueue: []`, `initialSelection.status: "no-candidate"`인 `PlannerResult`를 반환하고 selection draw를 소비하지 않는다.
2. app은 initial plan을 만들지 않고 `recipeOrder` 순서대로 generation 시작 시 고정한 `knownGoodPlanByRecipeId`의 첫 plan을 조회한다.
3. reserved plan이 있으면 `candidateSource: "known-good"`, `searchTier: "known-good"`, `candidateCursor: 0`, `attempt: 1`, `fallbackTrigger: "no-candidate"`로 render/finalize한다. accept되면 normal `accepted-output`이며 terminal result는 없다.
4. known-good attempt가 reject되면 `terminalReason: "known-good-rejected"`이고 `lastAttemptResult`는 non-null full record다.
5. matching template이 없거나 shape/instantiation/complete validation에서 제외돼 map plan이 없으면 mounted attempt 없이 `terminalReason: "no-candidate-no-known-good"`, `rankedStopReason: "no-candidate"`, `lastAttemptResult: null`인 terminal result를 만든다.
6. 두 terminal reason 모두 이전 valid Component의 display/export identity를 보존한다. 이전 valid Component가 없으면 displayed identity는 null이고 export는 disabled다.
7. 모든 branch는 처음 검증한 `PlannerResult` object를 generation snapshot과 test hook에 그대로 보존한다.

## CompositionPlan Contract

```js
{
  schemaVersion: 3,
  planId: "plan:sha256:8b7f...",
  generationInputHash: "sha256:4ad1...",
  generationInput: {
    schemaVersion: 1,
    seed: 305419896,
    generationTimestamp: "2026-07-13T12:00:00+09:00",
    ratio: "3:4",
    borderMode: "corner-stroke",
    viewport: { width: 1440, height: 1200, devicePixelRatio: 2 },
    safeBox: { x: 0, y: 0, width: 720, height: 960 },
    vocabularyVersion: 1,
    recipeVersion: 1,
    motifVersion: 1,
    configVersion: 1,
    compositionEngineVersion: 1,
    fontMetricsVersion: 1,
    fontAssetRevision: "sha256:6d4f...",
    ownerSnapshotRevision: "sha256:ab91..."
  },
  recipeId: "command",
  coherenceMode: "direct",
  slots: [
    {
      id: "hero-1",
      slotDefinitionId: "hero",
      compositionRole: "hero",
      prominence: "primary",
      sourceKind: "lexical",
      lexicalUseId: "upgrade.command.en",
      translationSetId: "upgrade.command",
      candidateId: "lexical:upgrade.command.en",
      tokenId: "type:upgrade.command.en:xxxlarge",
      instanceKey: null,
      phrasePackId: null
    },
    {
      id: "subject-1",
      slotDefinitionId: "subject",
      compositionRole: "support",
      prominence: "secondary",
      sourceKind: "lexical",
      lexicalUseId: "system.topic.en",
      translationSetId: "system.topic",
      candidateId: "lexical:system.topic.en",
      tokenId: "type:system.topic.en:medium",
      instanceKey: null,
      phrasePackId: null
    },
    {
      id: "meta-1",
      slotDefinitionId: "meta",
      compositionRole: "metadata",
      prominence: "tertiary",
      sourceKind: "lexical",
      lexicalUseId: "version.reference",
      translationSetId: null,
      candidateId: "lexical:version.reference:sha256:instance-v1-2...",
      tokenId: "type:version.reference.v1-2:small",
      instanceKey: "version:v1.2",
      phrasePackId: null
    }
  ],
  blocks: [
    {
      id: "block-1",
      footprint: "3x2",
      cells: [1, 2, 3, 4, 5, 6],
      slotInstanceId: "hero-1",
      requestedSize: "xxxlarge",
      requestedWeight: "bold",
      requestedFontWeight: 900,
      alignment: "center",
      verticalAlignment: "middle",
      orientationMode: "none"
    },
    {
      id: "block-2",
      footprint: "2x1",
      cells: [7, 8],
      slotInstanceId: "subject-1",
      requestedSize: "medium",
      requestedWeight: "normal",
      requestedFontWeight: 400,
      alignment: "left",
      verticalAlignment: "bottom",
      orientationMode: "none"
    },
    {
      id: "block-3",
      footprint: "1x1",
      cells: [9],
      slotInstanceId: "meta-1",
      requestedSize: "small",
      requestedWeight: "normal",
      requestedFontWeight: 400,
      alignment: "right",
      verticalAlignment: "bottom",
      orientationMode: "none"
    }
  ],
  decisionTrace: {
    rankKey: [1, 5, 2, 6, 0.1875, 3],
    preferRuleMatchIds: ["command.target-affinity"],
    minNormalizedFitMargin: 0.1875,
    layoutPreferenceMatches: [
      "hero:largest-viable-footprint",
      "meta:edge",
      "meta:corner"
    ]
  }
}
```

Plan slot은 `sourceKind: "lexical" | "motif"`로 구분되는 union이다. Recipe의 `source: "graphic"` slot은 plan에서 `sourceKind: "motif"`로 materialize되며 다른 graphic source kind는 pilot에 없다.

Lexical slot:

```js
{
  id: "meta-1",
  slotDefinitionId: "meta",
  compositionRole: "metadata",
  prominence: "tertiary",
  sourceKind: "lexical",
  lexicalUseId: "version.reference",
  translationSetId: null,
  candidateId: "lexical:version.reference:sha256:instance-v1-2...",
  tokenId: "type:version.reference.v1-2:small",
  instanceKey: "version:v1.2",
  phrasePackId: null
}
```

Motif slot:

```js
{
  id: "motif-1",
  slotDefinitionId: "motif",
  compositionRole: "motif",
  prominence: "secondary",
  sourceKind: "motif",
  motifId: "motif.pseudo-qr",
  candidateId: "motif.pseudo-qr:variant-04",
  tokenId: "graphic:pseudo-qr:large",
  materializationKey: "sha256:07bc...",
  renderParams: {
    graphicType: "pseudo-qr",
    size: "large",
    moduleCount: 21,
    payloadBits: "101101...",
    stroke: "thin"
  },
  renderParamsHash: "sha256:931a...",
  occupancySafetyFactor: 1.35,
  occupancyCalibrationRevision: "sha256:7c31..."
}
```

Motif renderer별 `renderParams` schema와 reviewed occupancy calibration은 `motifs.js`가 소유한다. 모든 render-affecting 값과 exact `occupancySafetyFactor`/`occupancyCalibrationRevision`은 keyed materialization에서 candidate와 plan으로 복사하며 renderer/finalizer가 random, ID lookup 또는 환경 default로 보충할 수 없다. `renderParamsHash = hashCanonical(renderParams)`다. Complete validator는 plan slot의 두 occupancy field가 candidate와 exact-equal이고 candidate의 값이 active motif registry record와 exact-equal인지 검사한다.

Canonical plan validation은 generation마다 한 번 만든 immutable `PlanValidationContext`를 사용한다.

```ts
type TypographyCandidateFamily = {
  sourceKind: "lexical";
  vocabularyVersion: number;
  candidateId: string;
  tokenFamilyId: string;
  materializationOrdinal: number;
  materializationKey: string;
  supportedSizes: readonly ("small" | "medium" | "large" | "xlarge" | "xxlarge" | "xxxlarge")[];
  visibleText: string;
  normalizedVisibleText: string;
  lexicalUseId: string;
  translationSetId: string | null;
  tags: readonly string[];
  language: "en" | "ko" | "zh";
  script: string;
  typeface: string;
  tokenFunction: string;
  instanceKey: string | null;
  phrasePackId: string | null;
};

type MotifCandidate = {
  sourceKind: "motif";
  motifVersion: number;
  candidateId: string;
  motifId: string;
  tokenId: string;
  materializationOrdinal: number;
  materializationKey: string;
  intrinsicBounds: { width: number; height: number };
  renderParams: Readonly<Record<string, unknown>>;
  renderParamsHash: string;
  occupancySafetyFactor: number;
  occupancyCalibrationRevision: string;
};

type CanonicalLayoutAssignment = {
  layoutKey: string;
  blocks: readonly {
    footprint: string;
    cells: readonly number[];
    slotInstanceId: string;
  }[];
};

type CanonicalLayoutEnumerator = (
  slotInstanceIds: readonly string[]
) => readonly CanonicalLayoutAssignment[];

type CompositionTuple = {
  recipeId: string;
  slots: readonly {
    id: string;
    slotDefinitionId: string;
    sourceKind: "lexical" | "motif";
    candidateId: string;
  }[];
};

type TupleCompatibilityResult =
  | {
      valid: true;
      tupleFingerprint: string;
      compatibleTuple: Readonly<CompositionTuple>;
      rejectionReasons: readonly [];
    }
  | {
      valid: false;
      tupleFingerprint: string;
      compatibleTuple: null;
      rejectionReasons: readonly string[];
    };

type RankedBlockDecision = {
  id: string;
  footprint: string;
  cells: readonly number[];
  slotInstanceId: string;
  requestedSize: "small" | "medium" | "large" | "xlarge" | "xxlarge" | "xxxlarge";
  requestedWeight: "normal" | "bold" | null;
  requestedFontWeight: 400 | 700 | 900 | null;
  alignment: "left" | "center" | "right";
  verticalAlignment: "top" | "middle" | "bottom";
  orientationMode: "none" | "whole-rotate" | "glyph-sideways-stack";
};

type PlanRankFacts = {
  rankKey: RankKey;
  preferRuleMatchIds: readonly string[];
  minNormalizedFitMargin: number;
  layoutPreferenceMatches: readonly string[];
};

type ViablePlanDecision = {
  decisionFingerprint: string;
  blocks: readonly RankedBlockDecision[];
  rankFacts: Readonly<PlanRankFacts>;
};

type TupleLayoutFacts = {
  tupleFingerprint: string;
  viableDecisions: readonly ViablePlanDecision[];
  maxCellCountBySlotInstanceId: Readonly<Record<string, number>>;
};

type OwnerSnapshotEntry = {
  ownerId:
    | "vocabulary"
    | "recipes"
    | "motifs"
    | "config"
    | "canonical-hash"
    | "candidate-materializer"
    | "layout"
    | "composition-validator"
    | "planner"
    | "plan-to-export-runtime"
    | "manifest-tooling"
    | "typography-metrics"
    | "font-assets";
  versionField:
    | "vocabularyVersion"
    | "recipeVersion"
    | "motifVersion"
    | "configVersion"
    | "compositionEngineVersion"
    | "fontMetricsVersion"
    | "fontAssetRevision";
  versionValue: number | string;
  sourceFiles: readonly string[];
  dataFiles: readonly string[];
  assetFiles: readonly string[];
  contentRevision: string;
};

type OwnerSnapshotManifest = {
  schemaVersion: 1;
  versionTuple: {
    vocabularyVersion: number;
    recipeVersion: number;
    motifVersion: number;
    configVersion: number;
    compositionEngineVersion: number;
    fontMetricsVersion: number;
    fontAssetRevision: string;
  };
  entries: readonly OwnerSnapshotEntry[];
  planningComplexityCertificates: readonly PlanningComplexityCertificate[];
  ownerSnapshotRevision: string;
};

type OwnerSnapshotLedgerRow = {
  schemaVersion: 1;
  versionTuple: OwnerSnapshotManifest["versionTuple"];
  ownerSnapshotRevision: string;
  toolingSourceHashes: readonly {
    path: string;
    sha256Hex: string;
  }[];
  toolingUpgrade: null | {
    fromCompositionEngineVersion: number;
    toCompositionEngineVersion: number;
    reason: string;
  };
};

type PlanValidationContext = {
  generationInput: Readonly<GenerationInput>;
  generationInputHash: string;
  ownerSnapshotManifest: Readonly<OwnerSnapshotManifest>;
  versions: {
    vocabularyVersion: number;
    recipeVersion: number;
    motifVersion: number;
    configVersion: number;
    compositionEngineVersion: number;
    fontMetricsVersion: number;
    fontAssetRevision: string;
    ownerSnapshotRevision: string;
  };
  candidateById: ReadonlyMap<string, TypographyCandidateFamily | MotifCandidate>;
  rankedCandidateIds: readonly string[];
  lexicalUseById: ReadonlyMap<string, LexicalUse>;
  translationSetByLexicalUseId: ReadonlyMap<string, TranslationSet>;
  recipeById: ReadonlyMap<string, CompositionRecipe>;
  activeRecipeIds: readonly string[];
  planningComplexityCertificateByRecipeId: ReadonlyMap<string, PlanningComplexityCertificate>;
  relationEdges: readonly RelationEdge[];
  blockPolicyByFootprint: ReadonlyMap<string, GridBlockPolicy>;
  enumerateCanonicalLayouts: CanonicalLayoutEnumerator;
  measureTypography: TypographyMeasurer;
  deriveTypographyTokenVariant: TypographyVariantDeriver;
  validateMotifRenderParams: MotifParamsValidator;
};
```

`composition-owner-snapshot.js`는 generated immutable `OwnerSnapshotManifest`와 `COMPOSITION_ENGINE_VERSION`을 export한다. entry는 위 exact owner ID set을 한 번씩 `ownerId` ascending으로 포함한다. 모든 path 배열은 repository-relative unique ascending path이고 generated manifest의 명시적 self-exclusion 외에는 entries 사이 path 중복을 허용하지 않는다. `vocabulary|recipes|motifs|config|typography-metrics|font-assets`는 각각 자기 semantic version/revision field에, `canonical-hash|candidate-materializer|layout|composition-validator|planner|plan-to-export-runtime|manifest-tooling`은 `compositionEngineVersion`에 연결하며 `versionValue`는 manifest tuple의 named field와 exact-equal이어야 한다. 각 `contentRevision = hashCanonical({ ownerId, versionField, versionValue, semanticPayload, sourceByteHashes, dataByteHashes, assetByteHashes })`다. path/hash arrays는 path ascending이고 raw byte hash는 shared `sha256Hex`다. `semanticPayload`는 data owner의 canonical immutable records/schema/count, algorithm owner의 public contract/revision descriptor, `plan-to-export-runtime`의 runtime roots/exclusion schema, `manifest-tooling`의 entrypoints/dependency-closure/bootstrap-policy revision을 각각 담아 owner 종류 때문에 빈 예외가 생기지 않게 한다. `font-assets` entry는 family별 asset hash 목록을 포함한다. `planningComplexityCertificates`는 exact active recipe ID set을 한 번씩 ascending order로 포함하고 config limits와 release fixture revision에 결속된다. root `ownerSnapshotRevision`은 self field를 제외한 manifest payload의 `hashCanonical`이다.

Verifier는 `index.html`에서 module script, stylesheet와 CSS `@import`/local `url(...)` dependency를 찾고, `src/app.js`와 declared additional runtime roots에서 static `import`/`export ... from` closure를 repository 내부 native ES modules로 재귀 계산한다. non-literal dynamic import와 undeclared runtime network resource는 plan-to-export path에서 금지하며 literal dynamic root는 manifest generator config에 명시해야 한다. `vocabulary`부터 `planner` 및 `canonical-hash`까지의 upstream entries가 선언한 `sourceFiles`는 서로 중복될 수 없고 module closure에 존재해야 한다. `plan-to-export-runtime.sourceFiles`는 full module closure에서 그 upstream source files와 generated `src/composition-owner-snapshot.js`를 뺀 exact remainder여야 한다. `plan-to-export-runtime.dataFiles`는 `index.html`, output-affecting CSS와 upstream/font entries에 배정되지 않은 local runtime resource의 exact remainder다. `font-assets`는 `fonts/fonts.css`와 실제 font files를 소유한다. 따라서 `composition-known-good.js`, `grid-selection.js`, `grid-renderer.js`, `graphics.js`, `grid-finalizer.js`, `validation.js`, `export.js`, `svg.js`, output orchestration을 가진 `app.js`, styles와 앞으로 추가되는 downstream dependency는 별도 수동 허용 없이 snapshot에 들어간다. generated manifest module은 자기 hash를 포함하지 않지만 verifier가 canonical emitter output과 file bytes의 exact equality를 별도로 검사한다.

`manifest-tooling.sourceFiles`는 `scripts/bootstrap-verify-composition-owner-snapshot.mjs`, emitter, candidate manifest verifier, planning-complexity verifier와 네 entrypoint의 static local dependency closure에서 이미 다른 owner에 배정된 shared `canonical-hash.js`를 뺀 exact remainder다. tooling source는 browser가 import하거나 실행하지 않지만 그 entry metadata와 content revision은 generated runtime manifest 및 append-only ledger에 포함된다. generated `composition-owner-snapshot.js`만 self-excluded이며 bootstrap/emitter/verifiers는 제외 대상이 아니다.

CI trust root는 candidate checkout의 bootstrap이 아니라 `--base-ref` merge base git object에서 `git show`로 추출해 temporary path에서 실행하는 base `bootstrap-verify-composition-owner-snapshot.mjs`와 그 base verifier closure다. Bootstrap entrypoint만 Node built-in `fs`, `crypto`와 자체 static-import parser를 사용할 수 있으며 그 static local dependency closure는 Node crypto를 직접 import할 수 없다. 이 예외는 아직 신뢰하지 않은 candidate raw bytes와 ledger prefix를 비교하기 위한 security boundary일 뿐 composition ID, canonical object hash, manifest content revision을 만드는 identity owner가 아니다. candidate checkout의 bootstrap module은 import/execute하지 않고 source bytes와 closure만 ledger 대상으로 검사한다. ledger는 위 exact `OwnerSnapshotLedgerRow` schema를 쓰며 `sha256Hex`는 prefix 없는 64 lowercase hex다. base bootstrap은 merge-base ledger rows가 candidate ledger의 byte-for-byte prefix인지, candidate tooling entrypoint closure와 path-ascending raw-byte hashes가 candidate last row와 정확히 같은지 먼저 검사한다. 이어 merge-base의 candidate-independent verifier/canonical-hash closure도 temporary path로 추출해 candidate data/source/manifest에 read-only로 실행한다. Base verifier와 bootstrap 중 하나라도 실패하면 candidate code는 실행하지 않는다.

Tooling closure가 unchanged이면 candidate last row의 hashes는 base last row와 같고 `toolingUpgrade`는 `null`이어야 한다. 하나라도 바뀌면 candidate ledger는 정확히 한 row를 append하고 higher `compositionEngineVersion`, non-empty reason, old/new engine version과 exact candidate closure hashes를 기록해야 한다. 이 recorded upgrade와 base verifier가 모두 통과한 뒤에만 candidate verifier를 추가 실행하며, candidate verifier가 만든 manifest/tooling content revision/root도 appended row와 exact-equal이어야 한다. Base verifier가 authority이고 candidate verifier는 그 실패를 waive할 수 없다. unledgered mutation, base-row rewrite, unrelated version bump, extra/missing tooling dependency는 candidate code가 실행되기 전에 실패한다. Candidate bootstrap/verifier 자체가 바뀌어도 이번 change에서 새 behavior를 activation contract에 사용할 수 없고 recorded source로만 merge한 뒤 다음 change의 base trust root가 된다.

Bootstrap genesis와 verifier/hash/ledger schema upgrade는 한 change에서 처리하지 않는다. Phase A의 별도 reviewed foundation change가 bootstrap, base verifier, CI invocation과 schema-1 empty/genesis ledger를 먼저 merge하고, Phase B manifest tooling은 그 base trust root가 존재한 뒤 들어간다. Trust logic을 바꿀 때 첫 change는 old base verifier가 이해하고 현재 behavior를 그대로 검증할 수 있는 backward-compatible next tooling을 recorded upgrade로 merge한다. 새 behavior/schema/hash activation은 그 tooling이 merge-base가 된 두 번째 change에서만 허용한다. Legitimate unchanged/recorded-upgrade/two-stage activation과 unledgered/coordinated-bypass fixtures를 모두 CI에 고정한다.

Repository verifier는 actual source/data/asset bytes에서 manifest를 재계산한다. 현재 ledger의 owner entry가 이전 revision보다 다른 `contentRevision`을 가지면 그 entry의 declared `versionValue`도 달라야 하며, 다른 owner의 version bump로 대신할 수 없다. append-only `composition-owner-snapshots.json` ledger는 full version tuple당 root digest를 하나만 허용한다. CI의 `--base-ref` mode는 merge base ledger의 기존 rows가 byte-for-byte 같은 prefix로 보존됐는지 확인하고 append만 허용한다. 따라서 source/data가 바뀌었는데 version을 그대로 둔 채 manifest를 재생성하거나 과거 row를 교체해도 gate를 통과할 수 없다. Manifest regeneration은 owner version 변경 때 명시적으로 실행해 결과를 commit하는 maintenance command이며 app build/start prerequisite가 아니다. browser runtime은 committed verified manifest를 native ES module로 import하고 filesystem hashing이나 새 build step을 수행하지 않는다.

`composition-plan-validator.js`의 `createPlanValidationContext(...)`는 app이 고정한 exact frozen `GenerationInput` object, verified owner manifest와 versioned snapshots, keyed concrete candidate-family index를 하나의 frozen read-only view로 만든다. context의 `generationInputHash`는 `hashCanonical(context.generationInput)`이어야 한다. manifest `versionTuple`은 input/context에서 `ownerSnapshotRevision`을 제외한 corresponding fields와 deep-equal이고 recomputed root digest는 `GenerationInput.ownerSnapshotRevision` 및 `context.versions.ownerSnapshotRevision`과 같아야 한다. `activeRecipeIds`는 `composition-recipes.js`의 exact `recipeVersion` snapshot이며 non-empty, unique, ascending이고 모든 ID가 `recipeById`에 존재해야 한다. complexity certificate map은 이 exact active set과 일대일 대응하고 각 bound/fixture revision이 verified manifest와 같아야 한다. `rankedCandidateIds`는 regular ranked inventory의 unique ascending ID 배열이며 모든 ID가 `candidateById`에 존재해야 한다. template-only static candidates는 full index에서 known-good instantiation에 쓸 수 있지만 이 배열에 없으면 ranked domain에 들어가지 않는다. duplicate ID, duplicate family-local materialization ordinal/key, invalid final candidate ID, translation membership conflict, active recipe mismatch, complexity certificate mismatch, ranked-candidate membership/order, registry version, manifest content/version 또는 `GenerationInput` version/hash mismatch가 있으면 context construction을 실패시킨다. lexical candidate family는 exact `vocabularyVersion`과 size-neutral `candidateId`, `tokenFamilyId`, `materializationOrdinal`, `materializationKey`, `supportedSizes`, `visibleText`, normalized visible text, lexical use/set ID, tags, language, script, typeface, token function, `instanceKey`, `phrasePackId`를 가지며 size-specific `tokenId`를 저장하지 않는다. motif candidate는 exact `motifVersion`, motif/candidate/materialization ordinal/key identity, exact token ID, intrinsic bounds, render params/hash와 registry-exact occupancy factor/calibration revision을 가진다. factor가 finite positive가 아니거나 factor/revision이 active registry record와 다르면 construction을 실패시킨다. candidate owner version이 context와 다르면 construction을 실패시킨다.

`token-library.js`는 값 생성 전에 owner snapshot의 family descriptor와 declared materialization count를 ordinal `0..count-1` slot으로 확장한다. lexical family key는 `tokenFamilyId`, owner version은 `vocabularyVersion`이고 motif family key는 `motifId`, owner version은 `motifVersion`이다. `materializationKey = hashCanonical({ ownerVersion, familyKey, materializationOrdinal })`이며 ordinal은 같은 family 안에서만 정해지고 다른 family의 추가/삭제로 이동하지 않는다. 모든 dynamic field를 이 key로 만든 뒤 lexical `instanceKey`를 확정하고, 마지막에 static `candidateId = tokenFamilyId`, dynamic `candidateId = tokenFamilyId + ":" + hashCanonical(canonicalInstanceKey)`를 만든다. 따라서 final candidate ID를 materialization input으로 다시 사용하지 않는다.

Output-affecting version ownership은 다음과 같다.

- lexical family descriptor, declared count, dynamic field schema/value algorithm, visible/typeface identity가 바뀌면 `vocabularyVersion`을 올린다.
- recipe records, active recipe IDs, slot/cardinality, relation edges, pair rules 또는 layout preference data가 바뀌면 `recipeVersion`을 올린다.
- motif descriptor, declared variant count, render-parameter schema/value algorithm, occupancy factor/calibration이 바뀌면 `motifVersion`을 올린다.
- planning/mounted attempt limit, footprint policy나 `deriveTypographyTokenVariant`의 requested size/weight/token-ID mapping이 바뀌면 `configVersion`을 올린다.
- family-local materialization framework, canonical semantic/layout enumeration, tuple compatibility, plan/rank derivation, plan identity, recipe arbitration, tier classification, queue construction, known-good resolution, plan projection, graphics/SVG rendering, mounted finalization, rendered validation, export serialization 또는 app acceptance/terminal orchestration이 바뀌면 `compositionEngineVersion`을 올린다.
- metric data/algorithm이나 font asset이 바뀌면 각각 `fontMetricsVersion` 또는 `fontAssetRevision`을 바꾼다.
- 위 owner의 실제 data/source/asset content가 하나라도 바뀌면 version bump와 함께 새 manifest/ledger entry를 만들고 `ownerSnapshotRevision`을 바꾼다.

`token-library.js`는 이 owner snapshots와 `GenerationInput`에서만 candidate를 도출하며 독립된 unversioned descriptor/count/derivation constant를 소유하지 않는다. descriptor/count/value policy는 vocabulary/motif/config version에, 공통 expansion/materialization framework는 `compositionEngineVersion`에 귀속되고 실제 source/data bytes는 owner manifest에 고정된다. 따라서 별도 token-library version 없이 canonical input의 version tuple과 `ownerSnapshotRevision`이 candidate inventory와 variant derivation을 완전히 고정한다.

`token-library.js`의 pure `deriveTypographyTokenVariant(candidateFamily, blockDecision)`는 requested size와 block policy로 `{ tokenId, requestedWeight, requestedFontWeight }`를 만든다. lexical plan slot의 `candidateId`는 size-neutral family를 참조하고 `tokenId`는 이 derivation의 exact output이다. 같은 candidate family의 size/layout plan은 같은 tuple에 남지만 token ID와 block decision이 달라 서로 다른 plan ID를 가진다.

`composition-plan-validator.js`의 pure `validateTupleCompatibility(tuple, context)`가 layout-independent semantic eligibility의 유일한 owner다. canonical slot order와 candidate index를 resolve해 recipe 존재/coherence mode, slot instance ID와 block-count/cardinality, repeated-slot strictly-ascending candidate order, source/accepted tag, hero/motif constraints, max-one endpoint의 unconditional 및 selected-optional active relation, avoid, normalized visible-text duplicate, translation-set duplicate, dynamic/phrase identity를 검사한다. 결과는 canonical recipe/candidate identities로 만든 `tupleFingerprint`, frozen `compatibleTuple` 또는 stable ordered rejection reasons를 가진 `TupleCompatibilityResult`다. 이 함수는 layout, size, fit, rank, reservation을 참조하지 않는다.

ranked-universe derivation은 canonical raw tuple을 평가할 때, known-good instantiator는 template slot을 resolve할 때, complete validator는 plan slot을 projection할 때 이 exact 함수를 호출한다. 세 경로 모두 `valid: true`의 `compatibleTuple`만 `deriveTupleLayoutFacts`에 전달하며 다른 tuple prefilter를 구현할 수 없다. planner는 이미 검증된 universe를 소비할 뿐 semantic tuple을 별도로 만들지 않는다. complete validator는 returned compatible tuple을 plan slot projection과 비교한다. `tupleFingerprint`는 planner queue의 canonical tuple key와 telemetry/test identity이며 plan schema에 중복 저장하지 않는다.

`grid-layout.js`의 pure `enumerateCanonicalLayouts(slotInstanceIds)`는 candidate value, recipe semantics, block policy, fit, rank, plan ID, reservation을 참조하지 않고 canonical-order slot instance IDs를 rectangular 3x3 complete-coverage block assignment로 열거한다. 각 `CanonicalLayoutAssignment`는 stable `layoutKey`와 block별 `footprint`, sorted `cells`, `slotInstanceId`만 가지며 `layoutKey` ascending으로 반환된다. 같은 input은 deep-equal 결과를 만들고 다른 family inventory나 planner queue 상태는 결과를 바꾸지 않는다.

`composition-plan-validator.js`의 pure `deriveTupleLayoutFacts(compatibleTuple, context)`는 이 enumerator의 전체 출력과 `context.generationInput`의 exact ratio, viewport, safe box geometry를 받아 block policy, candidate source compatibility, requested start size/alignment/vertical-alignment/orientation alternatives, typography variant derivation, motif bounds, fallback-resolved predicted fit을 확장·필터링한다. Predicted actual size/weight는 viability와 rank margin 계산에만 쓰는 validator-local 사실이며 plan identity에는 들어가지 않는다. 먼저 stable viable block decisions와 `maxCellCountBySlotInstanceId`를 확정한 뒤 validator-owned pure `derivePlanRankFacts(compatibleTuple, decision, { maxCellCountBySlotInstanceId }, context)`로 각 decision의 exact six-field key와 explanation을 만든다. 결과는 위 exact `TupleLayoutFacts` schema이며 viable decisions는 `decisionFingerprint` ascending이다. fingerprint는 sorted complete block decisions의 `hashCanonical`이다.

planner는 `TupleLayoutFacts.viableDecisions`에서 plans를 만들고 제공된 `rankFacts.rankKey`를 compare할 뿐 rank field를 다시 계산하지 않는다. known-good instantiator는 template blocks와 같은 `decisionFingerprint` record의 blocks/rank facts를 plan에 복사한다. complete validator는 plan slots로 compatible tuple을 재구성하고 같은 facts에서 decision fingerprint를 찾아 plan blocks와 `decisionTrace`를 deep-compare한다. 이 내부 계산은 `validateCompositionPlan`을 재귀 호출하지 않는다. reserved plan ID와 queue eligibility는 facts 입력이 아니므로 instantiated known-good plan도 planner enumeration 전에 같은 기준으로 검증할 수 있다.

`validateCompositionPlan(plan, context)`는 아래 순서로 모두 검사한다.

1. `composition-model.js`의 base plan/schema/plan-ID identity
2. context의 frozen `GenerationInput` object/hash/version tuple/owner snapshot과 plan `GenerationInput`의 deep equality
3. 모든 slot과 `candidateById` family의 identity equality, lexical `tokenId`/requested weight의 block-derived equality
4. plan slot projection에 대한 shared `validateTupleCompatibility` success와 returned compatible tuple identity equality
5. canonical `TupleLayoutFacts` decision membership, 3x3 coverage, block policy, requested size/orientation/alignment/weight, pure predicted fit, validator-derived rank facts와 plan `decisionTrace` deep equality
6. 각 motif slot의 versioned `validateMotifRenderParams`

하나라도 실패하면 plan은 invalid다. planner queue entry, instantiated known-good plan, renderer input은 모두 동일 context와 이 complete validator를 통과해야 한다. context-free `KnownGoodTemplate` shape validation, base validator 또는 motif validator 단독 통과를 complete plan validation으로 취급하지 않는다. context 자체는 plan이나 export에 직렬화하지 않으며 exact frozen `GenerationInput`, verified owner manifest, versioned snapshots, keyed materialization으로 replay한다.

Contract:

- plan은 JSON 직렬화 가능한 plain object다.
- schema version 3이 이 rewrite의 첫 implementable plan version이다. 문서에만 있던 version 2는 runtime에 배포되지 않았으므로 migration 대상이 아니며 validator는 v2 fixture를 reject한다.
- plan 생성은 DOM, SVG node, `getBBox()`를 참조하지 않는다.
- plan은 canonical `GenerationInput`과 `generationInputHash`를 그대로 보존한다.
- `planIdentityPayload`는 `schemaVersion`, `generationInputHash`, `recipeId`, `coherenceMode`, ID 순으로 정렬한 complete slot records, ID 순으로 정렬한 complete block decision records를 포함한다. slot의 `instanceKey`, `phrasePackId`, motif materialization identity, `occupancySafetyFactor`, `occupancyCalibrationRevision`과 block의 cells, slotInstanceId, requestedSize, requestedWeight, requestedFontWeight, alignment, verticalAlignment, orientationMode를 모두 포함한다. motif block의 두 requested weight field는 `null`이다.
- `planId = "plan:" + hashCanonical(planIdentityPayload)`이고 exact pattern은 `^plan:sha256:[0-9a-f]{64}$`다. base/composed validator, known-good instantiator, queue와 fixtures가 모두 이 constructor를 사용한다. `planId`, `decisionTrace`, rank, cursor, attempt, mounted actual size/weight/bounds/occupancy는 payload에서 제외한다. 같은 tuple이라도 cell, size, alignment, orientation 중 하나가 다르면 다른 plan ID가 되어야 한다.
- selected slot instance 수는 recipe block count와 같고 slot cardinality를 만족한다.
- slot instance ID는 plan 안에서 유일하며 모든 block은 존재하는 instance를 정확히 한 번 참조한다.
- selected lexical use와 block assignment는 한 render/finalize attempt 안에서 변경되지 않는다. reject 뒤 app은 다음 whole plan만 선택할 수 있다.
- `translationSetId`는 translation set index에서 파생하며 membership이 없으면 `null`이다.
- dynamic lexical candidate는 non-null `instanceKey`가 필요하고 static candidate는 `null`이다. dynamic `candidateId`는 stable `tokenFamilyId`와 `hashCanonical(instanceKey)`를 함께 포함하며 materialized field가 확정된 뒤에만 만든다. complete phrase는 lexical record/candidate/plan에 같은 non-null `phrasePackId`가 필요하다.
- lexical `candidateId`는 size-neutral family identity다. plan slot의 size-specific `tokenId`와 block의 requested weight fields는 context의 pure typography variant deriver 결과와 같아야 하며 tuple key에는 `tokenId`나 requested size/weight를 넣지 않는다.
- `actualSize`, `actualWeight`, `actualFontWeight`, finalization tier, rendered bounds와 mounted occupancy score는 plan이 아니라 finalization report와 SVG metadata에 기록한다.
- decision trace는 각 plan의 deterministic rank explanation만 담는다. top tie, selected plan/index, draw count 같은 selection outcome은 `InitialSelection`만 소유하며 어떤 `CompositionPlan.decisionTrace`에도 복제하지 않는다.
- plan `decisionTrace`는 matched `ViablePlanDecision.rankFacts`와 deep-equal인 exact `PlanRankFacts`다. planner, known-good, validator가 별도 rank explanation을 조립하지 않는다.

## Randomness And Reproducibility

- canonical full input은 앞에서 정의한 immutable `GenerationInput`이다.
- app layout choice는 pre-layout `layoutSeedInput`의 `app-layout` label seed를 사용한다. recipe rotation, materialization, top-tie selection은 final `GenerationInput`의 독립된 `recipe-choice`, `materialization`, `selection` label seed를 사용한다.
- ratio/border가 caller에서 이미 고정된 경우 app layout seed는 값을 바꾸지 않는다. 자동 선택 시 keyed field value만 사용하며 mutable draw를 소비하지 않는다.
- candidate의 dynamic code, table value, graphic size 같은 materialized field는 `keyedValue(materializationSeed, materializationKey, fieldName)`로 계산한다. `materializationKey`는 field 값과 final candidate ID보다 먼저 stable family key/ordinal에서 계산되며, 이 함수는 pure하고 mutable PRNG draw를 소비하지 않는다.
- candidate는 materialize 후 ID 기준 stable sort한다. keyed recipe rotation으로 한 recipe를 고정한 뒤 그 recipe의 plan만 ranking한다. inventory 수나 materialized field가 바뀌어도 mutable selection stream 위치를 이동시키지 않는다.
- selected recipe에 non-reserved hard-valid ranked plan이 하나 이상이면 planner는 injected `selectionRandomSource`를 정확히 한 번 소비하며 그 값은 최고 rank tie group의 `floor(u * tieCount)` index에만 사용한다. tie가 하나여도 draw 한 번을 소비한다. 모든 recipe가 non-reserved ranked candidate 0개면 draw는 0이고 no-candidate record를 반환한다. stream은 GenerationInput label seed마다 독립이므로 이 차이가 다른 input을 이동시키지 않는다.
- mounted rejection과 candidate cursor 이동은 selection draw를 추가하지 않는다.
- renderer, finalizer, validator, exporter는 어떤 random source도 소비하지 않는다.
- verified owner manifest를 포함한 동일한 canonical `GenerationInput`을 같은 exact `NODE_CONFORMANCE_RUNTIME`/`BROWSER_CONFORMANCE_PROFILE` pair에서 실행하면 plan deep equality와 같은 SVG structural fingerprint를 만든다.
- export, Grid toggle, Tone toggle, Compose 왕복은 active plan과 PRNG snapshot을 바꾸지 않는다.
- 위 output-affecting ownership matrix의 registry/algorithm이 바뀌면 해당 semantic version/revision과 `ownerSnapshotRevision`을 함께 증가시키고 이전 seed의 동일 결과를 암묵적으로 약속하지 않는다.

## SVG Metadata

Component root:

```text
data-composition-schema
data-composition-recipe
data-coherence-mode
data-generation-input-hash
data-node-conformance-runtime
data-browser-conformance-profile
data-vocabulary-version
data-recipe-version
data-motif-version
data-config-version
data-composition-engine-version
data-font-metrics-version
data-font-asset-revision
data-owner-snapshot-revision
data-safe-box
```

Accepted component root의 `data-node-conformance-runtime`과 `data-browser-conformance-profile`은 config snapshot의 exact pair와 같아야 한다. 다른 runtime/engine에서 current UI를 표시하더라도 이 metadata를 가장하거나 acceptance artifact를 만들 수 없다.

Token root:

```text
data-lexical-use
data-translation-set
data-composition-role
data-visual-prominence
data-mounted-occupancy-score
data-rendered-width
data-rendered-height
data-message-slot
data-fallback-tier
data-token-weight
data-instance-key
data-phrase-pack
```

Accepted token root의 `data-visual-prominence`는 plan slot의 categorical `primary | secondary | tertiary`와 같아야 한다. 별도 `data-mounted-occupancy-score`, `data-rendered-width`, `data-rendered-height`는 accepted `FinalizationReport`의 exact decimal score/bounds와 같아야 한다. Typography node의 `data-token-weight`는 `normal | bold`, SVG `font-weight` attribute는 exact `400 | 700 | 900`이며 report의 actual weight fields와 같아야 한다.

Graphic motif:

```text
data-motif-id
data-motif-candidate
data-materialization-key
data-render-params-hash
data-occupancy-safety-factor
data-occupancy-calibration-revision
data-motif-factual="false"
```

Accepted motif root의 `data-occupancy-safety-factor`와 `data-occupancy-calibration-revision`은 각각 plan slot과 accepted report의 exact factor/revision 모두와 같아야 한다. Conditional metadata는 plan 값이 non-null일 때만 기록하고 문자열 `"null"`을 쓰지 않는다. Motif node는 lexical-only attributes를 생략하고 lexical node는 motif-only attributes를 생략한다.

기존 form, function, role, context, typeface, size, weight, orientation metadata는 유지한다.

`svg.js`의 pure `deriveSvgStructuralProjection(componentRoot)`은 accepted component subtree를 preorder로 읽어 `{ nodePath, namespaceURI, localName, sortedAttributes, directText }` plain records를 만든다. Grid/debug overlay와 UI-only state는 schema-owned exclusion list로 제외하고, composition/render/finalization metadata와 visible geometry/text는 포함한다. attribute는 namespace/local-name/value tuple ascending이며 DOM object, attribute insertion order, browser serialization whitespace를 payload로 사용하지 않는다. `svgStructuralFingerprint = hashCanonical({ schemaVersion: 1, nodes })`이고 active/display/export/test가 같은 value를 공유한다. Exported SVG/PNG artifact의 byte digest는 `"sha256:" + sha256Hex(bytes)`이며 structural fingerprint와 별개다.

## Module Boundaries

### New Modules

`canonical-hash.js`

- composition identity와 manifest content identity의 canonical byte/hash contract를 소유한다. `canonicalJson`, `utf8Bytes`, `sha256Hex`, `hashCanonical`과 pinned vendored native-ES SHA-256 implementation만 export한다.
- planner, validators, candidate materializer, known-good instantiator, owner-manifest emitter/verifier, browser와 Node tests는 ID/digest를 만들 때 이 module을 import한다. 다른 module은 identity payload에 직접 `JSON.stringify`, Node `createHash`, Web Crypto 또는 별도 key sorter를 사용할 수 없다.
- vendored implementation의 license와 exact upstream revision을 source 옆에 보존한다. DOM, network, registry, random을 참조하지 않는다.

`composition-model.js`

- lexical use, translation set, relation edge, recipe, motif, `GenerationInput`, owner snapshot, discriminated plan slot, plan, `RankKey`, `InitialSelection`, `SearchQueueEntry`, `RankedPlanUniverse`, `PlannerResult`, attempt envelope/result, finalization report, terminal result의 enum/schema/base validator만 소유한다.
- motif slot의 required identity/object/hash shape는 검사하지만 motif별 `renderParams` field schema는 검사하지 않는다.
- record를 저장하지 않으며 duplicate key, stable ID, derived index helper만 제공한다.
- DOM, SVG, random을 참조하지 않는다.

`composition-recipes.js`

- recipe record, `recipeVersion`별 canonical `activeRecipeIds`, slot definition, versioned directed relation edge, sparse pair rule, layout preference data의 유일한 owner다.
- experimental activation은 별도 active set을 가진 새 `recipeVersion`으로 표현하고 planner가 읽는 unversioned flag를 두지 않는다.
- typography measurement와 SVG를 참조하지 않는다.

`motifs.js`

- `MOTIF_REGISTRY_VERSION`, GraphicMotif records, declared variant count, motif별 materialized `renderParams` schema/value algorithm과 reviewed occupancy factor/calibration revision의 유일한 owner다.
- `validateMotifRenderParams({ motifVersion, motifId, renderParams, renderParamsHash, occupancySafetyFactor, occupancyCalibrationRevision })` pure validator를 export하고 active registry record와 exact equality를 검사한다.
- data와 schema만 소유하고 SVG node를 만들지 않는다.

`composition-owner-snapshot.js`

- `COMPOSITION_ENGINE_VERSION`, generated frozen `OwnerSnapshotManifest`, root `ownerSnapshotRevision`의 runtime owner다.
- manifest emitter/verifier는 shared `canonical-hash.js`로 output owner의 canonical data와 source/data/asset files를 hash하고 HTML/CSS/module runtime dependency closure의 exact one-owner partition, owner별 required version field, generated-module canonical bytes, base-relative append-only ledger를 검사한다. merge-base에서 실행한 bootstrap은 candidate tooling을 실행하기 전에 append-only prefix와 exact candidate tooling closure/raw-byte ledger를 독립 검증한다. runtime module은 verified result만 export한다.
- vocabulary, recipe, motif, policy, metric 값을 복제하거나 planner algorithm을 구현하지 않는다.

`scripts/verify-planning-complexity.mjs`

- generated canonical JSON data만 읽는 release-only independent tuple/layout reference evaluator와 planning certificate verifier다.
- runtime validator/layout/planner를 import하지 않고 exact tuple/order/counters와 all-fit layout upper bounds를 비교한다. behavior를 선택하거나 browser bundle에 들어가지 않는다.
- source, oracle contract와 fixtures는 `manifest-tooling` owner 및 `compositionEngineVersion`에 귀속된다.

`composition-plan-validator.js`

- exact `GenerationInput`, verified owner manifest, versioned snapshots, concrete candidate index를 받는 `createPlanValidationContext(...)`, pure `deriveCanonicalCardinalityShapes(...)`, `deriveCanonicalSlotDomains(...)`, `validateTupleCompatibilityPrefix(...)`, `validateTupleCompatibility(...)`, `derivePlanRankFacts(...)`, `deriveTupleLayoutFacts(...)`, lazy `enumerateCanonicalSemanticTuples(...)`, `deriveRankedPlanUniverse(...)`, `deriveCanonicalSearchQueue(...)`, canonical `validateCompositionPlan(...)`, composed `validatePlannerResult(...)`를 export한다.
- context의 injected motif validator와 typography measurer를 호출해 base identity, lexical/recipe/relation, motif, policy/fit contract를 합성한다.
- tuple compatibility가 slot/cardinality/relation/avoid/duplicate eligibility의 유일한 callable owner이며 planner, known-good instantiator, complete validator가 공유한다.
- injected canonical layout enumerator로 tuple의 viable layout facts를 한 번의 비재귀 경로로 계산해 planner와 complete validator에 같은 결과를 제공한다.
- cardinality shape total order, unary slot-domain derivation, semantics-preserving prefix pruning, four production planning counters, lazy canonical semantic tuple traversal, selected-recipe ranked universe, exact tiered queue derivation을 소유하며 planner와 result validator가 같은 fresh derivation을 사용하게 한다.
- planner output, instantiated known-good plan, renderer input이 공유하는 유일한 complete plan validation entry point다.
- registry record, DOM, SVG, random을 소유하지 않으며 injected pure snapshot/function만 읽는다.

`composition-known-good.js`

- recipe ID, ratio, vocabulary/recipe/motif/config/composition-engine/font-metrics/font-asset tuple로 keyed되고 owner snapshot revision을 embed하지 않는 `KnownGoodTemplate` record와 context-free `validateKnownGoodTemplateShape(...)`의 유일한 owner다.
- app startup의 `createKnownGoodRegistry(...)`는 generation context 없이 shape, duplicate full key, static candidate declaration과 forbidden owner-revision field만 검사하고 frozen registry와 stable config diagnostics를 반환한다.
- `instantiateKnownGoodTemplate(template, generationInput, context)`는 template을 normal plan으로 resolve하고 canonical identity를 만든 뒤 complete validator를 통과한 plan만 반환한다. synthetic startup validation context를 만들지 않는다.
- instantiation은 app이 context에 고정한 exact `GenerationInput` object 외의 input을 reject한다.
- DOM, measurement, random을 참조하지 않는다.

`typography-metrics.js`

- `FONT_METRICS_VERSION`과 approved typeface/script의 `400|700|900`용 static metric data를 소유한다.
- `measure({ text, typeface, fontWeight, size, lineHeight, orientationMode }) → { width, height }` pure interface를 제공한다. `fontWeight`는 plan block의 exact `requestedFontWeight`인 `400 | 700 | 900`다.
- DOM, canvas, SVG, mounted font API를 참조하지 않는다. `tests/fixtures/typography-metrics.json`이 version별 golden input/output을 고정한다.

`composition-planner.js`

- canonical `generationInput`, complete frozen `validationContext`, selection random source를 입력받는다.
- recipe, lexical/motif slot tuple, block assignment를 plain object plan으로 만들고 immutable `PlannerResult`를 반환한다.
- validator-owned `deriveRankedPlanUniverse`를 소비하고 returned top tie에서 seeded selection만 수행한 뒤 `deriveCanonicalSearchQueue`의 exact queue를 result에 넣는다. 자체 semantic-tuple traversal, rank field 계산, candidate omission, tier classifier를 구현하지 않는다.
- queue에 넣기 전에 모든 plan을 composed validator로 검사하고 assembled result를 `validatePlannerResult(result, context, knownGoodPlanByRecipeId)`로 검사한 뒤 반환한다.
- DOM과 SVG node를 만들지 않는다.

Planner input contract:

```js
planComposition({
  generationInput,
  validationContext,
  knownGoodPlanByRecipeId,
  selectionRandomSource
})
```

planner는 ratio, safe box, seed, timestamp, registry/policy/composition-engine/font version과 owner snapshot revision을 `generationInput`에서 읽고 concrete candidates, recipes, relations, policies, pure helpers는 `validationContext`에서만 읽는다. app은 context 생성에 사용한 exact frozen object를 planner의 `generationInput`으로 전달해야 하며 planner는 `validationContext.generationInput === generationInput`, `hashCanonical(generationInput)`, version tuple, owner manifest revision을 모두 확인한다. `knownGoodPlanByRecipeId`는 recipe당 최대 한 개의 already-complete-valid plan을 가지며 validator-owned universe derivation이 그 ID를 complete plan materialization 뒤 ranked candidates와 queue에서 제외한다. usage history, accepted-output frequency, telemetry를 입력받지 않는다. mounted actual measurement는 context의 pure prediction이 아니라 finalizer의 책임이다.

### Changed Owners

`config.js`

- `COMPOSITION_POLICY_VERSION`, `NODE_CONFORMANCE_RUNTIME = "v22.12.0"`, `BROWSER_CONFORMANCE_PROFILE = "playwright-1.61.1/chromium-http"`, `MAX_MOUNTED_RANKED_ATTEMPTS = 8`, `MAX_CANONICAL_PREFIX_VISITS_PER_RECIPE = 50000`, `MAX_LAYOUT_DECISION_EXPANSIONS_PER_RECIPE = 200000`, `MAX_RETAINED_VIABLE_DECISIONS_PER_TUPLE = 1024`, `MAX_RANKED_PLANS_PER_RECIPE = 4096`, existing block policy, `deriveTypographyTokenVariant`의 block-to-size/weight/token-ID mapping contract의 유일한 owner다. generated config semantic payload는 conformance pair를 포함하고 release verifier는 root package, `.node-version`, CI runtime과 exact equality를 검사한다.
- Node/browser conformance pair, mounted-attempt/planning budget, footprint/size/alignment/orientation 또는 variant derivation contract가 바뀌면 version을 증가시킨다. Motif-family occupancy factor는 `motifs.js`와 `motifVersion`이 소유한다.

`vocabulary.js`

- visible text, lexical use/translation set record, lexical family descriptor, declared materialization count, dynamic reference schema/value algorithm의 유일한 owner다.
- size, block, position, prominence를 소유하지 않는다.

`token-model.js`

- concrete render token의 existing taxonomy와 composition metadata contract를 검증한다.
- recipe나 slot을 선택하지 않는다.

`token-library.js`

- lexical use를 size-neutral typography candidate family로, motif를 exact graphic candidate로 materialize한다.
- vocabulary/motif owner의 versioned descriptor와 declared count를 `compositionEngineVersion`에 귀속된 family-local materialization framework로 ordinal slots에 확장한다. 자체 descriptor/count를 소유하지 않으며 dynamic field는 precomputed materialization key의 keyed pure value로 만들고 selection random source를 받지 않는다.
- `deriveTypographyTokenVariant(candidateFamily, blockDecision)`로 size-specific token ID와 requested label/numeric weight를 결정하며 candidate family ID는 바꾸지 않는다.
- lexical candidate의 `instanceKey`/`phrasePackId`와 motif candidate의 motif/candidate/materialization/renderParams/occupancy-calibration identity를 plan까지 손실 없이 전달한다.
- hero, recipe, position을 결정하지 않는다.

`grid-layout.js`

- 3x3 geometry, packing, cell, physical fit helper와 `compositionEngineVersion`에 귀속된 pure `enumerateCanonicalLayouts(slotInstanceIds)`를 소유한다.
- enumerator는 complete rectangular assignments만 stable key 순으로 반환하고 candidate, block policy, fit, rank, reservation을 참조하지 않는다.
- word meaning과 recipe semantics를 참조하지 않는다.

`grid-selection.js`

- transition 동안 validated composition plan의 exact block/token assignment를 renderer input으로 투영한다.
- arbitrary pool에서 새 word를 고르지 않는다.
- requested size, weight, token ID, orientation, alignment를 바꾸거나 pre-render size alternate를 생성·적용할 수 없다. 모든 applied downshift는 mount 후 `grid-finalizer.js`와 `FinalizationReport` 경계에서만 일어난다.

`grid-renderer.js`

- plan과 generation-scoped `PlanValidationContext`를 받아 complete validation을 통과한 plan만 detached SVG로 렌더하고 metadata를 기록한다.
- recipe, token, size를 다시 결정하지 않는다.

`svg.js` / `export.js`

- accepted component의 canonical structural projection과 `hashCanonical` fingerprint를 소유하며 browser serialization whitespace나 attribute insertion order를 identity로 사용하지 않는다.
- exported SVG/PNG bytes의 digest는 shared `sha256Hex`로 만들고 Node crypto는 test cross-check에서만 사용한다. Grid/debug overlay와 UI-only state exclusion list는 versioned output contract다.

`grid-finalizer.js`

- mounted typography의 actual fit, discrete size downshift, position nudge, size sync와 final token-root bounds 측정을 수행한다.
- pure `deriveMountedOccupancy(...)`로 lexical/motif normalized area와 safety-factor score를 만들고 actual lexical hierarchy 및 hero-over-motif strict geometry gate를 판정한다. score formula나 factor를 복제하지 않는다.
- `FinalizationReport`를 반환하고 candidate cursor나 next plan을 선택하지 않는다.
- vocabulary, recipe, random을 참조하지 않는다.

`validation.js`

- rendered contract의 structural/physical result만 반환한다.
- semantic quality를 valid/invalid로 가장하지 않는다.
- DOM과 plan을 수정하거나 console을 쓰지 않는다.

`app.js`

- `candidate creation → composition planning → render → finalize → validate → AttemptResult`를 조정한다.
- viewport와 caller option을 capture하고 keyed ratio/border choice와 safe box를 확정해 canonical `GenerationInput`을 만든다.
- config snapshot의 exact Node/browser conformance pair를 renderer/finalizer/test diagnostics와 SVG root metadata에 전달한다. 다른 runtime/engine에서 실행될 때 current UI를 막지는 않지만 deterministic composition conformance를 주장하거나 acceptance artifact를 생성하지 않는다.
- verified owner manifest를 선택해 exact frozen `GenerationInput`에 version tuple과 `ownerSnapshotRevision`을 기록하고, versioned snapshots including active recipe IDs, full regular/template-static candidate index와 exact sorted `rankedCandidateIds`, pure canonical layout enumerator, metric/motif validators로 generation-scoped `PlanValidationContext`를 한 번 만든다.
- compatible template을 같은 context로 instantiate/complete-validate해 immutable `knownGoodPlanByRecipeId`를 만들고, 같은 context와 map object를 planner에 전달한 뒤 renderer와 fallback까지 보존한다.
- definitive attempt status, full queue와 분리된 config-versioned ranked attempt prefix, stable cursor/fallback trigger, known-good terminal policy를 소유한다.
- composed validation을 통과한 frozen `PlannerResult`를 generation snapshot에 끝까지 보존하고 active plan, planner result, finalization report, validation records, definitive attempt result를 test hook에 노출한다. no-candidate에서 known-good 또는 terminal로 간 경우도 original planner result를 null로 지우지 않는다.

Dependency direction:

```text
Source dependency (A ─→ B means B may import A)

canonical-hash ─→ composition-model
canonical-hash ─→ candidate/materialization/validation/planning/known-good identity owners
canonical-hash ─→ owner-manifest emitter/verifier

composition-model (schema/base validator only)
  ├─→ vocabulary
  ├─→ composition-recipes
  ├─→ motifs
  └─→ token-library

composition-model ─→ composition-plan-validator
composition-plan-validator ─→ composition-planner
composition-plan-validator ─→ composition-known-good
composition-plan-validator ─→ grid-renderer
canonical-hash + composition-owner-snapshot ─→ app

config ─→ grid-layout
vocabulary + motifs + config ─→ token-library

composition-planner + composition-known-good
  + grid-selection + grid-renderer
  + grid-finalizer + validation + export ─→ app

composition-owner-snapshot + vocabulary + composition-recipes + motifs
  + token-library(candidate index) + config(block policies)
  + grid-layout(canonical enumerator) + typography-metrics(pure)
  + composition-plan-validator ─→ app (builds PlanValidationContext)

Runtime data flow

app verified owner manifest + owner snapshots + full candidate index + rankedCandidateIds
  → canonical GenerationInput → frozen PlanValidationContext
KnownGoodTemplate registry + GenerationInput + context
  → instantiate/complete-validate → immutable reserved knownGoodPlanByRecipeId
app GenerationInput + context + reserved map
  → validator-owned ranked universe → planner selection → validated frozen PlannerResult
  → app generation snapshot → queue plan render with same context → mount
  → finalizer report → validation records → app AttemptResult
    ├→ accept → active/export state
    └→ reject → next ranked plan within max-8 prefix
      → queue/budget stop reason → reserved map plan → terminal policy
```

`app.js`만 composition root로서 pipeline module을 조정한다. source graph는 cycle이 없어야 하고 어떤 leaf module도 `app.js`를 import하지 않는다.

## Validation

### Automated Structural Rules

| Rule ID | Condition |
| --- | --- |
| `composition.schema` | known GenerationInput/plan schema, full semantic version tuple, owner snapshot revision, stable IDs |
| `composition.hero` | typography hero와 primary가 정확히 하나 |
| `composition.cardinality` | recipe blockCount와 모든 slot cardinality 충족 |
| `composition.slot-block` | unique slot instances와 blocks가 일대일 대응하고 cells 1-9를 한 번씩 피복 |
| `composition.relation` | direct recipe의 unconditional 및 selected-optional active requiredRelations clause가 모두 selected tuple에서 충족 |
| `composition.identity` | dynamic instanceKey, atomic phrasePackId, motif materialization 및 occupancy-calibration identity가 source부터 SVG까지 일치 |
| `composition.motif-params` | composed validator가 motifVersion/motifId별 renderParams schema와 hash를 승인 |
| `composition.duplicate-text` | normalized visible text duplicate 0 |
| `composition.translation-duplicate` | recipe가 허용하지 않은 same-set repetition 0 |
| `composition.motif` | graphic hero 0, unique motif contract 충족 |
| `composition.physical` | footprint, orientation, fit, token count contract 충족 |
| `composition.hierarchy` | support size/weight와 motif area/size가 planning comparator를 충족하고 mounted hero occupancy score가 모든 motif보다 strictly greater |
| `composition.fallback` | required hero cell-index/neutral fallback 0, rejected attempt 채택 0 |
| `composition.replan` | cursor 단조 증가, ranked mount 최대 8회, exact stop reason/fallback trigger, mounted retry random draw 0 |

validator는 기존 `{ rule, valid, nodes, detail }` 형식을 유지한다.

### Pure Tests

- shared canonical hash vector의 canonical string/UTF-8 hex/lowercase SHA-256가 exact `NODE_CONFORMANCE_RUNTIME`과 `BROWSER_CONFORMANCE_PROFILE`에서 exact-equal이고 Node crypto cross-check와 일치하는지 검사한다. forbidden type, lone surrogate, sparse array, cycle을 양쪽에서 reject한다. identity source gate는 runtime, candidate emitter/verifiers, planning verifier와 ordinary tests에서 `canonical-hash.js` 밖의 direct stringify/hash를 금지하고, exact bootstrap entrypoint의 raw-byte trust check와 named independent test cross-check만 allowlist한다. bootstrap dependency의 direct crypto import, candidate bootstrap 실행, base bootstrap의 composition identity 생성은 각각 poison-pill/source fixtures로 reject한다. process/package/`.node-version`/CI/profile/project mismatch는 test setup에서 fixture 실행 전에 실패시킨다.
- lexical use ID, translation membership, exact/close/adapted enum 검사
- lexical use가 둘 이상의 translation set에 속하면 registry/index construction rejection 검사
- current action group의 approved/unreviewed 상태 검사
- shared tuple compatibility를 통한 command/status blockCount/cardinality, accepted tag, max-one endpoint의 unconditional/conditional requiredRelations와 multi-instance required-endpoint recipe rejection 검사
- layout preference key가 declared slot definition ID인지와 role alias/unknown key rejection 검사
- directed relation selector resolution, full selector-discriminator duplicate key의 lexical-use/translation-set/tag fixture, direct avoid의 ordered-distinct forward/reverse/self/no-match와 forbidden relation field, avoid/required/prefer precedence, positive command/status edge와 recovery selected/no-edge/absent fixture 검사
- validator-owned rank derivation의 prefer rule당 최대 1 match, hierarchy-first six-field `RankKey` field order, fit-margin 6-decimal normalization과 planner-owned descending lexicographic comparator 검사
- 같은 semantic score에서 둘 다 fit하지만 큰 hero의 margin이 더 작은 fixture가 hero size/weight/area 우선으로 선택되는지 검사
- 동일 `RankKey` plan ID stable sort, `[0,1)` draw의 selected tie index, usage/frequency history가 planner input과 rank에 없음을 검사
- duplicate alternate edge rejection, multi-slot `alternatePriorityKey` ordering, motif-only other-replan 분류 검사
- 2-5 block plan별 unique slot-instance/block reference와 complete 3x3 coverage 검사
- duplicate text와 default translation-set duplicate 검사
- sparse edge-backed prefer와 direct avoid pair 검사
- HTTP status와 generic code family 분리 검사
- fixed `GenerationInput`의 CompositionPlan deep equality와 generationInputHash/version/owner-snapshot mismatch rejection
- tuple compatibility result/fingerprint/rejection-order의 planner/known-good/validator deep equality 검사
- canonical layout enumerator의 stable order/rectangular complete coverage, exact `TupleLayoutFacts`/decision fingerprint/rank facts의 planner/known-good/validator deep equality 검사
- `largest-viable-footprint`가 reserved plan과 동일한 viable layout도 비교에 포함하고 queue reservation 변화에는 불변인지 검사
- GenerationInput의 preserved border enum, motifVersion, compositionEngineVersion, content-addressed fontAssetRevision/ownerSnapshotRevision 검사
- exact `^plan:sha256:[0-9a-f]{64}$` constructor와 같은 tuple의 서로 다른 cells/size/alignment/orientation plan ID가 모두 다른지 검사
- family-local materialization ordinal/key → dynamic fields → instanceKey → final candidateId의 단방향 identity와 inventory 독립성 검사
- owner manifest를 actual canonical data/source/asset bytes에서 재계산하고 entry set/order/version-field mapping/planning certificate/root digest를 검사한다. HTML/CSS/module runtime dependency closure가 upstream entries와 `plan-to-export-runtime`으로 exact partition되는지, bootstrap/emitter/verifier closure가 `manifest-tooling`으로 완전히 귀속되는지 검사한다. merge-base에서 추출한 bootstrap으로 unchanged tooling, exact one-row recorded upgrade와 two-stage bootstrap upgrade는 accept하고 unledgered mutation, base-prefix rewrite, same-version tooling change, extra dependency와 candidate verifier/bootstrap coordinated bypass는 candidate code 실행 전에 reject한다. new downstream import/resource, known-good/graphics/renderer/finalizer/validation/export/app/style/canonical-hash source mutation과 generated-manifest byte tampering도 잡혀야 하며 stale `GenerationInput.ownerSnapshotRevision`과 과거 full-tuple digest 재사용을 reject한다.
- dynamic instanceKey, atomic phrasePackId, motif renderParams/occupancy factor/calibration revision의 registry → candidate → plan → report/SVG propagation과 hash 검사
- size-neutral lexical candidate family에서 여러 requested-size token variant를 파생하고 tuple identity는 유지하며 plan ID는 달라지는지 검사
- base-only 통과/composed motif-schema 실패 fixture, planner/instantiated-known-good/renderer의 composed validator 사용 검사
- requested/actual `normal|bold`와 `400|700|900` propagation, footprint-specific xlarge 900, plan identity/metric/SVG/report 일치 검사
- GenerationInput에서 app-layout/recipe-choice/materialization/selection label seed가 분리되고 materialization inventory 변화가 selection draw를 이동시키지 않는지 검사
- activeRecipeIds non-empty/unique/sorted/membership/version mismatch와 keyed rotation, first non-reserved viable recipe selection, same-recipe queue/reserved plan, no-ranked-candidate recipe-order fallback 검사
- context-free `KnownGoodTemplate` shape/forbidden-field/duplicate-key rejection과 generation-scoped instantiation complete validation을 검사한다. template/key의 `ownerSnapshotRevision`은 reject하고, semantic key가 같은 template은 current verified context owner revision이 바뀌어도 cycle 없이 재검증·재instantiation되는지 검사한다.
- complete frozen `PlanValidationContext`의 exact GenerationInput object/hash/geometry, verified owner manifest/candidate/version mismatch rejection과 planner/known-good-instantiator/renderer context identity 검사
- `knownGoodPlanByRecipeId`의 recipe당 최대 1개, queue ID 비중복, no-ranked-candidate/queue-exhaustion/attempt-budget-exhaustion 시 동일 reserved plan object handoff 검사
- validator-owned cardinality shape의 `[totalInstanceCount, ...counts]` numeric total order와 unary slot domains의 source/tag/required-review predicates 및 sorted membership을 검사한다. repeated same-definition instances는 candidate ID strictly ascending 하나만 남아 candidate permutation과 compensating layout swap이 같은 visual composition을 중복 생성하지 않아야 한다. active snapshot에서 independent reference와 domain/prefix-pruned lazy product의 valid fingerprint set/order가 exact-equal이고, not-fully-bound cross-slot predicate가 prefix reject되지 않으며 layout predicate가 domain/prefix에 들어가지 않는지 검사한다.
- 모든 active recipe의 production all-fit dry run과 independent planning oracle에서 tuple/order, prefix visits, raw layout-decision expansions가 exact-equal이고 retained/ranked counts가 certified upper bound 이하여야 한다. 네 config limit의 limit-1/limit/exceeds-limit fixture, skipped increment/omitted branch/rejected-alternative/retained-peak faulty adapter, no truncation, breach 시 mount 0/partial PlannerResult 0/previous component 보존을 검사하고 transient complete plan collection이 두 세트를 넘지 않는지 benchmark assertion으로 고정한다.
- validator-owned fresh ranked universe와 shared `validatePlannerResult`를 통한 selected/no-candidate truth, exact active rotation/examined prefix/top rank/tie IDs/universe fingerprint, reserved exclusion, full queue membership/order/tier/cursor/fingerprint/plan deep equality 검사. omitted/extra/reordered/mis-tiered entry와 거짓 no-candidate를 각각 reject한다
- selection outcome field가 `InitialSelection`에만 있고 모든 plan decision trace에는 plan-local rank explanation만 있는지 검사
- finalization reject/validation reject의 definitive `AttemptResult`, full queue 보존, ranked prefix 최대 8회, queue-exhausted/attempt-budget-exhausted/no-candidate trigger, known-good sentinel cursor, candidate cursor 단조 증가, ranked/known-good source identity, full terminal attempt result와 display/export identity 검사
- exact Node/Chromium conformance pair에서 mounted token-root bounds와 6-decimal occupancy score를 검증한다. 모든 active motif의 512×512 opacity-weighted calibration revision/reviewer/factor가 fixture와 같고 p95 coverage-factor monotonicity 및 no-default rule을 만족해야 한다. downshift된 small typography hero와 large motif의 family-factor score equality/역전은 stable occupancy hierarchy reason으로 reject하고, hero score가 strictly greater인 control은 accept하며 every report block의 bounds/factor/revision/score가 formula와 exact-equal인지 검사한다.
- SVG `data-visual-prominence` categorical value와 `data-mounted-occupancy-score` decimal value가 각각 plan/report owner와 exact-equal이고 서로의 domain을 받을 수 없는지 검사한다. Motif-only factor/revision metadata는 plan slot과 report 양쪽에 exact-equal이어야 하며 lexical node에는 나타나지 않아야 한다.
- SVG root의 Node/browser conformance pair가 config와 exact-equal인지 검사한다. Attribute insertion order/serialization whitespace가 달라도 canonical structural projection/fingerprint가 같고 visible geometry/text/metadata mutation은 달라져야 한다. Grid/debug overlay와 UI-only toggle은 projection에서 제외되며 SVG/PNG byte digest는 shared SHA-256와 Node cross-check가 일치해야 한다.
- expressive-range fixture version, telemetry population denominator, blind artifact hash, side-specific ratings와 post-submit unblinding 검사
- concentration trigger당 review 1개, disposition requirement, successor report/version linkage, open-review acceptance gate 검사
- first-read side/node stable identity와 visible-text collision fixture 검사
- no-ranked-candidate → reserved plan accept/reject/missing-plan 세 transition과 nullable terminal attempt/report, display/export identity fixture 검사
- selected, queue-exhausted/attempt-budget-exhausted/no-candidate known-good, terminal failure에서 app generation snapshot/test hook이 같은 full frozen `PlannerResult` object를 보존하는지 검사
- language-stratum reviewer qualification과 translation-error ledger disposition 검사
- 양쪽 hero-language/manifest parity, manifest completeness, reviewer qualification coverage, language-keyed naturalness map, mixed-language rubric requirement와 every active motif × requested/downshifted visual-hierarchy cell coverage/first-read/legibility gate 검사. Non-null cell의 canonical motif ID가 active registry에서 resolve되고 candidate plan slot 및 SVG `data-motif-id`와 exact-equal인지도 검사한다.
- lexical/stratum/qualification/ledger의 canonical `en|ko|zh` key mismatch rejection
- planner, model, recipe module browser-global 금지
- finalizer, validator, exporter random/vocabulary 참조 금지
- grid-selection이 validated requested token/size/weight/orientation/alignment를 변경하거나 pre-render alternate를 적용하지 않는지 검사
- module cycle 0

### Browser And Soak Tests

- pilot recipe별 fixed-seed structural fixture
- supported ratio별 valid hero placement
- forced overflow에서 same-use discrete fallback
- same footprint typography size synchronization
- mounted reject에서 ranked plan 최대 8회 뒤 deterministic known-good 전환과 이전 valid Component 보존
- 기존 cell-index fallback 기대 fixture를 삭제하거나 required-hero rejection fixture로 migration
- barcode/QR uniqueness
- Random 1,000회 structural/physical violation 0
- reserved known-good plan 사용 0
- Grid/Tone/Compose/export 전후 active plan과 PRNG 불변
- current PNG/SVG export workflow 유지

### Expressive-Range Telemetry

`tests/fixtures/expressive-range-inputs.v1.json`은 sample schema version과 10,000개의 canonical `GenerationInput`을 고정한다. sample file, semantic version tuple, font asset revision 또는 owner snapshot revision이 바뀌면 별도 report series를 만든다.

Telemetry는 다음 population을 섞지 않는다.

| Population | Denominator | Required fields | Purpose |
| --- | --- | --- | --- |
| `initial-selection` | GenerationInput당 정확히 1 | input ID, ranked-universe fingerprint, recipe order/start index, nullable selected recipe, `selected|no-candidate`, `topRankKey`, `topTiePlanIds`, nullable selected plan/hero/index, draw count | recipe arbitration, enumeration, selection stream 검증 |
| `attempt` | mounted render/finalize 시도당 1 | input ID와 full `AttemptResult` including envelope, finalization, validation, definitive status/reasons | overflow/validation/replan 진단 |
| `accepted-output` | GenerationInput당 최대 1 | accepted plan/hero, recipe, language, script, footprint, orientation, motif, fallback summary | 실제 출력 분포와 editorial review |
| `terminal-failure` | accepted output이 없는 GenerationInput당 1 | complete terminal result, nullable last attempt result, displayed/export identity | fail-closed 감사 |

모든 recipe가 non-reserved ranked candidate 0개를 반환하면 initial-selection event는 `PlannerResult.initialSelection`을 그대로 투영해 non-empty `recipeOrder`, valid `recipeStartIndex`, `selectedRecipeId: null`, `status: "no-candidate"`, `topRankKey: null`, `topTiePlanIds: []`, `selectedPlanId: null`, `selectedTieIndex: null`, `selectionDrawCount: 0`, `heroLexicalUseId: null`이다. no-candidate count/rate는 별도 report하고 아래 expected/observed 합계에서는 제외한다.

Implementation distribution assertion은 mounted retry의 영향을 받지 않는 `status: "selected"` initial-selection population만 사용한다. expected count는 raw eligible hero 수가 아니라 planner의 실제 최고 rank tie set에서 계산한다. selected frozen input `i`의 non-empty 최고 tie set을 `T_i`라 할 때 hero `h`의 기대값은 다음과 같다.

```text
expected(h) = Σ_i count(plan in T_i whose hero is h) / |T_i|
```

동일한 sample의 initial selected plan으로 `observed(h)`를 구한다. `expected(h) >= 25`인 hero에서 `observed / expected`가 `0.5-2.0` 밖이면 implementation distribution failure다. 이 검사는 enumeration, tie selection, random stream coupling 버그를 찾는다.

Editorial concentration은 `accepted-output` population의 별도 report다. hero별 selection rate, top share, non-zero median, HHI를 기록하고 한 hero가 non-zero median의 2배를 넘으면 curation review를 연다. mounted rejection과 known-good 사용도 함께 표시한다. 이는 `林` 같은 token의 과집중을 발견하기 위한 신호이며 구조 validator failure로 처리하지 않는다.

```js
{
  schemaVersion: 1,
  id: "concentration:series-v1:forest-topic-zh",
  reportSeriesId: "expressive-range:v1",
  vocabularyVersion: 1,
  recipeVersion: 1,
  motifVersion: 1,
  configVersion: 1,
  compositionEngineVersion: 1,
  fontMetricsVersion: 1,
  fontAssetRevision: "sha256:6d4f...",
  ownerSnapshotRevision: "sha256:ab91...",
  heroLexicalUseId: "forest.topic.zh",
  trigger: {
    observedRate: 0.081,
    nonZeroMedianRate: 0.034,
    multiple: 2.382353
  },
  status: "open",
  disposition: null,
  reviewerIds: [],
  evidence: null,
  successorReportSeriesId: null
}
```

Threshold를 넘긴 hero마다 full version tuple과 owner snapshot에 고정된 `ConcentrationReview`를 정확히 하나 만든다. `status`는 `open | resolved`, resolved `disposition`은 `approved-curation | vocabulary-fix | planner-fix`다. `approved-curation`은 typography/product reviewer 두 명과 편향이 의도된 이유를 요구한다. `vocabulary-fix`와 `planner-fix`는 변경된 corresponding owner version과 새 owner snapshot revision을 사용한 successor report series를 요구하며 그 series에서 같은 hero가 threshold를 넘지 않아야 resolve할 수 있다. Phase E와 전체 acceptance는 `open` review가 0일 때만 통과한다. 이 disposition gate가 “explained frequency skew”의 유일한 정의이며 concentration 자체를 structural validator failure로 바꾸지는 않는다.

### Human Evaluation

자동 validator는 의미 품질을 증명하지 않는다.

- designer가 좋은 조합 30-50개와 나쁜 조합 20개를 먼저 작성한다.
- baseline과 candidate를 동일 seed, 동일 ratio로 최소 60쌍 생성하고 아래 visual-hierarchy coverage가 더 큰 수를 요구하면 그 수까지 늘린다.
- frozen set은 `command|status × ko/hangul|en/latin|zh/han`의 6개 linguistic stratum에 각각 최소 10쌍을 배정한다.
- 별도 visual-hierarchy cell은 active `motifId × heroFinalizationClass` 전부다. class는 candidate hero의 finalization `fallbackTier === 0`이면 `requested`, `> 0`이면 `downshifted`다. 각 cell은 해당 exact motif를 가진 candidate pair 최소 10개를 요구한다. 한 pair는 linguistic stratum 하나와 visual cell 하나에 동시에 count할 수 있다.
- frozen fixture는 아래 replay schema를 사용하고 baseline/candidate artifact를 생성 시점에 repository test artifact로 고정한다.
- `candidateSide`는 fixture 생성 시 고정하고 전체, ratio별, linguistic stratum별, visual-hierarchy cell별 left/right 수 차이가 최대 1이 되도록 counterbalance한다.
- source를 가리고 baseline/candidate의 `evaluatedLanguages` 합집합 모두에 qualified인 서로 다른 reviewer 최소 2명이 독립 평가한다. 한 reviewer가 전체 corpus의 모든 언어 자격을 가질 필요는 없지만 자신이 맡은 fixture의 언어는 모두 충족해야 한다. fixture와 side assignment는 평가 중 재생성하지 않는다.
- 평가 항목은 hero clarity, semantic plausibility, legibility, visual interest, evaluated language별 lexical naturalness다. mixed-language fixture에는 multilingual naturalness를 추가한다.
- disagreement와 자유 메모를 보존한다.

Frozen pair fixture:

```js
{
  schemaVersion: 1,
  fixtureId: "blind-command-ko-001",
  stratum: { recipeId: "command", heroLanguage: "ko", heroScript: "hangul" },
  visualHierarchyCell: {
    motifId: "motif.pseudo-qr",
    heroFinalizationClass: "downshifted"
  },
  candidateSide: "left",
  baseline: {
    revision: "git:baseline-sha",
    evaluatedLanguages: ["ko"],
    generationInput: {
      schemaVersion: 1,
      seed: 305419896,
      generationTimestamp: "2026-07-13T12:00:00+09:00",
      ratio: "3:4",
      borderMode: "corner-stroke",
      viewport: { width: 1440, height: 1200, devicePixelRatio: 2 },
      safeBox: { x: 0, y: 0, width: 720, height: 960 },
      vocabularyVersion: 1,
      recipeVersion: 0,
      motifVersion: 1,
      configVersion: 1,
      compositionEngineVersion: 1,
      fontMetricsVersion: 1,
      fontAssetRevision: "sha256:6d4f...",
      ownerSnapshotRevision: "sha256:baseline-owner..."
    },
    viewportSafeBoxBasis: "captured-in-generation-input",
    fingerprint: "sha256:...",
    svg: { path: "artifacts/blind/...baseline.svg", sha256: "..." },
    png: { path: "artifacts/blind/...baseline.png", sha256: "..." }
  },
  candidate: {
    revision: "git:candidate-sha",
    evaluatedLanguages: ["ko"],
    generationInput: {
      schemaVersion: 1,
      seed: 305419896,
      generationTimestamp: "2026-07-13T12:00:00+09:00",
      ratio: "3:4",
      borderMode: "corner-stroke",
      viewport: { width: 1440, height: 1200, devicePixelRatio: 2 },
      safeBox: { x: 0, y: 0, width: 720, height: 960 },
      vocabularyVersion: 1,
      recipeVersion: 1,
      motifVersion: 1,
      configVersion: 1,
      compositionEngineVersion: 1,
      fontMetricsVersion: 1,
      fontAssetRevision: "sha256:6d4f...",
      ownerSnapshotRevision: "sha256:candidate-owner..."
    },
    viewportSafeBoxBasis: "captured-in-generation-input",
    fingerprint: "sha256:...",
    svg: { path: "artifacts/blind/...candidate.svg", sha256: "..." },
    png: { path: "artifacts/blind/...candidate.png", sha256: "..." }
  }
}
```

각 artifact의 `fingerprint`는 위 `svgStructuralFingerprint`, `svg.sha256`과 `png.sha256`은 respective frozen file bytes의 `"sha256:" + sha256Hex(bytes)`다. `evaluatedLanguages`는 그 side에서 lexical naturalness 평가 대상인 모든 visible lexical typography node의 canonical `en|ko|zh` language를 sorted unique array로 고정한다. 숫자-only reference와 motif는 제외하지만 hero는 반드시 포함한다. baseline과 candidate의 expected hero language는 모두 fixture `stratum.heroLanguage`와 같고 두 artifact의 `evaluatedLanguages` 배열도 deep-equal이어야 한다. Non-null `visualHierarchyCell.motifId`는 active motif registry에서 exact 한 record로 resolve되고 candidate plan motif slot의 `motifId` 및 artifact `data-motif-id`와 같아야 한다. `heroFinalizationClass`는 accepted finalization report에서 파생한 class와 같아야 하며 두 cell field는 source label과 함께 평가 화면에는 노출하지 않는다. 각 side는 이 language set, revision, viewport, safe box, full version tuple, font asset revision, owner snapshot revision을 replay할 수 있어야 한다. 평가 UI는 structural/byte hash와 language/owner manifest를 먼저 검증하고 mismatch fixture를 열지 않는다.

Immutable review result는 다음 qualification snapshot을 포함한다.

```js
{
  fixtureId: "blind-command-ko-001",
  reviewerId: "reviewer-ko-01",
  qualificationSnapshot: [{
    language: "ko",
    basis: "native",
    verifiedBy: "evaluation-owner-01",
    verifiedAt: "2026-07-13T12:00:00+09:00"
  }],
  artifactHashes: {
    left: "sha256:candidate-artifact...",
    right: "sha256:baseline-artifact..."
  },
  ratingsBySide: {
    left: {
      heroClarity: 4,
      semanticPlausibility: 4,
      legibility: 5,
      visualInterest: 4,
      lexicalNaturalnessByLanguage: { ko: 4 }
    },
    right: {
      heroClarity: 3,
      semanticPlausibility: 3,
      legibility: 4,
      visualInterest: 3,
      lexicalNaturalnessByLanguage: { ko: 4 }
    }
  },
  firstReadBySide: {
    left: {
      slotInstanceId: "hero-1",
      lexicalUseId: "upgrade.command.ko",
      nodeFingerprint: "sha256:left-hero-node...",
      visibleText: "업그레이드"
    },
    right: {
      slotInstanceId: "baseline-primary-1",
      lexicalUseId: "upgrade.command.ko",
      nodeFingerprint: "sha256:right-primary-node...",
      visibleText: "업그레이드"
    }
  },
  firstAttentionSide: "left",
  preferenceSide: "left"
}
```

Qualification `basis`는 `native | professional | certified` 중 하나이며 evaluation owner가 평가 전에 검증한다. 결과 집계는 shared `evaluatedLanguages`의 모든 language와 일치하는 qualification snapshot이 없으면 reviewer-fixture result 전체를 거부한다. 각 side의 `lexicalNaturalnessByLanguage` key set은 artifact `evaluatedLanguages`와 exact-equal이어야 하고 값은 각각 1-5다. shared language set이 둘 이상이면 두 side rating 모두 `multilingualNaturalness`를 요구한다. Translation-error ledger adjudicator도 해당 record language qualification을 가져야 한다.

Raw review result는 source label을 노출하지 않고 `left | right`만 기록한다. `ratingsBySide`는 두 side 모두 hero clarity, semantic plausibility, legibility, visual interest와 language-keyed lexical naturalness를 가져야 하며 shared language manifest가 mixed-language이면 두 side 모두 `multilingualNaturalness`를 추가한다. `firstReadBySide`의 key가 selected side identity이고, evaluation harness는 immutable SVG에서 클릭한 node의 `data-message-slot`과 `data-lexical-use`를 읽어 `slotInstanceId`, `lexicalUseId`를 채운다. `nodeFingerprint = hashCanonical({ artifactSha256, rootToNodeOrdinalPath, slotInstanceId, lexicalUseId })`다. `visibleText`는 audit display일 뿐 identity나 일치 판정 key가 아니다.

Review result를 immutable하게 저장한 뒤에만 aggregator가 frozen fixture의 `candidateSide`를 읽는다. 이 mapping으로 `ratingsBySide`, `firstReadBySide`, `preferenceSide`를 candidate/baseline 관측값으로 변환한다. candidate hero 식별은 candidate artifact의 expected hero `slotInstanceId + lexicalUseId + nodeFingerprint`와 mapped first-read record가 모두 일치할 때만 true다. 따라서 양쪽에 같은 visible text가 있어도 충돌하지 않는다. derived preference는 `candidate | baseline | tie`이며 raw `preferenceSide`는 `left | right | tie`다.

각 평가 항목은 5점 척도를 사용한다.

| Score | Anchor |
| --- | --- |
| 1 | 의도 파악 또는 사용이 거의 불가능함 |
| 2 | 큰 문제가 있어 수정 없이는 수용하기 어려움 |
| 3 | 의도는 전달되며 최소 수용 가능함 |
| 4 | 명확하고 안정적이며 작은 개선만 필요함 |
| 5 | 매우 명확하고 의도적으로 완성도 높음 |

평가자는 각 side에서 가장 먼저 읽히는 node를 선택하고, pair의 최초 주의 side와 overall preference를 `left`, `right`, `tie` 중 하나로 기록한다. candidate/baseline label은 평가 화면과 raw result에 노출하지 않는다. mapped candidate-side semantic plausibility 1-2점을 `incoherent`로 정의한다. 모든 reviewer-fixture-side rating을 독립 observation으로 합산하고 tie는 preference 분모에서 제외한다.

Pilot acceptance:

- 6개 stratum 각각 mapped candidate-side 첫 시선 hero stable identity 일치율 90% 이상
- 모든 active motif의 `requested|downshifted` visual-hierarchy cell 각각 mapped candidate-side 첫 시선 hero stable identity 일치율 90% 이상
- incoherent 평가 10% 이하
- non-tie overall preference에서 candidate 선택률 55% 이상
- 각 stratum의 candidate legibility 평균이 같은 stratum baseline보다 낮지 않음
- 각 visual-hierarchy cell의 candidate legibility 평균이 같은 cell paired baseline보다 낮지 않음
- shared manifest의 각 language별 candidate `lexicalNaturalnessByLanguage[language]` 평균이 같은 paired fixture의 baseline 평균보다 낮지 않음
- frozen `vocabularyVersion`의 approved translation member에 연결된 `open` translation-error ledger record 0

## Acceptance Criteria

- 모든 recipe Component에 typography hero가 정확히 하나 있다.
- graphic motif는 primary 또는 hero가 되지 않는다.
- hard compatibility와 duplicate violation이 없다.
- direct plan은 approved directed relation edge를 모두 충족한다.
- repeated slot 후보 permutation은 한 canonical tuple만 만들고 required relation endpoint는 v1에서 max-one이다.
- 의미와 3x3 위치 사이에 universal hard mapping이 없다.
- required hero fallback이 lexical meaning을 보존한다.
- current discrete size, no-scale, font, weight, orientation, line-height, stroke 계약을 유지한다.
- verified owner manifest를 포함한 같은 canonical `GenerationInput`을 declared exact Node/browser conformance pair에서 실행하면 같은 plan과 structural fingerprint를 만든다.
- planner result queue가 fresh canonical ranked universe의 selected-recipe plan을 누락·추가 없이 정확히 한 번씩 포함한다.
- lexical/motif conditional identity와 complete block decisions가 plan ID와 SVG metadata에 보존된다.
- mounted occupancy는 obvious geometry takeover를 막고 every active motif × requested/downshifted blind cell에서 typography hero first-read gate를 통과한다.
- Random 1,000회 structural/physical violation, rejected-plan 채택, generation당 ranked mount 8회 초과, known-good fallback 사용이 0이다.
- 10,000-input expressive-range report series가 생성되고 모든 triggered `ConcentrationReview`의 `open` record가 0이다.
- blind pilot이 human evaluation gate를 통과한다.
- 기존 controls, Compose mode, Grid/Tone toggle, PNG/SVG export가 유지된다.
- runtime AI, external NLP, 새 UI를 도입하지 않는다.

## Delivery Plan

### Phase A: Inventory, Curation, And Trust Foundation

Files:

- repository root `package.json`
- repository root `.node-version` (new)
- `.github/workflows/micro-graphic-generator.yml` (new, exact Node runtime)
- `src/vocabulary.js`
- `src/composition-model.js` (new)
- `src/canonical-hash.js` (new)
- `src/vendor/sha256.js` (new, pinned native-ES source)
- `src/vendor/sha256.LICENSE.txt` (new, license/upstream revision note)
- `tests/fixtures/composition-vocabulary.json` (new)
- `tests/fixtures/composition-owner-snapshots.json` (new, schema-1 empty/genesis ledger)
- `scripts/bootstrap-verify-composition-owner-snapshot.mjs` (new, base-ref trust root)
- `scripts/verify-composition-owner-snapshot.mjs` (new, base verifier before activation)
- `scripts/verify-planning-complexity.mjs` (new, synthetic-oracle foundation)
- `tests/runtime-conformance.mjs` (new, imported before every generator test entrypoint)
- `tests/run-tests.mjs`
- `tests/pure.test.mjs`

Work:

- current visible token을 ID, text, language, typeface, render taxonomy로 export한다.
- 62개 action group을 use별로 audit하고 exact/close/adapted를 기록한다.
- `QUICK` 같은 modifier와 ambiguous use를 분리한다.
- organization, mention, hashtag, HTTP status, generic code family를 분리한다.
- good 30-50, bad 20 example corpus를 작성한다.
- translation audit disagreement를 versioned translation-error ledger에 기록한다.
- root package engine, `.node-version`, CI setup을 exact Node `22.12.0`으로 맞추고 `tests/runtime-conformance.mjs`가 `process.version === "v22.12.0"` 및 package/CI/config pair를 fixture 실행 전에 검증하게 한다.
- 별도 reviewed foundation change로 shared canonical hash, bootstrap, candidate-independent manifest/planning verifiers, CI base-ref invocation과 genesis ledger를 먼저 land한다. Candidate emitter와 runtime manifest activation은 이 change에 넣지 않는다.
- identity source gate는 merge-base에서 추출된 bootstrap entrypoint만 raw-byte trust용 direct Node crypto를 허용하고 dependency/candidate execution을 금지한다. candidate-bootstrap poison-pill fixture로 base-ref bootstrap만 실행되는지 증명한다.
- 이 단계에서는 visual output을 바꾸지 않는다.

Gate:

- registry schema, translation-set membership uniqueness, reviewStatus test 통과
- current generator regression test 통과
- pilot required use가 모두 approved
- exact Node runtime/package/`.node-version`/CI/config conformance와 pre-fixture fail-fast canary 통과
- bootstrap direct-crypto allowlist, dependency rejection과 candidate-bootstrap poison-pill canary 통과
- bootstrap foundation이 merge-base에서 실행되고 unchanged/recorded-upgrade/unledgered-mutation canary를 통과한 뒤에만 Phase B 시작

### Phase B: Command And Status Pilot

Files:

- `src/canonical-hash.js` (Phase A trust foundation, unchanged)
- `src/vendor/sha256.js` (Phase A trust foundation, unchanged)
- `src/config.js`
- `src/token-library.js`
- `src/composition-recipes.js` (new)
- `src/motifs.js` (new)
- `src/composition-plan-validator.js` (new)
- `src/composition-planner.js` (new)
- `src/composition-owner-snapshot.js` (new, generated manifest)
- `src/grid-layout.js`
- `src/typography-metrics.js` (new)
- `src/typography-metrics-data.js` (new)
- `tests/fixtures/composition-plan-baseline.json` (new)
- `tests/fixtures/canonical-hash-vectors.json` (new)
- `tests/fixtures/composition-owner-snapshots.json` (Phase A에서 도입, append-only)
- `tests/fixtures/planning-complexity.json` (new)
- `tests/fixtures/typography-metrics.json` (new)
- `scripts/emit-composition-owner-snapshot.mjs` (new)
- `scripts/verify-composition-owner-snapshot.mjs` (Phase A base verifier, unchanged)
- `scripts/verify-planning-complexity.mjs` (Phase A independent evaluator, unchanged)
- `tests/playwright.config.mjs` (existing, exact Node/browser conformance pair assertion)
- `tests/pure.test.mjs`

Work:

- `command`와 `status` recipe를 선언한다.
- versioned relation edges와 두 recipe의 2-5 block/direct unconditional·conditional required-relation fixture를 만든다.
- `GenerationInput`, shared canonical byte/hash module, Phase A에서 강제한 exact Node runtime과 Chromium conformance profile, config/composition-engine version, pure font-metric data와 measurer, generated owner snapshot manifest/emitter/verifier/append-only ledger를 구현하고 Phase A merge-base bootstrap으로 candidate tooling을 검증한다.
- exact GenerationInput, verified plan-to-export/tooling owner closure, versioned owner/candidate/active-recipe snapshot, explicit ranked candidate IDs, independent-oracle planning complexity certificates, canonical layout enumerator의 `PlanValidationContext`, cardinality-shape total order, repeated-slot symmetry break, shared unary domains/prefix/tuple compatibility, bounded lazy semantic tuple/ranked universe/queue와 rank/layout facts, complete plan/result validators, negative context/motif fixtures를 구현한다.
- vocabulary/motif versioned descriptors에서 token library의 typography/graphic candidate를 family-local ordinal/materialization key 기반으로 도출하고 config-versioned typography variant mapping을 적용한다.
- keyed recipe rotation, first-viable recipe arbitration, canonical universe와 exact-equal한 same-recipe queue를 구현한다.
- motif를 포함한 complete candidate index와 graphic slot plan shape를 test-only path에서 만든다. live motif SVG render는 아직 연결하지 않는다.
- test-only 또는 internal feature flag path에서 CompositionPlan을 만든다.
- current render path는 아직 유지한다.

Gate:

- fixed GenerationInput의 2-5 block plan deep equality
- 10,000 plan에서 composed schema, cardinality, direct relation, duplicate violation 0
- planner/test tuple projection/validator의 compatibility fingerprint와 rejection reasons identity 통과
- keyed inventory change 전후 selection draw 위치 불변
- fixed seed의 recipeOrder/selectedRecipeId와 cross-recipe queue entry 0
- owner source/data byte 변경, stale snapshot revision, same-version ledger reuse rejection 통과
- merge-base bootstrap의 legitimate unchanged/recorded tooling upgrade와 unledgered/coordinated bypass rejection, app import closure drift, canonical hash/tooling closure drift와 downstream render/finalize/export source mutation rejection 통과
- shared canonical hash의 exact `v22.12.0`/`playwright-1.61.1/chromium-http` fixed-vector parity, forbidden-input rejection, scoped direct identity hashing source gate 통과
- cardinality shape total order, repeated-slot one-representation, max-one required endpoint, unary-domain/prefix-pruned enumeration과 independent reference valid fingerprint equivalence 통과
- 모든 active recipe의 four-counter planning certificate가 independent all-fit oracle와 config limits 이내이고 fault-injection/exceeds-limit snapshot/runtime fixture가 mount 전 fail-closed하는지 통과
- omitted/extra/reordered/mis-tiered queue와 거짓 no-candidate rejection 통과
- planner/validator가 공유한 tuple-layout facts와 reserved-independent layout preference fixture 통과
- versioned `400|700|900` typography metric golden fixture와 plan weight identity 통과

### Phase C: Layout Integration And Fallback

Files:

- `src/app.js`
- `src/composition-known-good.js` (new)
- `src/graphics.js`
- `src/grid-selection.js`
- `src/grid-layout.js`
- `src/grid-renderer.js`
- `src/grid-finalizer.js`
- `src/validation.js`
- `tests/fixtures/motif-occupancy-calibration.json` (new)

Work:

- composition plan을 active random render path에 연결한다.
- grid-selection의 기존 pre-render size alternate 경로를 제거하고 exact validated block decision projection으로 제한한다.
- Phase B motif candidate를 live SVG renderer에 연결해 2-5 block pilot plan을 모두 render 가능하게 한다.
- reviewed occupancy factor/calibration revision을 registry에서 candidate, plan slot, finalization report와 motif SVG metadata까지 default 없이 전달한다.
- lexicographic placement와 typography-first hierarchy를 적용한다.
- role-preserving fallback, mounted cross-kind occupancy safety gate와 plan rejection/replan을 구현한다.
- context-free known-good template registry, generation-scoped complete-valid reserved plan map, frozen planner-result generation snapshot/test hook, max-8 ranked prefix와 stop-reason-aware known-good attempt envelope, app-owned definitive `AttemptResult`를 구현한다.
- 기존 cell-index fallback test를 finalization/validation reject AttemptResult와 bounded whole-plan replan test로 교체한다.
- SVG metadata와 structural validator를 추가한다.

Gate:

- supported ratio fixed fixtures 통과
- command/status 5-block motif fixture의 live render/finalize/metadata 통과
- font-ready exact Chromium profile fixture에서 every token-root bounds/occupancy formula가 일치하고 downshift된 hero보다 motif가 같거나 큰 plan은 reject, strictly-lower motif control은 accept
- every active motif의 actual paint/opacity calibration fixture, reviewed family factor와 revision/no-default/monotonicity 및 registry → candidate → plan → report/SVG exact propagation gate 통과
- categorical `data-visual-prominence`와 decimal `data-mounted-occupancy-score`의 separate-domain metadata validation 통과
- instantiated known-good plan과 planner/validator의 tuple compatibility fingerprint 및 tuple-layout facts identity 통과
- finalization-reject와 validation-reject `AttemptResult`/terminal fixtures 통과
- queue가 8개 초과인 systemic reject fixture에서 ranked mount 8회, `attempt-budget-exhausted` known-good 전환, remaining queue mount 0 통과
- selected/no-candidate/known-good/terminal path의 frozen `PlannerResult` snapshot identity 통과
- Random 1,000회 structural/physical violation 0
- canonical structural fingerprint/raw artifact byte hash, export와 PRNG invariants 통과

### Phase D: Graphic Motif Expansion And Hardening

Files:

- `src/graphics.js`
- `src/motifs.js`
- `src/grid-renderer.js`
- `src/composition-recipes.js`
- `tests/generator.spec.mjs`

Work:

- pilot 이후 추가 motif record와 renderer schema를 순차 등록한다.
- motif별 density, uniqueness, renderParams telemetry와 negative fixtures를 확장한다.
- planning comparator와 mounted occupancy safety 양쪽에서 motif의 geometric takeover를 막고 human first-read gate로 perceptual hierarchy를 검증한다.

Gate:

- barcode/QR uniqueness
- graphic primary 0
- motif frequency, intrinsic planning hierarchy, mounted occupancy와 perceptual first-read review 통과

### Phase E: Evaluation And Expansion

Work:

- `tests/fixtures/expressive-range-inputs.v1.json`과 population별 telemetry report를 생성한다.
- revision/full-input/artifact-hash를 가진 6개 linguistic stratum 및 every active motif × requested/downshifted visual-hierarchy cell의 blind fixture와 immutable SVG/PNG artifact를 생성한다.
- 언어별 reviewer qualification snapshot과 translation-error ledger version을 review result에 고정한다.
- linguistic/visual cell minimum을 모두 만족하는 60쌍 이상 blind comparison을 실행한다.
- expressive-range report와 reviewer disagreement를 분석한다.
- threshold를 넘긴 hero의 `ConcentrationReview`를 만들고 approved curation 또는 versioned corrective rerun으로 모두 resolve한다.
- gate 통과 시 `process`, `identity`, `signal`을 순차 추가한다.
- `editorial-fragment`와 `multilingual-echo`는 실험용 active set을 가진 별도 `recipeVersion`에서 검증한다. UI/app flag는 GenerationInput 생성 전에 그 version을 선택할 수 있지만 planner에 unrecorded flag로 전달하지 않는다.

Gate:

- linguistic stratum과 motif/downshift visual-hierarchy cell별 human evaluation acceptance 통과
- `npm run test:generator` 통과
- `npm run test:generator:soak` 통과
- expressive-range report의 open `ConcentrationReview` 0
- README, fixtures, spec status를 실제 결과로 갱신

## Review Findings Resolution

| Cold-start finding | Resolution in this spec |
| --- | --- |
| universal concept와 번역 등가성 오류 | `lexicalUse` + qualified `translationSet` |
| polarity, urgency, intent의 intrinsic 고정 | recipe/composition context로 이동 |
| domain 교집합의 false confidence | sparse typed relation과 pair affinity |
| overlapping exclusive archetype | non-exclusive editorial `CompositionRecipe` |
| semantic zone과 size 직접 연결 | recipe soft preference + physical planner |
| fallback이 required meaning 파괴 | same-use shrink, approved alternate, replan |
| fake graphic을 evidence로 분류 | non-factual `GraphicMotif` |
| validator가 품질을 스스로 증명 | structural test + expressive range + blind review |
| 분류 governance 부재 | scope note, reviewStatus, examples, disagreement 기록 |

## Delivery Approval Gates

이 문서의 typography-first product definition과 `Typography-First Composition Generation` 명칭은 구현을 위한 accepted working direction이다. 외부 brand naming은 별도 product decision이며 Phase A 시작을 막지 않는다.

다음 항목은 미해결 schema가 아니라 phase deliverable의 승인 gate다.

- Phase A gate: command/status good 30-50개와 bad 20개 corpus, action translation audit, reviewStatus 승인
- Phase B gate: pilot의 initial sparse relation과 pair counter-example 승인
- Phase E gate: blind evaluation 통과, expressive-range report 생성, open `ConcentrationReview` 0

Non-blocking later decisions:

- editorial-fragment의 evocative tension 강도
- multilingual-echo의 same-set repetition 한도
- fake person mention과 organization naming corpus
- 새 graphic asset이 추가될 때 motif tag와 density

## References

- [Cold-start review](./SEMANTIC_CLASSIFICATION_COLD_START_REVIEW.md)
- [W3C OntoLex-Lemon](https://www.w3.org/2016/05/ontolex/)
- [W3C SKOS Reference](https://www.w3.org/TR/skos-reference/)
- [Berkeley FrameNet](https://berkeleyfn.framenetbr.ufjf.br/WhatIsFrameNet)
- [Munzner Nested Model for Visualization Design](https://cs.ubc.ca/labs/imager/tr/2009/NestedModel/NestedModel.pdf)
- [Expressive Range Analysis](https://www.pcgworkshop.com/archive/smith2010analyzing.pdf)
