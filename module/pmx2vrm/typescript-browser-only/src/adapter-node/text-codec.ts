/**
 * Node.js text codec — wraps iconv-lite for CJK encoding support.
 */

import iconv from "iconv-lite";
import type { TextCodec } from "../core/types.js";

const FALLBACK_ENCODINGS = ["shiftjis", "gbk", "euc-kr", "big5"];

export class NodeTextCodec implements TextCodec {
  decode(bytes: Uint8Array, encoding: string): string {
    return iconv.decode(Buffer.from(bytes), encoding);
  }

  decodeFileName(bytes: Uint8Array): string {
    // Try UTF-8 first
    try {
      const utf8 = new TextDecoder("utf-8", { fatal: true });
      return utf8.decode(bytes);
    } catch {}

    // Fallback through CJK encodings
    for (const enc of FALLBACK_ENCODINGS) {
      try {
        const decoded = iconv.decode(Buffer.from(bytes), enc);
        if (!decoded.includes("\uFFFD")) return decoded;
      } catch {
        continue;
      }
    }

    return new TextDecoder("utf-8").decode(bytes);
  }
}
