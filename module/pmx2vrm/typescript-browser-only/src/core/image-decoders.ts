/**
 * TGA and BMP decoders — extracted from pmx-reader.ts.
 *
 * Pure Uint8Array operations, no Node.js Buffer dependency.
 */

export interface DecodedImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * Parse TGA (uncompressed and RLE) into raw RGBA pixels.
 * Covers the formats commonly used in MMD models.
 */
export function decodeTga(buf: Uint8Array): DecodedImage {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const idLen = buf[0];
  const colorMapType = buf[1];
  const imageType = buf[2];
  const width = view.getUint16(12, true);
  const height = view.getUint16(14, true);
  const bpp = buf[16];
  const descriptor = buf[17];

  const colorMapEntries = colorMapType ? view.getUint16(5, true) : 0;
  const colorMapBits = colorMapType ? buf[7] : 0;
  const headerSize = 18 + idLen + (colorMapType ? colorMapEntries * Math.ceil(colorMapBits / 8) : 0);
  const channels = bpp / 8;
  const pixelCount = width * height;
  const pixels = new Uint8Array(pixelCount * 4);

  let src = headerSize;

  function writePixel(dst: number, offset: number) {
    if (channels >= 3) {
      // TGA stores BGR(A)
      pixels[dst] = buf[offset + 2];
      pixels[dst + 1] = buf[offset + 1];
      pixels[dst + 2] = buf[offset];
      pixels[dst + 3] = channels === 4 ? buf[offset + 3] : 255;
    } else if (channels === 1) {
      pixels[dst] = buf[offset];
      pixels[dst + 1] = buf[offset];
      pixels[dst + 2] = buf[offset];
      pixels[dst + 3] = 255;
    }
  }

  if (imageType === 2 || imageType === 3) {
    // Uncompressed
    for (let i = 0; i < pixelCount; i++) {
      writePixel(i * 4, src);
      src += channels;
    }
  } else if (imageType === 10 || imageType === 11) {
    // RLE compressed
    let pi = 0;
    while (pi < pixelCount) {
      const header = buf[src++];
      const count = (header & 0x7F) + 1;
      if (header & 0x80) {
        // Run-length packet
        for (let j = 0; j < count && pi < pixelCount; j++, pi++) {
          writePixel(pi * 4, src);
        }
        src += channels;
      } else {
        // Raw packet
        for (let j = 0; j < count && pi < pixelCount; j++, pi++) {
          writePixel(pi * 4, src);
          src += channels;
        }
      }
    }
  } else {
    throw new Error(`Unsupported TGA image type: ${imageType}`);
  }

  // Flip vertically if origin is bottom-left (bit 5 of descriptor = 0)
  const topDown = (descriptor & 0x20) !== 0;
  if (!topDown) {
    const rowBytes = width * 4;
    const tmp = new Uint8Array(rowBytes);
    for (let y = 0; y < Math.floor(height / 2); y++) {
      const topOff = y * rowBytes;
      const botOff = (height - 1 - y) * rowBytes;
      tmp.set(pixels.subarray(topOff, topOff + rowBytes));
      pixels.set(pixels.subarray(botOff, botOff + rowBytes), topOff);
      pixels.set(tmp, botOff);
    }
  }

  return { width, height, data: pixels };
}

/**
 * Parse BMP into raw RGBA pixels.
 * Handles 24-bit and 32-bit uncompressed BMPs (common in MMD).
 */
export function decodeBmp(buf: Uint8Array): DecodedImage {
  if (buf[0] !== 0x42 || buf[1] !== 0x4D) throw new Error("Not a BMP file");

  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const dataOffset = view.getUint32(10, true);
  const width = view.getInt32(18, true);
  const rawHeight = view.getInt32(22, true);
  const height = Math.abs(rawHeight);
  const bpp = view.getUint16(28, true);
  const compression = view.getUint32(30, true);

  if (compression !== 0 && compression !== 3) {
    throw new Error(`Unsupported BMP compression: ${compression}`);
  }
  if (bpp !== 24 && bpp !== 32 && bpp !== 8) {
    throw new Error(`Unsupported BMP bpp: ${bpp}`);
  }

  const pixels = new Uint8Array(width * height * 4);
  const channels = bpp / 8;
  const rowSize = Math.ceil((width * channels) / 4) * 4; // rows padded to 4 bytes
  const bottomUp = rawHeight > 0;

  for (let y = 0; y < height; y++) {
    const srcY = bottomUp ? (height - 1 - y) : y;
    const rowStart = dataOffset + srcY * rowSize;
    for (let x = 0; x < width; x++) {
      const dst = (y * width + x) * 4;
      const s = rowStart + x * channels;
      if (channels >= 3) {
        // BMP stores BGR(A)
        pixels[dst] = buf[s + 2];
        pixels[dst + 1] = buf[s + 1];
        pixels[dst + 2] = buf[s];
        pixels[dst + 3] = channels === 4 ? buf[s + 3] : 255;
      } else {
        // 8-bit grayscale
        pixels[dst] = buf[s];
        pixels[dst + 1] = buf[s];
        pixels[dst + 2] = buf[s];
        pixels[dst + 3] = 255;
      }
    }
  }

  return { width, height, data: pixels };
}
