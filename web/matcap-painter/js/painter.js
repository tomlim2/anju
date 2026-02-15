const SIZE = 512;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2;

export class Painter {
  constructor(canvas, brush, layerSystem) {
    this.canvas = canvas;
    this.brush = brush;
    this.layers = layerSystem;
    this.mirror = false;

    this._painting = false;
    this._lastX = 0;
    this._lastY = 0;

    // Display canvas (shown to user) — the output canvas from layers
    this._displayCanvas = canvas;
    this._displayCtx = canvas.getContext('2d');

    this._bindEvents();
    this._drawGuide();
  }

  _bindEvents() {
    this.canvas.addEventListener('pointerdown', (e) => this._onDown(e));
    this.canvas.addEventListener('pointermove', (e) => this._onMove(e));
    this.canvas.addEventListener('pointerup', (e) => this._onUp(e));
    this.canvas.addEventListener('pointerleave', (e) => this._onUp(e));
  }

  _canvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = SIZE / rect.width;
    const scaleY = SIZE / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  _inCircle(x, y) {
    const dx = x - CENTER;
    const dy = y - CENTER;
    return dx * dx + dy * dy <= RADIUS * RADIUS;
  }

  _onDown(e) {
    const { x, y } = this._canvasCoords(e);
    if (!this._inCircle(x, y)) return;

    this._painting = true;
    this._lastX = x;
    this._lastY = y;
    this.canvas.setPointerCapture(e.pointerId);

    const ctx = this.layers.getActiveCtx();
    if (!ctx) return;

    this.brush.stamp(ctx, x, y);
    if (this.mirror) {
      this.brush.stamp(ctx, 2 * CENTER - x, y);
    }
    this.layers.composite();
  }

  _onMove(e) {
    if (!this._painting) return;
    const { x, y } = this._canvasCoords(e);

    const ctx = this.layers.getActiveCtx();
    if (!ctx) return;

    this.brush.strokeInterpolated(ctx, this._lastX, this._lastY, x, y);
    if (this.mirror) {
      this.brush.strokeInterpolated(
        ctx,
        2 * CENTER - this._lastX, this._lastY,
        2 * CENTER - x, y
      );
    }

    this._lastX = x;
    this._lastY = y;
    this.layers.composite();
  }

  _onUp(e) {
    if (!this._painting) return;
    this._painting = false;
  }

  _drawGuide() {
    // Draw a subtle circle guide on the output canvas once
    // This is handled by CSS border-radius instead
  }

  loadImage(img) {
    // Load an image onto the active layer
    const ctx = this.layers.getActiveCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    this.layers.composite();
  }

  exportPNG() {
    return this.layers.outputCanvas.toDataURL('image/png');
  }
}
