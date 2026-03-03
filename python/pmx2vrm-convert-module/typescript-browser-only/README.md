# typescript-browser-only/

Browser-compatible PMX→VRM converter. Refactored from `../typescript/` with adapter pattern to eliminate Node-only dependencies.

## Architecture

```
src/
├── core/                    # Pure TS — zero I/O, runs in any JS runtime
│   ├── types.ts             # ConvertDeps, VrmOutput, ValidationResult, PmxData
│   ├── pmx-reader.ts        # PMX binary parser (deps injected, no fs/sharp)
│   ├── gltf-builder.ts      # glTF 2.0 skeleton/mesh assembly
│   ├── vrm-builder.ts       # VRM 0.x extension injection
│   ├── spring-converter.ts  # PMX physics → VRM spring bones
│   ├── bone-mapping.ts      # Japanese bone names → VRM humanoid
│   ├── vrm-validator.ts     # 6-layer validation (validate + formatHuman)
│   ├── vrm-renamer.ts       # GLB metadata + ASCII filename
│   ├── glb-writer.ts        # GltfData → GLB Uint8Array (sync, no file I/O)
│   ├── humanoid-check.ts    # Quick 16-bone humanoid check
│   ├── image-decoders.ts    # TGA/BMP → RGBA (extracted from pmx-reader)
│   └── path-utils.ts        # extname, basename, dirname (no node:path)
│
├── adapter-browser/         # Browser-specific I/O
│   ├── worker.ts            # Web Worker entry — postMessage API
│   ├── convert.ts           # convertZip(ArrayBuffer, opts) → VrmOutput[]
│   ├── image-encoder.ts     # pako-based PNG encoder (Canvas-free, alpha-safe)
│   ├── text-codec.ts        # TextDecoder({ fatal: true }) CJK chain
│   └── zip-reader.ts        # JSZip + decodeFileName wrapper
│
└── adapter-node/            # Node.js I/O (CLI compatibility)
    ├── intake.ts            # CLI entry (sharp, iconv-lite, fs)
    ├── image-encoder.ts     # sharp wrapper
    └── text-codec.ts        # iconv-lite wrapper
```

## Key design

**ConvertDeps injection.** Core functions accept `{ image: ImageEncoder, text: TextCodec }` instead of importing I/O directly. Browser adapter uses pako + TextDecoder; Node adapter uses sharp + iconv-lite.

**Canvas-free PNG encoding.** Browser `ImageEncoder.rgbaToPng()` builds PNG manually with pako deflate. Canvas premultiplies alpha irreversibly — this preserves original alpha values.

**Worker protocol:**
```
Main → Worker: { zipBuffer: ArrayBuffer, scale: number, noSpring: boolean }
Worker → Main: { ok: true, results: VrmOutput[] }  (Transferable buffers)
Worker → Main: { ok: false, error: string }
```

## CLI usage

```bash
npx tsx src/adapter-node/intake.ts <input> [options]
```

Same flags as `../typescript/` (--output, --scale, --no-spring, --no-rename, --no-validate).

## Showcase (Vite)

```bash
cd showcase && npm run dev  # http://localhost:971
```

Vite + React 19 SPA. Conversion runs entirely in-browser via Web Worker. No server API calls. Single Convert tab: ZIP upload → VRM conversion → inline validation → download.

| File | Role |
|------|------|
| `showcase/src/App.tsx` | Main UI (queue picker, worker dispatch, result display) |
| `showcase/vite.config.ts` | `@converter` alias → `../src`, fs.allow for parent dir |

## Dependencies

| Package | Where | Purpose |
|---------|-------|---------|
| `jszip` | core | ZIP parsing |
| `pako` | adapter-browser | PNG deflate (Canvas-free) |
| `sharp` | adapter-node only | Image codec |
| `iconv-lite` | adapter-node only | CJK text decoding |
