import { floodFill } from './brush.js';

const SIZE = 512;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2;
const MAX_HISTORY = 40;

export class Painter {
  constructor(canvas, brush, layerSystem) {
    this.canvas = canvas;
    this.brush = brush;
    this.layers = layerSystem;
    this.mirror = false;

    this._painting = false;
    this._lastX = 0;
    this._lastY = 0;

    // Undo/Redo stacks — each entry: { layerIndex, imageData }
    this._undoStack = [];
    this._redoStack = [];

    // Cursor overlay
    this._cursorCanvas = document.getElementById('cursor-overlay');
    this._cursorCtx = this._cursorCanvas.getContext('2d');
    this._cursorX = -1;
    this._cursorY = -1;
    this._cursorVisible = false;

    this._bindEvents();
  }

  // --- History ---

  _saveSnapshot() {
    const idx = this.layers.activeIndex;
    const ctx = this.layers.getActiveCtx();
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
    this._undoStack.push({ layerIndex: idx, imageData });
    if (this._undoStack.length > MAX_HISTORY) this._undoStack.shift();
    this._redoStack.length = 0;
  }

  undo() {
    if (this._undoStack.length === 0) return;
    const entry = this._undoStack.pop();
    const layer = this.layers.layers[entry.layerIndex];
    if (!layer) return;

    // Save current state to redo
    const currentData = layer.ctx.getImageData(0, 0, SIZE, SIZE);
    this._redoStack.push({ layerIndex: entry.layerIndex, imageData: currentData });

    // Restore
    layer.ctx.putImageData(entry.imageData, 0, 0);
    this.layers.composite();
  }

  redo() {
    if (this._redoStack.length === 0) return;
    const entry = this._redoStack.pop();
    const layer = this.layers.layers[entry.layerIndex];
    if (!layer) return;

    // Save current state to undo
    const currentData = layer.ctx.getImageData(0, 0, SIZE, SIZE);
    this._undoStack.push({ layerIndex: entry.layerIndex, imageData: currentData });

    // Restore
    layer.ctx.putImageData(entry.imageData, 0, 0);
    this.layers.composite();
  }

  // --- Events ---

  _bindEvents() {
    this.canvas.addEventListener('pointerdown', (e) => this._onDown(e));
    this.canvas.addEventListener('pointermove', (e) => this._onMove(e));
    this.canvas.addEventListener('pointerup', (e) => this._onUp(e));
    this.canvas.addEventListener('pointerleave', (e) => {
      this._onUp(e);
      this._cursorVisible = false;
      this._drawCursor();
    });
    this.canvas.addEventListener('pointerenter', () => {
      this._cursorVisible = true;
    });
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

    // Save snapshot before any modification
    this._saveSnapshot();

    // Fill tool — single click action, no drag
    if (this.brush.type === 'fill') {
      const ctx = this.layers.getActiveCtx();
      if (!ctx) return;
      floodFill(ctx, x, y, this.brush.color);
      this.layers.composite();
      return;
    }

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
    const { x, y } = this._canvasCoords(e);
    this._cursorX = x;
    this._cursorY = y;
    this._cursorVisible = true;
    this._drawCursor();

    if (!this._painting) return;

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

  _drawCursor() {
    const ctx = this._cursorCtx;
    const canvas = this._cursorCanvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!this._cursorVisible) return;

    const x = this._cursorX;
    const y = this._cursorY;

    if (this.brush.type === 'fill') {
      this._drawFillCursor(ctx, x, y);
      return;
    }

    const r = this.brush.size;

    // Difference mode — auto-contrasts against any background
    ctx.globalCompositeOperation = 'difference';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.2;

    // Main cursor circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Mirror cursor
    if (this.mirror) {
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(2 * CENTER - x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Center dot
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
  }

  _drawFillCursor(ctx, x, y) {
    ctx.globalCompositeOperation = 'difference';
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 1.2;

    // Crosshair
    const s = 7;
    ctx.beginPath();
    ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
    ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
    ctx.stroke();

    // Small fill bucket icon (simplified drop shape)
    const ox = x + 6;
    const oy = y + 6;
    ctx.beginPath();
    ctx.moveTo(ox, oy - 4);
    ctx.quadraticCurveTo(ox + 4, oy, ox, oy + 4);
    ctx.quadraticCurveTo(ox - 4, oy, ox, oy - 4);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
  }

  refreshCursor() {
    this._drawCursor();
  }

  loadImage(img) {
    this._saveSnapshot();
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
