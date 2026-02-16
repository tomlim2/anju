const MAX_LAYERS = 8;
const SIZE = 2048;
export const CONTENT_SIZE = 1024;
const OFFSET = (SIZE - CONTENT_SIZE) / 2;

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
    this.contentCanvas = document.createElement('canvas');
    this.contentCanvas.width = CONTENT_SIZE;
    this.contentCanvas.height = CONTENT_SIZE;
    this._contentCtx = this.contentCanvas.getContext('2d');
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
    this.composite();
  }

  resetDetail(index) {
    const layer = this.layers[index];
    if (!layer) return;
    layer.hue = 0;
    layer.saturation = 0;
    layer.brightness = 0;
  }

  getFilteredCanvas(index) {
    const layer = this.layers[index];
    if (!layer) return null;
    const hasHSV = layer.hue !== 0 || layer.saturation !== 0 || layer.brightness !== 0;
    if (!hasHSV) return layer.canvas;
    return this._applyHSVFilter(layer.canvas, layer.hue, layer.saturation, layer.brightness);
  }

  composite() {
    const ctx = this.outputCtx;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Draw bottom-to-top
    for (let layerIndex = 0; layerIndex < this.layers.length; layerIndex++) {
      const layer = this.layers[layerIndex];
      if (!layer.visible || layer.opacity <= 0) continue;

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;

      if (this.transform) this.transform.applyToContext(ctx, layerIndex);

      const hasHSV = layer.hue !== 0 || layer.saturation !== 0 || layer.brightness !== 0;
      if (hasHSV) {
        const filtered = this._applyHSVFilter(layer.canvas, layer.hue, layer.saturation, layer.brightness);
        ctx.drawImage(filtered, 0, 0);
      } else {
        ctx.drawImage(layer.canvas, 0, 0);
      }

      ctx.restore();
    }

    // Crop center to content canvas (for preview / export)
    this._contentCtx.clearRect(0, 0, CONTENT_SIZE, CONTENT_SIZE);
    this._contentCtx.drawImage(this.outputCanvas, OFFSET, OFFSET, CONTENT_SIZE, CONTENT_SIZE, 0, 0, CONTENT_SIZE, CONTENT_SIZE);

    if (this.onChange) this.onChange();
  }

  _applyHSVFilter(sourceCanvas, hue, sat, val) {
    if (!this._hsvCanvas) {
      this._hsvCanvas = document.createElement('canvas');
      this._hsvCanvas.width = SIZE;
      this._hsvCanvas.height = SIZE;
    }
    const tmpCtx = this._hsvCanvas.getContext('2d');
    tmpCtx.clearRect(0, 0, SIZE, SIZE);
    tmpCtx.drawImage(sourceCanvas, 0, 0);

    const imageData = tmpCtx.getImageData(0, 0, SIZE, SIZE);
    const data = imageData.data;
    const hueShift = hue / 360;
    const satShift = sat / 100;
    const valShift = val / 100;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;

      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

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

      // Apply adjustments
      h = (h + hueShift + 1) % 1;
      s = Math.max(0, Math.min(1, s + satShift));
      v = Math.max(0, Math.min(1, v + valShift));

      // HSV to RGB
      const hi = Math.floor(h * 6);
      const f = h * 6 - hi;
      const p = v * (1 - s);
      const q = v * (1 - f * s);
      const t = v * (1 - (1 - f) * s);

      let rr, gg, bb;
      switch (hi % 6) {
        case 0: rr = v; gg = t; bb = p; break;
        case 1: rr = q; gg = v; bb = p; break;
        case 2: rr = p; gg = v; bb = t; break;
        case 3: rr = p; gg = q; bb = v; break;
        case 4: rr = t; gg = p; bb = v; break;
        case 5: rr = v; gg = p; bb = q; break;
      }

      data[i] = Math.round(rr * 255);
      data[i + 1] = Math.round(gg * 255);
      data[i + 2] = Math.round(bb * 255);
    }

    tmpCtx.putImageData(imageData, 0, 0);
    return this._hsvCanvas;
  }
}
