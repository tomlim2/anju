# 웹 랩 만드는 법

`web/` 아래 랩에 해당한다. 다섯 개 랩이 이미 같은 뼈대를 쓰고 있는데 어디에도 적혀 있지 않아서
여기 적는다.

## 다섯 파일 뼈대

```
web/<lab-name>/
├── index.html      # 마크업 + importmap + src/main.js 진입점만
├── styles.css      # UI 껍데기. 캔버스는 fixed inset:0
├── serve.mjs       # 의존성 없는 정적 서버
├── README.md       # 목표 / 실행 / 현재 범위
└── src/
    ├── main.js     # 진입점. 상태와 UI 배선만
    └── ...         # 도메인 모듈
```

새 랩은 기존 랩 하나를 복사해서 시작하는 것이 가장 빠르다. 다만 복사한 뒤 **포트와 로그 문구를
반드시 고친다.** 아래 "알려진 문제" 참조.

- `index.html`에는 로직을 넣지 않는다. 마크업과 importmap, 그리고 `<script type="module" src="./src/main.js">` 한 줄
- `main.js`는 배선만 한다. 그리기·계산은 별도 모듈로 뺀다
- 빌드 단계를 만들지 않는다. native ES module로 끝낸다

## importmap

three.js는 번들하지 않고 importmap으로 받는다. **버전을 고정한다.**

```html
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.169.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.169.0/examples/jsm/"
  }
}
</script>
```

`web/render-target/`은 예외적으로 CDN `<script>` 태그와 r128을 쓴다. 옛 방식이므로 따라 하지 않는다.
`webgl/boid/`는 importmap 없이 `import * as THREE from "three"`만 있어 **브라우저에서 그대로는 돌지 않는다.**

## 포트

랩마다 다른 포트를 쓴다. 같은 포트를 쓰면 두 랩을 동시에 못 띄운다.

| 랩 | 포트 |
| --- | --- |
| micro-graphic-generator | 7100 |
| cel-lab | 7200 |
| menagerie | 7300 |
| monolith | 7400 |
| type-tape | 7500 |

새 랩은 **7600부터** 쓴다. 랩을 복사해서 시작했다면 포트와 시작 로그 문구를 반드시 고친다.

## 실행

`file://` 직접 실행은 지원하지 않는다. native ES module이 HTTP origin을 요구한다.

```bash
node web/<lab-name>/serve.mjs
```

포트는 첫 인자로 넘길 수 있다. `node serve.mjs 7999`

## 모듈 캐시

파일을 고쳤는데 브라우저에 반영되지 않으면 **먼저 이걸 의심한다.**

`Cache-Control: no-store`만으로는 브라우저의 ES module map이 비워지지 않는다. 서버가 상대 경로
import 지정자에 `?v=` 를 붙여 URL 자체를 바꿔야 확실하다. `micro-graphic-generator/dev-server.mjs`와
`menagerie/serve.mjs`가 이 방식을 쓴다. 새 랩의 `serve.mjs`는 이 둘 중 하나를 복사한다.

importmap의 bare specifier(`three`)에는 붙이지 않는다. 상대 경로(`./`, `../`)만 대상이다.

## three.js를 쓸 때

- **정점 색은 선형 공간으로 넣는다.** three.js는 정점 색을 선형으로 보고 출력할 때 sRGB로 변환한다.
  sRGB 헥스를 그대로 주면 어두운 색이 중간 회색으로 밝아진다
- **`CanvasTexture`에는 `colorSpace = THREE.SRGBColorSpace`를 명시한다**
- `THREE.Line`의 굵기는 대부분 1로 고정된다. 굵은 선이 필요하면 리본 메시를 만든다

## 알려진 문제

- `web/index.html`은 랩 목록이 아니다. 어느 랩과도 무관한 Git 브랜치 스위처 스텁이며 동작하지 않는다
