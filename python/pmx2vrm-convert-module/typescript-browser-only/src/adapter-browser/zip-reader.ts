/**
 * Browser ZIP reader — JSZip with CJK filename decoding.
 */

import JSZip from "jszip";
import { BrowserTextCodec } from "./text-codec.js";

const codec = new BrowserTextCodec();

export async function loadZip(buffer: ArrayBuffer): Promise<JSZip> {
  return JSZip.loadAsync(buffer, {
    decodeFileName: (bytes: Uint8Array | string[] | Buffer) => {
      if (bytes instanceof Uint8Array) return codec.decodeFileName(bytes);
      if (Array.isArray(bytes)) return bytes.join("");
      return codec.decodeFileName(new Uint8Array(bytes));
    },
  });
}
