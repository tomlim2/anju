const SIZE = 1024;
const HALF = SIZE / 2;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function lerp(a, b, t) { return a + (b - a) * t; }

function normalize(v) {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 1];
}

export class ToonGenerator {
  constructor(canvas) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._onChange = null;

    // Gradient mode: 'step' (hard bands) or 'linear' (smooth interpolation)
    this.gradientMode = 'step';

    // Gradient stops (bright → mid → dark, low position = bright)
    this.stops = [
      { position: 8, color: '#b0b0b0' },
      { position: 16, color: '#4f4f4f' },
      { position: 35, color: '#0a0a0a' },
      { position: 67, color: '#05f6fa' },
    ];

    // Specular
    this.specEnabled = true;
    this.specColor = '#dedede';
    this.specPower = 16;
    this.specThreshold = 0.85;

    // Outline
    this.outlineEnabled = true;
    this.outlineColor = '#000000';
    this.outlineWidth = 0.021;

    // Light direction
    this.lightDir = normalize([-0.34, 0.54, 0.77]);

    // Post Process
    this.postProcess = 'none'; // 'none', 'blur', 'pixelize'
    this.postProcessStrength = 4;

    // FOV (0 = orthographic, >0 = perspective)
    this.fov = 0;

    // Undo/redo history
    this._history = [JSON.stringify(this.toJSON())];
    this._historyIndex = 0;
  }

  set onChange(fn) { this._onChange = fn; }

  saveState() {
    const json = JSON.stringify(this.toJSON());
    // Skip if identical to current state
    if (json === this._history[this._historyIndex]) return;
    // Truncate future states
    this._history.splice(this._historyIndex + 1);
    this._history.push(json);
    if (this._history.length > 100) this._history.shift();
    this._historyIndex = this._history.length - 1;
  }

  undo() {
    if (this._historyIndex <= 0) return false;
    this._historyIndex--;
    this.fromJSON(JSON.parse(this._history[this._historyIndex]));
    return true;
  }

  redo() {
    if (this._historyIndex >= this._history.length - 1) return false;
    this._historyIndex++;
    this.fromJSON(JSON.parse(this._history[this._historyIndex]));
    return true;
  }

  get canUndo() { return this._historyIndex > 0; }
  get canRedo() { return this._historyIndex < this._history.length - 1; }

  toJSON() {
    return {
      gradientMode: this.gradientMode,
      stops: this.stops.map(s => ({ position: s.position, color: s.color })),
      outlineEnabled: this.outlineEnabled, outlineColor: this.outlineColor, outlineWidth: this.outlineWidth,
      specEnabled: this.specEnabled, specColor: this.specColor, specPower: this.specPower, specThreshold: this.specThreshold,
      postProcess: this.postProcess, postProcessStrength: this.postProcessStrength,
      fov: this.fov,
      lightDir: this.lightDir.map(v => Math.round(v * 100)),
    };
  }

  fromJSON(data) {
    if (!data) return false;
    if (data.gradientMode) this.gradientMode = data.gradientMode;
    if (Array.isArray(data.stops) && data.stops.length >= 2) this.stops = data.stops;
    if (data.outlineEnabled !== undefined) this.outlineEnabled = data.outlineEnabled;
    if (data.outlineColor) this.outlineColor = data.outlineColor;
    if (data.outlineWidth !== undefined) this.outlineWidth = data.outlineWidth;
    if (data.specEnabled !== undefined) this.specEnabled = data.specEnabled;
    if (data.specColor) this.specColor = data.specColor;
    if (data.specPower !== undefined) this.specPower = data.specPower;
    if (data.specThreshold !== undefined) this.specThreshold = data.specThreshold;
    if (data.postProcess) this.postProcess = data.postProcess;
    if (data.postProcessStrength !== undefined) this.postProcessStrength = data.postProcessStrength;
    if (data.fov !== undefined) this.fov = data.fov;
    if (Array.isArray(data.lightDir) && data.lightDir.length === 3) {
      const [x, y, z] = data.lightDir.map(v => v / 100);
      const len = Math.sqrt(x * x + y * y + z * z);
      this.lightDir = len > 0 ? [x / len, y / len, z / len] : [0, 0, 1];
    }
    return true;
  }

  render() {
    const imageData = this._ctx.createImageData(SIZE, SIZE);
    const data = imageData.data;

    const lightDir = this.lightDir;
    const isLinear = this.gradientMode === 'linear';
    // For step: sorted descending (highest position first)
    // For linear: sorted ascending (lowest position first) for lerp between neighbors
    const sortedStops = [...this.stops].sort((a, b) => b.position - a.position);
    const stopColors = sortedStops.map(s => hexToRgb(s.color));
    const stopPositions = sortedStops.map(s => s.position / 100);
    // Ascending for linear interpolation
    const ascStops = [...this.stops].sort((a, b) => a.position - b.position);
    const ascColors = ascStops.map(s => hexToRgb(s.color));
    const ascPositions = ascStops.map(s => s.position / 100);

    const specRgb = hexToRgb(this.specColor);
    const outlineRgb = hexToRgb(this.outlineColor);

    // Perspective setup
    const usePerspective = this.fov > 0;
    let camDist = 0, sScale = 1;
    if (usePerspective) {
      camDist = 1 / Math.tan(this.fov * Math.PI / 360);
      sScale = camDist > 1.001 ? camDist / Math.sqrt(camDist * camDist - 1) : 20;
    }

    for (let py = 0; py < SIZE; py++) {
      const screenY = (HALF - py) / HALF;
      for (let px = 0; px < SIZE; px++) {
        const screenX = (px - HALF) / HALF;
        const r2 = screenX * screenX + screenY * screenY;
        const idx = (py * SIZE + px) * 4;

        if (r2 > 1) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 0;
          continue;
        }

        const dist = Math.sqrt(r2);

        let nx, ny, nz;
        if (usePerspective) {
          // Ray-sphere intersection: camera at (0,0,camDist), ray toward (sx,sy,0)
          const sx = screenX * sScale;
          const sy = screenY * sScale;
          const a = sx * sx + sy * sy + camDist * camDist;
          const sqrtDisc = camDist * Math.sqrt(1 - r2);
          const t = (camDist * camDist - sqrtDisc) / a;
          nx = t * sx;
          ny = t * sy;
          nz = camDist * (1 - t);
        } else {
          nx = screenX;
          ny = screenY;
          nz = Math.sqrt(1 - r2);
        }

        // Outline (screen-space edge)
        if (this.outlineEnabled && dist > 1 - this.outlineWidth) {
          data[idx] = outlineRgb[0];
          data[idx + 1] = outlineRgb[1];
          data[idx + 2] = outlineRgb[2];
          data[idx + 3] = 255;
          continue;
        }

        // NdotL for toon bands
        const ndotl = nx * lightDir[0] + ny * lightDir[1] + nz * lightDir[2];
        const t = (1 - ndotl) * 0.5; // remap: bright(NdotL=1)→0, dark(NdotL=-1)→1

        // Find color from gradient
        let r, g, b;

        if (isLinear) {
          // Linear: interpolate between adjacent stops (ascending order)
          if (t <= ascPositions[0]) {
            r = ascColors[0][0]; g = ascColors[0][1]; b = ascColors[0][2];
          } else if (t >= ascPositions[ascPositions.length - 1]) {
            const last = ascColors[ascPositions.length - 1];
            r = last[0]; g = last[1]; b = last[2];
          } else {
            for (let i = 0; i < ascPositions.length - 1; i++) {
              if (t >= ascPositions[i] && t <= ascPositions[i + 1]) {
                const segT = (t - ascPositions[i]) / (ascPositions[i + 1] - ascPositions[i]);
                r = Math.round(lerp(ascColors[i][0], ascColors[i + 1][0], segT));
                g = Math.round(lerp(ascColors[i][1], ascColors[i + 1][1], segT));
                b = Math.round(lerp(ascColors[i][2], ascColors[i + 1][2], segT));
                break;
              }
            }
          }
        } else {
          // Step: hard band transitions (descending order)
          r = stopColors[stopColors.length - 1][0];
          g = stopColors[stopColors.length - 1][1];
          b = stopColors[stopColors.length - 1][2];
          for (let i = 0; i < sortedStops.length; i++) {
            if (t >= stopPositions[i]) {
              r = stopColors[i][0]; g = stopColors[i][1]; b = stopColors[i][2];
              break;
            }
          }
        }

        // Specular (hard circle)
        if (this.specEnabled) {
          const rx = 2 * nx * ndotl - lightDir[0];
          const ry = 2 * ny * ndotl - lightDir[1];
          const rz = 2 * nz * ndotl - lightDir[2];
          const rdotv = Math.max(0, rz);
          const spec = Math.pow(rdotv, this.specPower);
          if (spec > this.specThreshold) {
            r = specRgb[0]; g = specRgb[1]; b = specRgb[2];
          }
        }

        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    this._ctx.putImageData(imageData, 0, 0);
    this._applyPostProcess();
    if (this._onChange) this._onChange();
  }

  _applyPostProcess() {
    if (this.postProcess === 'none') return;

    const canvas = this._canvas;
    const ctx = this._ctx;

    if (!this._tempCanvas) {
      this._tempCanvas = document.createElement('canvas');
    }
    const temp = this._tempCanvas;

    if (this.postProcess === 'blur') {
      temp.width = SIZE;
      temp.height = SIZE;
      const tctx = temp.getContext('2d');
      tctx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.filter = `blur(${this.postProcessStrength}px)`;
      ctx.drawImage(temp, 0, 0);
      ctx.filter = 'none';
    }

    if (this.postProcess === 'pixelize') {
      const pixelSize = Math.max(2, this.postProcessStrength);
      const smallW = Math.ceil(SIZE / pixelSize);
      const smallH = Math.ceil(SIZE / pixelSize);
      temp.width = smallW;
      temp.height = smallH;
      const tctx = temp.getContext('2d');
      tctx.imageSmoothingEnabled = true;
      tctx.drawImage(canvas, 0, 0, smallW, smallH);
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(temp, 0, 0, SIZE, SIZE);
      ctx.imageSmoothingEnabled = true;
    }

    if (this.postProcess === 'glitch') {
      const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
      const src = new Uint8ClampedArray(imageData.data);
      const dst = imageData.data;
      const strength = this.postProcessStrength;
      const sliceCount = 3 + strength * 2;
      const maxShift = Math.round(strength * 8);

      // Seed-free deterministic hash from strength for consistent look
      let seed = (strength * 9973 + 7) | 0;
      const rand = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed & 0x7fffffff) / 2147483647; };

      // RGB channel shift
      const rShift = Math.round((rand() - 0.5) * maxShift);
      const gShift = Math.round((rand() - 0.5) * maxShift);
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const i = (y * SIZE + x) * 4;
          const rx = Math.min(SIZE - 1, Math.max(0, x + rShift));
          const gx = Math.min(SIZE - 1, Math.max(0, x + gShift));
          dst[i]     = src[(y * SIZE + rx) * 4];
          dst[i + 1] = src[(y * SIZE + gx) * 4 + 1];
          // blue and alpha stay
        }
      }

      // Horizontal slice displacement
      for (let s = 0; s < sliceCount; s++) {
        const y0 = Math.floor(rand() * SIZE);
        const h = Math.floor(rand() * (8 + strength * 4)) + 2;
        const shift = Math.round((rand() - 0.5) * maxShift * 2);
        for (let y = y0; y < Math.min(SIZE, y0 + h); y++) {
          for (let x = 0; x < SIZE; x++) {
            const sx = Math.min(SIZE - 1, Math.max(0, x + shift));
            const di = (y * SIZE + x) * 4;
            const si = (y * SIZE + sx) * 4;
            dst[di]     = dst[si] || 0;
            dst[di + 1] = dst[si + 1] || 0;
            dst[di + 2] = dst[si + 2] || 0;
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }
  }
}
