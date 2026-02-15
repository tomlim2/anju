const SPACING_RATIO = 0.25;

export class Brush {
  constructor() {
    this.type = 'brush'; // brush | airbrush | blur | eraser
    this.size = 20;
    this.opacity = 1.0;
    this.hardness = 0.5;
    this.color = '#c0c0c0';

    this._stampCanvas = document.createElement('canvas');
    this._stampCtx = this._stampCanvas.getContext('2d');
    this._dirty = true;
    this._lastType = null;
    this._lastSize = null;
    this._lastColor = null;
    this._lastHardness = null;
    this._lastOpacity = null;
  }

  _needsRebuild() {
    return (
      this._dirty ||
      this._lastType !== this.type ||
      this._lastSize !== this.size ||
      this._lastColor !== this.color ||
      this._lastHardness !== this.hardness ||
      this._lastOpacity !== this.opacity
    );
  }

  _buildStamp() {
    if (!this._needsRebuild()) return;

    const s = Math.ceil(this.size);
    const d = s * 2;
    this._stampCanvas.width = d;
    this._stampCanvas.height = d;
    const ctx = this._stampCtx;
    ctx.clearRect(0, 0, d, d);

    if (this.type === 'blur') {
      // Blur stamp: just a circle mask
      ctx.beginPath();
      ctx.arc(s, s, s, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
    } else {
      // Soft brush / airbrush / eraser stamp
      const r = s;
      const innerR = r * this.hardness;
      const gradient = ctx.createRadialGradient(s, s, innerR, s, s, r);

      let alpha = this.type === 'airbrush' ? 0.08 : 1.0;
      const rgb = hexToRgb(this.color);
      const c = this.type === 'eraser' ? '0,0,0' : `${rgb.r},${rgb.g},${rgb.b}`;

      gradient.addColorStop(0, `rgba(${c},${alpha})`);
      gradient.addColorStop(1, `rgba(${c},0)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, d, d);
    }

    this._dirty = false;
    this._lastType = this.type;
    this._lastSize = this.size;
    this._lastColor = this.color;
    this._lastHardness = this.hardness;
    this._lastOpacity = this.opacity;
  }

  stamp(ctx, x, y) {
    if (this.type === 'blur') {
      this._blurAt(ctx, x, y);
      return;
    }

    this._buildStamp();
    const s = Math.ceil(this.size);

    ctx.save();
    if (this.type === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = this.opacity;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = this.opacity;
    }
    ctx.drawImage(this._stampCanvas, x - s, y - s);
    ctx.restore();
  }

  strokeInterpolated(ctx, x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = Math.max(1, this.size * SPACING_RATIO);
    const count = Math.ceil(dist / step);

    for (let i = 0; i <= count; i++) {
      const t = count === 0 ? 0 : i / count;
      this.stamp(ctx, x0 + dx * t, y0 + dy * t);
    }
  }

  _blurAt(ctx, x, y) {
    const r = Math.min(Math.ceil(this.size), 50);
    const d = r * 2;
    const sx = Math.max(0, Math.floor(x - r));
    const sy = Math.max(0, Math.floor(y - r));
    const w = Math.min(d, ctx.canvas.width - sx);
    const h = Math.min(d, ctx.canvas.height - sy);
    if (w <= 0 || h <= 0) return;

    const imageData = ctx.getImageData(sx, sy, w, h);
    boxBlur(imageData, 3);
    // Apply within circle mask
    const cx = x - sx;
    const cy = y - sy;
    const origData = ctx.getImageData(sx, sy, w, h);
    const strength = this.opacity;

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const dx = px - cx;
        const dy = py - cy;
        const distSq = dx * dx + dy * dy;
        if (distSq > r * r) continue;

        const falloff = 1 - Math.sqrt(distSq) / r;
        const blend = falloff * strength;
        const i = (py * w + px) * 4;
        for (let c = 0; c < 4; c++) {
          origData.data[i + c] = Math.round(
            origData.data[i + c] * (1 - blend) + imageData.data[i + c] * blend
          );
        }
      }
    }
    ctx.putImageData(origData, sx, sy);
  }
}

export function floodFill(ctx, startX, startY, fillColor, tolerance = 32) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const rgb = hexToRgb(fillColor);

  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (sx < 0 || sx >= w || sy < 0 || sy >= h) return;

  const startIdx = (sy * w + sx) * 4;
  const sr = data[startIdx], sg = data[startIdx + 1], sb = data[startIdx + 2], sa = data[startIdx + 3];

  // Don't fill if target color is same as fill color
  if (sr === rgb.r && sg === rgb.g && sb === rgb.b && sa === 255) return;

  const visited = new Uint8Array(w * h);
  const stack = [sx, sy];

  function matches(i) {
    const dr = data[i] - sr;
    const dg = data[i + 1] - sg;
    const db = data[i + 2] - sb;
    const da = data[i + 3] - sa;
    return dr * dr + dg * dg + db * db + da * da <= tolerance * tolerance * 4;
  }

  while (stack.length > 0) {
    const y = stack.pop();
    const x = stack.pop();
    const pos = y * w + x;
    if (x < 0 || x >= w || y < 0 || y >= h) continue;
    if (visited[pos]) continue;
    const idx = pos * 4;
    if (!matches(idx)) continue;

    visited[pos] = 1;
    data[idx] = rgb.r;
    data[idx + 1] = rgb.g;
    data[idx + 2] = rgb.b;
    data[idx + 3] = 255;

    stack.push(x - 1, y, x + 1, y, x, y - 1, x, y + 1);
  }

  ctx.putImageData(imageData, 0, 0);
}

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff };
}

function boxBlur(imageData, passes) {
  const { data, width, height } = imageData;
  const temp = new Uint8ClampedArray(data.length);

  for (let pass = 0; pass < passes; pass++) {
    // Horizontal
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const i = (y * width + nx) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3];
          count++;
        }
        const i = (y * width + x) * 4;
        temp[i] = r / count; temp[i + 1] = g / count;
        temp[i + 2] = b / count; temp[i + 3] = a / count;
      }
    }
    data.set(temp);

    // Vertical
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          const i = (ny * width + x) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3];
          count++;
        }
        const i = (y * width + x) * 4;
        temp[i] = r / count; temp[i + 1] = g / count;
        temp[i + 2] = b / count; temp[i + 3] = a / count;
      }
    }
    data.set(temp);
  }
}
