import { floodFill } from './brush.js';

const SIZE = 1024;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2;
const MAX_HISTORY = 40;

// Cursor drawing constants (screen-space CSS pixels)
const CURSOR_OUTER_WIDTH = 2.4;
const CURSOR_DOT_RADIUS = 2;
const CROSSHAIR_SIZE = 7;
const DROP_ICON_OFFSET = 6;
const DROP_ICON_SIZE_OUTER = 4;
const DROP_ICON_SIZE_INNER = 3;

export class Painter {
  constructor(canvas, brush, layerSystem) {
    this.canvas = canvas;
    this.brush = brush;
    this.layers = layerSystem;
    this.mirrorX = false;
    this.mirrorY = false;
    this.panMode = false;
    this.onColorPick = null; // callback(hexColor) when eyedropper picks

    this._painting = false;
    this._lastX = 0;
    this._lastY = 0;

    // Undo/Redo stacks — each entry: { layerIndex, imageData }
    this._undoStack = [];
    this._redoStack = [];

    // Cursor overlay — lives in canvas-area (screen space, unaffected by zoom/pan)
    this._cursorCanvas = document.getElementById('cursor-overlay');
    this._cursorArea = this._cursorCanvas.parentElement;
    this._dpr = window.devicePixelRatio || 1;
    this._cursorCtx = this._cursorCanvas.getContext('2d');
    this._cursorX = -1;
    this._cursorY = -1;
    this._cursorVisible = false;
    this._resizeCursorCanvas();

    this._resizeObserver = new ResizeObserver(() => this._resizeCursorCanvas());
    this._resizeObserver.observe(this._cursorArea);

    this._ac = new AbortController();
    this._bindEvents();
  }

  destroy() {
    this._ac.abort();
    this._resizeObserver.disconnect();
  }

  // --- Cursor canvas sizing ---

  _resizeCursorCanvas() {
    const w = this._cursorArea.clientWidth;
    const h = this._cursorArea.clientHeight;
    this._cursorCanvas.width = w * this._dpr;
    this._cursorCanvas.height = h * this._dpr;
    this._cursorCtx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
  }

  // Canvas coord (0–1024) → screen coord relative to cursor overlay
  _toScreen(cx, cy) {
    const canvasRect = this.canvas.getBoundingClientRect();
    const areaRect = this._cursorArea.getBoundingClientRect();
    return {
      x: canvasRect.left - areaRect.left + (cx / SIZE) * canvasRect.width,
      y: canvasRect.top - areaRect.top + (cy / SIZE) * canvasRect.height,
    };
  }

  // Canvas pixels → screen pixels ratio (for brush radius)
  _screenScale() {
    const canvasRect = this.canvas.getBoundingClientRect();
    return canvasRect.width / SIZE;
  }

  // --- History ---

  saveSnapshot() { this._saveSnapshot(); }

  _saveSnapshot() {
    const layerIndex = this.layers.activeIndex;
    const ctx = this.layers.getActiveCtx();
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
    this._undoStack.push({ layerIndex, imageData });
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
    const listenerOptions = { signal: this._ac.signal };
    this.canvas.addEventListener('pointerdown', (event) => this._onDown(event), listenerOptions);
    this.canvas.addEventListener('pointermove', (event) => this._onMove(event), listenerOptions);
    this.canvas.addEventListener('pointerup', () => this._onUp(), listenerOptions);
    this.canvas.addEventListener('pointerleave', () => {
      this._onUp();
      this._cursorVisible = false;
      this._drawCursor();
    }, listenerOptions);
    this.canvas.addEventListener('pointerenter', () => {
      this._cursorVisible = true;
    }, listenerOptions);
  }

  _canvasCoords(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = SIZE / rect.width;
    const scaleY = SIZE / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  _inCircle(x, y) {
    const deltaX = x - CENTER;
    const deltaY = y - CENTER;
    return deltaX * deltaX + deltaY * deltaY <= RADIUS * RADIUS;
  }

  _onDown(event) {
    if (this.panMode) return;
    const { x, y } = this._canvasCoords(event);

    // Save snapshot before any modification
    this._saveSnapshot();

    // Eyedropper — sample color from composited output, no modification
    if (this.brush.type === 'eyedropper') {
      const px = Math.floor(x);
      const py = Math.floor(y);
      if (px < 0 || px >= SIZE || py < 0 || py >= SIZE) return;
      const data = this.layers.outputCtx.getImageData(px, py, 1, 1).data;
      const hex = '#' + ((1 << 24) | (data[0] << 16) | (data[1] << 8) | data[2]).toString(16).slice(1);
      this.brush.color = hex;
      if (this.onColorPick) this.onColorPick(hex);
      this._undoStack.pop(); // remove snapshot — no modification was made
      return;
    }

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
    this.canvas.setPointerCapture(event.pointerId);

    const ctx = this.layers.getActiveCtx();
    if (!ctx) return;

    this.brush.stamp(ctx, x, y);
    this._mirrorStamp(ctx, x, y);
    this.layers.composite();
  }

  _onMove(event) {
    const { x, y } = this._canvasCoords(event);
    this._cursorX = x;
    this._cursorY = y;
    this._cursorVisible = true;
    this._drawCursor();

    if (!this._painting) return;

    const ctx = this.layers.getActiveCtx();
    if (!ctx) return;

    this.brush.strokeInterpolated(ctx, this._lastX, this._lastY, x, y);
    this._mirrorStroke(ctx, this._lastX, this._lastY, x, y);

    this._lastX = x;
    this._lastY = y;
    this.layers.composite();
  }

  _onUp() {
    if (!this._painting) return;
    this._painting = false;
    this.layers.composite();
  }

  // --- Cursor drawing (screen space — all dimensions in CSS pixels) ---

  _drawCursor() {
    const ctx = this._cursorCtx;
    const width = this._cursorArea.clientWidth;
    const height = this._cursorArea.clientHeight;
    ctx.clearRect(0, 0, width, height);

    if (!this._cursorVisible || this.panMode) return;

    const { x, y } = this._toScreen(this._cursorX, this._cursorY);
    const scale = this._screenScale();

    if (this.brush.type === 'fill' || this.brush.type === 'eyedropper') {
      this._drawFillCursor(ctx, x, y);
      return;
    }

    const brushRadius = this.brush.size * scale;

    // Double-stroke cursor: dark outline + light inner for visibility on any background
    ctx.globalCompositeOperation = 'source-over';

    // Outer dark ring
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = CURSOR_OUTER_WIDTH;
    ctx.beginPath();
    ctx.arc(x, y, brushRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner light ring
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, brushRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Mirror cursors
    for (const [mx, my] of this._mirrorPoints(this._cursorX, this._cursorY)) {
      const { x: sx, y: sy } = this._toScreen(mx, my);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, brushRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(sx, sy, brushRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Center dot
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(x, y, CURSOR_DOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x, y, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawFillCursor(ctx, x, y) {
    ctx.globalCompositeOperation = 'source-over';
    const crosshairSize = CROSSHAIR_SIZE;

    // Dark outline
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x - crosshairSize, y); ctx.lineTo(x + crosshairSize, y);
    ctx.moveTo(x, y - crosshairSize); ctx.lineTo(x, y + crosshairSize);
    ctx.stroke();

    // Light inner
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - crosshairSize, y); ctx.lineTo(x + crosshairSize, y);
    ctx.moveTo(x, y - crosshairSize); ctx.lineTo(x, y + crosshairSize);
    ctx.stroke();

    // Drop icon
    const dropOffsetX = x + DROP_ICON_OFFSET;
    const dropOffsetY = y + DROP_ICON_OFFSET;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.moveTo(dropOffsetX, dropOffsetY - DROP_ICON_SIZE_OUTER);
    ctx.quadraticCurveTo(dropOffsetX + DROP_ICON_SIZE_OUTER, dropOffsetY, dropOffsetX, dropOffsetY + DROP_ICON_SIZE_OUTER);
    ctx.quadraticCurveTo(dropOffsetX - DROP_ICON_SIZE_OUTER, dropOffsetY, dropOffsetX, dropOffsetY - DROP_ICON_SIZE_OUTER);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(dropOffsetX, dropOffsetY - DROP_ICON_SIZE_INNER);
    ctx.quadraticCurveTo(dropOffsetX + DROP_ICON_SIZE_INNER, dropOffsetY, dropOffsetX, dropOffsetY + DROP_ICON_SIZE_INNER);
    ctx.quadraticCurveTo(dropOffsetX - DROP_ICON_SIZE_INNER, dropOffsetY, dropOffsetX, dropOffsetY - DROP_ICON_SIZE_INNER);
    ctx.fill();
  }

  _mirrorPoints(x, y) {
    const points = [];
    if (this.mirrorX) points.push([2 * CENTER - x, y]);
    if (this.mirrorY) points.push([x, 2 * CENTER - y]);
    if (this.mirrorX && this.mirrorY) points.push([2 * CENTER - x, 2 * CENTER - y]);
    return points;
  }

  _mirrorStamp(ctx, x, y) {
    for (const [mirroredX, mirroredY] of this._mirrorPoints(x, y)) {
      this.brush.stamp(ctx, mirroredX, mirroredY);
    }
  }

  _mirrorStroke(ctx, x0, y0, x1, y1) {
    for (const [, , flipX, flipY] of this._mirrorAxes()) {
      this.brush.strokeInterpolated(
        ctx,
        flipX ? 2 * CENTER - x0 : x0,
        flipY ? 2 * CENTER - y0 : y0,
        flipX ? 2 * CENTER - x1 : x1,
        flipY ? 2 * CENTER - y1 : y1,
      );
    }
  }

  _mirrorAxes() {
    const axes = [];
    if (this.mirrorX) axes.push([0, 0, true, false]);
    if (this.mirrorY) axes.push([0, 0, false, true]);
    if (this.mirrorX && this.mirrorY) axes.push([0, 0, true, true]);
    return axes;
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

  loadImageToLayer(img, layerIndex) {
    const layer = this.layers.layers[layerIndex];
    if (!layer) return;
    const imageData = layer.ctx.getImageData(0, 0, SIZE, SIZE);
    this._undoStack.push({ layerIndex, imageData });
    if (this._undoStack.length > MAX_HISTORY) this._undoStack.shift();
    this._redoStack.length = 0;
    layer.ctx.clearRect(0, 0, SIZE, SIZE);
    layer.ctx.drawImage(img, 0, 0, SIZE, SIZE);
    this.layers.composite();
  }

  exportPNG() {
    return this.layers.outputCanvas.toDataURL('image/png');
  }
}
