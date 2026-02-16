import { MatcapPicker } from './matcap-picker.js';
import { FULL_PATH } from './matcaps.js';

export class UI {
  constructor(brush, painter, layerSystem, preview) {
    this.brush = brush;
    this.painter = painter;
    this.layers = layerSystem;
    this.preview = preview;

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

    this._ac = new AbortController();

    this._picker = new MatcapPicker((matcapId, layerIndex) => {
      const img = new Image();
      img.onload = () => {
        this.layers.resetHSV(layerIndex);
        this.painter.loadImageToLayer(img, layerIndex);
        this._renderLayerList();
        this._refreshHSVPanel();
      };
      img.src = FULL_PATH + matcapId + '.png';
    });

    this._bindToolbar();
    this._bindControls();
    this._bindLayers();
    this._bindHSVPanel();
    this._bindKeyboard();
    this._bindCanvasNav();
    this._bindViewport();
    this._resizeCanvasDisplay();
    window.addEventListener('resize', () => this._resizeCanvasDisplay(), { signal: this._ac.signal });
  }

  destroy() {
    this._ac.abort();
    clearTimeout(this._zoomBadgeTimer);
  }

  _bindToolbar() {
    const listenerOptions = { signal: this._ac.signal };
    const toolButtons = document.querySelectorAll('[data-tool]');
    const panButton = document.getElementById('tool-pan');

    toolButtons.forEach((toolButton) => {
      toolButton.addEventListener('click', () => {
        toolButtons.forEach((button) => button.classList.remove('active'));
        panButton.classList.remove('active');
        toolButton.classList.add('active');
        this.brush.type = toolButton.dataset.tool;
        this._setPanMode(false);
      }, listenerOptions);
    });

    panButton.addEventListener('click', () => {
      const entering = !this._panToggle;
      this._setPanMode(entering);
      toolButtons.forEach((button) => button.classList.toggle('active', !entering && button.dataset.tool === this.brush.type));
      panButton.classList.toggle('active', entering);
    }, listenerOptions);
  }

  _setPanMode(on) {
    this._panToggle = on;
    this.painter.panMode = on;
    document.getElementById('canvas-area').classList.toggle('panning', on);
  }

  _bindSlider(name, setter) {
    const sliderElement = document.querySelector(`[data-slider="${name}"]`);
    if (!sliderElement) return null;
    const input = sliderElement.querySelector('.slider-track');
    const valueDisplay = sliderElement.querySelector('.slider-val');
    input.addEventListener('input', (event) => {
      valueDisplay.value = event.target.value;
      setter(+event.target.value);
    });
    valueDisplay.addEventListener('change', (event) => {
      const min = +input.min, max = +input.max;
      const v = Math.round(Math.min(max, Math.max(min, +event.target.value || 0)));
      event.target.value = v;
      input.value = v;
      setter(v);
    });
    return { input, valueDisplay, set(value) { input.value = value; valueDisplay.value = value; } };
  }

  _bindControls() {
    const color = document.getElementById('brush-color');
    const listenerOptions = { signal: this._ac.signal };
    color.addEventListener('input', (event) => { this.brush.color = event.target.value; }, listenerOptions);

    this._sizeSlider = this._bindSlider('size', (value) => { this.brush.size = value; });
    this._bindSlider('opacity', (value) => { this.brush.opacity = value / 100; });
    this._bindSlider('hardness', (value) => { this.brush.hardness = value / 100; });

    document.getElementById('mirror-x').addEventListener('change', (event) => {
      this.painter.mirrorX = event.target.checked;
      this.painter.refreshCursor();
    }, listenerOptions);
    document.getElementById('mirror-y').addEventListener('change', (event) => {
      this.painter.mirrorY = event.target.checked;
      this.painter.refreshCursor();
    }, listenerOptions);
  }

  // --- Canvas Navigation (Zoom / Pan) ---

  _bindCanvasNav() {
    const listenerOptions = { signal: this._ac.signal };
    const area = document.getElementById('canvas-area');

    // Wheel zoom (toward cursor)
    area.addEventListener('wheel', (event) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.95 : 1.05;
      const newZoom = Math.min(16, Math.max(0.25, this._zoom * factor));

      const wrap = document.getElementById('canvas-wrap');
      const rect = wrap.getBoundingClientRect();
      const cursorX = event.clientX - (rect.left + rect.width / 2);
      const cursorY = event.clientY - (rect.top + rect.height / 2);

      const scale = newZoom / this._zoom;
      this._panX += cursorX - cursorX * scale;
      this._panY += cursorY - cursorY * scale;
      this._zoom = newZoom;
      this._applyTransform();
    }, { passive: false, signal: this._ac.signal });

    // Middle mouse or space+left for pan
    area.addEventListener('pointerdown', (event) => {
      if (event.button === 1 || (event.button === 0 && (this._spaceHeld || this._panToggle))) {
        event.preventDefault();
        event.stopPropagation();
        this._panning = true;
        this._panStartX = event.clientX;
        this._panStartY = event.clientY;
        this._panOriginX = this._panX;
        this._panOriginY = this._panY;
        area.setPointerCapture(event.pointerId);
      }
    }, listenerOptions);

    area.addEventListener('pointermove', (event) => {
      if (!this._panning) return;
      this._panX = this._panOriginX + (event.clientX - this._panStartX);
      this._panY = this._panOriginY + (event.clientY - this._panStartY);
      this._applyTransform();
    }, listenerOptions);

    area.addEventListener('pointerup', (event) => {
      if (this._panning) {
        this._panning = false;
        area.releasePointerCapture(event.pointerId);
      }
    }, listenerOptions);

    // Prevent middle-click auto-scroll
    area.addEventListener('mousedown', (event) => {
      if (event.button === 1) event.preventDefault();
    }, listenerOptions);

    // Nav buttons
    document.getElementById('nav-fit').addEventListener('click', () => {
      this.resetView();
    }, listenerOptions);

    this._panToggle = false;
  }

  _bindViewport() {
    const listenerOptions = { signal: this._ac.signal };
    document.getElementById('vp-rotate').addEventListener('click', (event) => {
      const on = this.preview.toggleAutoRotate();
      event.currentTarget.classList.toggle('active', on);
    }, listenerOptions);
    document.getElementById('vp-reset').addEventListener('click', () => {
      this.preview.resetView();
    }, listenerOptions);
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
    const addButton = document.getElementById('layer-add');
    const deleteButton = document.getElementById('layer-delete');

    const listenerOptions = { signal: this._ac.signal };
    addButton.addEventListener('click', () => {
      this.layers.addLayer();
      this._renderLayerList();
      this._refreshHSVPanel();
    }, listenerOptions);
    deleteButton.addEventListener('click', () => {
      this.layers.deleteLayer(this.layers.activeIndex);
      this._renderLayerList();
      this._refreshHSVPanel();
    }, listenerOptions);

    this._dragFromIndex = -1;
    this._gripHeld = false;
    document.addEventListener('mouseup', () => { this._gripHeld = false; }, listenerOptions);

    const prevOnChange = this.layers.onChange;
    this.layers.onChange = () => {
      if (prevOnChange) prevOnChange();
      this._updateThumbnails();
    };

    this._renderLayerList();
  }

  _createBlendSelect(layerIndex, currentMode) {
    const select = document.createElement('select');
    select.className = 'layer-blend';
    const modes = [
      ['source-over', 'Normal'],
      ['multiply', 'Multiply'],
      ['screen', 'Screen'],
      ['overlay', 'Overlay'],
    ];
    for (const [value, label] of modes) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
    select.value = currentMode;
    select.addEventListener('click', (event) => event.stopPropagation());
    select.addEventListener('change', (event) => {
      event.stopPropagation();
      this.layers.setBlendMode(layerIndex, event.target.value);
    });
    return select;
  }

  _renderLayerList() {
    const list = document.getElementById('layer-list');
    list.innerHTML = '';

    // Allow dropping on empty area below last item (moves to index 0)
    list.addEventListener('dragover', (event) => { event.preventDefault(); });
    list.addEventListener('drop', (event) => {
      if (this._dragFromIndex === -1) return;
      // Only handle drops on the list itself, not bubbled from items
      if (event.target !== list) return;
      event.preventDefault();
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
      this._refreshHSVPanel();
    });

    for (let layerIndex = this.layers.layers.length - 1; layerIndex >= 0; layerIndex--) {
      const layer = this.layers.layers[layerIndex];
      const item = document.createElement('div');
      item.className = 'layer-item' + (layerIndex === this.layers.activeIndex ? ' active' : '');
      item.dataset.layerIndex = layerIndex;

      const grip = document.createElement('span');
      grip.className = 'layer-grip';
      grip.innerHTML = '<svg width="6" height="10" viewBox="0 0 6 10" fill="currentColor"><circle cx="1.5" cy="1.5" r="1"/><circle cx="4.5" cy="1.5" r="1"/><circle cx="1.5" cy="5" r="1"/><circle cx="4.5" cy="5" r="1"/><circle cx="1.5" cy="8.5" r="1"/><circle cx="4.5" cy="8.5" r="1"/></svg>';

      item.draggable = true;
      grip.addEventListener('mousedown', () => { this._gripHeld = true; });
      item.addEventListener('dragstart', (event) => {
        if (!this._gripHeld) { event.preventDefault(); return; }
        this._gripHeld = false;
        this._dragFromIndex = layerIndex;
        item.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => {
        this._gripHeld = false;
        item.classList.remove('dragging');
        this._dragFromIndex = -1;
        list.querySelectorAll('.layer-item').forEach(layerElement => {
          layerElement.classList.remove('drag-over-top', 'drag-over-bottom');
        });
      });
      item.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        list.querySelectorAll('.layer-item').forEach(layerElement => {
          layerElement.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        const rect = item.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        item.classList.add(event.clientY < mid ? 'drag-over-top' : 'drag-over-bottom');
      });
      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      item.addEventListener('drop', (event) => {
        event.preventDefault();
        if (this._dragFromIndex === -1 || this._dragFromIndex === layerIndex) return;
        const rect = item.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        // Visual list is reversed: top of DOM = high index, bottom = low index
        // Dropping above an item in DOM = moving to a higher index
        // Dropping below an item in DOM = moving to a lower index
        let targetIndex = event.clientY < mid ? layerIndex + 1 : layerIndex;
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
        this._refreshHSVPanel();
      });

      const visibilityToggle = document.createElement('span');
      visibilityToggle.className = 'layer-vis' + (layer.visible ? '' : ' hidden');
      visibilityToggle.innerHTML = layer.visible
        ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="16" height="16" fill="currentColor"><path d="M595.58-384.51q47.5-47.59 47.5-115.58t-47.59-115.49q-47.59-47.5-115.58-47.5t-115.49 47.59q-47.5 47.59-47.5 115.58t47.59 115.49q47.59 47.5 115.58 47.5t115.49-47.59ZM403.5-423.5Q372-455 372-500t31.5-76.5Q435-608 480-608t76.5 31.5Q588-545 588-500t-31.5 76.5Q525-392 480-392t-76.5-31.5ZM228.62-296.12Q115.16-372.23 61.54-500q53.62-127.77 167.02-203.88Q341.97-780 479.95-780q137.97 0 251.43 76.12Q844.84-627.77 898.46-500q-53.62 127.77-167.02 203.88Q618.03-220 480.05-220q-137.97 0-251.43-76.12ZM480-500Zm207.5 160.5Q782-399 832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280q113 0 207.5-59.5Z"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="16" height="16" fill="currentColor"><path d="M630.92-441.08 586-486q9-49.69-28.35-89.35Q520.31-615 466-606l-44.92-44.92q13.54-6.08 27.77-9.12 14.23-3.04 31.15-3.04 68.08 0 115.58 47.5T643.08-500q0 16.92-3.04 31.54-3.04 14.61-9.12 27.38Zm127.23 124.46L714-358q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-46.61-46.61q37.92-15.08 77.46-22.23Q438.39-780 480-780q140.61 0 253.61 77.54T898.46-500q-22.23 53.61-57.42 100.08-35.2 46.46-82.89 83.3Zm32.31 231.39L628.62-245.85q-30.77 11.39-68.2 18.62Q523-220 480-220q-141 0-253.61-77.54Q113.77-375.08 61.54-500q22.15-53 57.23-98.88 35.08-45.89 77.23-79.58l-110.77-112 42.16-42.15 705.22 705.22-42.15 42.16Zm-552.3-551.08q-31.7 25.23-61.66 60.66Q146.54-540.23 128-500q50 101 143.5 160.5T480-280q27.31 0 54.39-4.62 27.07-4.61 45.92-9.53L529.69-346q-10.23 4.15-23.69 6.61-13.46 2.47-26 2.47-68.08 0-115.58-47.5T316.92-500q0-12.15 2.47-25.42 2.46-13.27 6.61-24.27l-87.84-86.62ZM541-531Zm-131.77 65.77Z"/></svg>';
      visibilityToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        this.layers.setVisibility(layerIndex, !layer.visible);
        this._renderLayerList();
      });

      const thumb = document.createElement('canvas');
      thumb.className = 'layer-thumb';
      thumb.width = 28;
      thumb.height = 28;
      thumb.dataset.layerIndex = layerIndex;

      const nameLabel = document.createElement('span');
      nameLabel.className = 'layer-name';
      nameLabel.textContent = layer.name;

      const matcapButton = document.createElement('button');
      matcapButton.className = 'layer-matcap-btn';
      matcapButton.title = 'Load matcap preset';
      matcapButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="14" height="14" fill="currentColor"><path d="M480-480Zm0 360q-75 0-140.5-28.5t-114-77q-48.5-48.5-77-114T120-480q0-75 28.5-140.5t77-114q48.5-48.5 114-77T480-840q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-480q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-120Zm0-80q116 0 198-82t82-198q0-116-82-198t-198-82q-116 0-198 82t-82 198q0 116 82 198t198 82Z"/></svg>';
      matcapButton.addEventListener('click', (event) => {
        event.stopPropagation();
        this._picker.open(layerIndex);
      });

      const importButton = document.createElement('button');
      importButton.className = 'layer-matcap-btn';
      importButton.title = 'Import image';
      importButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="14" height="14" fill="currentColor"><path d="M450-328.46v-336l-98.61 98.61-42.16-43.38L480-780l170.77 170.77-42.16 43.38L510-664.46v336h-60ZM252.31-180Q222-180 201-201q-21-21-21-51.31v-108.46h60v108.46q0 4.62 3.85 8.46 3.84 3.85 8.46 3.85h455.38q4.62 0 8.46-3.85 3.85-3.84 3.85-8.46v-108.46h60v108.46Q780-222 759-201q-21 21-51.31 21H252.31Z"/></svg>';
      importButton.addEventListener('click', (event) => {
        event.stopPropagation();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', () => {
          const file = input.files[0];
          if (!file) return;
          const img = new Image();
          img.onload = () => {
            this.layers.resetHSV(layerIndex);
            this.painter.loadImageToLayer(img, layerIndex);
            this._renderLayerList();
            this._refreshHSVPanel();
            URL.revokeObjectURL(img.src);
          };
          img.src = URL.createObjectURL(file);
        });
        input.click();
      });

      const blendSelect = this._createBlendSelect(layerIndex, layer.blendMode);

      const opacitySlider = document.createElement('input');
      opacitySlider.type = 'range';
      opacitySlider.className = 'layer-opacity';
      opacitySlider.min = 0;
      opacitySlider.max = 100;
      opacitySlider.value = Math.round(layer.opacity * 100);
      opacitySlider.addEventListener('input', (event) => {
        event.stopPropagation();
        this.layers.setOpacity(layerIndex, +event.target.value / 100);
      });

      item.addEventListener('click', () => {
        this.layers.setActive(layerIndex);
        this._renderLayerList();
        this._refreshHSVPanel();
      });

      item.appendChild(grip);
      item.appendChild(visibilityToggle);
      item.appendChild(thumb);
      item.appendChild(nameLabel);
      item.appendChild(matcapButton);
      item.appendChild(importButton);
      item.appendChild(blendSelect);
      item.appendChild(opacitySlider);
      list.appendChild(item);
    }

    this._updateThumbnails();
  }

  _updateThumbnails() {
    const thumbs = document.querySelectorAll('.layer-thumb');
    for (const thumb of thumbs) {
      const layerIndex = +thumb.dataset.layerIndex;
      const source = this.layers.getFilteredCanvas(layerIndex);
      if (!source) continue;
      const ctx = thumb.getContext('2d');
      ctx.clearRect(0, 0, 28, 28);
      ctx.drawImage(source, 0, 0, 28, 28);
    }
  }

  // --- HSV Panel ---

  _bindHSVPanel() {
    const listenerOptions = { signal: this._ac.signal };
    const hueSlider = document.getElementById('hsv-hue');
    const satSlider = document.getElementById('hsv-sat');
    const valSlider = document.getElementById('hsv-val');
    const hueVal = document.getElementById('hsv-hue-val');
    const satVal = document.getElementById('hsv-sat-val');
    const valVal = document.getElementById('hsv-val-val');

    const update = () => {
      const h = +hueSlider.value;
      const s = +satSlider.value;
      const v = +valSlider.value;
      hueVal.value = h;
      satVal.value = s;
      valVal.value = v;
      this.layers.setHSV(this.layers.activeIndex, h, s, v);
    };

    const syncFromInput = (numInput, slider) => {
      const min = +slider.min, max = +slider.max;
      const v = Math.round(Math.min(max, Math.max(min, +numInput.value || 0)));
      numInput.value = v;
      slider.value = v;
      update();
    };

    hueSlider.addEventListener('input', update, listenerOptions);
    satSlider.addEventListener('input', update, listenerOptions);
    valSlider.addEventListener('input', update, listenerOptions);

    hueVal.addEventListener('change', () => syncFromInput(hueVal, hueSlider), listenerOptions);
    satVal.addEventListener('change', () => syncFromInput(satVal, satSlider), listenerOptions);
    valVal.addEventListener('change', () => syncFromInput(valVal, valSlider), listenerOptions);

    // Double-click to reset individual slider
    hueSlider.addEventListener('dblclick', () => { hueSlider.value = 0; update(); }, listenerOptions);
    satSlider.addEventListener('dblclick', () => { satSlider.value = 0; update(); }, listenerOptions);
    valSlider.addEventListener('dblclick', () => { valSlider.value = 0; update(); }, listenerOptions);

    this._hsvElements = { hueSlider, satSlider, valSlider, hueVal, satVal, valVal };
    this._refreshHSVPanel();
  }

  _refreshHSVPanel() {
    const el = this._hsvElements;
    if (!el) return;
    const layer = this.layers.getActiveLayer();
    if (!layer) return;
    el.hueSlider.value = layer.hue;
    el.satSlider.value = layer.saturation;
    el.valSlider.value = layer.brightness;
    el.hueVal.value = layer.hue;
    el.satVal.value = layer.saturation;
    el.valVal.value = layer.brightness;
  }

  // --- Keyboard ---

  _bindKeyboard() {
    const listenerOptions = { signal: this._ac.signal };
    document.addEventListener('keydown', (event) => {
      // Space for pan mode
      if (event.code === 'Space' && !event.repeat) {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;
        event.preventDefault();
        this._spaceHeld = true;
        this.painter.panMode = true;
        document.getElementById('canvas-area').classList.add('panning');
      }

      // Undo/Redo — works even when focused on inputs
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        this.painter.undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === 'Z' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault();
        this.painter.redo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
        event.preventDefault();
        this.painter.redo();
        return;
      }

      // Don't intercept tool shortcuts when typing in inputs
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;

      const key = event.key.toLowerCase();

      // Reset view
      if ((event.ctrlKey || event.metaKey) && key === '0') {
        event.preventDefault();
        this.resetView();
        return;
      }

      // Pan toggle
      if (key === 'h') {
        const entering = !this._panToggle;
        this._setPanMode(entering);
        document.getElementById('tool-pan').classList.toggle('active', entering);
        document.querySelectorAll('[data-tool]').forEach((button) => {
          button.classList.toggle('active', !entering && button.dataset.tool === this.brush.type);
        });
        return;
      }

      const toolMap = { b: 'brush', a: 'airbrush', r: 'blur', e: 'eraser', g: 'fill' };

      if (toolMap[key]) {
        this._setPanMode(false);
        document.getElementById('tool-pan').classList.remove('active');
        this.brush.type = toolMap[key];
        document.querySelectorAll('[data-tool]').forEach((button) => {
          button.classList.toggle('active', button.dataset.tool === toolMap[key]);
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
    }, listenerOptions);

    document.addEventListener('keyup', (event) => {
      if (event.code === 'Space') {
        this._spaceHeld = false;
        if (!this._panToggle) {
          this.painter.panMode = false;
          document.getElementById('canvas-area').classList.remove('panning');
        }
      }
    }, listenerOptions);
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
