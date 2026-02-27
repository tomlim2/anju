# pmx2vrm

PMX to VRM 0.x converter with dual TypeScript and Python implementations.

> **⚠️ CRITICAL:** 하나의 PMX ZIP에서 **2개 이상의 VRM**이 출력될 수 있다. 의상 차분, 체형 차분, 본체+소품 등으로 ZIP 안에 humanoid PMX가 여러 개 들어있는 경우가 흔하다. **반드시 다중 출력을 전제로 처리 로직을 구성할 것.**

## Supported inputs

- **Folder** containing `.pmx` files and their textures
- **Flat ZIP** containing `.pmx` files and textures (CJK filenames handled automatically)

A single input (folder or ZIP) can contain **multiple humanoid PMX files**. Each humanoid PMX is converted to a separate `.vrm` file. Non-humanoid PMX files (props, accessories, stages) are automatically skipped — the converter checks for 17 required VRM humanoid bones and only converts models that pass.

### Not supported

- **Nested ZIPs** (zip-in-zip) — extract the inner zip first, then convert the extracted folder or zip. The converter will warn if nested ZIPs are detected.

## CLI usage

### TypeScript

```bash
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

The `webapp/` directory contains a Next.js test interface for browser-based conversion. Upload a flat ZIP and download the resulting `.vrm` file(s).
