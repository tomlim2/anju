# api-test — VRM API 실험

**UE 관련: 아니오.** VRM/GLB를 다루는 외부 API와 파일 포맷을 확인해 보는 일회성 스크립트.
제품 코드가 아니다.

관련 파이프라인은 [`../module/pmx2vrm/`](../module/pmx2vrm/README.md)에 있다.

## 어디에 있나

- VRM API에 요청을 보내 보려면? → [`test_vrm_api.py`](test_vrm_api.py) — `requests` 사용, 엔드포인트는 비어 있어 직접 채워야 한다
- GLB 바이너리 헤더·청크를 뜯어보려면? → [`analyze_vrm.py`](analyze_vrm.py) — `struct`로 GLB 12바이트 헤더부터 파싱
- NZ 다운로더 UI? → [`nz-downloader/index.html`](nz-downloader/index.html)

## 주의

`nz-downloader/config.js`는 API 시크릿을 담고 있어 gitignore 대상이다. 커밋하지 않는다.
