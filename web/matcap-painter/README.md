# Matcap Painter

Paint matcap textures directly in the browser. See the result on a 3D model in real time.

## What it does

A single-page painting tool for creating and editing [matcap](https://en.wikipedia.org/wiki/Matcap) (Material Capture) textures. You paint on a 2D canvas and a 3D preview updates live with the texture applied.

## Features

**Painting**
- Brush, airbrush, blur, eraser, flood fill
- Adjustable size, opacity, hardness
- X/Y mirror symmetry

**Layers**
- Up to 8 layers with blend modes (Normal, Multiply, Screen, Overlay)
- Per-layer opacity
- HSB, contrast, lift adjustments (non-destructive)
- Transform: translate, rotate, scale with bake-on-release
- Layer reordering via drag-and-drop

**Matcap Library**
- 228 built-in matcap presets
- Click any layer's palette icon to pick a matcap
- Random preset generator (shuffles layers, matcaps, blend modes, adjustments)

**3D Preview**
- WebGPU renderer (Three.js r172)
- Multiple models: Torus, TorusKnot, AmongUs (animated)
- Animation track selector with play/pause
- Auto-rotate, orbit controls
- Selectable background color

**Export**
- PNG export of the final composited matcap texture

## Setup

```bash
cd web/matcap-painter
npm install
```

Serve from the project root with any static file server:

```bash
npx serve .
```

Open `http://localhost:3000/web/matcap-painter/` (or whatever port your server uses).

Requires a browser with WebGPU support (Chrome 113+, Edge 113+).

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| B | Brush |
| A | Airbrush |
| R | Blur |
| E | Eraser |
| G | Fill |
| H | Pan |
| [ / ] | Brush size |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+0 | Fit canvas |

## File Structure

```
index.html          Single-page app (HTML + CSS)
js/
  main.js           Entry point, init and render loop
  brush.js          Brush engine (stamp-based with interpolation)
  layers.js         Layer system with compositing and per-pixel filters
  painter.js        Canvas input handling, undo/redo, mirror
  preview.js        Three.js WebGPU 3D preview with animation
  transform.js      Translate/rotate/scale controller (bake on release)
  models.js         Model loader (presets + GLB with animation support)
  matcaps.js        Matcap texture ID registry
  matcap-picker.js  Modal matcap picker grid
  ui.js             UI bindings and state management
assets/
  among_us.glb      Animated 3D model
  matcaps/full/     228 matcap PNG textures (1024x1024)
  matcaps/thumb/    Thumbnail versions for picker
```

## Tech

- **Rendering**: Three.js r172 WebGPU (`WebGPURenderer`, `MeshMatcapMaterial`)
- **Animation**: `AnimationMixer` with GLB skeletal animation
- **Painting**: 2D Canvas API with stamp-based brush interpolation
- **Layer compositing**: Canvas `globalCompositeOperation` + per-pixel HSV/contrast/lift filter
- **No build step**: ES modules with import maps, served as static files

## License

MIT
