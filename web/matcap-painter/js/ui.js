import { MatcapPicker } from './matcap-picker.js';
import { MATCAP_IDS, FULL_PATH } from './matcaps.js';

// Navigation constants
const ZOOM_IN_FACTOR = 1.05;
const ZOOM_OUT_FACTOR = 0.95;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 16;
const ZOOM_BADGE_DURATION = 800;
const BRUSH_SIZE_STEP = 50;
const BRUSH_SIZE_MIN = 0;
const BRUSH_SIZE_MAX = 1024;

export class UI {
  constructor(brush, painter, layerSystem, preview, transform, modeController, toonGenerator) {
    this.brush = brush;
    this.painter = painter;
    this.layers = layerSystem;
    this.preview = preview;
    this.transform = transform;
    this.modeController = modeController;
    this.toonGenerator = toonGenerator;

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
      this._autoBakeTransform();
      const img = new Image();
      img.onload = () => {
        this.layers.resetDetail(layerIndex);
        this.painter.loadImageToLayer(img, layerIndex);
        this._renderLayerList();
        this._refreshHSVPanel();
      };
      img.src = FULL_PATH + matcapId + '.png';
    });

    this._settingsPanel = document.getElementById('layer-settings');

    this._bindToolbar();
    this._bindControls();
    this._bindHSVPanel();   // Must run before _bindLayers — stores element refs while panel is in DOM
    this._bindLayers();     // _renderLayerList() detaches panel for accordion positioning
    this._bindKeyboard();
    this._bindCanvasNav();
    this._bindViewport();
    this._bindShaderControls();
    this._resizeCanvasDisplay();
    window.addEventListener('resize', () => this._resizeCanvasDisplay(), { signal: this._ac.signal });

    // Re-layout canvas on mode change
    if (this.modeController) {
      const prevCb = this.modeController._onModeChange;
      this.modeController._onModeChange = (mode, prev) => {
        if (prevCb) prevCb(mode, prev);
        this._resizeCanvasDisplay();
      };
    }
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

    // Eyedropper callback — update color input when color is picked
    this.painter.onColorPick = (hex) => { color.value = hex; };

    // Color chips
    document.getElementById('color-chips').addEventListener('click', (event) => {
      const chip = event.target.closest('[data-color]');
      if (!chip) return;
      const hex = chip.dataset.color;
      this.brush.color = hex;
      color.value = hex;
    }, listenerOptions);


    this._sizeSlider = this._bindSlider('size', (value) => { this.brush.size = value; });
    this._bindSlider('opacity', (value) => { this.brush.opacity = value / 100; });
    this._bindSlider('hardness', (value) => { this.brush.hardness = value / 100; });

  }

  // --- Canvas Navigation (Zoom / Pan) ---

  _bindCanvasNav() {
    const listenerOptions = { signal: this._ac.signal };
    const area = document.getElementById('canvas-area');

    // Wheel zoom (toward cursor) — disabled in shader mode
    area.addEventListener('wheel', (event) => {
      if (this.modeController && this.modeController.mode === 'shader') return;
      event.preventDefault();
      const factor = event.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR;
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this._zoom * factor));

      const wrap = document.getElementById('canvas-wrap');
      const rect = wrap.getBoundingClientRect();
      const cursorX = event.clientX - (rect.left + rect.width / 2);
      const cursorY = event.clientY - (rect.top + rect.height / 2);

      const scale = newZoom / this._zoom;
      this._panX += cursorX - cursorX * scale;
      this._panY += cursorY - cursorY * scale;
      this._zoom = newZoom;
      this._applyTransform();
      this.painter.refreshCursor();
    }, { passive: false, signal: this._ac.signal });

    // Middle mouse or space+left for pan — disabled in shader mode
    area.addEventListener('pointerdown', (event) => {
      if (this.modeController && this.modeController.mode === 'shader') return;
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
    this._animSelect = document.getElementById('anim-select');
    this._animSelect.addEventListener('change', (event) => {
      this.preview.playClip(event.target.value);
    }, listenerOptions);
    document.getElementById('bg-select').addEventListener('change', (event) => {
      this.preview.setBackground(event.target.value);
    }, listenerOptions);
    document.getElementById('vp-anim').addEventListener('click', (event) => {
      const on = this.preview.toggleAnimation();
      event.currentTarget.classList.toggle('active', on);
      event.currentTarget.textContent = on ? '⏸' : '▶';
    }, listenerOptions);
    document.getElementById('vp-rotate').addEventListener('click', (event) => {
      const on = this.preview.toggleAutoRotate();
      event.currentTarget.classList.toggle('active', on);
    }, listenerOptions);
    document.getElementById('vp-reset').addEventListener('click', () => {
      this.preview.resetView();
    }, listenerOptions);

    this._refreshAnimSelect();
  }

  _refreshAnimSelect() {
    const names = this.preview.clipNames;
    this._animSelect.innerHTML = '';
    if (names.length === 0) {
      this._animSelect.style.display = 'none';
      return;
    }
    this._animSelect.style.display = '';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'None';
    this._animSelect.appendChild(none);
    for (const name of names) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      this._animSelect.appendChild(opt);
    }
  }

  _zoomBy(factor) {
    this._zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this._zoom * factor));
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
      badge.className = 'zoom-badge';
      document.getElementById('canvas-area').appendChild(badge);
    }
    badge.textContent = Math.round(this._zoom * 100) + '%';
    badge.classList.add('visible');
    clearTimeout(this._zoomBadgeTimer);
    this._zoomBadgeTimer = setTimeout(() => badge.classList.remove('visible'), ZOOM_BADGE_DURATION);
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
    const randomButton = document.getElementById('layer-random');
    const resetButton = document.getElementById('layer-reset');

    const listenerOptions = { signal: this._ac.signal };
    addButton.addEventListener('click', () => {
      this._detailOpen = false;
      this.layers.addLayer();
      this._renderLayerList();
      this._refreshHSVPanel();
    }, listenerOptions);
    deleteButton.addEventListener('click', () => {
      this._detailOpen = false;
      this.layers.deleteLayer(this.layers.activeIndex);
      this._renderLayerList();
      this._refreshHSVPanel();
    }, listenerOptions);
    randomButton.addEventListener('click', () => this._randomPreset().catch(console.error), listenerOptions);
    resetButton.addEventListener('click', () => {
      this._autoBakeTransform();
      while (this.layers.layers.length > 1) this.layers.layers.pop();
      const first = this.layers.layers[0];
      first.ctx.fillStyle = '#ffffff';
      first.ctx.fillRect(0, 0, first.canvas.width, first.canvas.height);
      this.layers.resetDetail(0);
      first.name = 'Layer 1';
      first.blendMode = 'source-over';
      first.opacity = 1.0;
      this.layers.activeIndex = 0;
      this.layers.composite();
      this._detailOpen = false;
      this._renderLayerList();
      this._refreshHSVPanel();
    }, listenerOptions);

    this._detailOpen = false;

    this._dragFromIndex = -1;
    this._gripHeld = false;
    document.addEventListener('mouseup', () => { this._gripHeld = false; }, listenerOptions);

    // Bind list-level drag events once (not per render)
    const list = document.getElementById('layer-list');
    list.addEventListener('dragover', (event) => { event.preventDefault(); }, listenerOptions);
    list.addEventListener('drop', (event) => {
      if (this._dragFromIndex === -1) return;
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
      this._detailOpen = false;
      this._renderLayerList();
      this._refreshHSVPanel();
    }, listenerOptions);

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
    // Detach settings panel before clearing to preserve element references
    const settingsPanel = this._settingsPanel;
    settingsPanel.remove();
    settingsPanel.classList.remove('open');
    list.innerHTML = '';

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
        // Clamp — allow layers.length (means "insert at end")
        targetIndex = Math.max(0, Math.min(this.layers.layers.length, targetIndex));
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
        this._detailOpen = false;
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
        if (this.layers.isSoloed) this.layers.unsoloLayer();
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
      importButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="14" height="14" fill="currentColor"><path d="M480-480ZM212.31-140Q182-140 161-161q-21-21-21-51.31v-535.38Q140-778 161-799q21-21 51.31-21h300v60h-300q-5.39 0-8.85 3.46t-3.46 8.85v535.38q0 5.39 3.46 8.85t8.85 3.46h535.38q5.39 0 8.85-3.46t3.46-8.85v-300h60v300Q820-182 799-161q-21 21-51.31 21H212.31Zm43.08-152.31h449.22L565-478.46 445-322.69l-85-108.08-104.61 138.46ZM680-600v-80h-80v-60h80v-80h60v80h80v60h-80v80h-60Z"/></svg>';
      importButton.addEventListener('click', (event) => {
        event.stopPropagation();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', () => {
          const file = input.files[0];
          if (!file) return;
          this._autoBakeTransform();
          const img = new Image();
          img.onload = () => {
            this.layers.resetDetail(layerIndex);
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
        if (layerIndex !== this.layers.activeIndex) this._autoBakeTransform();
        this.layers.setActive(layerIndex);
        this._renderLayerList();
        this._refreshHSVPanel();
      });

      const soloButton = document.createElement('span');
      soloButton.className = 'layer-solo' + (this.layers._soloIndex === layerIndex ? ' active' : '');
      soloButton.title = 'Solo (show only this layer)';
      soloButton.textContent = 'S';
      soloButton.addEventListener('click', (event) => {
        event.stopPropagation();
        this.layers.soloLayer(layerIndex);
        this._renderLayerList();
      });

      const detailBtn = document.createElement('button');
      detailBtn.className = 'layer-detail-btn' + (this._detailOpen && layerIndex === this.layers.activeIndex ? ' open' : '');
      detailBtn.title = 'Layer detail';
      detailBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M440-120v-240h80v80h320v80H520v80h-80Zm-320-80v-80h240v80H120Zm160-160v-80H120v-80h160v-80h80v240h-80Zm160-80v-80h400v80H440Zm160-160v-240h80v80h160v80H680v80h-80Zm-480-80v-80h400v80H120Z"/></svg>';
      detailBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (layerIndex === this.layers.activeIndex) {
          this._detailOpen = !this._detailOpen;
        } else {
          this._autoBakeTransform();
          this.layers.setActive(layerIndex);
          this._detailOpen = true;
        }
        this._renderLayerList();
        this._refreshHSVPanel();
      });

      item.appendChild(grip);
      item.appendChild(soloButton);
      item.appendChild(visibilityToggle);
      item.appendChild(thumb);
      item.appendChild(nameLabel);
      item.appendChild(matcapButton);
      item.appendChild(importButton);
      item.appendChild(blendSelect);
      item.appendChild(opacitySlider);
      item.appendChild(detailBtn);
      list.appendChild(item);
    }

    // Accordion: insert detail panel directly below the active layer item
    if (this._detailOpen) {
      const activeItem = list.querySelector(`[data-layer-index="${this.layers.activeIndex}"]`);
      if (activeItem) {
        activeItem.after(settingsPanel);
        settingsPanel.classList.add('open');
      }
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

  // --- Detail Panel (HSB + Transform) ---

  _bindHSVPanel() {
    const listenerOptions = { signal: this._ac.signal };
    const hueSlider = document.getElementById('hsv-hue');
    const satSlider = document.getElementById('hsv-sat');
    const valSlider = document.getElementById('hsv-val');
    const contrastSlider = document.getElementById('hsv-contrast');
    const liftSlider = document.getElementById('hsv-lift');
    const hueVal = document.getElementById('hsv-hue-val');
    const satVal = document.getElementById('hsv-sat-val');
    const valVal = document.getElementById('hsv-val-val');
    const contrastVal = document.getElementById('hsv-contrast-val');
    const liftVal = document.getElementById('hsv-lift-val');
    const xSlider = document.getElementById('layer-x');
    const xVal = document.getElementById('layer-x-val');
    const ySlider = document.getElementById('layer-y');
    const yVal = document.getElementById('layer-y-val');
    const rotSlider = document.getElementById('layer-rotation');
    const rotVal = document.getElementById('layer-rotation-val');
    const scaleSlider = document.getElementById('layer-scale');
    const scaleVal = document.getElementById('layer-scale-val');

    const updateHSV = () => {
      const h = +hueSlider.value;
      const s = +satSlider.value;
      const v = +valSlider.value;
      hueVal.value = h;
      satVal.value = s;
      valVal.value = v;
      this.layers.setHSV(this.layers.activeIndex, h, s, v);
    };

    const updateContrast = () => { contrastVal.value = contrastSlider.value; this.layers.setContrast(this.layers.activeIndex, +contrastSlider.value); };
    const updateLift = () => { liftVal.value = liftSlider.value; this.layers.setLift(this.layers.activeIndex, +liftSlider.value); };

    const updateX = () => { xVal.value = xSlider.value; this.transform.setX(+xSlider.value); };
    const updateY = () => { yVal.value = ySlider.value; this.transform.setY(+ySlider.value); };
    const updateRotation = () => { rotVal.value = rotSlider.value; this.transform.setRotation(+rotSlider.value); };
    const updateScale = () => { scaleVal.value = scaleSlider.value; this.transform.setScale(+scaleSlider.value); };

    const syncFromInput = (numInput, slider, callback) => {
      const min = +slider.min, max = +slider.max;
      const v = Math.round(Math.min(max, Math.max(min, +numInput.value || 0)));
      numInput.value = v;
      slider.value = v;
      callback();
    };

    hueSlider.addEventListener('input', updateHSV, listenerOptions);
    satSlider.addEventListener('input', updateHSV, listenerOptions);
    valSlider.addEventListener('input', updateHSV, listenerOptions);
    contrastSlider.addEventListener('input', updateContrast, listenerOptions);
    liftSlider.addEventListener('input', updateLift, listenerOptions);
    xSlider.addEventListener('input', updateX, listenerOptions);
    ySlider.addEventListener('input', updateY, listenerOptions);
    rotSlider.addEventListener('input', updateRotation, listenerOptions);
    scaleSlider.addEventListener('input', updateScale, listenerOptions);

    // Bake transform into pixels on release
    const bakeAndReset = () => {
      if (this.transform.hasTransform) {
        this.painter.saveSnapshot();
        this.transform.bake();
      }
      xSlider.value = 0; xVal.value = 0;
      ySlider.value = 0; yVal.value = 0;
      rotSlider.value = 0; rotVal.value = 0;
      scaleSlider.value = 100; scaleVal.value = 100;
      this._renderLayerList();
    };
    xSlider.addEventListener('change', bakeAndReset, listenerOptions);
    ySlider.addEventListener('change', bakeAndReset, listenerOptions);
    rotSlider.addEventListener('change', bakeAndReset, listenerOptions);
    scaleSlider.addEventListener('change', bakeAndReset, listenerOptions);

    hueVal.addEventListener('change', () => syncFromInput(hueVal, hueSlider, updateHSV), listenerOptions);
    satVal.addEventListener('change', () => syncFromInput(satVal, satSlider, updateHSV), listenerOptions);
    valVal.addEventListener('change', () => syncFromInput(valVal, valSlider, updateHSV), listenerOptions);
    contrastVal.addEventListener('change', () => syncFromInput(contrastVal, contrastSlider, updateContrast), listenerOptions);
    liftVal.addEventListener('change', () => syncFromInput(liftVal, liftSlider, updateLift), listenerOptions);
    xVal.addEventListener('change', () => { syncFromInput(xVal, xSlider, updateX); bakeAndReset(); }, listenerOptions);
    yVal.addEventListener('change', () => { syncFromInput(yVal, ySlider, updateY); bakeAndReset(); }, listenerOptions);
    rotVal.addEventListener('change', () => { syncFromInput(rotVal, rotSlider, updateRotation); bakeAndReset(); }, listenerOptions);
    scaleVal.addEventListener('change', () => { syncFromInput(scaleVal, scaleSlider, updateScale); bakeAndReset(); }, listenerOptions);

    // Double-click to reset individual slider
    hueSlider.addEventListener('dblclick', () => { hueSlider.value = 0; updateHSV(); }, listenerOptions);
    satSlider.addEventListener('dblclick', () => { satSlider.value = 0; updateHSV(); }, listenerOptions);
    valSlider.addEventListener('dblclick', () => { valSlider.value = 0; updateHSV(); }, listenerOptions);
    contrastSlider.addEventListener('dblclick', () => { contrastSlider.value = 0; updateContrast(); }, listenerOptions);
    liftSlider.addEventListener('dblclick', () => { liftSlider.value = 0; updateLift(); }, listenerOptions);

    this._detailElements = { hueSlider, satSlider, valSlider, contrastSlider, liftSlider, hueVal, satVal, valVal, contrastVal, liftVal, xSlider, xVal, ySlider, yVal, rotSlider, rotVal, scaleSlider, scaleVal };
    this._refreshHSVPanel();
  }

  _autoBakeTransform() {
    if (this.transform.hasTransform) {
      this.painter.saveSnapshot();
      this.transform.bake();
      this._refreshHSVPanel();
    }
  }

  async _randomPreset() {
    this._autoBakeTransform();

    const count = Math.floor(Math.random() * 3) + 1;
    const blendModes = ['source-over', 'multiply', 'screen', 'overlay'];

    // Pre-generate configs and load images while old content stays visible
    const configs = [];
    const loads = [];
    for (let i = 0; i < count; i++) {
      const matcapId = MATCAP_IDS[Math.floor(Math.random() * MATCAP_IDS.length)];
      const cfg = {
        blendMode: i === 0 ? 'source-over' : blendModes[Math.floor(Math.random() * blendModes.length)],
        opacity: i === 0 ? 1.0 : +(0.4 + Math.random() * 0.6).toFixed(2),
        hue: Math.floor(Math.random() * 361) - 180,
        saturation: Math.floor(Math.random() * 101) - 50,
        brightness: Math.floor(Math.random() * 61) - 30,
        contrast: Math.floor(Math.random() * 81) - 30,
        lift: Math.floor(Math.random() * 21),
        img: null,
      };
      configs.push(cfg);
      loads.push(new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { cfg.img = img; resolve(); };
        img.onerror = resolve;
        img.src = FULL_PATH + matcapId + '.png';
      }));
    }
    await Promise.all(loads);

    // Suppress intermediate composites — shadow prototype method
    this.layers.composite = () => {};

    while (this.layers.layers.length > 1) this.layers.layers.pop();
    const first = this.layers.layers[0];
    first.ctx.clearRect(0, 0, first.canvas.width, first.canvas.height);
    this.layers.resetDetail(0);
    first.name = 'Layer 1';
    for (let i = 1; i < count; i++) this.layers.addLayer(`Layer ${i + 1}`);

    for (let i = 0; i < count; i++) {
      const layer = this.layers.layers[i];
      const cfg = configs[i];
      layer.blendMode = cfg.blendMode;
      layer.opacity = cfg.opacity;
      layer.hue = cfg.hue;
      layer.saturation = cfg.saturation;
      layer.brightness = cfg.brightness;
      layer.contrast = cfg.contrast;
      layer.lift = cfg.lift;
      if (cfg.img) layer.ctx.drawImage(cfg.img, 0, 0, layer.canvas.width, layer.canvas.height);
    }

    // Restore and composite once
    delete this.layers.composite;
    this.layers.activeIndex = count - 1;
    this.layers.composite();
    this._detailOpen = false;
    this._renderLayerList();
    this._refreshHSVPanel();
  }

  _refreshHSVPanel() {
    const el = this._detailElements;
    if (!el) return;
    const layer = this.layers.getActiveLayer();
    if (!layer) return;
    el.hueSlider.value = layer.hue;
    el.satSlider.value = layer.saturation;
    el.valSlider.value = layer.brightness;
    el.contrastSlider.value = layer.contrast;
    el.liftSlider.value = layer.lift;
    el.hueVal.value = layer.hue;
    el.satVal.value = layer.saturation;
    el.valVal.value = layer.brightness;
    el.contrastVal.value = layer.contrast;
    el.liftVal.value = layer.lift;
    el.xSlider.value = this.transform.x;
    el.xVal.value = this.transform.x;
    el.ySlider.value = this.transform.y;
    el.yVal.value = this.transform.y;
    el.rotSlider.value = this.transform.rotation;
    el.rotVal.value = this.transform.rotation;
    el.scaleSlider.value = this.transform.scale;
    el.scaleVal.value = this.transform.scale;
  }

  // --- Shader Controls ---

  _shaderRender() {
    if (this.modeController && this.modeController.mode === 'shader' && this.toonGenerator) {
      this.toonGenerator.render();
    }
  }

  _bindShaderControls() {
    if (!this.toonGenerator) return;
    const toon = this.toonGenerator;
    const listenerOptions = { signal: this._ac.signal };

    const scheduleRender = () => this._shaderRender();

    // Helper: bind slider + number input pair
    const bindPair = (sliderId, valId, getter, setter) => {
      const slider = document.getElementById(sliderId);
      const val = document.getElementById(valId);
      if (!slider || !val) return;
      slider.addEventListener('input', () => { val.value = slider.value; setter(+slider.value); scheduleRender(); }, listenerOptions);
      val.addEventListener('change', () => {
        const min = +slider.min, max = +slider.max;
        const v = Math.round(Math.min(max, Math.max(min, +val.value || 0)));
        val.value = v; slider.value = v; setter(v); scheduleRender();
      }, listenerOptions);
    };

    // Gradient editor (Figma-style)
    this._initGradientEditor();

    // Outline
    document.getElementById('outline-enabled')?.addEventListener('change', (e) => { toon.outlineEnabled = e.target.checked; scheduleRender(); }, listenerOptions);
    document.getElementById('outline-color')?.addEventListener('input', (e) => { toon.outlineColor = e.target.value; scheduleRender(); }, listenerOptions);
    bindPair('outline-width', 'outline-width-val', () => toon.outlineWidth * 1000, (v) => { toon.outlineWidth = v / 1000; });

    // Specular
    document.getElementById('spec-enabled')?.addEventListener('change', (e) => { toon.specEnabled = e.target.checked; scheduleRender(); }, listenerOptions);
    document.getElementById('spec-color')?.addEventListener('input', (e) => { toon.specColor = e.target.value; scheduleRender(); }, listenerOptions);
    bindPair('spec-power', 'spec-power-val', () => toon.specPower, (v) => { toon.specPower = v; });
    bindPair('spec-threshold', 'spec-threshold-val', () => toon.specThreshold * 100, (v) => { toon.specThreshold = v / 100; });

    // FOV
    bindPair('shader-fov', 'shader-fov-val', () => toon.fov, (v) => { toon.fov = v; });

    // Light direction
    const normalize = (x, y, z) => {
      const len = Math.sqrt(x * x + y * y + z * z);
      return len > 0 ? [x / len, y / len, z / len] : [0, 0, 1];
    };
    const updateLight = () => {
      const lx = +(document.getElementById('light-x')?.value || 30) / 100;
      const ly = +(document.getElementById('light-y')?.value || 50) / 100;
      const lz = +(document.getElementById('light-z')?.value || 80) / 100;
      toon.lightDir = normalize(lx, ly, lz);
      scheduleRender();
    };
    bindPair('light-x', 'light-x-val', () => toon.lightDir[0] * 100, (v) => { updateLight(); });
    bindPair('light-y', 'light-y-val', () => toon.lightDir[1] * 100, (v) => { updateLight(); });
    bindPair('light-z', 'light-z-val', () => toon.lightDir[2] * 100, (v) => { updateLight(); });

    // Copy / Paste shader parameters
    document.getElementById('shader-copy')?.addEventListener('click', async () => {
      const json = JSON.stringify(toon.toJSON(), null, 2);
      await navigator.clipboard.writeText(json);
    }, listenerOptions);

    document.getElementById('shader-paste')?.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text);
        if (toon.fromJSON(data)) {
          this._refreshShaderUI();
          scheduleRender();
        }
      } catch (e) {
        console.warn('Paste failed:', e);
      }
    }, listenerOptions);
  }

  _refreshShaderUI() {
    const toon = this.toonGenerator;
    const setPair = (sliderId, valId, value) => {
      const s = document.getElementById(sliderId);
      const v = document.getElementById(valId);
      if (s) s.value = value;
      if (v) v.value = value;
    };

    // Gradient
    const modeSelect = document.getElementById('gradient-mode');
    if (modeSelect) modeSelect.value = toon.gradientMode;
    this._renderGradientUI();

    // Outline
    const outEn = document.getElementById('outline-enabled');
    if (outEn) outEn.checked = toon.outlineEnabled;
    const outCol = document.getElementById('outline-color');
    if (outCol) outCol.value = toon.outlineColor;
    setPair('outline-width', 'outline-width-val', Math.round(toon.outlineWidth * 1000));

    // Specular
    const specEn = document.getElementById('spec-enabled');
    if (specEn) specEn.checked = toon.specEnabled;
    const specCol = document.getElementById('spec-color');
    if (specCol) specCol.value = toon.specColor;
    setPair('spec-power', 'spec-power-val', toon.specPower);
    setPair('spec-threshold', 'spec-threshold-val', Math.round(toon.specThreshold * 100));

    // FOV
    setPair('shader-fov', 'shader-fov-val', toon.fov);

    // Light direction
    setPair('light-x', 'light-x-val', Math.round(toon.lightDir[0] * 100));
    setPair('light-y', 'light-y-val', Math.round(toon.lightDir[1] * 100));
    setPair('light-z', 'light-z-val', Math.round(toon.lightDir[2] * 100));
  }

  // --- Gradient Editor (Figma-style) ---

  _initGradientEditor() {
    const toon = this.toonGenerator;
    const bar = document.getElementById('gradient-bar');
    const list = document.getElementById('gradient-stop-list');
    const addBtn = document.getElementById('gradient-add-stop');
    if (!bar || !list) return;

    this._selectedStopIndex = 0;
    this._gradientBar = bar;
    this._gradientList = list;

    // Gradient mode select (Step / Linear)
    const modeSelect = document.getElementById('gradient-mode');
    modeSelect?.addEventListener('change', (e) => {
      toon.gradientMode = e.target.value;
      this._shaderRender();
      this._renderGradientUI();
    }, { signal: this._ac.signal });

    // Interpolate color at a position from existing stops
    const lerpColor = (pos) => {
      const sorted = [...toon.stops].sort((a, b) => a.position - b.position);
      if (sorted.length === 0) return '#888888';
      if (pos <= sorted[0].position) return sorted[0].color;
      if (pos >= sorted[sorted.length - 1].position) return sorted[sorted.length - 1].color;
      for (let i = 0; i < sorted.length - 1; i++) {
        if (pos >= sorted[i].position && pos <= sorted[i + 1].position) {
          const t = (pos - sorted[i].position) / (sorted[i + 1].position - sorted[i].position);
          const a = sorted[i].color, b = sorted[i + 1].color;
          const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
          const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
          const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bv = Math.round(ab + (bb - ab) * t);
          return '#' + ((1 << 24) | (r << 16) | (g << 8) | bv).toString(16).slice(1);
        }
      }
      return '#888888';
    };

    // Add stop button
    addBtn?.addEventListener('click', () => {
      const sorted = [...toon.stops].sort((a, b) => a.position - b.position);
      let newPos = 50;
      if (sorted.length >= 2) {
        let maxGap = 0, gapStart = 0, gapEnd = 100;
        for (let i = 0; i < sorted.length - 1; i++) {
          const gap = sorted[i + 1].position - sorted[i].position;
          if (gap > maxGap) { maxGap = gap; gapStart = sorted[i].position; gapEnd = sorted[i + 1].position; }
        }
        newPos = Math.round((gapStart + gapEnd) / 2);
      }
      toon.stops.push({ position: newPos, color: lerpColor(newPos) });
      this._selectedStopIndex = toon.stops.length - 1;
      this._shaderRender();
      this._renderGradientUI();
    }, { signal: this._ac.signal });

    // Click on bar to add stop (left=0%=dark, right=100%=bright)
    bar.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('gradient-handle')) return;
      const rect = bar.getBoundingClientRect();
      const pos = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
      toon.stops.push({ position: pos, color: lerpColor(pos) });
      this._selectedStopIndex = toon.stops.length - 1;
      this._shaderRender();
      this._renderGradientUI();
    }, { signal: this._ac.signal });

    this._renderGradientUI();
  }

  _updateGradientBar() {
    const toon = this.toonGenerator;
    const bar = this._gradientBar;
    if (!bar) return;
    const ascSorted = [...toon.stops].sort((a, b) => a.position - b.position);
    if (toon.gradientMode === 'linear') {
      bar.style.background = `linear-gradient(to right, ${ascSorted.map(s => `${s.color} ${s.position}%`).join(', ')})`;
    } else {
      const stops = [];
      for (let i = 0; i < ascSorted.length; i++) {
        const start = i === 0 ? '0%' : ascSorted[i].position + '%';
        const end = i === ascSorted.length - 1 ? '100%' : ascSorted[i + 1].position + '%';
        stops.push(`${ascSorted[i].color} ${start}`);
        stops.push(`${ascSorted[i].color} ${end}`);
      }
      bar.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
    }
    // Update handles
    bar.querySelectorAll('.gradient-handle').forEach((h, i) => {
      if (toon.stops[i]) { h.style.left = toon.stops[i].position + '%'; h.style.background = toon.stops[i].color; }
    });
  }

  _renderGradientUI() {
    const toon = this.toonGenerator;
    const bar = this._gradientBar;
    const list = this._gradientList;
    if (!bar || !list) return;

    this._updateGradientBar();

    // Render handles
    bar.querySelectorAll('.gradient-handle').forEach(h => h.remove());
    toon.stops.forEach((stop, i) => {
      const handle = document.createElement('div');
      handle.className = 'gradient-handle' + (i === this._selectedStopIndex ? ' selected' : '');
      handle.style.left = stop.position + '%';
      handle.style.background = stop.color;
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._selectedStopIndex = i;
        this._renderGradientUI();
        this._startHandleDrag(i);
      });
      bar.appendChild(handle);
    });

    // Render stop list
    list.innerHTML = '';
    toon.stops.forEach((stop, i) => {
      const row = document.createElement('div');
      row.className = 'gradient-stop-item' + (i === this._selectedStopIndex ? ' selected' : '');
      row.addEventListener('click', () => { if (this._selectedStopIndex === i) return; this._selectedStopIndex = i; this._renderGradientUI(); });

      // Position wrap: [number][%]
      const posWrap = document.createElement('div');
      posWrap.className = 'gradient-pos-wrap';
      const pos = document.createElement('input');
      pos.type = 'number';
      pos.className = 'gradient-pos';
      pos.value = stop.position;
      pos.min = 0;
      pos.max = 100;
      pos.addEventListener('change', () => {
        toon.stops[i].position = Math.max(0, Math.min(100, Math.round(+pos.value || 0)));
        this._shaderRender();
        this._renderGradientUI();
      });
      pos.addEventListener('click', (e) => e.stopPropagation());
      const pct = document.createElement('span');
      pct.className = 'gradient-pos-pct';
      pct.textContent = '%';
      posWrap.appendChild(pos);
      posWrap.appendChild(pct);

      // Color swatch with hidden color input
      const swatch = document.createElement('div');
      swatch.className = 'gradient-swatch';
      swatch.style.background = stop.color;
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = stop.color;
      colorInput.addEventListener('input', (e) => {
        e.stopPropagation();
        toon.stops[i].color = colorInput.value;
        swatch.style.background = colorInput.value;
        hex.value = colorInput.value.slice(1).toUpperCase();
        this._shaderRender();
        this._updateGradientBar();
      });
      colorInput.addEventListener('change', (e) => {
        e.stopPropagation();
        this._renderGradientUI();
      });
      colorInput.addEventListener('click', (e) => e.stopPropagation());
      swatch.appendChild(colorInput);

      // Hex input
      const hex = document.createElement('input');
      hex.type = 'text';
      hex.className = 'gradient-hex';
      hex.value = stop.color.slice(1).toUpperCase();
      hex.maxLength = 6;
      hex.addEventListener('change', () => {
        const val = hex.value.replace('#', '').trim();
        if (/^[0-9a-fA-F]{6}$/.test(val)) {
          toon.stops[i].color = '#' + val.toLowerCase();
          this._shaderRender();
          this._renderGradientUI();
        } else {
          hex.value = toon.stops[i].color.slice(1).toUpperCase();
        }
      });
      hex.addEventListener('click', (e) => e.stopPropagation());

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'gradient-remove-btn';
      removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="14" height="14" fill="currentColor"><path d="M220-450v-60h520v60H220Z"/></svg>';
      removeBtn.title = 'Remove stop';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (toon.stops.length <= 2) return;
        toon.stops.splice(i, 1);
        if (this._selectedStopIndex >= toon.stops.length) this._selectedStopIndex = toon.stops.length - 1;
        this._shaderRender();
        this._renderGradientUI();
      });

      row.appendChild(posWrap);
      row.appendChild(swatch);
      row.appendChild(hex);
      row.appendChild(removeBtn);
      list.appendChild(row);
    });
  }

  _startHandleDrag(index) {
    const toon = this.toonGenerator;
    const bar = this._gradientBar;

    const onMove = (e) => {
      const rect = bar.getBoundingClientRect();
      const pos = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
      toon.stops[index].position = pos;

      // Update bar gradient (left=0%=dark, right=100%=bright)
      const ascSorted = [...toon.stops].sort((a, b) => a.position - b.position);
      if (toon.gradientMode === 'linear') {
        bar.style.background = `linear-gradient(to right, ${ascSorted.map(s => `${s.color} ${s.position}%`).join(', ')})`;
      } else {
        const stops = [];
        for (let i = 0; i < ascSorted.length; i++) {
          const start = i === 0 ? '0%' : ascSorted[i].position + '%';
          const end = i === ascSorted.length - 1 ? '100%' : ascSorted[i + 1].position + '%';
          stops.push(`${ascSorted[i].color} ${start}`);
          stops.push(`${ascSorted[i].color} ${end}`);
        }
        bar.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
      }

      // Update handle position
      const handles = bar.querySelectorAll('.gradient-handle');
      if (handles[index]) handles[index].style.left = pos + '%';

      // Update position input in stop list
      const rows = this._gradientList.querySelectorAll('.gradient-stop-item');
      if (rows[index]) {
        const posInput = rows[index].querySelector('.gradient-pos');
        if (posInput) posInput.value = pos;
      }

      this._shaderRender();
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      this._renderGradientUI();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
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

      // Tool shortcuts only in paint mode
      if (this.modeController && this.modeController.mode !== 'paint') return;

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

      const toolMap = { b: 'brush', a: 'airbrush', r: 'blur', e: 'eraser', f: 'fill', i: 'eyedropper' };

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
        this.brush.size = Math.max(BRUSH_SIZE_MIN, this.brush.size - BRUSH_SIZE_STEP);
        if (this._sizeSlider) this._sizeSlider.set(Math.round(this.brush.size));
        this.painter.refreshCursor();
      }
      if (key === ']') {
        this.brush.size = Math.min(BRUSH_SIZE_MAX, this.brush.size + BRUSH_SIZE_STEP);
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
    const isShader = this.modeController && this.modeController.mode === 'shader';

    // Hide nav buttons, circle mask, and checkerboard in shader mode
    const nav = document.querySelector('.canvas-nav');
    if (nav) nav.style.display = isShader ? 'none' : '';
    const mask = document.querySelector('.canvas-circle-mask');
    if (mask) mask.style.display = isShader ? 'none' : '';
    const bg = document.querySelector('.canvas-bg');
    if (bg) bg.style.display = isShader ? 'none' : '';
    const cursorOverlay = document.getElementById('cursor-overlay');
    if (cursorOverlay) cursorOverlay.style.display = isShader ? 'none' : '';
    const paintCanvas = document.getElementById('paint-canvas');
    if (paintCanvas) paintCanvas.style.cursor = isShader ? 'default' : 'none';

    let displaySize;
    if (isShader) {
      // Shader mode: slightly smaller sphere, no padding
      displaySize = Math.max(200, Math.min(area.clientWidth, area.clientHeight) * 0.56);
      this._zoom = 1;
      this._panX = 0;
      this._panY = 0;
    } else {
      const padding = 24;
      const maxSize = Math.min(area.clientWidth, area.clientHeight) - padding * 2;
      const dpr = window.devicePixelRatio || 1;
      displaySize = Math.max(200, Math.min(maxSize, canvas.width / dpr));
    }

    this._baseSize = displaySize;
    wrap.style.width = displaySize + 'px';
    wrap.style.height = displaySize + 'px';
    canvas.style.width = displaySize + 'px';
    canvas.style.height = displaySize + 'px';
    this._applyTransform();
    wrap.style.opacity = '1';
  }
}
