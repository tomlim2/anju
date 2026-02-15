# anju

TA toolkit for Unreal Engine. Asset management, camera control, character tools, shaders, batch automation — all as self-contained scripts you can drop into any branch.

## Python Modules

20 modules in `python/`. Each one runs standalone with `import unreal`.

| Module | What it does |
|--------|-------------|
| `anime_manager` | VRM conversion, outline creation, material instances |
| `asset_manager` | Replace skeletal meshes, delete unreferenced, recompile materials |
| `camera_manager` | Actor sorting, aspect ratio, screen percentage |
| `preset_manager` | Preset customization, preview pipeline |
| `user_character_manager` | GUI character creator for CINEV |
| `quick_screen_shot` | Multi-resolution capture, batch crop with masks |
| `shipping_manager` | Build shipping, creator launcher/shipper |
| `texture_manager` | Texture utilities |
| `tag-manager` | Asset tagging system |
| `motion_manager` | Animation tools |
| `actor_manager` | Actor manipulation in editor |
| `action_manager` | Action sequence tools |
| `blueprint_tools` | Blueprint automation |
| `material_tools` | Material editing helpers |
| `sprite_sheet_generator` | Image sequence → sprite sheet |
| `git_manager` / `gitGUI` | Git operations from within UE |
| `character-tool` | Character pipeline utilities |
| `sm-path-to-csv` | Static mesh path export |

## Shaders

- **HLSL** — Cartoon rendering, shadow SDF, Laplacian filter, water effects (`hlsl/`)
- **GLSL** — Toon shader, ripple effects (`glsl/`)

## Scripts

- **Batch** (`bat/`) — Git config, LFS setup, redirector cleanup
- **Shell** (`sh/`) — Art branch creation, Slack notifications
- **PowerShell** (`ps1/`) — Content unlocking, art branch creation

## Web

Three.js experiments in `web/` and `webgl/`. Render targets, boid simulation, interactive flow.

## Conventions

- `snake_case` for Python, standalone scripts with `import unreal`
- `DA_` prefix for Data Assets, forward-slash paths
- Self-contained per module — no cross-module dependencies
