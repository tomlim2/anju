// VMD binary metadata extractor (lightweight — no full parse).
// Reads header, keyframe counts, and bone/morph names only.

const SJIS = new TextDecoder('shift_jis');

function readString(view, offset, len) {
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, len);
  const nullIdx = bytes.indexOf(0);
  const slice = nullIdx >= 0 ? bytes.subarray(0, nullIdx) : bytes;
  return SJIS.decode(slice);
}

/**
 * Extract metadata from a VMD binary buffer.
 * Does NOT consume the File — safe to call before MMDLoader.
 * @param {ArrayBuffer} buffer
 * @returns {{ modelName: string, boneKeyframeCount: number, uniqueBoneCount: number,
 *             boneNames: Set<string>, morphKeyframeCount: number, uniqueMorphCount: number,
 *             morphNames: Set<string>, cameraKeyframeCount: number, isCamera: boolean,
 *             maxFrame: number, duration: number }}
 */
export function extractVmdMeta(buffer) {
  const view = new DataView(buffer);
  let offset = 30; // skip magic "Vocaloid Motion Data 0002"

  // Model name (20 bytes, ShiftJIS)
  const modelName = readString(view, offset, 20);
  offset += 20;

  // --- Bone keyframes ---
  const boneCount = view.getUint32(offset, true);
  offset += 4;

  const boneNames = new Set();
  let maxFrame = 0;
  const BONE_STRIDE = 111; // 15 name + 4 frame + 12 pos + 16 rot + 64 interp

  for (let i = 0; i < boneCount; i++) {
    const name = readString(view, offset, 15);
    const frame = view.getUint32(offset + 15, true);
    boneNames.add(name);
    if (frame > maxFrame) maxFrame = frame;
    offset += BONE_STRIDE;
  }

  // --- Morph keyframes ---
  const morphCount = view.getUint32(offset, true);
  offset += 4;

  const morphNames = new Set();
  const MORPH_STRIDE = 23; // 15 name + 4 frame + 4 weight

  for (let i = 0; i < morphCount; i++) {
    const name = readString(view, offset, 15);
    const frame = view.getUint32(offset + 15, true);
    morphNames.add(name);
    if (frame > maxFrame) maxFrame = frame;
    offset += MORPH_STRIDE;
  }

  // --- Camera keyframes ---
  let cameraCount = 0;
  if (offset + 4 <= buffer.byteLength) {
    cameraCount = view.getUint32(offset, true);
    offset += 4;
    const CAMERA_STRIDE = 61;
    for (let i = 0; i < cameraCount; i++) {
      const frame = view.getUint32(offset, true);
      if (frame > maxFrame) maxFrame = frame;
      offset += CAMERA_STRIDE;
    }
  }

  const isCamera = cameraCount > 0 && boneCount === 0;
  const duration = maxFrame / 30;

  return {
    modelName,
    boneKeyframeCount: boneCount,
    uniqueBoneCount: boneNames.size,
    boneNames,
    morphKeyframeCount: morphCount,
    uniqueMorphCount: morphNames.size,
    morphNames,
    cameraKeyframeCount: cameraCount,
    isCamera,
    maxFrame,
    duration,
  };
}
