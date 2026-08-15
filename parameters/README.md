# parameters — UE 머티리얼 파라미터 이름 목록

**UE 관련: 예.** 캐릭터 머티리얼의 파라미터 이름을 scalar / vector로 나눠 적어둔 참조 목록.
코드가 아니라 데이터이며, 자동으로 읽는 스크립트는 현재 없다.

셰이더 본체는 [`../hlsl/`](../hlsl/README.md)에 있다.

## 어디에 있나

- casual 프리셋의 파라미터 이름은? → [`casual.txt`](casual.txt)
  - scalar: 페이크 림라이트(밝기·폴오프·파워), 림라이트 각도·회전, 주야간 이미시브, 스페큘러, SSS, 디퓨즈(밝기·색조·채도)
  - outline: `Intensity`, `OutlineThickness`
  - vector: `FakeRimLightTint`, `AmbientColor`, `DayTone`/`NightTone`, `DiffuseColor`, `EmissiveColor`, `SSS`

## 상태

마지막 갱신 2024-06-26. 파일 1개뿐이라 `hlsl/` 또는 `python/anime_manager/` 아래로 옮기는 것을 검토 중이다.
