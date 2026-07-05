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

## 현재 시각 규칙

- 기본은 단색 전경/배경.
- 시스템 텍스트는 monospaced 영어를 쓴다.
- 한글 키워드는 굵은 display label처럼 쓴다.
- 작은 메타데이터, 가짜 조직명, 포트, revision badge, serial, code를 조합한다.
- 선은 살짝 거칠게 만들어 너무 깨끗한 UI처럼 보이지 않게 한다.
- barcode, pseudo-QR, tick mark, mini table, wave graph, label, frame, symbol을 재사용 가능한 그래픽 primitive로 둔다.
- 복잡한 컨트롤보다 레이아웃 변주를 우선한다.

## 레이아웃 모드

- `single`: 중앙에 하나의 기술 라벨/스트립.
- `grid`: 여러 개의 마이크로 패널을 적당한 간격으로 배치.
- `dense`: 작은 패널을 많이 밀도 있게 배치.
- `strip`: 가로 라벨 조각을 세로로 누적.
- `specimen`: 큰 타이포 샘플 하나와 보조 마크.

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
