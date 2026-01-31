# anju

Technical Artist Toolkit for Unreal Engine

Automation scripts for UE workflows - asset management, camera control, character tools, and more. Each script is self-contained for cross-branch compatibility.

---

## Project Structure

```
anju/
├── python/              # UE Python scripts (15+ modules)
│   ├── anime_manager/
│   ├── asset_manager/
│   ├── camera_manager/
│   ├── preset_manager/
│   ├── quick_screen_shot/
│   ├── texture_manager/
│   ├── tag_manager/
│   ├── motion_manager/
│   ├── user_character_manager/
│   └── ...
├── hlsl/                # Shader code
├── bat/                 # Windows batch scripts
├── sh/                  # Shell scripts
└── web/                 # Three.js web components
```

---

## Core Modules

| Module | Purpose |
|--------|---------|
| `anime_manager` | VRM conversion, outline creation, material instances |
| `asset_manager` | Replace skeletal meshes, delete unreferenced, recompile materials |
| `camera_manager` | Actor sorting, aspect ratio, screen percentage |
| `preset_manager` | Preset customization, thumbnail mapping |
| `quick_screen_shot` | Multi-resolution capture, batch crop with masks |
| `user_character_manager` | GUI character creator for CINEV |
| `texture_manager` | Texture utilities |
| `tag_manager` | Asset tagging system |
| `motion_manager` | Animation tools |

---

## Other Tools

- **HLSL** - Cartoon rendering, shadow SDF, water effects
- **Batch Scripts** - Git configuration, LFS setup
- **Web** - Three.js visualization, render targets

---

## Conventions

- **Python**: `snake_case`, standalone scripts using `import unreal`
- **Assets**: `DA_` prefix for Data Assets, forward-slash paths
- **Philosophy**: Self-contained scripts for cross-branch compatibility

---

## Documentation

- Individual module READMEs in each folder
- `CLAUDE.md` for development guidelines
