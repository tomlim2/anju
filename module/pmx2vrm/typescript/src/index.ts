/**
 * GLB writer for PMX -> VRM 0.x conversion pipeline.
 */

import { writeFile } from "node:fs/promises";
import type { GltfData } from "./types.js";

/**
 * Write glTF data as GLB binary with proper 4-byte alignment.
 *
 * GLB layout:
 *   [12-byte header: magic + version + total_length]
 *   [JSON chunk: length + type(0x4E4F534A) + data (space-padded)]
 *   [BIN chunk:  length + type(0x004E4942) + data (null-padded)]
 */
export async function writeGlb(gltfData: GltfData, outputPath: string): Promise<void> {
  const jsonStr = JSON.stringify(gltfData.json);
  const jsonBytes = new TextEncoder().encode(jsonStr);

  // Pad JSON to 4-byte alignment with spaces (0x20)
  const jsonPad = (4 - (jsonBytes.byteLength % 4)) % 4;
  const jsonPadded = new Uint8Array(jsonBytes.byteLength + jsonPad);
  jsonPadded.set(jsonBytes);
  for (let i = 0; i < jsonPad; i++) jsonPadded[jsonBytes.byteLength + i] = 0x20;

  // Pad BIN to 4-byte alignment with null bytes
  const binData = gltfData.bin;
  const binPad = (4 - (binData.byteLength % 4)) % 4;
  const binPadded = new Uint8Array(binData.byteLength + binPad);
  binPadded.set(binData);

  const totalLength = 12 + 8 + jsonPadded.byteLength + 8 + binPadded.byteLength;

  const output = new Uint8Array(totalLength);
  const view = new DataView(output.buffer);

  // GLB header
  view.setUint32(0, 0x46546C67, true);  // magic: 'glTF'
  view.setUint32(4, 2, true);            // version: 2
  view.setUint32(8, totalLength, true);   // total length

  // JSON chunk
  let offset = 12;
  view.setUint32(offset, jsonPadded.byteLength, true);
  view.setUint32(offset + 4, 0x4E4F534A, true); // JSON
  offset += 8;
  output.set(jsonPadded, offset);
  offset += jsonPadded.byteLength;

  // BIN chunk
  view.setUint32(offset, binPadded.byteLength, true);
  view.setUint32(offset + 4, 0x004E4942, true); // BIN
  offset += 8;
  output.set(binPadded, offset);

  await writeFile(outputPath, output);
}
