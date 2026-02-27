/**
 * VRM Renamer — stores original filename in VRM metadata and
 * generates an ASCII-safe English filename for the output.
 */

// ── GLB helpers ──

/**
 * Parse a GLB buffer into its JSON and BIN chunks.
 */
function parseGlb(buffer: Uint8Array): { json: Record<string, any>; bin: Uint8Array } {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const magic = view.getUint32(0, true);
  if (magic !== 0x46546C67) throw new Error("Not a valid GLB file");

  let offset = 12;

  // JSON chunk
  const jsonLen = view.getUint32(offset, true);
  const jsonType = view.getUint32(offset + 4, true);
  if (jsonType !== 0x4E4F534A) throw new Error("Expected JSON chunk");
  offset += 8;
  const jsonBytes = buffer.slice(offset, offset + jsonLen);
  const json = JSON.parse(new TextDecoder().decode(jsonBytes));
  offset += jsonLen;

  // BIN chunk
  const binLen = view.getUint32(offset, true);
  offset += 8;
  const bin = buffer.slice(offset, offset + binLen);

  return { json, bin };
}

/**
 * Rebuild a GLB buffer from JSON object and BIN data.
 */
function buildGlb(json: Record<string, any>, bin: Uint8Array): Uint8Array {
  const jsonStr = JSON.stringify(json);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  const jsonPad = (4 - (jsonBytes.byteLength % 4)) % 4;
  const jsonPadded = new Uint8Array(jsonBytes.byteLength + jsonPad);
  jsonPadded.set(jsonBytes);
  for (let i = 0; i < jsonPad; i++) jsonPadded[jsonBytes.byteLength + i] = 0x20;

  const binPad = (4 - (bin.byteLength % 4)) % 4;
  const binPadded = new Uint8Array(bin.byteLength + binPad);
  binPadded.set(bin);

  const totalLength = 12 + 8 + jsonPadded.byteLength + 8 + binPadded.byteLength;
  const output = new Uint8Array(totalLength);
  const view = new DataView(output.buffer);

  view.setUint32(0, 0x46546C67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);

  let offset = 12;
  view.setUint32(offset, jsonPadded.byteLength, true);
  view.setUint32(offset + 4, 0x4E4F534A, true);
  offset += 8;
  output.set(jsonPadded, offset);
  offset += jsonPadded.byteLength;

  view.setUint32(offset, binPadded.byteLength, true);
  view.setUint32(offset + 4, 0x004E4942, true);
  offset += 8;
  output.set(binPadded, offset);

  return output;
}

// ── Naming helpers ──

function hasNonAscii(str: string): boolean {
  return /[^\x00-\x7F]/.test(str);
}

function timestampName(): string {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `vrm_${y}${mo}${d}_${h}${mi}${s}`;
}

function sanitizeAscii(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\-_.]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function stripExtension(name: string): string {
  return name.replace(/\.(pmx|vrm)$/i, "");
}

// ── Public API ──

/**
 * Generate an ASCII-safe VRM filename from the original name.
 *
 * Rules:
 *   - Non-ASCII chars present → timestamp: vrm_YYYYMMDD_HHmmss.vrm
 *   - All ASCII → sanitize special chars to underscore + .vrm
 */
export function makeEnglishName(originalName: string): string {
  const stem = stripExtension(originalName);

  if (hasNonAscii(stem)) {
    return `${timestampName()}.vrm`;
  }

  const safe = sanitizeAscii(stem);
  if (!safe) return `${timestampName()}.vrm`;

  return `${safe}.vrm`;
}

/**
 * Rename a VRM (GLB) file:
 * 1. Stores the original filename (without extension) in extensions.VRM.meta.title
 * 2. Returns the modified buffer and an ASCII-safe english filename
 *
 * @param glbBuffer - The GLB binary data
 * @param originalName - Original filename (e.g. "芙宁娜_荒.pmx" or "Archer (1).pmx")
 * @returns Modified buffer with metadata and the new english filename (with .vrm extension)
 */
export function renameVrm(
  glbBuffer: Uint8Array,
  originalName: string,
): { buffer: Uint8Array; englishName: string } {
  const baseName = stripExtension(originalName);

  // Parse GLB, inject original name into VRM meta
  const { json, bin } = parseGlb(glbBuffer);

  if (json.extensions?.VRM?.meta) {
    json.extensions.VRM.meta.title = baseName;
  }

  // Rebuild GLB with updated JSON
  const buffer = buildGlb(json, bin);

  // Generate english filename
  const englishName = makeEnglishName(originalName);

  return { buffer, englishName };
}
