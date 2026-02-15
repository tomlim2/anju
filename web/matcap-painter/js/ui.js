import { MatcapPicker } from './matcap-picker.js';
import { FULL_PATH } from './matcaps.js';

export class UI {
  constructor(brush, painter, layerSystem) {
    this.brush = brush;
    this.painter = painter;
    this.layers = layerSystem;

    // Canvas navigation state
    this._zoom = 1;
    this._panX = 0;
    this._panY = 0;
    this._baseSize = 200;
    this._spaceHeld = false;
    this._panning = false;
    this._panStartX = 0;
    this._panStartY = 0;
    this._panOriginX = 0;
    this._panOriginY = 0;

    this._picker = new MatcapPicker((matcapId, layerIndex) => {
      const img = new Image();
      img.onload = () => {
        this.painter.loadImageToLayer(img, layerIndex);
        this._renderLayerList();
      };
      img.src = FULL_PATH + matcapId + '.png';
    });

    this._bindToolbar();
    this._bindControls();
    this._bindLayers();
    this._bindKeyboard();
    this._bindCanvasNav();
    this._resizeCanvasDisplay();
    window.addEventListener('resize', () => this._resizeCanvasDisplay());
  }

  _bindToolbar() {
    const toolBtns = document.querySelectorAll('[data-tool]');
    const panBtn = document.getElementById('tool-pan');

    toolBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        toolBtns.forEach((b) => b.classList.remove('active'));
        panBtn.classList.remove('active');
        btn.classList.add('active');
        this.brush.type = btn.dataset.tool;
        this._setPanMode(false);
      });
    });

    panBtn.addEventListener('click', () => {
      const entering = !this._panToggle;
      this._setPanMode(entering);
      toolBtns.forEach((b) => b.classList.toggle('active', !entering && b.dataset.tool === this.brush.type));
      panBtn.classList.toggle('active', entering);
    });
  }

  _setPanMode(on) {
    this._panToggle = on;
    this.painter.panMode = on;
    document.getElementById('canvas-area').classList.toggle('panning', on);
  }

  _bindSlider(name, setter) {
    const el = document.querySelector(`[data-slider="${name}"]`);
    if (!el) return null;
    const input = el.querySelector('.slider-track');
    const val = el.querySelector('.slider-val');
    input.addEventListener('input', (e) => {
      val.textContent = e.target.value;
      setter(+e.target.value);
    });
    return { input, val, set(v) { input.value = v; val.textContent = v; } };
  }

  _bindControls() {
    const color = document.getElementById('brush-color');
    color.addEventListener('input', (e) => { this.brush.color = e.target.value; });

    this._sizeSlider = this._bindSlider('size', (v) => { this.brush.size = v; });
    this._bindSlider('opacity', (v) => { this.brush.opacity = v / 100; });
    this._bindSlider('hardness', (v) => { this.brush.hardness = v / 100; });

    document.getElementById('mirror-x').addEventListener('change', (e) => {
      this.painter.mirrorX = e.target.checked;
      this.painter.refreshCursor();
    });
    document.getElementById('mirror-y').addEventListener('change', (e) => {
      this.painter.mirrorY = e.target.checked;
      this.painter.refreshCursor();
    });
  }

  // --- Canvas Navigation (Zoom / Pan) ---

  _bindCanvasNav() {
    const area = document.getElementById('canvas-area');

    // Wheel zoom (toward cursor)
    area.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(16, Math.max(0.25, this._zoom * factor));

      const wrap = document.getElementById('canvas-wrap');
      const rect = wrap.getBoundingClientRect();
      const cx = e.clientX - (rect.left + rect.width / 2);
      const cy = e.clientY - (rect.top + rect.height / 2);

      const scale = newZoom / this._zoom;
      this._panX += cx - cx * scale;
      this._panY += cy - cy * scale;
      this._zoom = newZoom;
      this._applyTransform();
    }, { passive: false });

    // Middle mouse or space+left for pan
    area.addEventListener('pointerdown', (e) => {
      if (e.button === 1 || (e.button === 0 && (this._spaceHeld || this._panToggle))) {
        e.preventDefault();
        e.stopPropagation();
        this._panning = true;
        this._panStartX = e.clientX;
        this._panStartY = e.clientY;
        this._panOriginX = this._panX;
        this._panOriginY = this._panY;
        area.setPointerCapture(e.pointerId);
      }
    });

    area.addEventListener('pointermove', (e) => {
      if (!this._panning) return;
      this._panX = this._panOriginX + (e.clientX - this._panStartX);
      this._panY = this._panOriginY + (e.clientY - this._panStartY);
      this._applyTransform();
    });

    area.addEventListener('pointerup', (e) => {
      if (this._panning) {
        this._panning = false;
        area.releasePointerCapture(e.pointerId);
      }
    });

    // Prevent middle-click auto-scroll
    area.addEventListener('mousedown', (e) => {
      if (e.button === 1) e.preventDefault();
    });

    // Nav buttons
    document.getElementById('nav-fit').addEventListener('click', () => {
      this.resetView();
    });

    this._panToggle = false;
  }

  _zoomBy(factor) {
    this._zoom = Math.min(16, Math.max(0.25, this._zoom * factor));
    this._applyTransform();
  }

  _applyTransform() {
    const wrap = document.getElementById('canvas-wrap');
    wrap.style.transform = `translate(${this._panX}px, ${this._panY}px) scale(${this._zoom})`;

    // Show zoom level badge
    this._showZoomBadge();
  }

  _showZoomBadge() {
    let badge = document.getElementById('zoom-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'zoom-badge';
      document.getElementById('canvas-area').appendChild(badge);
    }
    badge.textContent = Math.round(this._zoom * 100) + '%';
    badge.classList.add('visible');
    clearTimeout(this._zoomBadgeTimer);
    this._zoomBadgeTimer = setTimeout(() => badge.classList.remove('visible'), 800);
  }

  resetView() {
    this._zoom = 1;
    this._panX = 0;
    this._panY = 0;
    this._applyTransform();
  }

  // --- Layers ---

  _bindLayers() {
    const addBtn = document.getElementById('layer-add');
    const delBtn = document.getElementById('layer-delete');

    addBtn.addEventListener('click', () => {
      this.layers.addLayer();
      this._renderLayerList();
    });
    delBtn.addEventListener('click', () => {
      this.layers.deleteLayer(this.layers.activeIndex);
      this._renderLayerList();
    });

    this._dragFromIndex = -1;
    this._gripHeld = false;
    document.addEventListener('mouseup', () => { this._gripHeld = false; });

    const prevOnChange = this.layers.onChange;
    this.layers.onChange = () => {
      if (prevOnChange) prevOnChange();
      this._updateThumbnails();
    };

    this._renderLayerList();
  }

  _createBlendSelect(layerIndex, currentMode) {
    const sel = document.createElement('select');
    sel.className = 'layer-blend';
    const modes = [
      ['source-over', 'Normal'],
      ['multiply', 'Multiply'],
      ['screen', 'Screen'],
      ['overlay', 'Overlay'],
    ];
    for (const [val, label] of modes) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      sel.appendChild(opt);
    }
    sel.value = currentMode;
    sel.addEventListener('click', (e) => e.stopPropagation());
    sel.addEventListener('change', (e) => {
      e.stopPropagation();
      this.layers.setBlendMode(layerIndex, e.target.value);
    });
    return sel;
  }

  _renderLayerList() {
    const list = document.getElementById('layer-list');
    list.innerHTML = '';

    // Allow dropping on empty area below last item (moves to index 0)
    list.addEventListener('dragover', (e) => { e.preventDefault(); });
    list.addEventListener('drop', (e) => {
      if (this._dragFromIndex === -1) return;
      // Only handle drops on the list itself, not bubbled from items
      if (e.target !== list) return;
      e.preventDefault();
      const targetIndex = 0;
      if (targetIndex !== this._dragFromIndex) {
        const [moved] = this.layers.layers.splice(this._dragFromIndex, 1);
        this.layers.layers.splice(0, 0, moved);
        if (this.layers.activeIndex === this._dragFromIndex) {
          this.layers.activeIndex = 0;
        } else if (this.layers.activeIndex < this._dragFromIndex) {
          this.layers.activeIndex++;
        }
        this.layers.composite();
      }
      this._renderLayerList();
    });

    for (let i = this.layers.layers.length - 1; i >= 0; i--) {
      const layer = this.layers.layers[i];
      const item = document.createElement('div');
      item.className = 'layer-item' + (i === this.layers.activeIndex ? ' active' : '');
      item.dataset.layerIndex = i;

      const grip = document.createElement('span');
      grip.className = 'layer-grip';
      grip.innerHTML = '<svg width="6" height="10" viewBox="0 0 6 10" fill="currentColor"><circle cx="1.5" cy="1.5" r="1"/><circle cx="4.5" cy="1.5" r="1"/><circle cx="1.5" cy="5" r="1"/><circle cx="4.5" cy="5" r="1"/><circle cx="1.5" cy="8.5" r="1"/><circle cx="4.5" cy="8.5" r="1"/></svg>';

      item.draggable = true;
      grip.addEventListener('mousedown', () => { this._gripHeld = true; });
      item.addEventListener('dragstart', (e) => {
        if (!this._gripHeld) { e.preventDefault(); return; }
        this._gripHeld = false;
        this._dragFromIndex = i;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => {
        this._gripHeld = false;
        item.classList.remove('dragging');
        this._dragFromIndex = -1;
        list.querySelectorAll('.layer-item').forEach(el => {
          el.classList.remove('drag-over-top', 'drag-over-bottom');
        });
      });
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        list.querySelectorAll('.layer-item').forEach(el => {
          el.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        const rect = item.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        item.classList.add(e.clientY < mid ? 'drag-over-top' : 'drag-over-bottom');
      });
      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        if (this._dragFromIndex === -1 || this._dragFromIndex === i) return;
        const rect = item.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        // Visual list is reversed: top of DOM = high index, bottom = low index
        // Dropping above an item in DOM = moving to a higher index
        // Dropping below an item in DOM = moving to a lower index
        let targetIndex = e.clientY < mid ? i + 1 : i;
        // Clamp
        targetIndex = Math.max(0, Math.min(this.layers.layers.length - 1, targetIndex));
        if (targetIndex !== this._dragFromIndex) {
          const [moved] = this.layers.layers.splice(this._dragFromIndex, 1);
          const insertAt = targetIndex > this._dragFromIndex ? targetIndex - 1 : targetIndex;
          this.layers.layers.splice(insertAt, 0, moved);
          // Update active index
          if (this.layers.activeIndex === this._dragFromIndex) {
            this.layers.activeIndex = insertAt;
          } else {
            // Adjust if active was shifted
            const oldActive = this.layers.activeIndex;
            if (this._dragFromIndex < oldActive && insertAt >= oldActive) {
              this.layers.activeIndex--;
            } else if (this._dragFromIndex > oldActive && insertAt <= oldActive) {
              this.layers.activeIndex++;
            }
          }
          this.layers.composite();
        }
        this._renderLayerList();
      });

      const vis = document.createElement('span');
      vis.className = 'layer-vis' + (layer.visible ? '' : ' hidden');
      vis.innerHTML = layer.visible
        ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="16" height="16" fill="currentColor"><path d="M595.58-384.51q47.5-47.59 47.5-115.58t-47.59-115.49q-47.59-47.5-115.58-47.5t-115.49 47.59q-47.5 47.59-47.5 115.58t47.59 115.49q47.59 47.5 115.58 47.5t115.49-47.59ZM403.5-423.5Q372-455 372-500t31.5-76.5Q435-608 480-608t76.5 31.5Q588-545 588-500t-31.5 76.5Q525-392 480-392t-76.5-31.5ZM228.62-296.12Q115.16-372.23 61.54-500q53.62-127.77 167.02-203.88Q341.97-780 479.95-780q137.97 0 251.43 76.12Q844.84-627.77 898.46-500q-53.62 127.77-167.02 203.88Q618.03-220 480.05-220q-137.97 0-251.43-76.12ZM480-500Zm207.5 160.5Q782-399 832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280q113 0 207.5-59.5Z"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="16" height="16" fill="currentColor"><path d="M630.92-441.08 586-486q9-49.69-28.35-89.35Q520.31-615 466-606l-44.92-44.92q13.54-6.08 27.77-9.12 14.23-3.04 31.15-3.04 68.08 0 115.58 47.5T643.08-500q0 16.92-3.04 31.54-3.04 14.61-9.12 27.38Zm127.23 124.46L714-358q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-46.61-46.61q37.92-15.08 77.46-22.23Q438.39-780 480-780q140.61 0 253.61 77.54T898.46-500q-22.23 53.61-57.42 100.08-35.2 46.46-82.89 83.3Zm32.31 231.39L628.62-245.85q-30.77 11.39-68.2 18.62Q523-220 480-220q-141 0-253.61-77.54Q113.77-375.08 61.54-500q22.15-53 57.23-98.88 35.08-45.89 77.23-79.58l-110.77-112 42.16-42.15 705.22 705.22-42.15 42.16Zm-552.3-551.08q-31.7 25.23-61.66 60.66Q146.54-540.23 128-500q50 101 143.5 160.5T480-280q27.31 0 54.39-4.62 27.07-4.61 45.92-9.53L529.69-346q-10.23 4.15-23.69 6.61-13.46 2.47-26 2.47-68.08 0-115.58-47.5T316.92-500q0-12.15 2.47-25.42 2.46-13.27 6.61-24.27l-87.84-86.62ZM541-531Zm-131.77 65.77Z"/></svg>';
      vis.addEventListener('click', (e) => {
        e.stopPropagation();
        this.layers.setVisibility(i, !layer.visible);
        this._renderLayerList();
      });

      const thumb = document.createElement('canvas');
      thumb.className = 'layer-thumb';
      thumb.width = 28;
      thumb.height = 28;
      thumb.dataset.layerIndex = i;

      const name = document.createElement('span');
      name.className = 'layer-name';
      name.textContent = layer.name;

      const matcapBtn = document.createElement('button');
      matcapBtn.className = 'layer-matcap-btn';
      matcapBtn.title = 'Load matcap preset';
      matcapBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="14" height="14" fill="currentColor"><path d="M480-480Zm0 360q-75 0-140.5-28.5t-114-77q-48.5-48.5-77-114T120-480q0-75 28.5-140.5t77-114q48.5-48.5 114-77T480-840q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-480q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-120Zm0-80q116 0 198-82t82-198q0-116-82-198t-198-82q-116 0-198 82t-82 198q0 116 82 198t198 82Z"/></svg>';
      matcapBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._picker.open(i);
      });

      const blendSel = this._createBlendSelect(i, layer.blendMode);

      const opSlider = document.createElement('input');
      opSlider.type = 'range';
      opSlider.className = 'layer-opacity';
      opSlider.min = 0;
      opSlider.max = 100;
      opSlider.value = Math.round(layer.opacity * 100);
      opSlider.addEventListener('input', (e) => {
        e.stopPropagation();
        this.layers.setOpacity(i, +e.target.value / 100);
      });

      item.addEventListener('click', () => {
        this.layers.setActive(i);
        this._renderLayerList();
      });

      item.appendChild(grip);
      item.appendChild(vis);
      item.appendChild(thumb);
      item.appendChild(name);
      item.appendChild(matcapBtn);
      item.appendChild(blendSel);
      item.appendChild(opSlider);
      list.appendChild(item);
    }

    this._updateThumbnails();
  }

  _updateThumbnails() {
    const thumbs = document.querySelectorAll('.layer-thumb');
    for (const thumb of thumbs) {
      const idx = +thumb.dataset.layerIndex;
      const layer = this.layers.layers[idx];
      if (!layer) continue;
      const ctx = thumb.getContext('2d');
      ctx.clearRect(0, 0, 28, 28);
      ctx.drawImage(layer.canvas, 0, 0, 28, 28);
    }
  }

  // --- Keyboard ---

  _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Space for pan mode
      if (e.code === 'Space' && !e.repeat) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        e.preventDefault();
        this._spaceHeld = true;
        this.painter.panMode = true;
        document.getElementById('canvas-area').classList.add('panning');
      }

      // Undo/Redo — works even when focused on inputs
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.painter.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        this.painter.redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        this.painter.redo();
        return;
      }

      // Don't intercept tool shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      const key = e.key.toLowerCase();

      // Reset view
      if ((e.ctrlKey || e.metaKey) && key === '0') {
        e.preventDefault();
        this.resetView();
        return;
      }

      // Pan toggle
      if (key === 'h') {
        const entering = !this._panToggle;
        this._setPanMode(entering);
        document.getElementById('tool-pan').classList.toggle('active', entering);
        document.querySelectorAll('[data-tool]').forEach((b) => {
          b.classList.toggle('active', !entering && b.dataset.tool === this.brush.type);
        });
        return;
      }

      const toolMap = { b: 'brush', a: 'airbrush', r: 'blur', e: 'eraser', g: 'fill' };

      if (toolMap[key]) {
        this._setPanMode(false);
        document.getElementById('tool-pan').classList.remove('active');
        this.brush.type = toolMap[key];
        document.querySelectorAll('[data-tool]').forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.tool === toolMap[key]);
        });
        return;
      }

      // [ and ] for brush size
      if (key === '[') {
        this.brush.size = Math.max(1, this.brush.size - 5);
        if (this._sizeSlider) this._sizeSlider.set(Math.round(this.brush.size));
        this.painter.refreshCursor();
      }
      if (key === ']') {
        this.brush.size = Math.min(100, this.brush.size + 5);
        if (this._sizeSlider) this._sizeSlider.set(Math.round(this.brush.size));
        this.painter.refreshCursor();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this._spaceHeld = false;
        if (!this._panToggle) {
          this.painter.panMode = false;
          document.getElementById('canvas-area').classList.remove('panning');
        }
      }
    });
  }

  // --- Canvas Display ---

  _resizeCanvasDisplay() {
    const area = document.getElementById('canvas-area');
    const wrap = document.getElementById('canvas-wrap');
    const canvas = document.getElementById('paint-canvas');

    const padding = 24;
    const maxSize = Math.min(area.clientWidth, area.clientHeight) - padding * 2;
    const displaySize = Math.max(200, maxSize);

    this._baseSize = displaySize;
    wrap.style.width = displaySize + 'px';
    wrap.style.height = displaySize + 'px';
    canvas.style.width = displaySize + 'px';
    canvas.style.height = displaySize + 'px';
    this._applyTransform();
  }
}
