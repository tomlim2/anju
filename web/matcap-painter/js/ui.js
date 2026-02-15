export class UI {
  constructor(brush, painter, layerSystem) {
    this.brush = brush;
    this.painter = painter;
    this.layers = layerSystem;

    this._bindToolbar();
    this._bindControls();
    this._bindLayers();
    this._bindKeyboard();
    this._resizeCanvasDisplay();
    window.addEventListener('resize', () => this._resizeCanvasDisplay());
  }

  _bindToolbar() {
    const btns = document.querySelectorAll('[data-tool]');
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        btns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.brush.type = btn.dataset.tool;
      });
    });
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

    const mirror = document.getElementById('mirror-x');
    mirror.addEventListener('change', (e) => {
      this.painter.mirror = e.target.checked;
    });
  }

  _bindLayers() {
    const addBtn = document.getElementById('layer-add');
    const delBtn = document.getElementById('layer-delete');
    const upBtn = document.getElementById('layer-up');
    const downBtn = document.getElementById('layer-down');

    addBtn.addEventListener('click', () => {
      this.layers.addLayer();
      this._renderLayerList();
    });
    delBtn.addEventListener('click', () => {
      this.layers.deleteLayer(this.layers.activeIndex);
      this._renderLayerList();
    });
    upBtn.addEventListener('click', () => {
      this.layers.moveLayer(this.layers.activeIndex, 1);
      this._renderLayerList();
    });
    downBtn.addEventListener('click', () => {
      this.layers.moveLayer(this.layers.activeIndex, -1);
      this._renderLayerList();
    });

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

    for (let i = this.layers.layers.length - 1; i >= 0; i--) {
      const layer = this.layers.layers[i];
      const item = document.createElement('div');
      item.className = 'layer-item' + (i === this.layers.activeIndex ? ' active' : '');

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

      const name = document.createElement('span');
      name.className = 'layer-name';
      name.textContent = layer.name;

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

      item.appendChild(vis);
      item.appendChild(name);
      item.appendChild(blendSel);
      item.appendChild(opSlider);
      list.appendChild(item);
    }
  }

  _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
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

      const toolMap = { b: 'brush', a: 'airbrush', r: 'blur', e: 'eraser', g: 'fill' };
      const key = e.key.toLowerCase();

      if (toolMap[key]) {
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
  }

  _resizeCanvasDisplay() {
    const area = document.getElementById('canvas-area');
    const wrap = document.getElementById('canvas-wrap');
    const canvas = document.getElementById('paint-canvas');

    const padding = 24;
    const maxSize = Math.min(area.clientWidth, area.clientHeight) - padding * 2;
    const displaySize = Math.max(200, maxSize);

    wrap.style.width = displaySize + 'px';
    wrap.style.height = displaySize + 'px';
    canvas.style.width = displaySize + 'px';
    canvas.style.height = displaySize + 'px';
  }
}
