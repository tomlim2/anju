# Semantic Classification Cold-Start Review

## Status

- 상태: Historical review complete, findings integrated
- 작성일: 2026-07-12
- 검토 대상: `SEMANTIC_GENERATION_SPEC.md`의 2026-07-12 `Semantic Composition Generation Specification` draft
- 후속 문서: 2026-07-13 `Typography-First Composition Generation Specification` rewrite
- 결론: 검토 당시 draft는 구현 승인하지 않았으며, findings를 반영해 축소·재작성했다.
- 원 검토 범위: 리뷰 문서만 추가했으며 당시 대상 스펙과 실행 코드는 수정하지 않았다.

이 문서는 이전 draft에 대한 historical review다. 현재 같은 경로의 rewritten spec은 이 findings의 resolution이며, 아래 Verdict와 Finding의 “현재 스펙” 표현은 2026-07-12 draft를 뜻한다.

## Review Setup

이번 검토는 이전 대화 맥락을 전달하지 않은 두 개의 read-only agent와 primary reviewer의 독립 웹 리서치로 진행했다.

| Role | Context | Requested profile | Effective routing | Lens |
| --- | --- | --- | --- | --- |
| Cold-Start Semantic Classification Methodology Reviewer | `fork_context: false` | `review-deep-readonly` | `gpt-5.6-sol`, high reasoning, read-only instruction | 방법론 완전성, 다국어 의미 계약, 구현 가능성 |
| Contrarian / Anti-Current-State Reviewer | `fork_context: false` | `scan-fast-readonly` | `gpt-5.6-terra`, medium reasoning, read-only instruction | 전제 반증, 과설계, 최소 대안 |

두 agent 모두 대상 스펙과 명시된 current source만 읽었고 파일 수정, commit, push, 외부 상태 변경을 하지 않았다. Primary reviewer는 별도로 표준, 공식 lexical resource, peer-reviewed paper를 검색해 agent 결과를 교차 검증했다.

이 문서에서 “방법론 전체”는 단일 논문을 모두 열거한다는 뜻이 아니라, 이 문제에 실제 적용 가능한 연구·실무 방법론 계열을 빠짐없이 비교한다는 뜻이다.

## Verdict

현재 스펙의 다음 방향은 유지할 가치가 있다.

- 무작위 token보다 composition plan을 먼저 만든다.
- plan, layout, render, finalization, validation 경계를 분리한다.
- seeded random과 plain object plan으로 결정을 재현한다.
- physical fit과 hierarchy를 렌더 전후로 검증한다.

하지만 현재 semantic model은 구현하기 전에 재작성해야 한다.

- 고립된 단어에 DIKW level, intent, polarity, urgency를 고정한다.
- 한글·영어·중국어 표현을 하나의 정확한 concept로 간주한다.
- domain 교집합을 의미 일관성의 핵심 조건으로 사용한다.
- 하나의 결과를 정확히 하나의 archetype에 넣는다.
- 단어 의미를 3x3 위치와 크기로 직접 연결한다.
- 규칙 위반 0을 의미 품질의 증거로 취급한다.

이 접근은 의미를 정교하게 만드는 대신 **분류자의 주관을 formal rule처럼 굳히고 생성 결과를 단조롭게 만들 위험**이 크다. 권장 방향은 full semantic ontology가 아니라 다음의 작은 hybrid다.

```text
task-specific lexical use
→ multilingual translation set with equivalence notes
→ composition recipe and typed slots
→ sparse allow/avoid/affinity relations
→ physical layout feasibility
→ seeded choice among valid alternatives
```

## Findings

### P1 Blocker: Sense와 번역 등가성의 판정 기준이 없다

Target:

- `SEMANTIC_GENERATION_SPEC.md`의 `Concept Contract`
- `src/vocabulary.js`의 `actionTokens`

현재 스펙은 stable concept ID 아래 한글·영어·중국어 variant를 묶지만, 실제 데이터부터 정확한 번역 집합이 아니다.

- `BREAK → 분해 → 拆解`는 “깨뜨리다”보다 “분해하다” 쪽으로 좁아졌다.
- `BRING → 가져오기 → 导入`은 일반 이동과 software import가 섞였다.
- `CODE → 코딩 → 编码`은 명사, 행위, encoding sense가 섞였다.
- `WORK → 작동 → 运作`은 명령과 상태가 모두 가능하다.
- `POINT`, `SNAP`, `WATCH`, `TURN`, `NAME`, `OUTPUT`도 context에 따라 품사와 sense가 달라진다.

WordNet은 word가 아니라 context별 synset을 기본 단위로 사용하고, OntoLex-Lemon은 lexical entry, lexical sense, lexical concept를 분리한다. SKOS와 ISO 25964도 exact, close, partial/inexact mapping의 차이를 인정한다. Word sense 자체도 task와 corpus에 따라 경계가 달라진다는 비판이 있다. [WordNet](https://wordnet.princeton.edu/frequently-asked-questions), [OntoLex-Lemon](https://www.w3.org/2016/05/ontolex/), [ISO 25964](https://www.niso.org/standards-committees/iso-25964), [Kilgarriff](https://arxiv.org/abs/cmp-lg/9712006)

Required change:

- universal `conceptId` 대신 task-specific `lexicalUseId`를 사용한다.
- 다국어 연결은 `translationSetId`로 분리한다.
- translation member마다 `equivalence: exact | close | adapted`를 기록한다.
- 정확한 짧은 대응어가 없으면 variant 누락을 허용한다.
- use마다 짧은 definition, scope note, positive/counter example, POS를 둔다.
- **recipe compatibility가 달라질 때만** sense를 나눈다.

### P1 Blocker: Contextual 속성을 단어의 intrinsic facet으로 고정한다

Target:

- `semanticLevel`, `intent`, `polarity`, `urgency`
- status code polarity table

`LOCK`은 command, state, warning이 될 수 있다. `404`는 HTTP response context에서는 not-found지만 임의의 3자리 visual code일 수도 있다. `200`도 전체 business operation의 성공을 의미하지 않는다. polarity 연구도 word-level polarity가 domain과 context에 따라 바뀐다고 보고한다. [AAAI domain-dependent polarity study](https://ojs.aaai.org/index.php/AAAI/article/view/8081), [NRC affect lexicon](https://nrc-publications.canada.ca/eng/view/object/?id=0b6a5b58-a656-49d3-ab3e-252050a7a88c)

DIKW는 isolated display word의 lexical class가 아니다. 기존 연구에서도 level 정의와 변환 규칙에 합의가 부족하고, hierarchy 자체가 비판받는다. [Rowley](https://www.coengineers.com/wp-content/uploads/2020/06/DIKW.pdf), [Frické](https://doi.org/10.1177/0165551508094050)

Required change:

- 초기 모델에서 `semanticLevel`을 제거한다.
- token에는 가능한 use와 coarse authoring tag만 둔다.
- intent, tone, polarity, urgency는 recipe 또는 현재 composition assertion에 둔다.
- code는 `http-status`, `hex`, `serial`, `cell-index`처럼 code system을 먼저 구분한다.

### P1 Blocker: Domain 일치는 의미 관계를 보장하지 않는다

Target:

- `Semantic Compatibility Rules`
- `general` wildcard

같은 `system` domain 안에서도 `PRINT + LATENCY + CIRCUIT`, `SAVE + PORT + 404`는 관계가 불분명하다. 반대로 domain이 달라도 의도적인 metaphor 또는 product phrase로 잘 결합될 수 있다. `general`은 너무 넓으면 모든 gate를 무력화하고 너무 좁으면 후보를 고갈시킨다.

FrameNet은 event/frame과 participant slot을, VerbNet은 thematic role과 selectional restriction을, PropBank은 predicate별 argument set을 사용한다. 단순 domain보다 **누가 무엇에 무엇을 하는지**가 관계 판정에 더 직접적이다. [FrameNet](https://berkeleyfn.framenetbr.ufjf.br/WhatIsFrameNet), [VerbNet](https://verbs.colorado.edu/verbnet/), [PropBank](https://propbank.github.io/)

Required change:

- domain은 검색과 후보 축소용 soft facet으로만 사용한다.
- `actsOn`, `stateOf`, `resultOf`, `references`, `recoveryFor` 같은 작은 typed relation set을 사용한다.
- 전체 graph를 만들지 않고 recipe에서 실제 필요한 edge만 작성한다.
- 기본 allow + sparse deny 또는 explicit affinity score 중 하나를 선택한다.

### P1 Blocker: Archetype은 grammar로 충분히 닫혀 있지 않고 서로 겹친다

Target:

- 8개 `Archetype Grammar`
- Component당 archetype exactly one

`ACCESS DENIED + 403 + RETRY`는 warning, status, instruction의 성격을 동시에 가진다. verification/status, critical-info/identity도 겹친다. 현재 표에는 slot ID, cardinality, typed relation, atomic phrase 처리 규칙이 완전하게 정의되지 않았다.

NLG 방법론은 content selection, structure planning, lexical choice, surface realization을 분리한다. schema/template는 의미의 절대 분류가 아니라 특정 output을 만드는 recipe로 취급하는 편이 맞다. [Reiter and Dale](https://www.cambridge.org/core/journals/natural-language-engineering/article/abs/building-applied-natural-language-generation-systems/FEB374A3FF652F06D8567A6FAB2EF36E), [template-based generation](https://research.tue.nl/en/publications/template-based-generation-of-natural-language-expressions-with-co/)

Required change:

- `Archetype`을 semantic truth가 아닌 `CompositionRecipe`로 바꾼다.
- 결과는 recipe 하나로 생성되지만 여러 recipe 특성을 가질 수 있다.
- 초기 recipe는 `title`, `command`, `status`, `identity`, `data`, `verification` 6개 이하로 제한한다.
- warning은 status/command의 tone variant, critical-info는 data/identity variant로 먼저 검증한다.
- 각 recipe는 required/optional slot, cardinality, accepted tags, pair rules를 가진다.
- complete phrase는 atomic token으로 유지하되 `phrasePackId`와 recipe slot을 명시한다.

### P1 Blocker: 의미와 visual encoding을 직접 연결한다

Target:

- `3x3 Semantic Zone Preferences`
- `Footprint Eligibility`
- `Placement Scoring`

size는 salience를 만들 수 있지만 isolated word meaning이 특정 위치를 보편적으로 요구하지는 않는다. `top-right = status/time`, `bottom-right = evidence`는 현재 브랜드의 layout preference일 수는 있어도 semantic fact가 아니다. reading direction은 공간 인지와 visual scanning에 영향을 줄 수 있으므로 언어를 섞는 화면에 하나의 고정 semantic map을 적용하기 어렵다. [reading-direction study](https://pubmed.ncbi.nlm.nih.gov/27611064/)

Visualization design 연구는 domain/task abstraction과 visual encoding을 분리한다. visual channel은 expressiveness와 perceptual effectiveness로 평가해야 한다. [Munzner nested model](https://cs.ubc.ca/labs/imager/tr/2009/NestedModel/NestedModel.pdf), [Mackinlay APT](https://doi.org/10.1145/22949.22950)

Required change:

- 의미는 recipe slot 후보 선택에 사용한다.
- prominence는 recipe slot이 소유한다.
- size/footprint/position은 visual planner가 fit, hierarchy, composition preference로 결정한다.
- zone은 universal semantic label이 아니라 recipe별 soft layout preference다.
- scoring은 임의 weighted sum보다 `hard validity → fit → hierarchy → recipe preference → diversity`의 lexicographic order를 우선 검토한다.

### P1 Blocker: Fallback 계약이 required meaning을 파괴한다

Target:

- `Fallback Contract`
- planner 이후 concept를 변경하지 않는다는 계약

required primary가 fit하지 않을 때 neutral reference 또는 cell index로 바뀌면 command/status/verification의 핵심 의미가 사라진다. planner가 concept를 확정한다는 규칙과 alternate concept 교체도 충돌한다.

Required change:

```text
same lexical use at next smaller size
→ same recipe slot의 pre-approved alternate
→ deterministic layout replan
→ generation rejection with reserved known-good plan
```

- neutral reference는 optional metadata에만 허용한다.
- required hero에 cell-index fallback을 허용하지 않는다.
- finalizer는 token meaning을 변경하지 않는다.

### P1 Blocker: Fake graphic을 evidence로 분류한다

Target:

- barcode, pseudo-QR, table, wave의 `evidence` 분류
- README의 fake data primitive 정의

현재 barcode와 pseudo-QR은 실제 scan 또는 사실 검증을 보장하지 않는 visual primitive다. 이를 evidence라고 부르면 시각적 분위기와 사실적 증거를 혼동한다.

Required change:

- `evidence`를 `motif` 또는 `graphicRole`로 변경한다.
- 초기 graphic role은 `machine-readable-mark`, `data-table-look`, `signal-plot-look`, `badge` 정도로 둔다.
- 실제 input data와 provenance가 생길 때만 factual evidence role을 도입한다.

### P1 Blocker: Validation이 자기 규칙의 일관성만 검증한다

Target:

- 10,000 plan, Random 1,000회 violation 0
- semantic acceptance criteria

자동 validator는 작성한 규칙이 지켜졌는지 확인할 뿐, 그 규칙이 좋은 의미 조합과 좋은 시각 결과를 만드는지는 증명하지 못한다. strict semantic validator는 의도적인 긴장감과 낯선 조합을 false negative로 제거할 수 있다.

PCG 연구는 validity뿐 아니라 expressive range, quality, diversity를 별도로 평가한다. [Expressive Range Analysis](https://www.pcgworkshop.com/archive/smith2010analyzing.pdf), [PCG evaluation methodologies](https://ojs.aaai.org/index.php/AIIDE/article/view/13012)

Required change:

- automated hard validation은 structural/physical validity에 집중한다.
- semantic affinity는 soft score와 curated negative rule로 제한한다.
- baseline과 candidate를 blind comparison한다.
- coherence, visual hierarchy, interest, diversity를 사람 평가로 분리한다.
- token/recipe/language/footprint 빈도와 fallback rate를 expressive-range report로 만든다.

### P2: 분류 제작과 유지의 검증 절차가 없다

Target:

- vocabulary migration
- validation plan

분류표 자체가 데이터 제품인데 annotation guideline, reviewer disagreement, provenance, lifecycle이 없다. semantic representation 개발은 guideline을 반복 개선하고 실제 application expressiveness와 annotator agreement를 확인해야 한다. [semantic annotation methodology](https://pmc.ncbi.nlm.nih.gov/articles/PMC2815383/), [Krippendorff reliability](https://onlinelibrary.wiley.com/doi/10.1111/j.1468-2958.2004.tb00738.x)

Required change:

- lexical use마다 `scopeNote`, `examples`, `source`, `reviewStatus`를 둔다.
- ambiguous item은 최소 두 명 또는 designer + cold reviewer가 독립 분류한다.
- disagreement는 숨기지 않고 `ambiguous` 또는 복수 tag로 남긴다.
- category가 mutually exclusive일 필요가 없으면 multi-label을 허용한다.

## Methodology Landscape

### Linguistic And Lexical Methods

| Method | What it models | Cost | Fit for this generator | Decision |
| --- | --- | --- | --- | --- |
| POS / Universal Dependencies | noun, verb, modifier와 syntax | Low | action/modifier 분리의 보조 정보 | Use at authoring time |
| Dictionary/lexicography | definition, usage, register | Low-Medium | scope note 작성에 직접 유용 | Use |
| Componential analysis | 제한된 lexical field 안의 semantic feature 대비 | Medium | 가까운 use의 경계를 설명하는 데 유용하지만 전 어휘의 binary truth로 쓰기에는 취약 | Use selectively during authoring |
| WordNet synsets | sense, synonym, hypernym relations | Medium | sense 분리 참고; 영어 inventory 직접 이식은 위험 | Reference only |
| WSD | context에서 sense 선택 | High without context | curated word는 runtime context가 없음 | Do not use at runtime |
| Semantic fields/domains | broad topic grouping | Low | 후보 축소와 catalog 탐색 | Soft facet only |
| Semantic maps / colexification | 언어별로 한 form이 묶는 여러 meaning과 cross-lingual lexical gap | Medium | 한·영·중 translation set의 false equivalence 감사 | Offline audit only |
| Thematic roles / case grammar | Agent, Theme, Target 등 participant | Medium | action-target 관계에 유용 | Use reduced set |
| Frame semantics / FrameNet | event/state frame와 frame elements | Medium-High | composition slot 설계의 좋은 참고 | Use small local frames |
| VerbNet / PropBank | verb class, argument, selection restriction | High | 62개 action 전부 도입은 과도 | Borrow patterns only |
| Generative Lexicon | context가 만드는 systematic polysemy | High | fixed sense의 한계를 설명 | Design caution |
| Prototype / exemplar theory | fuzzy category와 typicality | Medium | hard class보다 soft affinity에 적합 | Optional soft score |
| Conceptual spaces | quality dimension 위의 거리, region, typicality | High | similarity를 연속값으로 다룰 수 있지만 dimension을 다시 설계해야 함 | Defer; offline experiment only |
| Natural Semantic Metalanguage | cross-language semantic explication | Very High | 짧은 token set에는 과도 | Defer |
| Semantic differential | evaluation, potency, activity의 사람 평정 | Medium-High | tone이 실제 목표일 때 connotative response 측정 | Evaluation study only |
| Speech acts / ISO 24617-2 | communicative action | Medium | command/status recipe intent에 유용 | Recipe-level only |
| SFL metafunctions | ideational/interpersonal/textual meaning | High | clause/discourse 분석에는 유용, isolated token에는 과도 | Defer |
| RST / discourse relations | nucleus-support 관계 | High | primary/support 아이디어만 차용 | Borrow one principle |

Componential analysis는 restricted domain에서 가까운 단어를 feature로 대비할 때 효율적이지만, 넓은 vocabulary에서는 feature inventory가 어휘만큼 커질 수 있다. CLICS의 colexification network는 여러 언어가 meaning boundary를 다르게 묶는다는 사실을 직접 보여 주므로 translation set 검토에는 유용하지만, 한국어·영어·중국어의 정답 mapping을 자동으로 주지는 않는다. Conceptual spaces와 semantic differential은 각각 similarity/typicality와 connotative affect를 연속값으로 측정하지만, 이 generator의 visual role이나 placement를 스스로 결정하지는 않는다. [Nida componential analysis](https://search.worldcat.org/title/componential-analysis-of-meaning-an-introduction-to-semantic-structures/oclc/1148586172), [CLICS](https://clics.clld.org/), [Gärdenfors conceptual spaces](https://mitpress.mit.edu/9780262572194/conceptual-spaces/), [Osgood semantic differential](https://eric.ed.gov/?id=ED033620)

Sources: [Universal Dependencies](https://universaldependencies.org/introduction.html), [FrameNet](https://berkeleyfn.framenetbr.ufjf.br/WhatIsFrameNet), [VerbNet](https://verbs.colorado.edu/verbnet/), [ISO 24617-2](https://www.iso.org/standard/76443.html), [RST](https://doi.org/10.1515/text.1.1988.8.3.243)

### Knowledge Organization Methods

| Method | What it models | Cost | Fit | Decision |
| --- | --- | --- | --- | --- |
| Controlled list | approved names and codes | Low | token IDs와 labels 관리 | Use |
| Synonym ring | equivalent lookup terms | Low | translation set에는 exactness가 부족 | Use with qualifiers |
| Taxonomy | one hierarchy | Medium | words가 여러 축에 걸쳐 부적합 | Do not use alone |
| Thesaurus / ISO 25964 | equivalence, hierarchy, association | Medium | exact/close/partial relation 참고 | Use lightly |
| SKOS | concept, multilingual labels, broader/related | Medium | data shape 참고에 적합 | SKOS-lite pattern only |
| OntoLex-Lemon | lexical entry, sense, concept 분리 | Medium-High | multilingual record boundary에 매우 유용 | Borrow model boundary |
| Faceted classification | independent axes | Low-Medium | language/form/tag/display class 분리 | Use |
| Formal ontology / OWL | axioms and inference | High | small artistic vocabulary에는 과도 | Reject for v1 |
| Knowledge graph | typed relations | Medium-High | sparse compatibility edges에는 유용 | Use tiny local graph |
| Formal Concept Analysis | object-attribute lattice | Medium | tag 중복과 hidden clusters audit | Offline analysis only |
| Card sorting | 사람의 grouping mental model | Low-Medium | designer assumptions 확인 | Use during curation |
| Delphi/expert consensus | classification consensus | High | 팀이 커질 때 유용 | Defer |

Sources: [NISO controlled vocabulary](https://www.niso.org/publications/ansiniso-z3919-2005-r2010), [ISO 704](https://www.iso.org/standard/79077.html), [SKOS](https://www.w3.org/TR/skos-reference/), [OntoLex-Lemon](https://www.w3.org/2016/05/ontolex/), [faceted classification](https://doi.org/10.17821/srels/2013/v50i6/43823), [Formal Concept Analysis](https://arxiv.org/abs/1703.02819)

### Rule And Generation Methods

| Method | Strength | Weakness | Decision |
| --- | --- | --- | --- |
| Hand-curated phrase packs | Highest coherence and control | finite combinations | Core baseline |
| Composition recipes / slot grammar | explainable variation | authoring needed | Core |
| Decision tables | explicit and testable | table growth | Core for slot rules |
| Pairwise allow/deny graph | small incremental edits | cannot model all higher-order effects | Core, sparse only |
| Weighted co-occurrence matrix | gradual affinity | weights require evidence | Use after curated examples |
| Stochastic grammar | diversity with structure | overgeneration | Optional after recipe baseline |
| CSP / bounded search | separates hard and soft constraints | complexity if schema grows | Use simple local enumeration |
| Answer Set Programming | expressive declarative constraints | new dependency and steep authoring cost | Reject for this scale |
| Search/evolutionary PCG | explores broad design space | evaluation/fitness design cost | Defer |
| Quality-Diversity | balances quality and diversity | far beyond current scale | Evaluation inspiration only |

The candidate space is small enough that an external solver is unnecessary. Stable enumeration, hard filtering, lexicographic ranking, and seeded tie-breaking are sufficient. Declarative PCG research supports separating design-space constraints from generation procedure, but does not require adopting ASP. [Answer Set Programming for PCG](https://adamsmith.as/papers/tciaig-asp4pcg.pdf)

### Statistical And AI Methods

| Method | Data need | Determinism/explainability | Decision |
| --- | --- | --- | --- |
| Frequency/co-occurrence from corpus | relevant corpus | High after data freeze | Optional authoring evidence |
| Topic modeling/clustering | medium corpus | Medium | current vocabulary too small |
| Word embeddings | large corpus | Low-Medium | offline related-word suggestion only |
| Multilingual embeddings / LaBSE | parallel multilingual data/model | Medium | translation candidate audit only |
| Supervised classifier | labeled examples | High after model freeze, low explainability | no dataset, reject |
| Zero-shot classifier | external model/prompt | prompt/model sensitive | offline suggestion only |
| LLM classification | no local dataset required | low reproducibility/provenance | never runtime; human-reviewed authoring aid only |

Word and sentence embeddings learn similarity from large corpora but do not supply task-specific sense boundaries or visual suitability. LaBSE covers many languages and is useful for translation candidate retrieval, not for proving exact lexical equivalence. [word2vec](https://arxiv.org/abs/1301.3781), [LaBSE](https://aclanthology.org/2022.acl-long.62/), [prompt sensitivity](https://arxiv.org/abs/2602.04297)

Korean and Chinese have WordNet-style resources, but their alignment still requires human curation. BabelNet is broad but its API/data license is non-commercial and research-oriented, so it must not become an unnoticed product dependency. [KorLex 2.0](https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART001645420), [Chinese Open WordNet](https://aclanthology.org/W13-4302/), [Open Multilingual WordNet](https://globalwordnet.github.io/gwadoc/index.en.html), [BabelNet license](https://babelnet.org/license)

### Visual Mapping And Evaluation Methods

| Method | Use | Decision |
| --- | --- | --- |
| Peircean semiotics | icon/index/symbol이 object와 관계 맺는 방식 구분 | graphic `form`과 motif naming 참고; word sense taxonomy로는 쓰지 않음 |
| Social semiotics / visual grammar | typography와 layout이 context 안에서 함께 만드는 meaning | fixed universal zone 대신 composition review lens로 사용 |
| Bertin visual variables | size, position, shape, value, orientation 등 encoding channel | reference vocabulary |
| Mackinlay expressiveness/effectiveness | data와 perceptual channel의 적합성 | use as evaluation principle |
| Munzner nested model | domain, abstraction, visual encoding, algorithm 분리 | core boundary principle |
| Gestalt grouping | proximity, similarity, enclosure로 relation 표시 | evaluate compositions |
| Eye tracking / saliency | attention order empirical check | later study, not initial rule |
| Reading-direction studies | language/culture-dependent spatial bias | reason to avoid universal zones |
| Blind preference test | baseline vs candidate quality | required before rollout |
| Expressive range analysis | diversity, bias, holes in output space | required generator report |

Peirce의 icon/index/symbol은 sign이 object를 나타내는 관계를 설명하므로 기존 `symbol/sign` naming을 검토하는 데는 유용하지만, `OUTPUT`이나 `LOCK`의 lexical sense를 결정해 주지는 않는다. Social semiotics도 meaning이 sign-maker, interpreter, medium, context와 연결된다고 보므로 layout을 고정 의미 좌표로 취급하는 것보다 결과 단위로 해석해야 한다. [Peirce semiotics overview](https://plato.stanford.edu/archives/spr2024/entries/peirce-semiotics/), [Kress and van Leeuwen visual grammar](https://www.taylorfrancis.com/chapters/mono/10.4324/9781003099857-1/introduction-gunther-kress-theo-van-leeuwen)

## Recommended Replacement

> **Superseded, non-normative examples.** 이 절은 2026-07-12 draft를 대체하기 위해 당시 제안한 historical sketch다. 구현자는 아래 snippet을 계약으로 사용하지 않고 successor spec의 [Data Model](./SEMANTIC_GENERATION_SPEC.md#data-model), [Composition Recipe](./SEMANTIC_GENERATION_SPEC.md#composition-recipe), [CompositionPlan Contract](./SEMANTIC_GENERATION_SPEC.md#compositionplan-contract)를 따라야 한다. 특히 lexical/translation record ownership, slot cardinality, typed pair selector는 successor만 source of truth다.

### 1. Lexical Use Registry

의미의 단위를 보편적 concept가 아니라 이 generator에서 승인한 use로 제한한다.

```js
{
  id: "upgrade.command.en",
  text: "UPGRADE",
  language: "english",
  script: "latin",
  pos: "verb",
  translationSetId: "upgrade.command",
  equivalence: "exact",
  tags: ["action", "system"],
  scopeNote: "imperative action applied to a system or version",
  examples: ["UPGRADE + SYSTEM", "UPGRADE + V1.2"],
  counterExamples: ["UPGRADE + FOREST"],
  displayClass: "long",
  reviewStatus: "approved"
}
```

Initial authoring tags:

```text
action | identity | topic | state | result |
modifier | value | reference | motif | greeting
```

이 tag는 mutually exclusive taxonomy가 아니다. 필요한 경우 한 use가 여러 tag를 가진다.

### 2. Translation Set

```js
{
  id: "upgrade.command",
  gloss: "cause a system or product to move to a newer version",
  members: [
    { lexicalUseId: "upgrade.command.en", equivalence: "exact" },
    { lexicalUseId: "upgrade.command.ko", equivalence: "close" },
    { lexicalUseId: "upgrade.command.zh", equivalence: "exact" }
  ]
}
```

- translation set은 duplicate suppression과 language variation을 위한 authoring relation이다.
- exact equivalence를 주장하지 않는다.
- `exact`, `close`, `adapted`를 구분한다.
- lexical gap을 허용한다.

### 3. Composition Recipe

```js
{
  id: "command",
  slots: [
    { id: "hero", required: true, accepts: ["action"], prominence: "primary" },
    { id: "subject", required: false, accepts: ["topic", "identity"], prominence: "secondary" },
    { id: "meta", required: false, accepts: ["reference", "value"], prominence: "metadata" },
    { id: "motif", required: false, accepts: ["motif"], prominence: "secondary" }
  ],
  pairRules: {
    prefer: [["action.upgrade", "topic.system"]],
    avoid: [["action.upgrade", "topic.forest"]]
  },
  layoutPreferences: {
    hero: ["large-footprint"],
    meta: ["edge", "corner"]
  }
}
```

- recipe는 semantics ontology가 아니라 curated composition template다.
- prominence와 layout preference는 token이 아니라 slot이 소유한다.
- graphic primitive는 `motif` slot을 사용한다.

### 4. Hard And Soft Rules

Hard constraints:

- supported physical footprint와 orientation
- typography/graphic intrinsic fit
- required recipe slot 충족
- exact text duplicate 금지
- recipe가 금지한 translation-set duplicate 금지
- barcode/pseudo-QR uniqueness
- deterministic seed와 prepared fallback

Soft objectives:

- preferred pair affinity
- recipe slot의 visual hierarchy
- layout preference
- language/script mix
- token frequency balancing
- novelty와 expressive range

Semantic affinity와 zone preference를 hard validation으로 만들지 않는다.

### 5. Generation Pipeline

```text
1. concrete lexical/graphic candidates 생성
2. recipe 선택
3. valid slot tuple 열거
4. hard semantic/duplicate rule 적용
5. ratio별 block packing과 physical fit 평가
6. lexicographic objective로 후보 순위 결정
7. 동일 순위 집합에서만 seeded random 선택
8. render
9. same-use size fallback 또는 deterministic replan
10. structural validation + quality telemetry
```

### 6. Authoring Workflow

1. 현재 vocabulary의 모든 token을 text, language, current role, size로 export한다.
2. designer가 실제로 좋은 조합 30-50개와 나쁜 조합 20개를 직접 고른다.
3. good set에서 반복되는 slot과 co-occurrence를 찾아 recipe와 pair preference를 만든다.
4. 각 multilingual set을 exact/close/adapted로 검토한다.
5. ambiguous use는 분리하거나 multi-tag로 둔다.
6. offline WordNet/FrameNet/embedding/LLM 결과는 suggestion으로만 기록한다.
7. reviewer disagreement를 scope note와 pair rule에 반영한다.
8. rule이 실제 false positive/negative를 해결할 때만 새 facet을 추가한다.

Card sorting과 small controlled vocabulary 원칙은 designer 직관만으로 taxonomy를 확정하는 위험을 줄일 수 있다. [Card sorting overview](https://keele-repository.worktribe.com/output/423710/card-sorting-for-user-experience-design), [NISO controlled vocabularies](https://www.niso.org/publications/ansiniso-z3919-2005-r2010)

### 7. Evaluation Workflow

Automated checks:

- physical violation 0
- deterministic seed equality
- required slot completeness
- exact duplicate/unique motif rule
- hard fallback rate
- recipe/token/language/footprint frequency
- fallback size distribution

Human review:

- semantic coherence
- visual hierarchy
- legibility
- interest/surprise
- multilingual naturalness
- overall preference

Evaluation design:

- 동일한 seed set으로 current block-first baseline과 recipe candidate를 생성한다.
- source를 가린 blind pair comparison을 한다.
- 최소 2명의 판정 또는 designer + independent cold reviewer를 사용한다.
- win/loss와 disagreement를 기록한다.
- validity와 diversity를 별도 결과로 보고한다.
- recipe가 특정 token이나 언어를 과도하게 반복하면 expressive-range failure로 본다.

## Keep / Rewrite / Remove / Defer

| Current spec element | Decision | Replacement |
| --- | --- | --- |
| Message-first plan | Keep | `CompositionPlan` |
| Plain-object plan | Keep | observable recipe/slot decisions |
| Seed determinism | Keep | stable enumeration + seeded tie-break |
| Module boundaries | Keep | lexical data / recipe / layout / render / finalizer |
| Concept ID | Rewrite | task-specific `lexicalUseId` + `translationSetId` |
| Multilingual variants | Rewrite | exact/close/adapted members, lexical gaps allowed |
| `semanticRole` | Rewrite | multi-label authoring `tags` |
| Archetype | Rewrite | non-exclusive `CompositionRecipe` |
| Domain | Rewrite | soft grouping tag |
| Polarity/urgency | Rewrite | recipe/composition context only |
| Evidence graphic | Rewrite | visual `motif` |
| Placement score | Rewrite | lexicographic objectives with explicit order |
| DIKW semantic level | Remove | no replacement in v1 |
| `general` auto-compatibility | Remove | explicit sparse relations |
| Universal 3x3 semantic zones | Remove | recipe-level soft layout preferences |
| Neutral reference fallback for required slot | Remove | role-preserving alternate or replan |
| Full ontology / OWL | Defer | not needed at current scale |
| Runtime WordNet/FrameNet | Defer | offline authoring reference only |
| Runtime embeddings/LLM | Defer | optional offline suggestion only |
| Semantic violation 0 as quality proof | Remove | blind quality + expressive-range evaluation |

## Recommended Next Spec Scope

다음 spec은 한 번에 전체 vocabulary를 ontology로 바꾸지 않는다.

Phase A:

- current token inventory export
- `lexicalUseId`, language, tags, translation set만 추가
- visual output unchanged

Phase B:

- manually approved composition examples 30-50개 작성
- `command`, `status` 두 recipe만 pilot
- pair preference/avoid 최소 세트 작성

Phase C:

- recipe-first selection을 feature flag 또는 test-only path로 구현
- baseline과 blind comparison

Phase D:

- pilot이 baseline보다 coherence와 preference에서 이길 때만 recipe 확장
- data/identity/title/verification을 순차 추가

이 순서라면 분류 체계를 먼저 믿고 전체 구현을 확장하는 대신, 실제 생성 결과가 좋아지는지 확인하면서 필요한 의미 구조만 남길 수 있다.

## Residual Design Decisions

- 목표가 literal coherence인지, evocative but plausible tension인지 결정해야 한다.
- 같은 translation set의 다국어 반복을 항상 금지할지 recipe별로 허용할지 결정해야 한다.
- complete phrase를 atomic token으로 유지할지 structured phrase pack으로 확장할지 결정해야 한다.
- `@ORG`를 기존 visual convention으로 유지할지 person mention 도입과 함께 migration할지 결정해야 한다.
- HTTP code를 실제 protocol 의미로 사용할지 generic tech code motif로 사용할지 결정해야 한다.
- 의미적 primary와 시각적 primary를 항상 같게 할지, 의도적 불일치를 허용할지 결정해야 한다.

## Final Recommendation

2026-07-12 `Semantic Composition Generation Specification` draft는 구현하지 않는다. 2026-07-13 rewritten `SEMANTIC_GENERATION_SPEC.md`가 아래 권고를 반영한 successor다.

1. 현재 vocabulary를 lexical use와 translation set 기준으로 audit한다.
2. 좋은 조합을 먼저 수집해 composition recipe를 역으로 추출한다.
3. semantic ontology가 아니라 최소 recipe pilot이 실제 시각 결과를 개선하는지 blind test한다.

가장 적합한 방법론은 **SKOS/OntoLex의 데이터 경계 + FrameNet의 slot 아이디어 + controlled vocabulary의 scope note + recipe/decision table + small deterministic CSP + PCG expressive-range evaluation**을 축소 결합한 방식이다. 어느 방법론도 그대로 도입하지 않고 이 generator의 작은 curated vocabulary와 시각 실험 목적에 필요한 부분만 사용한다.

## Primary References

- [W3C SKOS Reference](https://www.w3.org/TR/skos-reference/)
- [W3C OntoLex-Lemon](https://www.w3.org/2016/05/ontolex/)
- [ISO 704 terminology work](https://www.iso.org/standard/79077.html)
- [ISO 25964 thesauri and mappings](https://www.niso.org/standards-committees/iso-25964)
- [NISO Z39.19 controlled vocabularies](https://www.niso.org/publications/ansiniso-z3919-2005-r2010)
- [Princeton WordNet](https://wordnet.princeton.edu/frequently-asked-questions)
- [Global WordNet / Open Multilingual WordNet](https://globalwordnet.github.io/gwadoc/index.en.html)
- [Concepticon](https://concepticon.clld.org/)
- [Berkeley FrameNet](https://berkeleyfn.framenetbr.ufjf.br/WhatIsFrameNet)
- [VerbNet](https://verbs.colorado.edu/verbnet/)
- [Universal Dependencies](https://universaldependencies.org/introduction.html)
- [Kilgarriff, I Don't Believe in Word Senses](https://arxiv.org/abs/cmp-lg/9712006)
- [Pustejovsky, The Generative Lexicon](https://aclanthology.org/J91-4003/)
- [Rosch, Cognitive Representations of Semantic Categories](https://doi.org/10.1037/0096-3445.104.3.192)
- [Nida, Componential Analysis of Meaning](https://search.worldcat.org/title/componential-analysis-of-meaning-an-introduction-to-semantic-structures/oclc/1148586172)
- [CLICS cross-linguistic colexification database](https://clics.clld.org/)
- [Gärdenfors, Conceptual Spaces](https://mitpress.mit.edu/9780262572194/conceptual-spaces/)
- [Osgood, The Measurement of Meaning](https://eric.ed.gov/?id=ED033620)
- [Reiter and Dale, Applied NLG Systems](https://www.cambridge.org/core/journals/natural-language-engineering/article/abs/building-applied-natural-language-generation-systems/FEB374A3FF652F06D8567A6FAB2EF36E)
- [Munzner, Nested Model for Visualization Design](https://cs.ubc.ca/labs/imager/tr/2009/NestedModel/NestedModel.pdf)
- [Mackinlay, Automating Graphical Presentations](https://doi.org/10.1145/22949.22950)
- [Smith and Whitehead, Expressive Range Analysis](https://www.pcgworkshop.com/archive/smith2010analyzing.pdf)
- [Summerville, PCG Evaluation Methodologies](https://ojs.aaai.org/index.php/AIIDE/article/view/13012)
- [Krippendorff, Reliability in Content Analysis](https://doi.org/10.1111/j.1468-2958.2004.tb00738.x)
