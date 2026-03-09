/**
 * Node.js image encoder — wraps sharp for PNG conversion.
 */

import sharp from "sharp";
import { decodeTga, decodeBmp } from "../core/image-decoders.js";
import type { ImageEncoder } from "../core/types.js";

export class NodeImageEncoder implements ImageEncoder {
  async rgbaToPng(data: Uint8Array, width: number, height: number): Promise<Uint8Array> {
    const buf = await sharp(Buffer.from(data), { raw: { width, height, channels: 4 } })
      .png()
      .toBuffer();
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  async toPng(data: Uint8Array, ext: string): Promise<Uint8Array> {
    const e = ext.toLowerCase();

    if (e === ".tga") {
      const decoded = decodeTga(data);
      return this.rgbaToPng(decoded.data, decoded.width, decoded.height);
    }

    if (e === ".bmp") {
      const decoded = decodeBmp(data);
      return this.rgbaToPng(decoded.data, decoded.width, decoded.height);
    }

    // sharp handles PNG, JPEG, WebP, TIFF, GIF, etc.
    try {
      const buf = await sharp(Buffer.from(data)).png().toBuffer();
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } catch {
      throw new Error(`Unsupported image format: ${ext}`);
    }
  }

  async createFallback(): Promise<Uint8Array> {
    const buf = await sharp({
      create: { width: 1, height: 1, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    }).png().toBuffer();
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
}
