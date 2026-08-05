# CEL LAB

브라우저에서 도는 실시간 셀 셰이딩 놀이터. 밴드 라이팅, 스크린 공간 하프톤
스크린톤, 인버티드 헐 아웃라인을 슬라이더로 실시간 조정한다.

레포의 `glsl/Subs_ToonShader_V04`가 가진 개념(Flat Lighting Weight, Shadow
Sensitivity, 섀도우 컬러, 스펙큘러, 라인)을 웹 GLSL로 옮긴 것.

## 실행

```bash
node web/cel-lab/serve.mjs 7300
```

`http://127.0.0.1:7300`. ES 모듈이라 파일로 직접 열면 동작하지 않는다.
three.js는 importmap CDN (빌드 단계 없음).

## 구조

```
index.html      마크업 + 컨트롤 덱
styles.css      모노크롬 셸
serve.mjs       정적 서버
src/
├── main.js           덱 배선 — 슬라이더가 유니폼을 직접 구동
├── scene.js          씬, 모델·팔레트, 궤도 라이트
└── toon-material.js  셀 셰이더 + 인버티드 헐 (GLSL)
```

## 셰이더 노트

- **밴드 라이팅** — half-Lambert를 `uBands` 단계로 양자화. `uThreshold`
  (Shadow Sensitivity)가 램프를 밝음/그늘 쪽으로 민다. `uFlatWeight`는
  램프 결과를 무조명 베이스 컬러 쪽으로 섞는다 (V04의 Flat Lighting Weight).
- **스크린톤** — 45도 도트 스크린을 `gl_FragCoord` 기준(디바이스 공간)으로
  찍는다. 메시에 붙는 벽지가 아니라 지면에 인쇄된 톤으로 읽히는 이유.
  도트 반경은 밴드 어둡기에서 오고, 경계는 `fwidth`로 1px 안티에일리어싱.
- **스펙큘러 / 림** — 그라디언트 없이 `step`으로 끊는다. 인쇄된 하이라이트와
  만화식 림 플래시.
- **아웃라인** — 인버티드 헐. 클립 공간에서 노멀 방향으로 밀어서
  (`clipPosition.xy += clipNormal.xy * uWidth * clipPosition.w`) 모델 스케일과
  카메라 거리에 무관하게 화면상 두께가 일정하다. `anime_manager`가 UE에서
  쓰는 그 방식.
- 지면 디스크는 히어로와 같은 머티리얼을 공유한다 — 터미네이터와 톤이
  이어져서 바닥이 아니라 한 장의 패널로 읽힌다.

## 컨트롤

| 카드 | 항목 | 유니폼 |
| --- | --- | --- |
| MODEL | knot / sphere / capsule / torus | — |
| LIGHTING | bands, shadow sensitivity, flat weight | `uBands` `uThreshold` `uFlatWeight` |
| SCREENTONE | dot scale, coverage | `uToneScale` `uToneCover` |
| SURFACE | specular, rim | `uSpecular` `uRim` |
| LINE | outline | `uWidth` (헐) |
| INK | manga / sunset / mint | 팔레트 4색 |
