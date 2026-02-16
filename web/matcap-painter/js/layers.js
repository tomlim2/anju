const MAX_LAYERS = 8;
const SIZE = 1024;

const BLEND_OPS = {
  'source-over': 'source-over',
  'multiply': 'multiply',
  'screen': 'screen',
  'overlay': 'overlay',
};

export class LayerSystem {
  constructor(outputCanvas) {
    this.outputCanvas = outputCanvas;
    this.outputCtx = outputCanvas.getContext('2d');
    this.layers = [];
    this.activeIndex = 0;
    this.transform = null;
    this.onChange = null; // callback when composite changes

    this.addLayer('Layer 1');
  }

  addLayer(name) {
    if (this.layers.length >= MAX_LAYERS) return null;

    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    const layer = {
      name: name || `Layer ${this.layers.length + 1}`,
      canvas,
      ctx,
      visible: true,
      opacity: 1.0,
      blendMode: 'source-over',
      hue: 0,
      saturation: 0,
      brightness: 0,
      contrast: 0,
      lift: 0,
      _filteredCanvas: null,
      _filterDirty: true,
    };

    this.layers.push(layer);
    this.activeIndex = this.layers.length - 1;
    this.composite();
    return layer;
  }

  deleteLayer(index) {
    if (this.layers.length <= 1) return;
    if (index < 0 || index >= this.layers.length) return;

    this.layers.splice(index, 1);
    if (this.activeIndex >= this.layers.length) {
      this.activeIndex = this.layers.length - 1;
    }
    this.composite();
  }

  moveLayer(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= this.layers.length) return;

    const temp = this.layers[index];
    this.layers[index] = this.layers[newIndex];
    this.layers[newIndex] = temp;

    if (this.activeIndex === index) {
      this.activeIndex = newIndex;
    } else if (this.activeIndex === newIndex) {
      this.activeIndex = index;
    }
    this.composite();
  }

  getActiveLayer() {
    return this.layers[this.activeIndex] || null;
  }

  getActiveCtx() {
    const layer = this.getActiveLayer();
    return layer ? layer.ctx : null;
  }

  setActive(index) {
    if (index >= 0 && index < this.layers.length) {
      this.activeIndex = index;
    }
  }

  setVisibility(index, visible) {
    if (this.layers[index]) {
      this.layers[index].visible = visible;
      this.composite();
    }
  }

  soloLayer(index) {
    if (!this.layers[index]) return;
    if (this._soloIndex === index) {
      this.unsoloLayer();
      return;
    }
    // Only save visibility when entering solo from normal state
    if (this._soloIndex === undefined) {
      this._savedVisibility = this.layers.map(layer => layer.visible);
    }
    this._soloIndex = index;
    for (let i = 0; i < this.layers.length; i++) {
      this.layers[i].visible = i === index;
    }
    this.composite();
  }

  unsoloLayer() {
    if (this._savedVisibility) {
      for (let i = 0; i < this.layers.length; i++) {
        if (this.layers[i] && this._savedVisibility[i] !== undefined) {
          this.layers[i].visible = this._savedVisibility[i];
        }
      }
    }
    this._soloIndex = undefined;
    this._savedVisibility = null;
    this.composite();
  }

  get isSoloed() {
    return this._soloIndex !== undefined;
  }

  setOpacity(index, opacity) {
    if (this.layers[index]) {
      this.layers[index].opacity = Math.max(0, Math.min(1, opacity));
      this.composite();
    }
  }

  setBlendMode(index, mode) {
    if (this.layers[index] && BLEND_OPS[mode]) {
      this.layers[index].blendMode = mode;
      this.composite();
    }
  }

  setHSV(index, h, s, v) {
    const layer = this.layers[index];
    if (!layer) return;
    layer.hue = h;
    layer.saturation = s;
    layer.brightness = v;
    layer._filterDirty = true;
    this.composite();
  }

  setContrast(index, value) {
    const layer = this.layers[index];
    if (!layer) return;
    layer.contrast = value;
    layer._filterDirty = true;
    this.composite();
  }

  setLift(index, value) {
    const layer = this.layers[index];
    if (!layer) return;
    layer.lift = value;
    layer._filterDirty = true;
    this.composite();
  }

  resetDetail(index) {
    const layer = this.layers[index];
    if (!layer) return;
    layer.hue = 0;
    layer.saturation = 0;
    layer.brightness = 0;
    layer.contrast = 0;
    layer.lift = 0;
    layer._filterDirty = true;
  }

  getFilteredCanvas(index) {
    const layer = this.layers[index];
    if (!layer) return null;
    if (!this._hasAdjustments(layer)) return layer.canvas;
    return this._applyFilter(layer);
  }

  composite() {
    const ctx = this.outputCtx;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Active layer content may have changed from painting — invalidate its cache
    const activeLayer = this.layers[this.activeIndex];
    if (activeLayer) activeLayer._filterDirty = true;

    // Draw bottom-to-top
    for (let layerIndex = 0; layerIndex < this.layers.length; layerIndex++) {
      const layer = this.layers[layerIndex];
      if (!layer.visible || layer.opacity <= 0) continue;

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;

      if (this.transform) this.transform.applyToContext(ctx, layerIndex);

      if (this._hasAdjustments(layer)) {
        ctx.drawImage(this._applyFilter(layer), 0, 0);
      } else {
        ctx.drawImage(layer.canvas, 0, 0);
      }

      ctx.restore();
    }

    if (this.onChange) this.onChange();
  }

  _hasAdjustments(layer) {
    return layer.hue !== 0 || layer.saturation !== 0 || layer.brightness !== 0
      || layer.contrast !== 0 || layer.lift !== 0;
  }

  _applyFilter(layer) {
    // Return cached result if clean
    if (!layer._filterDirty && layer._filteredCanvas) {
      return layer._filteredCanvas;
    }

    if (!layer._filteredCanvas) {
      layer._filteredCanvas = document.createElement('canvas');
      layer._filteredCanvas.width = SIZE;
      layer._filteredCanvas.height = SIZE;
    }
    const tmpCtx = layer._filteredCanvas.getContext('2d');
    tmpCtx.clearRect(0, 0, SIZE, SIZE);
    tmpCtx.drawImage(layer.canvas, 0, 0);

    const imageData = tmpCtx.getImageData(0, 0, SIZE, SIZE);
    const data = imageData.data;
    const hueShift = layer.hue / 360;
    const satShift = layer.saturation / 100;
    const valShift = layer.brightness / 100;
    const contrastFactor = (100 + layer.contrast) / 100;
    const liftFloor = layer.lift / 100;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;

      let r = data[i] / 255;
      let g = data[i + 1] / 255;
      let b = data[i + 2] / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;

      // RGB to HSV
      let h = 0;
      let s = max === 0 ? 0 : delta / max;
      let v = max;

      if (delta !== 0) {
        if (max === r) h = ((g - b) / delta + 6) % 6;
        else if (max === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
        h /= 6;
      }

      // HSV adjustments
      h = (h + hueShift + 1) % 1;
      s = Math.max(0, Math.min(1, s + satShift));
      v = Math.max(0, Math.min(1, v + valShift));

      // HSV to RGB
      const hi = Math.floor(h * 6);
      const f = h * 6 - hi;
      const p = v * (1 - s);
      const q = v * (1 - f * s);
      const t = v * (1 - (1 - f) * s);

      switch (hi % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
      }

      // Contrast: pivot around 0.5
      if (layer.contrast !== 0) {
        r = (r - 0.5) * contrastFactor + 0.5;
        g = (g - 0.5) * contrastFactor + 0.5;
        b = (b - 0.5) * contrastFactor + 0.5;
      }

      // Lift: raise shadow floor
      if (layer.lift !== 0) {
        r = liftFloor + r * (1 - liftFloor);
        g = liftFloor + g * (1 - liftFloor);
        b = liftFloor + b * (1 - liftFloor);
      }

      data[i] = Math.round(Math.max(0, Math.min(1, r)) * 255);
      data[i + 1] = Math.round(Math.max(0, Math.min(1, g)) * 255);
      data[i + 2] = Math.round(Math.max(0, Math.min(1, b)) * 255);
    }

    tmpCtx.putImageData(imageData, 0, 0);
    layer._filterDirty = false;
    return layer._filteredCanvas;
  }
}
