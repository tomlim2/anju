/**
 * Browser text codec — TextDecoder with fatal fallback chain.
 *
 * Mirrors NodeTextCodec behavior using only Web APIs.
 * Uses TextDecoder({ fatal: true }) to detect encoding mismatches,
 * falling through UTF-8 → Shift-JIS → GBK → EUC-KR.
 */

import type { TextCodec } from "../core/types.js";

const ENCODINGS = ["utf-8", "shift_jis", "gbk", "euc-kr"] as const;

export class BrowserTextCodec implements TextCodec {
  decode(bytes: Uint8Array, encoding: string): string {
    return new TextDecoder(encoding, { fatal: false }).decode(bytes);
  }

  decodeFileName(bytes: Uint8Array): string {
    for (const enc of ENCODINGS) {
      try {
        return new TextDecoder(enc, { fatal: true }).decode(bytes);
      } catch {
        continue;
      }
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
}
