# PMX2VRM Browser-Only Conversion Plan

현재 Next.js 서버사이드에서 수행되는 PMX→VRM 변환을 **순수 브라우저(프론트엔드)에서 실행**하도록 리팩토링하는 계획.

**Base path:** `<anju>/python/pmx2vrm-convert-module/` (`<anju>` = repo-paths.json의 `anju` 경로)

---

## 현재 구조

```
typescript/src/
├── intake.ts              # ZIP 스캔 + 변환 오케스트레이션 (fs, path, iconv 의존)
├── pmx-reader.ts          # PMX 바이너리 파싱 + 텍스처 로딩 (fs, path, sharp, iconv 의존)
├── gltf-builder.ts        # glTF 2.0 조립 (순수 TS)
├── vrm-builder.ts         # VRM 0.x 확장 주입 (순수 TS)
├── spring-converter.ts    # 물리 → 스프링본 변환 (순수 TS)
├── bone-mapping.ts        # PMX 일본어본 → VRM 휴머노이드 매핑 (순수 TS)
├── vrm-validator.ts       # VRM 6레이어 검증 (순수 TS)
├── vrm-renamer.ts         # GLB 메타데이터 + 파일명 생성 (순수 TS)
├── index.ts               # GLB writer (fs.writeFile 의존)
└── types.ts               # 공유 인터페이스
```

### 서버 의존성 (제거 대상)

| 의존성 | 파일 | 용도 |
|--------|------|------|
| `sharp` | pmx-reader.ts:13 | TGA/BMP→PNG 변환, 1x1 폴백 생성 |
| `node:fs` | intake.ts:15-16, pmx-reader.ts:10-11, index.ts:5 | 파일 읽기/쓰기/스캔 |
| `node:path` | intake.ts:17, pmx-reader.ts:12 | 경로 조작 |
| `node:os` | intake.ts:18 | tmpdir() |
| `iconv-lite` | intake.ts:20, pmx-reader.ts:14 | CJK 파일명 디코딩 |

### 현재 핵심 함수 시그니처

```typescript
// pmx-reader.ts:826
export async function read(pmxPath: string, scale?: number): Promise<PmxData>

// pmx-reader.ts:745
async function loadTextureAsPng(filePath: string): Promise<Buffer>

// pmx-reader.ts:782
function resolveTexturePath(pmxDir: string, texPath: string): string | null

// pmx-reader.ts:612
function decodeTga(buf: Buffer): { width: number; height: number; data: Buffer }

// pmx-reader.ts:694
function decodeBmp(buf: Buffer): { width: number; height: number; data: Buffer }

// intake.ts:99
function isHumanoid(pmxBytes: Uint8Array): [boolean, Set<string>]

// intake.ts:336
export async function process_(inputPath: string, options?: ProcessOptions): Promise<string[]>

// index.ts:16
export async function writeGlb(gltfData: GltfData, outputPath: string): Promise<void>
```

---

## 목표 구조

```
typescript/src/
├── core/                       # 순수 TS (브라우저 + Node 공용)
│   ├── pmx-reader.ts           # PMX 바이너리 파싱 (I/O 제거, deps 주입)
│   ├── image-decoders.ts       # decodeTga + decodeBmp (pmx-reader.ts에서 추출)
│   ├── gltf-builder.ts         # 현재 gltf-builder.ts 이동 (변경 없음)
│   ├── vrm-builder.ts          # 현재 vrm-builder.ts 이동 (변경 없음)
│   ├── spring-converter.ts     # 현재 spring-converter.ts 이동 (변경 없음)
│   ├── bone-mapping.ts         # 현재 bone-mapping.ts 이동 (변경 없음)
│   ├── vrm-validator.ts        # 현재 vrm-validator.ts 이동 (변경 없음)
│   ├── vrm-renamer.ts          # 현재 vrm-renamer.ts 이동 (변경 없음)
│   ├── glb-writer.ts           # 현재 index.ts의 GLB 조립 로직 (writeFile 제거)
│   ├── humanoid-check.ts       # isHumanoid() (intake.ts에서 추출)
│   └── types.ts                # 현재 types.ts + I/O 인터페이스 추가
│
├── adapter-browser/            # 브라우저 전용 어댑터
│   ├── image-encoder.ts        # TGA/BMP RGBA → PNG 변환 (Canvas-free, pako 사용)
│   ├── text-codec.ts           # TextDecoder 기반 CJK 디코딩
│   ├── zip-reader.ts           # JSZip + decodeFileName 래퍼
│   ├── convert.ts              # 브라우저 진입점 (convertInMemory)
│   └── worker.ts               # Web Worker 엔트리
│
├── adapter-node/               # Node.js 전용 어댑터 (기존 호환)
│   ├── image-encoder.ts        # sharp 래퍼
│   ├── text-codec.ts           # iconv-lite 래퍼
│   └── intake.ts               # 기존 CLI + 서버 진입점 (현재 intake.ts 리팩토링)
│
└── index.ts                    # 양쪽 어댑터 re-export
```

---

## Phase 1: I/O 인터페이스 추출

**목표:** 코어 로직에서 I/O 의존성을 인터페이스 뒤로 분리.

### 1-1. I/O 인터페이스 정의

`core/types.ts`에 추가:

```typescript
/** 이미지 인코딩 어댑터 (브라우저: pako PNG, Node: sharp) */
export interface ImageEncoder {
  /** Raw RGBA 픽셀 → PNG 바이너리 */
  rgbaToPng(data: Uint8Array, width: number, height: number): Promise<Uint8Array>;
  /** 이미지 파일 바이트 → PNG 바이너리 (PNG/JPEG는 패스스루) */
  toPng(data: Uint8Array, ext: string): Promise<Uint8Array>;
  /** 1x1 white PNG 폴백 텍스처 생성 */
  createFallback(): Promise<Uint8Array>;
}

/** 텍스트 인코딩 어댑터 (브라우저: TextDecoder, Node: iconv-lite) */
export interface TextCodec {
  /** 바이트 → 문자열 (인코딩 지정) */
  decode(bytes: Uint8Array, encoding: string): string;
  /** 스마트 파일명 디코딩 (UTF-8 → Shift-JIS → GBK → EUC-KR 순서 시도) */
  decodeFileName(bytes: Uint8Array): string;
}

/** 코어 변환 함수에 주입되는 의존성 */
export interface ConvertDeps {
  image: ImageEncoder;
  text: TextCodec;
}

/** 브라우저 변환 결과 */
export interface VrmOutput {
  name: string;               // 원본 PMX 파일명
  vrm: Uint8Array;            // 변환된 VRM (GLB 바이너리)
  validation: ValidationResult;
  logs: string[];
}
```

### 1-2. 함수 시그니처 변경

| 함수 | 현재 시그니처 | 변경 후 |
|------|-------------|---------|
| `read()` (pmx-reader.ts:826) | `read(pmxPath: string, scale?: number)` | `read(pmxBytes: Uint8Array, textures: Map<string, Uint8Array>, deps: ConvertDeps, scale?: number)` |
| `loadTextureAsPng()` (pmx-reader.ts:745) | `loadTextureAsPng(filePath: string)` | `loadTextureAsPng(data: Uint8Array, ext: string, deps: ConvertDeps)` |
| `resolveTexturePath()` (pmx-reader.ts:782) | `resolveTexturePath(pmxDir: string, texPath: string)` | 제거 — 텍스처는 `Map<string, Uint8Array>`로 직접 룩업 |
| `writeGlb()` (index.ts:16) | `writeGlb(gltfData: GltfData, outputPath: string): Promise<void>` | `writeGlb(gltfData: GltfData): Uint8Array` (동기, 파일쓰기 없음) |
| `isHumanoid()` (intake.ts:99) | 현재 위치 유지 가능 | `core/humanoid-check.ts`로 이동 (intake.ts에서 import) |

### 1-3. 파일 이동 계획

**그대로 `core/`로 이동 (변경 없음):**
- `gltf-builder.ts` → `core/gltf-builder.ts`
- `vrm-builder.ts` → `core/vrm-builder.ts`
- `spring-converter.ts` → `core/spring-converter.ts`
- `bone-mapping.ts` → `core/bone-mapping.ts`
- `vrm-validator.ts` → `core/vrm-validator.ts`
- `vrm-renamer.ts` → `core/vrm-renamer.ts`

**추출 + 이동:**
- `pmx-reader.ts`의 `decodeTga()` (line 612) + `decodeBmp()` (line 694) → `core/image-decoders.ts`
- `intake.ts`의 `isHumanoid()` (line 99) → `core/humanoid-check.ts`
- `index.ts`의 GLB 조립 로직 (line 16-56) → `core/glb-writer.ts` (`writeFile` 제거)

**리팩토링:**
- `pmx-reader.ts` → `core/pmx-reader.ts` (sharp/fs/iconv/path 제거, `ConvertDeps` 주입)
- `intake.ts` → `adapter-node/intake.ts` (기존 CLI/서버 로직 유지)

### 1-4. `node:path` 대체

`path.join()`, `path.dirname()`, `path.extname()`, `path.basename()` 사용 부분을 순수 문자열 유틸로 교체:

```typescript
// core/path-utils.ts
export function extname(p: string): string {
  const i = p.lastIndexOf('.');
  return i < 0 ? '' : p.substring(i);
}
export function basename(p: string, ext?: string): string {
  let name = p.substring(Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')) + 1);
  if (ext && name.endsWith(ext)) name = name.substring(0, name.length - ext.length);
  return name;
}
export function dirname(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i < 0 ? '.' : p.substring(0, i);
}
```

### 1-5. Phase 1 완료 기준

- [ ] `core/` 디렉토리의 모든 파일에 `node:fs`, `node:path`, `node:os`, `sharp`, `iconv-lite` import가 **0개**
- [ ] `adapter-node/intake.ts`에서 `core/` 함수를 호출하여 기존 CLI가 동일하게 동작
- [ ] 테스트: `npx tsx adapter-node/intake.ts <test-zip>` 실행 → 기존과 동일한 VRM 출력

---

## Phase 2: 브라우저 어댑터 구현

### 2-1. 텍스처 처리 — Canvas 우회 (위험도 상 대응)

**문제:** Canvas 2D는 premultiplied alpha가 기본. 한번 premultiply되면 복원 불가. `createImageBitmap({ premultiplyAlpha: 'none' })`도 [Chrome만 지원](https://github.com/whatwg/html/issues/10142).

**해결:** Canvas를 쓰지 않는다. pako로 순수 JS PNG 인코딩.

```typescript
// adapter-browser/image-encoder.ts
import pako from 'pako';
import { decodeTga, decodeBmp } from '../core/image-decoders.js';

export class BrowserImageEncoder implements ImageEncoder {
  async rgbaToPng(data: Uint8Array, w: number, h: number): Promise<Uint8Array> {
    // PNG 구조: signature + IHDR + IDAT + IEND
    // IHDR: width(4) height(4) bitDepth(1:8) colorType(1:6=RGBA) compress(1:0) filter(1:0) interlace(1:0)
    // IDAT: zlib deflate of (filter_byte + row_data) per scanline
    // filter_byte = 0 (None) for simplicity
    const raw = new Uint8Array((1 + w * 4) * h);
    for (let y = 0; y < h; y++) {
      raw[y * (1 + w * 4)] = 0; // filter: None
      raw.set(data.subarray(y * w * 4, (y + 1) * w * 4), y * (1 + w * 4) + 1);
    }
    const compressed = pako.deflate(raw);
    return buildPng(w, h, compressed);
  }

  async toPng(data: Uint8Array, ext: string): Promise<Uint8Array> {
    const e = ext.toLowerCase();
    if (e === '.png' || e === '.jpeg' || e === '.jpg') return data; // 패스스루
    if (e === '.tga') {
      const d = decodeTga(data);
      return this.rgbaToPng(d.data, d.width, d.height);
    }
    if (e === '.bmp') {
      const d = decodeBmp(data);
      return this.rgbaToPng(d.data, d.width, d.height);
    }
    return this.createFallback();
  }

  async createFallback(): Promise<Uint8Array> {
    return this.rgbaToPng(new Uint8Array([255, 255, 255, 255]), 1, 1);
  }
}

/** PNG 바이너리 조립 (signature + IHDR + IDAT + IEND) */
function buildPng(w: number, h: number, idatPayload: Uint8Array): Uint8Array {
  // PNG signature (8 bytes)
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = buildChunk('IHDR', ihdrData(w, h));
  const idat = buildChunk('IDAT', idatPayload);
  const iend = buildChunk('IEND', new Uint8Array(0));
  return concatBytes([sig, ihdr, idat, iend]);
}

function ihdrData(w: number, h: number): Uint8Array {
  const buf = new Uint8Array(13);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  buf[8] = 8;  // bit depth
  buf[9] = 6;  // color type: RGBA
  return buf;
}

function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const len = data.length;
  const buf = new Uint8Array(4 + 4 + len + 4);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, len);
  buf.set([type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)], 4);
  buf.set(data, 8);
  const crc = crc32(buf.subarray(4, 8 + len));
  dv.setUint32(8 + len, crc);
  return buf;
}

// crc32: 표준 PNG CRC 테이블 구현 필요
```

**참고:**
- [Canvas getImageData premultiplied alpha 비가역 손실](https://dev.to/yoya/canvas-getimagedata-premultiplied-alpha-150b)
- pako는 JSZip이 내부적으로 사용하는 동일 라이브러리

**대안:** 자체 PNG 인코더 대신 [upng-js](https://github.com/nicolo-ribaudo/pako) (순수 JS PNG encoder/decoder) 사용 가능. 단, `rgbaToPng`는 단순 구조이므로 직접 구현이 의존성 최소화에 유리.

### 2-2. ZIP 파일명 디코딩 — TextDecoder `fatal: true` (위험도 중 대응)

**문제:** iconv-lite와 TextDecoder의 에러 핸들링 차이로 인코딩 감지 결과가 달라질 수 있음.

**해결:** [`TextDecoder`의 `fatal: true`](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/fatal)로 통일하여 동일한 폴백 로직 구현.

```typescript
// adapter-browser/text-codec.ts

const ENCODINGS = ['utf-8', 'shift_jis', 'gbk', 'euc-kr'] as const;

export class BrowserTextCodec implements TextCodec {
  decode(bytes: Uint8Array, encoding: string): string {
    return new TextDecoder(encoding, { fatal: false }).decode(bytes);
  }

  decodeFileName(bytes: Uint8Array): string {
    for (const enc of ENCODINGS) {
      try {
        return new TextDecoder(enc, { fatal: true }).decode(bytes);
      } catch {
        continue; // 잘못된 바이트 → 다음 인코딩 시도
      }
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}
```

**참고:**
- [JSZip loadAsync decodeFileName 옵션](https://stuk.github.io/jszip/documentation/api_jszip/load_async.html)
- [JSZip 일본어 파일명 이슈 #384](https://github.com/Stuk/jszip/issues/384)

### 2-3. ZIP 로딩 통합

```typescript
// adapter-browser/zip-reader.ts
import JSZip from 'jszip';
import { BrowserTextCodec } from './text-codec.js';

const codec = new BrowserTextCodec();

export async function loadZip(buffer: ArrayBuffer): Promise<JSZip> {
  return JSZip.loadAsync(buffer, {
    decodeFileName: (bytes: Uint8Array) => codec.decodeFileName(bytes),
  });
}
```

### 2-4. Phase 2 완료 기준

- [ ] `adapter-browser/image-encoder.ts` — TGA/BMP 입력에서 유효한 PNG 바이너리 출력 (PNG signature `89 50 4E 47` 확인)
- [ ] `adapter-browser/text-codec.ts` — Shift-JIS 바이트열 `[0x83, 0x7E, 0x83, 0x4E]` → `"ミク"` 디코딩 확인
- [ ] `adapter-browser/zip-reader.ts` — 일본어 파일명 ZIP 로딩 후 파일명 깨짐 없음

---

## Phase 3: 브라우저 진입점 + Web Worker

### 3-1. 브라우저 변환 진입점

```typescript
// adapter-browser/convert.ts
import JSZip from 'jszip';
import { loadZip } from './zip-reader.js';
import { BrowserImageEncoder } from './image-encoder.js';
import { BrowserTextCodec } from './text-codec.js';
import { read as readPmx } from '../core/pmx-reader.js';
import { isHumanoid } from '../core/humanoid-check.js';
import { build as buildGltf } from '../core/gltf-builder.js';
import { build as buildVrm } from '../core/vrm-builder.js';
import { writeGlb } from '../core/glb-writer.js';
import { renameVrm } from '../core/vrm-renamer.js';
import { validate } from '../core/vrm-validator.js';
import { extname } from '../core/path-utils.js';
import type { ConvertDeps, VrmOutput } from '../core/types.js';

export async function convertInMemory(
  zipBuffer: ArrayBuffer,
  opts: { scale?: number; noSpring?: boolean } = {},
): Promise<VrmOutput[]> {
  const deps: ConvertDeps = {
    image: new BrowserImageEncoder(),
    text: new BrowserTextCodec(),
  };
  const zip = await loadZip(zipBuffer);
  const logs: string[] = [];

  // ZIP 내 .pmx 파일 탐색
  const pmxEntries = Object.entries(zip.files)
    .filter(([name]) => name.toLowerCase().endsWith('.pmx') && !name.startsWith('__MACOSX'));

  const results: VrmOutput[] = [];

  for (const [name, entry] of pmxEntries) {
    const pmxBytes = await entry.async('uint8array');

    // humanoid 체크 (비humanoid PMX 스킵)
    const [ok] = isHumanoid(pmxBytes);
    if (!ok) {
      logs.push(`skip non-humanoid: ${name}`);
      continue;
    }

    // 동일 디렉토리 텍스처를 Map으로 수집
    const dir = name.substring(0, name.lastIndexOf('/') + 1);
    const textures = new Map<string, Uint8Array>();
    for (const [tName, tEntry] of Object.entries(zip.files)) {
      if (tName.startsWith(dir) && !tEntry.dir && tName !== name) {
        textures.set(tName.substring(dir.length), await tEntry.async('uint8array'));
      }
    }

    // 코어 변환 파이프라인 (I/O 없음)
    const pmx = await readPmx(pmxBytes, textures, deps, opts.scale ?? 0.08);
    const gltf = buildGltf(pmx, opts.scale ?? 0.08);
    const vrm = buildVrm(gltf, pmx, opts.noSpring ?? false);
    const glb = writeGlb(vrm);
    const renamed = renameVrm(glb, name);
    const validation = validate(renamed);

    results.push({ name, vrm: renamed, validation, logs });
  }

  return results;
}
```

### 3-2. Web Worker

```typescript
// adapter-browser/worker.ts
import { convertInMemory } from './convert.js';

self.onmessage = async (e: MessageEvent) => {
  const { zipBuffer, scale, noSpring } = e.data;
  try {
    const results = await convertInMemory(zipBuffer, { scale, noSpring });
    // Transferable로 전송 (복사 방지)
    const transfers = results.map(r => r.vrm.buffer);
    self.postMessage({ ok: true, results }, transfers);
  } catch (err) {
    self.postMessage({ ok: false, error: (err as Error).message });
  }
};
```

### 3-3. 프론트엔드 호출 (webapp/app/page.tsx)

기존 `/api/convert-zip` fetch 호출을 Worker 호출로 교체:

```typescript
const worker = new Worker(new URL('../typescript/src/adapter-browser/worker.ts', import.meta.url));

async function convertFile(file: File): Promise<VrmOutput[]> {
  const buffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      if (e.data.ok) resolve(e.data.results);
      else reject(new Error(e.data.error));
    };
    worker.postMessage({ zipBuffer: buffer, scale: 0.08, noSpring: false }, [buffer]);
  });
}
```

### 3-4. Phase 3 완료 기준

- [ ] 브라우저에서 테스트 ZIP 업로드 → VRM 다운로드 성공
- [ ] Web Worker에서 실행 → 메인 스레드 UI 프리즈 없음
- [ ] 서버 API (`/api/convert-zip`) 호출 없이 변환 완료

---

## Phase 4: 기존 Node.js 호환 유지

`adapter-node/`는 기존 sharp/iconv-lite/fs를 래핑하여 동일 `ConvertDeps` 인터페이스 구현.

```typescript
// adapter-node/image-encoder.ts
import sharp from 'sharp';
import type { ImageEncoder } from '../core/types.js';

export class NodeImageEncoder implements ImageEncoder {
  async rgbaToPng(data: Uint8Array, w: number, h: number) {
    return new Uint8Array(
      await sharp(Buffer.from(data), { raw: { width: w, height: h, channels: 4 } }).png().toBuffer()
    );
  }
  async toPng(data: Uint8Array, _ext: string) {
    return new Uint8Array(await sharp(Buffer.from(data)).png().toBuffer());
  }
  async createFallback() {
    return new Uint8Array(
      await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer()
    );
  }
}
```

```typescript
// adapter-node/text-codec.ts
import iconv from 'iconv-lite';
import type { TextCodec } from '../core/types.js';

export class NodeTextCodec implements TextCodec {
  decode(bytes: Uint8Array, encoding: string) {
    return iconv.decode(Buffer.from(bytes), encoding);
  }
  decodeFileName(bytes: Uint8Array) {
    // 현재 intake.ts의 smartDecodeFilename() 로직 이동
    for (const enc of ['utf-8', 'shiftjis', 'gbk', 'euc-kr', 'big5']) {
      const s = iconv.decode(Buffer.from(bytes), enc);
      if (!s.includes('\ufffd')) return s;
    }
    return iconv.decode(Buffer.from(bytes), 'utf-8');
  }
}
```

### Phase 4 완료 기준

- [ ] `npx tsx adapter-node/intake.ts <test-zip>` — 기존과 동일한 VRM 출력
- [ ] `webapp/app/api/convert-zip/route.ts` — Node 어댑터 사용하여 기존 서버 API 동작 유지

---

## 추가 의존성

| 패키지 | 용도 | 크기 | 환경 | 비고 |
|--------|------|------|------|------|
| `pako` | PNG IDAT zlib deflate | ~45KB | 브라우저 | JSZip이 이미 번들에 포함 |

기존 유지:
- `jszip` — 브라우저 호환, 양쪽 사용
- `iconv-lite` — `adapter-node/`에서만
- `sharp` — `adapter-node/`에서만

---

## 위험 요소 및 대응 요약

| 위험도 | 영역 | 원인 | 대응 | 검증 방법 |
|--------|------|------|------|----------|
| **상** | 텍스처 알파 | Canvas premultiply 비가역 | Canvas 우회, pako로 순수 JS PNG 인코딩 | 반투명 TGA 텍스처 → 출력 PNG 알파값 원본과 바이트 일치 확인 |
| **중** | ZIP 파일명 | iconv-lite ↔ TextDecoder 감지 차이 | `fatal: true` 폴백 통일 | Shift-JIS 파일명 ZIP으로 텍스처 매칭 성공 확인 |
| **하** | 리사이즈 품질 | lanczos3 vs bilinear | 현재 미사용, 대응 불필요 | — |

---

## 작업 순서 요약

```
Phase 1: I/O 인터페이스 추출
  1. core/types.ts에 ImageEncoder, TextCodec, ConvertDeps, VrmOutput 추가
  2. core/path-utils.ts 생성 (extname, basename, dirname)
  3. core/image-decoders.ts 생성 (decodeTga, decodeBmp 추출)
  4. core/humanoid-check.ts 생성 (isHumanoid 추출)
  5. 순수 TS 파일들 core/로 이동
  6. core/pmx-reader.ts 리팩토링 (ConvertDeps 주입, fs/sharp/iconv/path 제거)
  7. core/glb-writer.ts 리팩토링 (writeFile 제거, Uint8Array 반환)
  8. adapter-node/ 구현 (기존 코드 래핑)
  9. 검증: CLI 기존 동작 확인

Phase 2: 브라우저 어댑터 구현
  1. adapter-browser/image-encoder.ts (pako PNG 인코딩)
  2. adapter-browser/text-codec.ts (TextDecoder fatal:true)
  3. adapter-browser/zip-reader.ts (JSZip decodeFileName)
  4. 단위 검증: TGA→PNG, Shift-JIS 디코딩

Phase 3: 브라우저 통합
  1. adapter-browser/convert.ts (convertInMemory)
  2. adapter-browser/worker.ts (Web Worker)
  3. webapp/app/page.tsx 수정 (서버 API → Worker)
  4. 통합 검증: 브라우저에서 ZIP → VRM 변환

Phase 4: 호환성 확인
  1. Node CLI 동작 확인
  2. 서버 API 동작 확인
  3. Node 출력 vs 브라우저 출력 바이너리 비교
```

---

## 테스트 파일

검증에 사용할 파일 (repo-paths.json의 `mmd-archive` 경로):

```
<mmd-archive>/pmx/槿廚屆돛―빻삽/빻삽3.0.pmx    # Shift-JIS 경로, 텍스처 다수
<mmd-archive>/vmd/[MrPolarbear]/When the Moon Reaches Stars/When the Moon Reaches Stars/Mitsuru Solo.vmd
```

검증 기준: Node CLI 출력 VRM과 브라우저 출력 VRM이 바이트 동일 (또는 텍스처 바이너리 해시 일치).

---

## 참고 자료

- [WHATWG: createImageBitmap premultiplyAlpha 크로스브라우저 이슈](https://github.com/whatwg/html/issues/10142)
- [Canvas getImageData premultiplied alpha 비가역 손실](https://dev.to/yoya/canvas-getimagedata-premultiplied-alpha-150b)
- [WebGL and Alpha](https://webglfundamentals.org/webgl/lessons/webgl-and-alpha.html)
- [JSZip: 일본어 파일명 깨짐 이슈 #384](https://github.com/Stuk/jszip/issues/384)
- [JSZip loadAsync decodeFileName 옵션](https://stuk.github.io/jszip/documentation/api_jszip/load_async.html)
- [MDN: TextDecoder fatal 속성](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/fatal)
