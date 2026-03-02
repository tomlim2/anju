// Minimal PMX humanoid bone detector.
// Searches raw PMX binary data for key bone names to identify character models.

const HUMANOID_BONES = [
  'センター', '上半身', '下半身', '頭', '首',
  '左肩', '右肩', '左腕', '右腕', '左足', '右足',
];
const REQUIRED_COUNT = 5;

function encodeUTF16LE(str) {
  const result = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    result[i * 2] = code & 0xff;
    result[i * 2 + 1] = (code >> 8) & 0xff;
  }
  return result;
}

function containsSequence(haystack, needle) {
  for (let i = 0, end = haystack.length - needle.length; i <= end; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) { match = false; break; }
    }
    if (match) return true;
  }
  return false;
}

/**
 * Check if a PMX buffer contains humanoid bones.
 * @param {ArrayBuffer} buffer - raw PMX file data
 * @returns {boolean}
 */
export function hasHumanoidBones(buffer) {
  const data = new Uint8Array(buffer);

  // Check PMX magic "PMX "
  if (data[0] !== 0x50 || data[1] !== 0x4d || data[2] !== 0x58 || data[3] !== 0x20) return false;

  // Encoding flag: offset 9 (magic:4 + version:4 + globalsCount:1)
  const encoding = data[9]; // 0 = UTF-16LE, 1 = UTF-8
  const encoder = encoding === 1 ? new TextEncoder() : null;

  let found = 0;
  for (const bone of HUMANOID_BONES) {
    const encoded = encoding === 0 ? encodeUTF16LE(bone) : encoder.encode(bone);
    if (containsSequence(data, encoded)) found++;
    if (found >= REQUIRED_COUNT) return true;
  }

  return false;
}
