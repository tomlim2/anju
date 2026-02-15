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

  _bindControls() {
    const color = document.getElementById('brush-color');
    const size = document.getElementById('brush-size');
    const opacity = document.getElementById('brush-opacity');
    const hardness = document.getElementById('brush-hardness');
    const mirror = document.getElementById('mirror-x');
    const sizeVal = document.getElementById('size-val');
    const opacityVal = document.getElementById('opacity-val');
    const hardnessVal = document.getElementById('hardness-val');

    color.addEventListener('input', (e) => { this.brush.color = e.target.value; });
    size.addEventListener('input', (e) => {
      this.brush.size = +e.target.value;
      sizeVal.textContent = e.target.value;
    });
    opacity.addEventListener('input', (e) => {
      this.brush.opacity = +e.target.value / 100;
      opacityVal.textContent = e.target.value;
    });
    hardness.addEventListener('input', (e) => {
      this.brush.hardness = +e.target.value / 100;
      hardnessVal.textContent = e.target.value;
    });
    mirror.addEventListener('change', (e) => {
      this.painter.mirror = e.target.checked;
    });
  }

  _bindLayers() {
    const addBtn = document.getElementById('layer-add');
    const delBtn = document.getElementById('layer-delete');
    const upBtn = document.getElementById('layer-up');
    const downBtn = document.getElementById('layer-down');
    const blendSel = document.getElementById('layer-blend');

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
    blendSel.addEventListener('change', (e) => {
      this.layers.setBlendMode(this.layers.activeIndex, e.target.value);
    });

    this._renderLayerList();
  }

  _renderLayerList() {
    const list = document.getElementById('layer-list');
    const blendSel = document.getElementById('layer-blend');
    list.innerHTML = '';

    // Render top-to-bottom (highest index first)
    for (let i = this.layers.layers.length - 1; i >= 0; i--) {
      const layer = this.layers.layers[i];
      const item = document.createElement('div');
      item.className = 'layer-item' + (i === this.layers.activeIndex ? ' active' : '');

      const vis = document.createElement('span');
      vis.className = 'layer-vis' + (layer.visible ? '' : ' hidden');
      vis.textContent = layer.visible ? '\u{1F441}' : '\u{1F441}';
      vis.style.opacity = layer.visible ? '0.7' : '0.3';
      vis.addEventListener('click', (e) => {
        e.stopPropagation();
        this.layers.setVisibility(i, !layer.visible);
        this._renderLayerList();
      });

      const name = document.createElement('span');
      name.className = 'layer-name';
      name.textContent = layer.name;

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
        blendSel.value = this.layers.layers[i].blendMode;
        this._renderLayerList();
      });

      item.appendChild(vis);
      item.appendChild(name);
      item.appendChild(opSlider);
      list.appendChild(item);
    }

    // Update blend selector
    const active = this.layers.getActiveLayer();
    if (active) blendSel.value = active.blendMode;
  }

  _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Don't intercept when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      const toolMap = { b: 'brush', a: 'airbrush', r: 'blur', e: 'eraser' };
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
        document.getElementById('brush-size').value = this.brush.size;
        document.getElementById('size-val').textContent = Math.round(this.brush.size);
      }
      if (key === ']') {
        this.brush.size = Math.min(100, this.brush.size + 5);
        document.getElementById('brush-size').value = this.brush.size;
        document.getElementById('size-val').textContent = Math.round(this.brush.size);
      }
    });
  }

  _resizeCanvasDisplay() {
    const area = document.getElementById('canvas-area');
    const canvas = document.getElementById('paint-canvas');
    const bg = document.getElementById('canvas-bg');

    const padding = 24;
    const maxSize = Math.min(area.clientWidth, area.clientHeight) - padding * 2;
    const displaySize = Math.max(200, maxSize);

    canvas.style.width = displaySize + 'px';
    canvas.style.height = displaySize + 'px';
    bg.style.width = displaySize + 'px';
    bg.style.height = displaySize + 'px';
  }
}
