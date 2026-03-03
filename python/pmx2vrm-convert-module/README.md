# pmx2vrm

PMX to VRM 0.x converter with dual TypeScript and Python implementations.

> **CRITICAL:** 하나의 PMX ZIP에서 **2개 이상의 VRM**이 출력될 수 있다. 의상 차분, 체형 차분, 본체+소품 등으로 ZIP 안에 humanoid PMX가 여러 개 들어있는 경우가 흔하다. **반드시 다중 출력을 전제로 처리 로직을 구성할 것.**

## Architecture

```
pmx2vrm-convert-module/
├── typescript/src/                # TypeScript implementation (~3,900 LOC)
│   ├── intake.ts                  # CLI entry + ZIP/folder scan + orchestration
│   ├── pmx-reader.ts              # PMX binary parser + texture loading
│   ├── gltf-builder.ts            # glTF 2.0 skeleton/mesh assembly
│   ├── vrm-builder.ts             # VRM 0.x extension injection
│   ├── spring-converter.ts        # PMX physics → VRM spring bones
│   ├── bone-mapping.ts            # Japanese PMX bone names → VRM humanoid
│   ├── vrm-validator.ts           # 6-layer VRM validation
│   ├── vrm-renamer.ts             # GLB metadata + ASCII filename
│   ├── index.ts                   # GLB writer + exports
│   └── types.ts                   # Shared interfaces
├── webapp/                        # Next.js 15 + React 19 (port 970)
│   ├── app/page.tsx               # Upload UI (drag-drop, batch queue)
│   ├── app/api/convert-zip/       # Server-side conversion endpoint
│   └── app/api/validate/          # Server-side VRM validation endpoint
├── python/                        # Python reference implementation
├── PLAN-browser-only.md           # Browser-only conversion plan (see below)
└── known-issues.json              # Fixed bugs + known limitations
```

### Conversion pipeline

```
ZIP/Folder → scan for .pmx → humanoid check (17 required bones)
  → per humanoid PMX:
    PMX binary → readPmx() → PmxData (in-memory)
      → buildGltf()  → GltfData (skeleton, mesh, textures)
      → buildVrm()   → GltfData + VRM 0.x extensions (spring bones, humanoid, materials)
      → writeGlb()   → GLB binary
      → renameVrm()  → ASCII-safe filename
      → validate()   → 6-layer VRM validation
```

### Dependencies

| Package | Purpose | Environment |
|---------|---------|-------------|
| `jszip` | ZIP parsing/creation | Both |
| `sharp` | Image codec (TGA/BMP → PNG, fallback textures) | Node only |
| `iconv-lite` | CJK filename decoding (Shift-JIS, GBK, EUC-KR, Big5) | Node only |
| `commander` | CLI argument parsing | Node only |

## Supported inputs

- **Folder** containing `.pmx` files and their textures
- **Flat ZIP** containing `.pmx` files and textures (CJK filenames handled automatically)

A single input (folder or ZIP) can contain **multiple humanoid PMX files**. Each humanoid PMX is converted to a separate `.vrm` file. Non-humanoid PMX files (props, accessories, stages) are automatically skipped — the converter checks for 17 required VRM humanoid bones and only converts models that pass.

### Not supported

- **Nested ZIPs** (zip-in-zip) — extract the inner zip first, then convert the extracted folder or zip. The converter will warn if nested ZIPs are detected.

## CLI usage

### TypeScript

```bash
cd typescript
npx tsx src/intake.ts <input>              # folder or ZIP auto-detect
npx tsx src/intake.ts <input> -o ./out     # custom output directory
npx tsx src/intake.ts <input> --no-spring  # skip spring bones
npx tsx src/intake.ts <input> --no-rename  # skip ASCII rename step
npx tsx src/intake.ts <input> --no-validate
```

### Python

```bash
python -m pmx2vrm_convert_module.python.intake model.zip
python -m pmx2vrm_convert_module.python.intake model.zip --output ./out
python -m pmx2vrm_convert_module.python.intake model.zip --scale 0.08 --no-spring
```

## Webapp

```bash
cd webapp
npm run dev    # http://localhost:970
```

Next.js test interface for browser-based conversion. Upload a flat ZIP and download the resulting `.vrm` file(s). Currently **server-side only** — conversion runs in Next.js API routes (`/api/convert-zip`), not in the browser.

- **Upload limit:** 200MB (configured in `next.config.ts`)
- **Timeout:** 300 seconds per conversion
- **Response format:** base64-encoded VRM binaries + validation results + logs

## Browser-only conversion plan

> **[`PLAN-browser-only.md`](./PLAN-browser-only.md)** — Refactoring plan to run PMX→VRM conversion entirely in the browser.

### For agents

The converter currently depends on 3 Node-only modules: `sharp`, `node:fs`, `iconv-lite`. The plan extracts all I/O behind an adapter interface (`ImageEncoder`, `TextCodec`) so the same core logic runs in both browser and Node.

**Target structure:**
```
typescript/src/
├── core/            # Pure TS — no I/O, runs anywhere
├── adapter-browser/ # pako PNG encoder, TextDecoder, Web Worker
└── adapter-node/    # sharp, iconv-lite, fs (existing behavior)
```

**Key risks and mitigations:**
| Risk | Severity | Mitigation |
|------|----------|------------|
| Texture alpha corruption | HIGH | Canvas premultiplies alpha irreversibly → bypass Canvas, encode PNG with pako |
| ZIP filename mojibake | MED | TextDecoder vs iconv-lite detection differs → `TextDecoder({ fatal: true })` fallback chain |
| Resize quality | LOW | Not currently used, no action needed |

**4 phases:** Interface extraction → Browser adapters → Web Worker integration → Node compat verification

The plan includes current function signatures with line numbers, file move paths, adapter implementation code, and per-phase completion checklists. Read `PLAN-browser-only.md` for full details.
