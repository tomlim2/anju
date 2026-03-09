/**
 * Browser image encoder — pako-based PNG encoding (no Canvas dependency).
 *
 * Canvas 2D applies premultiplied alpha by default, which is irreversible.
 * This encoder builds PNG binaries directly from raw RGBA data using pako
 * (the same zlib library JSZip uses internally).
 */

import pako from "pako";
import { decodeTga, decodeBmp } from "../core/image-decoders.js";
import type { ImageEncoder } from "../core/types.js";

// ── CRC32 lookup table (standard PNG polynomial) ──

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── PNG assembly helpers ──

function concatBytes(arrays: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrays) total += a.length;
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

function ihdrData(w: number, h: number): Uint8Array {
  const buf = new Uint8Array(13);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  buf[8] = 8;  // bit depth
  buf[9] = 6;  // color type: RGBA
  // compress(0), filter(0), interlace(0) — already zero
  return buf;
}

function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const len = data.length;
  const buf = new Uint8Array(4 + 4 + len + 4);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, len);
  buf[4] = type.charCodeAt(0);
  buf[5] = type.charCodeAt(1);
  buf[6] = type.charCodeAt(2);
  buf[7] = type.charCodeAt(3);
  buf.set(data, 8);
  const crc = crc32(buf.subarray(4, 8 + len));
  dv.setUint32(8 + len, crc);
  return buf;
}

function buildPng(w: number, h: number, idatPayload: Uint8Array): Uint8Array {
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = buildChunk("IHDR", ihdrData(w, h));
  const idat = buildChunk("IDAT", idatPayload);
  const iend = buildChunk("IEND", new Uint8Array(0));
  return concatBytes([sig, ihdr, idat, iend]);
}

// ── Browser image encoder ──

export class BrowserImageEncoder implements ImageEncoder {
  async rgbaToPng(data: Uint8Array, w: number, h: number): Promise<Uint8Array> {
    // Build raw scanlines: filter_byte(0) + row_data per line
    const raw = new Uint8Array((1 + w * 4) * h);
    for (let y = 0; y < h; y++) {
      raw[y * (1 + w * 4)] = 0; // filter: None
      raw.set(data.subarray(y * w * 4, (y + 1) * w * 4), y * (1 + w * 4) + 1);
    }
    const compressed = pako.deflate(raw);
    return buildPng(w, h, compressed);
  }

  async toPng(data: Uint8Array, ext: string): Promise<Uint8Array> {
    const e = ext.toLowerCase();
    if (e === ".png" || e === ".jpeg" || e === ".jpg") return data; // pass-through
    if (e === ".tga") {
      const d = decodeTga(data);
      return this.rgbaToPng(d.data, d.width, d.height);
    }
    if (e === ".bmp") {
      const d = decodeBmp(data);
      return this.rgbaToPng(d.data, d.width, d.height);
    }
    return this.createFallback();
  }

  async createFallback(): Promise<Uint8Array> {
    return this.rgbaToPng(new Uint8Array([255, 255, 255, 255]), 1, 1);
  }
}
