# ae — After Effects 스크립트

**UE 관련: 아니오.** After Effects ExtendScript(`.jsx`). UE도 브라우저도 아닌 AE 안에서 실행한다.

## 어디에 있나

- 선택한 레이어를 무작위 위치로 흩으려면? → [`randomPos.jsx`](randomPos.jsx) — `app.beginUndoGroup` 사용, 실행 스크립트
- 텍스트를 무작위 단어로 바꾸려면? → [`randomTyping.jsx`](randomTyping.jsx) — 레이어 익스프레션으로 붙여 쓴다. 위치 기반 `seedRandom`

## 주의

두 파일의 실행 방식이 다르다. `randomPos.jsx`는 스크립트로 실행하고, `randomTyping.jsx`는 익스프레션 필드에 붙인다.
