const SPACING_RATIO = 0.25;

export class Brush {
  constructor() {
    this.type = 'brush'; // brush | airbrush | blur | eraser
    this.size = 512;
    this.opacity = 1.0;
    this.hardness = 0.5;
    this.color = '#000000';

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

    const radius = Math.ceil(this.size);
    const diameter = radius * 2;
    this._stampCanvas.width = diameter;
    this._stampCanvas.height = diameter;
    const ctx = this._stampCtx;
    ctx.clearRect(0, 0, diameter, diameter);

    if (this.type === 'blur') {
      // Blur stamp: just a circle mask
      ctx.beginPath();
      ctx.arc(radius, radius, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
    } else {
      // Soft brush / airbrush / eraser stamp
      const innerRadius = radius * this.hardness;
      const gradient = ctx.createRadialGradient(radius, radius, innerRadius, radius, radius, radius);

      let alpha = this.type === 'airbrush' ? 0.08 : 1.0;
      const rgb = hexToRgb(this.color);
      const colorChannels = this.type === 'eraser' ? '0,0,0' : `${rgb.r},${rgb.g},${rgb.b}`;

      gradient.addColorStop(0, `rgba(${colorChannels},${alpha})`);
      gradient.addColorStop(1, `rgba(${colorChannels},0)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, diameter, diameter);
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
    const radius = Math.ceil(this.size);

    ctx.save();
    if (this.type === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = this.opacity;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = this.opacity;
    }
    ctx.drawImage(this._stampCanvas, x - radius, y - radius);
    ctx.restore();
  }

  strokeInterpolated(ctx, x0, y0, x1, y1) {
    const deltaX = x1 - x0;
    const deltaY = y1 - y0;
    const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const step = Math.max(1, this.size * SPACING_RATIO);
    const count = Math.ceil(dist / step);

    for (let stepIndex = 0; stepIndex <= count; stepIndex++) {
      const progress = count === 0 ? 0 : stepIndex / count;
      this.stamp(ctx, x0 + deltaX * progress, y0 + deltaY * progress);
    }
  }

  _blurAt(ctx, x, y) {
    const blurRadius = Math.min(Math.ceil(this.size), 50);
    const blurDiameter = blurRadius * 2;
    const sourceX = Math.max(0, Math.floor(x - blurRadius));
    const sourceY = Math.max(0, Math.floor(y - blurRadius));
    const regionWidth = Math.min(blurDiameter, ctx.canvas.width - sourceX);
    const regionHeight = Math.min(blurDiameter, ctx.canvas.height - sourceY);
    if (regionWidth <= 0 || regionHeight <= 0) return;

    const imageData = ctx.getImageData(sourceX, sourceY, regionWidth, regionHeight);
    boxBlur(imageData, 3);
    // Apply within circle mask
    const centerX = x - sourceX;
    const centerY = y - sourceY;
    const origData = ctx.getImageData(sourceX, sourceY, regionWidth, regionHeight);
    const strength = this.opacity;

    for (let pixelY = 0; pixelY < regionHeight; pixelY++) {
      for (let pixelX = 0; pixelX < regionWidth; pixelX++) {
        const deltaX = pixelX - centerX;
        const deltaY = pixelY - centerY;
        const distSq = deltaX * deltaX + deltaY * deltaY;
        if (distSq > blurRadius * blurRadius) continue;

        const falloff = 1 - Math.sqrt(distSq) / blurRadius;
        const blend = falloff * strength;
        const pixelOffset = (pixelY * regionWidth + pixelX) * 4;
        for (let channelIndex = 0; channelIndex < 4; channelIndex++) {
          origData.data[pixelOffset + channelIndex] = Math.round(
            origData.data[pixelOffset + channelIndex] * (1 - blend) + imageData.data[pixelOffset + channelIndex] * blend
          );
        }
      }
    }
    ctx.putImageData(origData, sourceX, sourceY);
  }
}

export function floodFill(ctx, startX, startY, fillColor, tolerance = 32) {
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const data = imageData.data;
  const rgb = hexToRgb(fillColor);

  const startPixelX = Math.floor(startX);
  const startPixelY = Math.floor(startY);
  if (startPixelX < 0 || startPixelX >= canvasWidth || startPixelY < 0 || startPixelY >= canvasHeight) return;

  const startOffset = (startPixelY * canvasWidth + startPixelX) * 4;
  const startRed = data[startOffset], startGreen = data[startOffset + 1], startBlue = data[startOffset + 2], startAlpha = data[startOffset + 3];

  // Don't fill if target color is same as fill color
  if (startRed === rgb.r && startGreen === rgb.g && startBlue === rgb.b && startAlpha === 255) return;

  const visited = new Uint8Array(canvasWidth * canvasHeight);
  const stack = [startPixelX, startPixelY];

  function matches(offset) {
    const deltaRed = data[offset] - startRed;
    const deltaGreen = data[offset + 1] - startGreen;
    const deltaBlue = data[offset + 2] - startBlue;
    const deltaAlpha = data[offset + 3] - startAlpha;
    return deltaRed * deltaRed + deltaGreen * deltaGreen + deltaBlue * deltaBlue + deltaAlpha * deltaAlpha <= tolerance * tolerance * 4;
  }

  while (stack.length > 0) {
    const currentY = stack.pop();
    const currentX = stack.pop();
    const position = currentY * canvasWidth + currentX;
    if (currentX < 0 || currentX >= canvasWidth || currentY < 0 || currentY >= canvasHeight) continue;
    if (visited[position]) continue;
    const offset = position * 4;
    if (!matches(offset)) continue;

    visited[position] = 1;
    data[offset] = rgb.r;
    data[offset + 1] = rgb.g;
    data[offset + 2] = rgb.b;
    data[offset + 3] = 255;

    stack.push(currentX - 1, currentY, currentX + 1, currentY, currentX, currentY - 1, currentX, currentY + 1);
  }

  ctx.putImageData(imageData, 0, 0);
}

function hexToRgb(hex) {
  const hexValue = parseInt(hex.slice(1), 16);
  return { r: (hexValue >> 16) & 0xff, g: (hexValue >> 8) & 0xff, b: hexValue & 0xff };
}

function boxBlur(imageData, passes) {
  const { data, width, height } = imageData;
  const temp = new Uint8ClampedArray(data.length);

  for (let pass = 0; pass < passes; pass++) {
    // Horizontal
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let red = 0, green = 0, blue = 0, alpha = 0, sampleCount = 0;
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          const neighborX = x + offsetX;
          if (neighborX < 0 || neighborX >= width) continue;
          const offset = (y * width + neighborX) * 4;
          red += data[offset]; green += data[offset + 1]; blue += data[offset + 2]; alpha += data[offset + 3];
          sampleCount++;
        }
        const targetOffset = (y * width + x) * 4;
        temp[targetOffset] = red / sampleCount; temp[targetOffset + 1] = green / sampleCount;
        temp[targetOffset + 2] = blue / sampleCount; temp[targetOffset + 3] = alpha / sampleCount;
      }
    }
    data.set(temp);

    // Vertical
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let red = 0, green = 0, blue = 0, alpha = 0, sampleCount = 0;
        for (let offsetY = -1; offsetY <= 1; offsetY++) {
          const neighborY = y + offsetY;
          if (neighborY < 0 || neighborY >= height) continue;
          const offset = (neighborY * width + x) * 4;
          red += data[offset]; green += data[offset + 1]; blue += data[offset + 2]; alpha += data[offset + 3];
          sampleCount++;
        }
        const targetOffset = (y * width + x) * 4;
        temp[targetOffset] = red / sampleCount; temp[targetOffset + 1] = green / sampleCount;
        temp[targetOffset + 2] = blue / sampleCount; temp[targetOffset + 3] = alpha / sampleCount;
      }
    }
    data.set(temp);
  }
}
