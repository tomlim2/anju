const MAX_LAYERS = 8;
const SIZE = 512;

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

  composite() {
    const ctx = this.outputCtx;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Draw bottom-to-top
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (!layer.visible || layer.opacity <= 0) continue;

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;
      ctx.drawImage(layer.canvas, 0, 0);
      ctx.restore();
    }

    if (this.onChange) this.onChange();
  }
}
