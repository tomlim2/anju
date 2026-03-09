# typescript/

Node.js PMX→VRM converter. Monolithic — all code in `src/`, depends on `sharp` and `iconv-lite`.

This is the **original** TypeScript implementation. For the browser-compatible refactored version, see `../typescript-browser-only/`.

## Entry point

```bash
npx tsx src/intake.ts <input> [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `-o, --output <dir>` | `./output` | Output directory |
| `--scale <n>` | `0.08` | PMX→VRM scale factor |
| `--no-spring` | false | Skip spring bone conversion |
| `--no-rename` | false | Skip ASCII rename step |
| `--no-validate` | false | Skip 6-layer validation |

## Files

| File | Role |
|------|------|
| `src/intake.ts` | CLI entry, ZIP/folder scan, orchestration |
| `src/pmx-reader.ts` | PMX binary parser + texture loading (sharp for TGA/BMP) |
| `src/gltf-builder.ts` | glTF 2.0 skeleton/mesh assembly |
| `src/vrm-builder.ts` | VRM 0.x extension injection |
| `src/spring-converter.ts` | PMX physics → VRM spring bones |
| `src/bone-mapping.ts` | Japanese PMX bone names → VRM humanoid mapping |
| `src/vrm-validator.ts` | 6-layer VRM structural validation |
| `src/vrm-renamer.ts` | GLB metadata rewrite + ASCII filename generation |
| `src/index.ts` | GLB writer + exports |
| `src/types.ts` | Shared interfaces |

## Dependencies

| Package | Purpose |
|---------|---------|
| `sharp` | Image codec (TGA/BMP → PNG, fallback textures) |
| `iconv-lite` | CJK filename decoding (Shift-JIS, GBK, EUC-KR, Big5) |
| `jszip` | ZIP parsing/creation |
| `commander` | CLI argument parsing |

## Showcase (Next.js)

```bash
cd showcase && npm run dev  # http://localhost:970
```

Next.js 15 + React 19 server-side webapp. Conversion runs in API routes (`/api/convert-zip`), response is base64-encoded VRM. Has separate Validate tab (`/api/validate`). Upload limit 200MB, timeout 300s.
