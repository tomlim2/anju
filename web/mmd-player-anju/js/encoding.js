// Encoding round-trip utility for resolving CJK mojibake texture filenames.
// Ports the _find_texture_fallback logic from pmx2vrm's pmx_reader.py.

const ENCODING_ROUNDTRIPS = [
  ['gbk', 'euc-kr'],
  ['gbk', 'shift_jis'],
  ['gbk', 'big5'],
  ['big5', 'euc-kr'],
  ['shift_jis', 'euc-kr'],
  ['euc-kr', 'gbk'],
];

// Cache: encoding name → Map<codePoint, Uint8Array>
const encodeMapCache = new Map();

/**
 * Build a reverse lookup table: Unicode char → byte sequence for the given encoding.
 * Covers single-byte (0x00-0xFF) and CJK double-byte lead 0x81-0xFE, trail 0x40-0xFE.
 */
function buildEncodeMap(encoding) {
  if (encodeMapCache.has(encoding)) return encodeMapCache.get(encoding);

  const map = new Map();
  const decoder = new TextDecoder(encoding, { fatal: true });

  // Single-byte range
  for (let b = 0; b < 0x100; b++) {
    try {
      const ch = decoder.decode(new Uint8Array([b]));
      if (ch.length === 1 && !map.has(ch)) {
        map.set(ch, new Uint8Array([b]));
      }
    } catch { /* unmappable */ }
  }

  // Double-byte range (CJK encodings)
  for (let lead = 0x81; lead <= 0xfe; lead++) {
    for (let trail = 0x40; trail <= 0xfe; trail++) {
      try {
        const ch = decoder.decode(new Uint8Array([lead, trail]));
        if (ch.length === 1 && !map.has(ch)) {
          map.set(ch, new Uint8Array([lead, trail]));
        }
      } catch { /* unmappable */ }
    }
  }

  encodeMapCache.set(encoding, map);
  return map;
}

/**
 * Encode a Unicode string into bytes using the lookup table.
 * Returns null if any character is unmappable.
 */
function encodeString(str, encoding) {
  const map = buildEncodeMap(encoding);
  const parts = [];
  for (const ch of str) {
    const bytes = map.get(ch);
    if (!bytes) return null;
    parts.push(bytes);
  }
  const totalLen = parts.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const b of parts) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

/**
 * Try encoding round-trips to find a mojibake match in the candidate set.
 * @param {string} stem - filename without extension (lowercase)
 * @param {string} ext - extension including dot (lowercase)
 * @param {Set<string>} candidates - set of lowercase filenames available on disk
 * @returns {string|null} matched filename or null
 */
export function findMojibakeMatch(stem, ext, candidates) {
  for (const [encFrom, encTo] of ENCODING_ROUNDTRIPS) {
    try {
      const encoded = encodeString(stem, encFrom);
      if (!encoded) continue;
      const decoder = new TextDecoder(encTo, { fatal: true });
      const mojibakeStem = decoder.decode(encoded);
      const mojibakeName = mojibakeStem + ext;
      if (candidates.has(mojibakeName)) return mojibakeName;
    } catch { /* decode failed, try next pair */ }
  }
  return null;
}
