# anju

TA toolkit for Unreal Engine. Asset management, camera control, character tools, shaders, batch automation — all as self-contained scripts you can drop into any branch.

## Python Modules

21 modules in `python/`. Each one runs standalone with `import unreal`.

| Module | What it does |
|--------|-------------|
| `action_manager` | Action sequence tools |
| `actor_manager` | Actor manipulation in editor |
| `anime_manager` | VRM conversion, outline creation, material instances |
| `asset_manager` | Replace skeletal meshes, delete unreferenced, recompile materials |
| `blueprint_tools` | Blueprint automation |
| `camera_manager` | Actor sorting, aspect ratio, screen percentage |
| `character_tool` | Character pipeline utilities |
| `git_manager` / `git_gui` | Git operations from within UE |
| `material_tools` | Material editing helpers |
| `motion_manager` | Animation tools |
| `preset_manager` | Preset customization, preview pipeline |
| `quick_screen_shot` | Multi-resolution capture, batch crop with masks |
| `shipping_manager` | Build shipping, creator launcher/shipper |
| `sm_path_to_csv` | Static mesh path export |
| `sprite_sheet_generator` | Image sequence → sprite sheet |
| `tag_manager` | Asset tagging system |
| `texture_manager` | Texture utilities |
| `user_character_manager` | GUI character creator for CINEV |
| `vroid_character_creator` | VRoid character creation tools |

## Shaders

- **HLSL** (`hlsl/`) — Cartoon rendering, shadow SDF, Laplacian filter, water effects
- **GLSL** (`glsl/`) — Toon shader, ripple effects

## Scripts

- **Batch** (`bat/`) — Git config, LFS setup, redirector cleanup, file utilities
- **Shell** (`sh/`) — Art branch creation, Slack notifications
- **PowerShell** (`ps1/`) — Branch creation, content unlocking

## Web

Three.js experiments in `web/` and `webgl/`. Render targets, boid simulation, interactive flow.

## Conventions

- `snake_case` for Python, standalone scripts with `import unreal`
- `DA_` prefix for Data Assets, forward-slash paths
- Self-contained per module — no cross-module dependencies
