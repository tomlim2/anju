# module — 언어 무관 재사용 모듈

**UE 관련: 아니오.** UE에 의존하지 않는 독립 파이프라인. 같은 로직을 여러 런타임으로 구현해 둔다.

## 어디에 있나

- PMX(MMD) → VRM 변환 파이프라인? → [`pmx2vrm/`](pmx2vrm/) ([README](pmx2vrm/README.md))
  - Python 구현? → [`pmx2vrm/python/`](pmx2vrm/python/) — 진입점 `intake.py`
  - TypeScript(Node) 구현? → [`pmx2vrm/typescript/`](pmx2vrm/typescript/) — 진입점 `src/intake.ts`
  - 브라우저 전용 구현? → [`pmx2vrm/typescript-browser-only/`](pmx2vrm/typescript-browser-only/)
  - 브라우저 전용 설계 문서? → [`pmx2vrm/PLAN-browser-only.md`](pmx2vrm/PLAN-browser-only.md)
  - 알려진 변환 이슈? → [`pmx2vrm/known-issues.json`](pmx2vrm/known-issues.json)

## 작업 규칙

pmx2vrm 변경 시 커밋 순서와 테스트 방법이 정해져 있다.
[`../guidelines/index.md`](../guidelines/index.md) § PMX-VRM Converter Workflow 참조.
