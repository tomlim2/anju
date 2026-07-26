# Graphic Redesign Plan — Manga × Data-Terminal

> 상태: **준비(draft)**. 코드·파이프라인 미반영. 방향 확정용 문서.
> 목표: 현재 4개 motif(barcode / pseudo-qr / table / wave)를 전면 교체해, "데이터/터미널" 뼈대 위에 **일본 만화적 표현**을 입힌 새 그래픽 언어를 만든다.

> **개정 (2026-07-26): 방향 축소.** 말풍선(speech/shout)·사고구름·효과마크(汗/💢)·의성어(描き文字)·impact-burst는 **폐기**한다. 텍스트·컨테이너·오브젝트 글리프가 들어가는 표현은 이 도구가 잘 만들지 못한다. 남기는 방향은 **순수 흑백 패턴 / 선 / 스크린톤 / 방사 효과**뿐이다. Mockup 모드(`src/mockup-gallery.js`)의 현재 14종이 확정 후보다: `halftone-meter`, `radial-halftone`, `stipple-gradient`, `dot-matrix-field`, `hatch-field`, `line-screen`, `scanlines`, `speed-lines`, `chevron-stream`, `perspective-grid`, `concentric-rings`, `focus-lines`, `beta-flash`, `burst-rings`. 아래 3장 카탈로그의 C·D·E(컨테이너/마크/타이포) 그룹은 폐기로 간주한다.

## 1. 왜 갈아엎나

- 현재 블록 motif는 `barcode`, `pseudo-qr`, `table`, `wave` 4종뿐이고 전부 "machine-readable / data-look" 계열이라 시각 어휘가 단조롭다.
- Status·Verification·Warning·Instruction·Identity 아카이프를 **그래픽으로 받쳐주는 요소가 사실상 없다** (텍스트로만 표현됨).
- 흑백·거친 선·기술 라벨이라는 기존 DNA는 유지하되, 표현 언어를 만화 문법으로 교체한다.

## 2. 컨셉: "Manga-Terminal"

시스템/데이터 프리미티브를 **만화 효과선·스크린톤·말풍선·의성어**로 표현하는 흑백 하이브리드.

- **톤 시스템 = 스크린톤.** 값(레벨·밀도·확률)을 halftone 도트/해칭 밀도로 인코딩한다. wave 대신 tone이 "값의 시각화"를 맡는다.
- **강조 = 효과선.** 집중선·스피드선·베타플래시가 hero token을 향한 "주의 벡터"로 작동한다.
- **컨테이너 = 말풍선.** display keyword(`ロード`, `ERROR`, `접근 거부`)를 말풍선/사고구름/외침풍선에 담는다.
- **상태 = 효과 마크.** 汗(땀)·💢(분노 힘줄)·✨(반짝)·！？ 를 시스템 상태 글리프로 재해석한다.
- **hero 확장 = 描き文字(의성어).** ゴゴゴ·ドン·ザ… 를 왜곡된 그래픽 레터링으로. 기존 typography-first 파이프라인의 hero 후보와 자연스럽게 결합.
- **세로 지향성**은 만화와 궁합이 좋다 — 기존 `1x3` 세로 CJK 조판, 세로 효과선(ゴゴゴ), 세로 말풍선을 적극 활용.

세로선 정리: 데이터/터미널의 "정보 리얼리즘"은 유지하되(진짜처럼 보이는 값·코드), 그 값을 만화 톤/효과로 그린다.

## 3. 새 motif 카탈로그 (교체안)

각 motif는 현재 시스템과 동일하게 `{ id, graphicType, role, motifTags, occupancySafetyFactor, intrinsicBySize }`로 등록하고 `renderCompositionMotif` 분기 + occupancy 캘리브레이션을 갖는다.

### A. 톤 / 값 (screentone 계열 — `wave`·`table` 대체)

| id | 만화 요소 | 데이터 재해석 | 아카이프 | 비고 |
|---|---|---|---|---|
| `halftone-meter` | 스크린톤 도트 | 도트 밀도 = 계측값(0–100%) | Data / Status | 그라데이션 톤 바로도 변주 |
| `hatch-field` | 해칭(사선) | 선 밀도 = load/level | Data | 45°/교차 해칭 |
| `dot-matrix-field` | 톤 도트 격자 | 채운 도트 수 = 유닛 차트 | Data | table의 와플 버전 |

### B. 강조 / 모션 (효과선 계열 — 신규)

| id | 만화 요소 | 데이터 재해석 | 아카이프 | 비고 |
|---|---|---|---|---|
| `focus-lines` | 集中線 | 주의 벡터(hero를 가리킴) | Warning / Status | 수렴점 파라미터화 |
| `speed-lines` | スピード線 | throughput/stream 표시 | Data / Status | 수평·세로 방향 |
| `beta-flash` | ベタフラッシュ | 크리티컬 이벤트/스파이크 | Warning / Critical | 방사 흑색 버스트 |
| `impact-burst` | 打撃 스타/집중 | 알림·타격 강조 | Critical | hero 뒤 배경 |

### C. 컨테이너 / 발화 (말풍선 계열 — 신규)

| id | 만화 요소 | 데이터 재해석 | 아카이프 | 비고 |
|---|---|---|---|---|
| `speech-balloon` | 吹き出し | display keyword 컨테이너 | Status / Instruction | 둥근형 |
| `shout-balloon` | 외침 풍선(가시) | 경고/에러 메시지 | Warning | 가시 테두리 |
| `thought-cloud` | 사고 구름 | 예측/추정 상태 | Status | 점선 꼬리 |

### D. 효과 마크 / 글리프 (micro — `microBadge` 확장)

| id | 만화 요소 | 데이터 재해석 | 아카이프 | 비고 |
|---|---|---|---|---|
| `state-mark` | 汗 / 💢 / ✨ / ！？ | 시스템 상태 이모지(load/fault/ok/query) | Status / Verification | 작은 accent token |
| `emphasis-star` | キラ 반짝 | verified/approved 마크 | Verification | 스탬프 대체 |

### E. 타이포-그래픽 하이브리드 (신규 hero 계열)

| id | 만화 요소 | 데이터 재해석 | 아카이프 | 비고 |
|---|---|---|---|---|
| `onomatopoeia` | 描き文字(ゴゴゴ/ドン/ザ…) | 큰 상태 의성어 hero | Title / Identity | 기존 typography 파이프라인과 결합, 세로 조판 |

### 유지 여부

- `barcode`: 만화-테크와도 무난 → **유지 후보**(스크린톤 배경과 조합).
- `pseudo-qr`, `table`, `wave`: **폐기** 또는 위 톤/도트 motif로 흡수.

## 4. 디자인 원칙 (확정 룰 후보)

- **흑백 유지.** 톤은 순수 흑색 도트/선의 밀도로만 만든다(회색 없음, 착시 회색).
- **스크린톤 밀도 단계**: 예) 10 / 20 / 30 / 50 / 70% 고정 단계. 값은 이 단계로 양자화.
- **효과선 규칙**: 집중선은 단일 수렴점, 선 개수·각도 지터를 seed로 결정. 프레임 밖으로 나가지 않게 safe box clip.
- **말풍선**은 컨테이너이므로 내부에 display keyword 토큰을 담고, padding/margin 토큰 시스템을 그대로 따른다.
- **occupancy**: 효과선·베타플래시는 방사형이라 실제 잉크 범위가 넓다 → 보수적 `occupancySafetyFactor` 캘리브레이션 필요(현 barcode 1.20, qr 1.35 대비 더 높게 검토).
- **roughness**: 만화 펜선 느낌으로 기존보다 약간 더 거칠게, 단 machine-readable(바코드)엔 미적용.

## 5. 아카이프 매핑 (공백 메우기 확인)

| 아카이프 | 현재 | 신규 |
|---|---|---|
| Data | table, wave | halftone-meter, hatch-field, dot-matrix-field |
| Critical info | barcode | barcode(유지), beta-flash, impact-burst |
| Status | (없음) | speech-balloon, halftone-meter, state-mark |
| Warning | (없음) | focus-lines, shout-balloon, beta-flash |
| Verification | (없음) | emphasis-star, state-mark(✨) |
| Instruction | (없음) | speech-balloon, focus-lines(지시 벡터) |
| Identity/Title | (typography만) | onomatopoeia, impact-burst |

## 6. 구현 / 마이그레이션 계획 (잠긴 시스템 대응)

이 앱은 폰트·소스까지 해시로 잠기고 append-only ledger로 강제된다. 그래픽 전면 교체는 아래 owner를 건드린다:

- `motifs.js` → **motifVersion 1 → 2** (motif 정의/태그/occupancy 변경)
- `graphics.js`(렌더러) → `plan-to-export-runtime` owner, **compositionEngineVersion 5 → 6**
- `motif-occupancy-calibration.json` fixture 재생성 (신규 shape들의 보수적 factor 승인)
- `composition-recipes.js`에서 motif slot 규칙 조정 시 **recipeVersion** 범프
- `composition-owner-snapshot.js` 재생성(`emit-composition-owner-snapshot.mjs`) + ledger append
- **frozen artifact 재생성**: expressive-range, blind-evaluation corpus, browser-cases, baseline

### 선행 블로커 (먼저 처리)

- 앞서 CI를 삭제했는데 `composition-owner-manifest-lib.mjs`가 아직 `.github/workflows/micro-graphic-generator.yml`을 config owner 데이터로 참조한다 → emit이 실패한다. 그래픽 작업의 engine 범프에 **이 참조 제거를 함께 태워** 정리한다.

### 단계

1. **선행**: 매니페스트에서 삭제된 워크플로 참조 제거.
2. **모킹**: 신규 motif를 SVG 목업으로 먼저 그려 눈으로 확정(코드 편입 전).
3. **렌더러**: `graphics.js`에 신규 `renderCompositionMotif` 분기 + `motifRenderTelemetry` + renderParams 스키마 추가.
4. **등록**: `motifs.js`에 motif 레코드/태그/occupancy 추가, 폐기 motif 제거.
5. **캘리브레이션**: occupancy factor를 보수적으로 잡고 calibration fixture 재생성.
6. **레시피**: recipe별 motif 슬롯 허용/금지 갱신.
7. **스냅샷/버전**: engine·motif(·recipe) 버전 범프 + owner snapshot 재생성 + ledger append.
8. **fixture 재동결**: frozen artifact 재생성 및 커밋.
9. **테스트**: `npm run test:generator` 통과 + 브라우저 육안 확인.

## 7. 기술 노트

- **스크린톤/해칭**: SVG `<pattern>` 또는 생성된 도트/선 그룹. export가 self-contained여야 하므로 pattern 정의를 SVG 내부에 인라인.
- **효과선**: 수렴점 기준 방사 `line` 다발, 각도/길이 지터는 keyed PRNG로 결정론 유지.
- **말풍선**: path(둥근형/가시형/구름형) + 꼬리. 내부 텍스트는 기존 `textNode`/zone 시스템 재사용.
- **의성어**: 기존 typography hero 경로 확장(글자 왜곡·기울임은 transform으로, 폰트는 SUIT/Glow 유지 또는 전용 디스플레이 웨이트 검토).
- **결정론**: 모든 신규 motif는 `GenerationInput` 기반 keyed 값만 사용(현 시스템 규약 유지). canvas 읽기 금지, 승인된 occupancy factor만 사용.

## 8. 확정이 필요한 오픈 질문

1. **만화 : 데이터 비율** — 만화 표현을 전면(대부분 motif가 만화)으로 갈지, 데이터 리얼리즘 위에 액센트로만 얹을지.
2. **barcode 유지 여부** — 유일하게 살아남는 기존 motif로 둘지, 그것도 폐기할지.
3. **의성어 언어** — 일본어 가나(ゴゴゴ) 중심? 한글 의성어(두근·번쩍) 혼합? 현 vocabulary 언어 정책과 정합.
4. **스크린톤 계조 단계 수** — 3단? 5단?
5. **회색 금지 원칙 유지** 여부(순수 흑백 도트 톤만).
6. **폐기 motif 처리** — 완전 삭제 vs 당분간 비활성 유지.

## 9. 다음 액션

- 위 오픈 질문 확정 → 신규 motif 2~3개(예: `halftone-meter`, `focus-lines`, `speech-balloon`)를 SVG 목업으로 시각화 → 확정되면 6장 단계대로 파이프라인 편입.
