// Bone remapping: detect missing VMD bones and apply known aliases.

// True aliases — same bone, different naming convention
const BONE_ALIASES = {
  // Extend as new alias patterns are discovered
};

// Bones safe to ignore when missing (cosmetic/optional)
const IGNORABLE_PREFIXES = [
  'スカート', 'j_f_', 'j_ago', 'n_sippo',
  'Glasses', '新規ボーン',
];
const IGNORABLE_SUFFIXES = ['指先'];

function isIgnorable(name) {
  for (const p of IGNORABLE_PREFIXES) { if (name.startsWith(p)) return true; }
  for (const s of IGNORABLE_SUFFIXES) { if (name.endsWith(s)) return true; }
  return false;
}

/**
 * Analyze and remap VMD clip bones against a PMX skeleton.
 * Modifies clip.tracks in-place for alias remaps.
 * Returns { remapped, dropped, ignored } for debug display.
 */
export function remapClipBones(clip, skeleton) {
  const boneNames = new Set(skeleton.bones.map(b => b.name));
  const remapped = [];
  const dropped = [];
  const ignored = [];

  // Collect unique bone names referenced by tracks
  const trackBones = new Set();
  for (const track of clip.tracks) {
    const m = track.name.match(/\.bones\[(.+?)\]\./);
    if (m) trackBones.add(m[1]);
  }

  for (const bone of trackBones) {
    if (boneNames.has(bone)) continue;

    const alias = BONE_ALIASES[bone];
    if (alias && boneNames.has(alias)) {
      // Rename tracks to the alias
      for (const track of clip.tracks) {
        if (track.name.includes(`.bones[${bone}].`)) {
          track.name = track.name.replace(`.bones[${bone}].`, `.bones[${alias}].`);
        }
      }
      remapped.push(`${bone} → ${alias}`);
    } else if (isIgnorable(bone)) {
      ignored.push(bone);
    } else {
      dropped.push(bone);
    }
  }

  // Log details
  if (remapped.length) console.info('[MMD] Bone remapped:', remapped.join(', '));
  if (dropped.length) console.info('[MMD] Bone missing:', dropped.join(', '));
  if (ignored.length) console.info('[MMD] Bone ignored:', ignored.join(', '));

  return { remapped, dropped, ignored };
}
