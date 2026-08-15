# hlsl — UE 머티리얼 셰이더

**UE 관련: 예 (전부).** UE 머티리얼 에디터의 Custom 노드에 붙여 쓰는 HLSL 조각.
`GetDefaultSceneTextureUV` 같은 UE 전용 함수를 쓰므로 다른 렌더러에서는 그대로 동작하지 않는다.

파라미터 이름 목록은 [`../parameters/`](../parameters/README.md)에 있다.
비-UE 셰이더는 [`../glsl/`](../glsl/README.md)에 있다.

## 어디에 있나

- 2톤 툰 셰이딩(하드 엣지, 25% 그림자)? → [`cartoon_hlsl.hlsl`](cartoon_hlsl.hlsl) — UE 5.3 기준, directional light[0] 사용
- 얼굴 SDF 그림자 계산? → [`shadow_sdf.hlsl`](shadow_sdf.hlsl) — 머리 forward/right 벡터와 광원 내적
- SDF 텍스처 좌우 반전 처리? → [`shadow_sdf_texture_flipper.hlsl`](shadow_sdf_texture_flipper.hlsl)
- 라플라시안 필터(외곽선 검출)? → [`LaplacianFilter.hlsl`](LaplacianFilter.hlsl) — SceneTexture 기반
- 워터 머티리얼 UV 그래디언트 문제 수정? → [`waterFixIssue.hlsl`](waterFixIssue.hlsl) — `SampleGrad`로 우회
- UE 머티리얼 템플릿 원본은? → [`unreal_hlsl.hlsl`](unreal_hlsl.hlsl) — Epic의 `MaterialTemplate.usf`. 참고용이며 편집하지 않는다

## 알려진 문제

- `untitledHLSL.hlsl` — 빈 파일이다.
