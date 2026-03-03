# pmx2vrm

PMX to VRM 0.x converter. Three implementations share the same pipeline logic.

**One ZIP can produce multiple VRMs.** PMX archives often contain costume/body variants. Always handle multi-output.

## Implementations

| Directory | Runtime | Entry point | Showcase port |
|-----------|---------|-------------|---------------|
| `python/` | Python 3.10+ | `intake.py` | — |
| `typescript/` | Node.js (sharp, iconv-lite) | `src/intake.ts` | 970 (Next.js) |
| `typescript-browser-only/` | Browser (Web Worker, pako) | `src/adapter-browser/worker.ts` | 971 (Vite) |

## Pipeline

```
ZIP → scan .pmx → humanoid check (16 required bones)
  → per humanoid PMX:
    readPmx() → buildGltf() → buildVrm() → writeGlb() → renameVrm() → validate()
```

Each step is a pure function. I/O is injected via `ConvertDeps` (ImageEncoder + TextCodec).

## Structure

```
pmx2vrm-convert-module/
├── python/                         # Python reference (standalone)
│   ├── intake.py                   # CLI entry
│   └── vrm_validator.py            # Standalone validator (--json flag)
├── typescript/                     # Node.js implementation (monolithic)
│   ├── src/intake.ts               # CLI entry (sharp, iconv-lite, fs)
│   └── showcase/                   # Next.js 15 webapp (port 970, server-side)
├── typescript-browser-only/        # Browser-compatible refactor
│   ├── src/
│   │   ├── core/                   # Pure TS — no I/O, runs anywhere
│   │   ├── adapter-browser/        # pako PNG, TextDecoder, Web Worker
│   │   └── adapter-node/           # sharp, iconv-lite (CLI compat)
│   └── showcase/                   # Vite SPA (port 971, client-side only)
├── PLAN-browser-only.md            # Refactoring plan (historical — completed)
└── README.md                       # This file
```

## Quick start

```bash
# Python
cd python && python intake.py <zip_or_folder>

# TypeScript (Node)
cd typescript && npx tsx src/intake.ts <zip_or_folder>

# Browser showcase
cd typescript-browser-only/showcase && npm run dev  # localhost:971
```

## Validation

`vrm_validator.py` (Python) and `core/vrm-validator.ts` (TS) perform identical 6-layer checks:

1. GLB structure
2. glTF validity
3. VRM extension presence
4. Humanoid bone completeness (16 required)
5. Spring animation integrity
6. Material consistency

Both return `ValidationResult` with `valid`, `issues[]`, metadata. Python supports `--json` flag for machine-readable output.

## Key interfaces (typescript-browser-only)

```typescript
interface ConvertDeps { image: ImageEncoder; text: TextCodec; }
interface VrmOutput  { name: string; vrm: Uint8Array; validation: ValidationResult; logs: string[]; }
```

Worker protocol: `postMessage({ zipBuffer, scale, noSpring })` → `{ ok, results: VrmOutput[] }`.

See each subdirectory's README for implementation-specific details.
