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
      { position: 20, color: '#ffffff' },
      { position: 50, color: '#888888' },
      { position: 80, color: '#222222' },
    ];

    // Rim light
    this.rimEnabled = false;
    this.rimColor = '#aaccff';
    this.rimPower = 3.0;
    this.rimThreshold = 0.5;

    // Specular
    this.specEnabled = false;
    this.specColor = '#ffffff';
    this.specPower = 16;
    this.specThreshold = 0.85;

    // Outline
    this.outlineEnabled = true;
    this.outlineColor = '#000000';
    this.outlineWidth = 0.03;

    // Light direction
    this.lightDir = normalize([-0.6, 0.5, 0.8]);
  }

  set onChange(fn) { this._onChange = fn; }

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

    const rimRgb = hexToRgb(this.rimColor);
    const specRgb = hexToRgb(this.specColor);
    const outlineRgb = hexToRgb(this.outlineColor);

    for (let py = 0; py < SIZE; py++) {
      const ny = (HALF - py) / HALF;
      for (let px = 0; px < SIZE; px++) {
        const nx = (px - HALF) / HALF;
        const r2 = nx * nx + ny * ny;
        const idx = (py * SIZE + px) * 4;

        if (r2 > 1) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 0;
          continue;
        }

        const dist = Math.sqrt(r2);
        const nz = Math.sqrt(1 - r2);

        // Outline
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

        // Rim light
        if (this.rimEnabled) {
          const fresnel = Math.pow(1 - nz, this.rimPower);
          if (fresnel > this.rimThreshold) {
            const rimT = Math.min(1, (fresnel - this.rimThreshold) / (1 - this.rimThreshold));
            r = Math.round(lerp(r, rimRgb[0], rimT));
            g = Math.round(lerp(g, rimRgb[1], rimT));
            b = Math.round(lerp(b, rimRgb[2], rimT));
          }
        }

        // Specular
        if (this.specEnabled) {
          // reflect = 2 * N * (N.L) - L
          const rx = 2 * nx * ndotl - lightDir[0];
          const ry = 2 * ny * ndotl - lightDir[1];
          const rz = 2 * nz * ndotl - lightDir[2];
          // view direction = (0, 0, 1)
          const rdotv = Math.max(0, rz);
          const spec = Math.pow(rdotv, this.specPower);
          if (spec > this.specThreshold) {
            const specT = Math.min(1, (spec - this.specThreshold) / (1 - this.specThreshold));
            r = Math.round(lerp(r, specRgb[0], specT));
            g = Math.round(lerp(g, specRgb[1], specT));
            b = Math.round(lerp(b, specRgb[2], specT));
          }
        }

        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    this._ctx.putImageData(imageData, 0, 0);
    if (this._onChange) this._onChange();
  }
}
