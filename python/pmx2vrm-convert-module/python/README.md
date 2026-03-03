# python/

Python reference implementation of PMX→VRM converter.

## Entry point

```bash
python intake.py <zip_or_folder> [options]
# or
python -m pmx2vrm_convert_module.python.intake <zip_or_folder>
```

| Flag | Default | Description |
|------|---------|-------------|
| `--output <dir>` | `./output` | Output directory |
| `--scale <n>` | `0.08` | PMX→VRM scale factor |
| `--no-spring` | false | Skip spring bone conversion |

## Files

| File | Role |
|------|------|
| `intake.py` | CLI entry, ZIP/folder scan, orchestration |
| `pmx_reader.py` | PMX binary parser + texture loading |
| `gltf_builder.py` | glTF 2.0 skeleton/mesh assembly |
| `vrm_builder.py` | VRM 0.x extension injection |
| `spring_converter.py` | PMX physics → VRM spring bones |
| `spring_presets.json` | Default spring bone parameters |
| `bone_mapping.py` | Japanese PMX bone names → VRM humanoid mapping |
| `vrm_validator.py` | 6-layer VRM structural validation |
| `vrm_renamer.py` | GLB metadata rewrite + ASCII filename |

## Standalone validator

```bash
python vrm_validator.py <file.vrm>            # Human-readable
python vrm_validator.py <file.vrm> --json      # Machine-readable JSON
python vrm_validator.py <file.vrm> --strict     # Warnings = errors
```

Returns `ValidationResult` JSON:
```json
{
  "valid": true,
  "vrm_version": "0.0",
  "exporter": "pmx2vrm-0.1.0",
  "node_count": 428,
  "material_count": 30,
  "bone_count": 54,
  "issues": [{ "severity": "INFO", "layer": 1, "message": "...", "path": "" }]
}
```

Used by `/cocv-validate-vrm` skill for batch VRM quality checks.

## Dependencies

```
pip install -r requirements.txt
```

Uses Pillow for image codec, struct for binary parsing. No Node dependencies.
