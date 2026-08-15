# web — 브라우저 랩

**UE 관련: 아니오.** 정적 HTML + native ES module로 도는 그래픽·타이포그래피 실험.
빌드 단계 없이 로컬 HTTP 서버로 띄운다.

## 어디에 있나

- 타이포그래픽 마이크로 그래픽 제네레이터? → [`micro-graphic-generator/`](micro-graphic-generator/) ([README](micro-graphic-generator/README.md)) — 이 폴더에서 가장 큰 프로젝트. 테스트·dev-server 있음
- 절차적 손그림 크리처 그리드? → [`menagerie/`](menagerie/) ([README](menagerie/README.md)) — 시드 하나로 그리드 한 판. 개체마다 숨쉬고 깜빡인다
- 실시간 셀 셰이딩 놀이터(밴드 라이팅, 하프톤)? → [`cel-lab/`](cel-lab/) ([README](cel-lab/README.md))
- 모노크롬 복셀 타이포그래피? → [`monolith/`](monolith/) ([README](monolith/README.md))
- 3D 리본 타이포그래피(밴드·뫼비우스·코일)? → [`type-tape/`](type-tape/) ([README](type-tape/README.md))
- Three.js 렌더 타겟 예제? → [`render-target/`](render-target/)
- CSS 없는 마크업 실험? → [`v0-no-css/`](v0-no-css/)
`index.html`은 랩 목록이 아니다. 어느 랩과도 무관한 Git 브랜치 스위처 스텁이며 동작하지 않는다.

## 실행

각 랩은 자체 `serve.mjs` 또는 `dev-server.mjs`를 가진다. `file://` 직접 실행은 지원하지 않는다.
micro-graphic-generator는 실행 계약이 [`micro-graphic-generator/tests/launch-contract.json`](micro-graphic-generator/tests/launch-contract.json)에 명시돼 있다.

## 주의

- 랩마다 포트가 다르다. 7100 micro-graphic-generator / 7200 cel-lab / 7300 menagerie / 7400 monolith / 7500 type-tape.
- micro-graphic-generator의 테스트는 Node **22.12.0** 고정을 요구한다(`assertRuntimeConformance`).
다른 버전에서는 테스트가 실행 전에 막힌다.
