# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a technical artist's collection of Unreal Engine automation scripts and tools. The repository contains primarily Python scripts designed to work with Unreal Engine's Python API, along with some Three.js components for web visualization.

## Architecture

### Python Scripts Organization

The codebase is organized into functional modules under `python/`:

- **anime_manager/**: Scripts for anime-style character and material management
  - Data Asset (DA) operations and skeletal mesh to blueprint conversion
  - VRM4U and VamBo material outline generation
  - Material instance creation and management

- **asset_manager/**: Asset lifecycle and cleanup utilities
  - Reference checking and unused asset deletion
  - Material recompilation and asset moving operations

- **camera_manager/**: Viewport and camera control scripts
  - Actor piloting and ejection (`eject_pilot.py`)
  - Screen percentage adjustment and sorting utilities

- **texture_manager/**: Texture processing and optimization
  - Multi-step texture downsizing workflow (`step0_downsize_settings.py` through `step3_reimport_textures.py`)
  - LOD bias modification and texture format conversion

- **preset_manager/**: Preset and thumbnail generation
  - Batch processing for character presets
  - Preview processing and folder synchronization

- **tag-manager/**: Asset metadata and tagging system
  - Metadata operations for asset organization
  - Asset loading with hard references

### Key Patterns

1. **Unreal Python API Usage**: All scripts use `import unreal` and leverage Unreal's editor subsystems
2. **Standalone Scripts**: Scripts are designed to be self-contained for cross-branch compatibility
3. **Asset Path Management**: Heavy use of asset path manipulation and package name handling
4. **Editor Subsystem Integration**: Consistent use of `unreal.get_editor_subsystem()` for editor operations

## Common Operations

### Running Python Scripts
Execute Unreal Python scripts through the Unreal Editor Python console or via editor utility widgets.

### Asset Management
- Use `find_no_reference_and_delete.py` for cleaning unused assets
- Use scripts in `asset_manager/` for batch asset operations
- Reference checking via `unreal.EditorAssetSubsystem.find_package_referencers_for_asset()`

### Material and Character Workflows
- Skeletal mesh to Data Asset conversion in `anime_manager/`
- Material instance generation and outline creation
- VRM4U and VamBo material system integration

### Texture Processing
Follow the step-by-step texture downsize workflow:
1. `step0_downsize_settings.py` - Configure paths and settings
2. `step1_export_textures.py` - Export textures from Unreal
3. `step2_process_textures.py` - External processing
4. `step3_reimport_textures.py` - Reimport processed textures

## Development Environment

- **Unreal Engine**: Primary development environment with Python API
- **Three.js**: Web visualization components (minimal dependency in `package.json`)
- **Git**: Version control with standard workflows

## File Naming Conventions

- Python scripts use snake_case
- Data Assets prefixed with `DA_`
- Material instances follow Unreal naming conventions
- Asset paths use forward slashes following Unreal conventions