# glsl — 비-UE 셰이더

**UE 관련: 아니오.** 이름만 보면 [`../hlsl/`](../hlsl/README.md)와 짝처럼 보이지만 **용도가 다르다.**
hlsl은 전부 UE 머티리얼용이고, 이 폴더는 Substance Painter와 웹용이다. 폴더 안에서도 둘로 갈린다.

## 어디에 있나

- Substance Painter 툰 셰이더? → [`Subs_ToonShader_V04.glsl`](Subs_ToonShader_V04.glsl) — `lib-sampler.glsl` 등 Substance 전용 라이브러리를 import한다
- 웹 이미지 물결 효과 (프래그먼트)? → [`rippleFragment.glsl`](rippleFragment.glsl)
- 웹 이미지 물결 효과 (버텍스)? → [`rippleVertex.glsl`](rippleVertex.glsl)

## 주의

`rippleVertex.glsl`은 `void main {` 으로 시작해 괄호가 빠져 있다. 그대로는 컴파일되지 않는다.
