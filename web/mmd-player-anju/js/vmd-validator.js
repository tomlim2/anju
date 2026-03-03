// VMD↔PMX compatibility validator (browser ES module).
// Operates on Three.js clip + mesh data — no binary parsing needed.

const TWIST_BONES = ['左腕捩', '右腕捩', '左手捩', '右手捩'];
const DUMMY_BONES = ['左ダミー', '右ダミー'];
const ARM_BONES = ['左腕', '右腕', '左ひじ', '右ひじ'];
const IK_TARGET_NAMES = ['左足ＩＫ', '右足ＩＫ'];

function quatAngle(qw) {
  return 2 * Math.acos(Math.min(1, Math.abs(qw))) * (180 / Math.PI);
}

/**
 * Validate clip compatibility with mesh.
 * @param {THREE.AnimationClip} clip
 * @param {THREE.SkinnedMesh} mesh
 * @param {{ remapped: string[], dropped: string[], ignored: string[], trackBones: Set<string> }} remapResult
 * @returns {object} validation report
 */
export function validateClip(clip, mesh, remapResult) {
  const mmd = mesh.geometry.userData.MMD;
  const pmxBoneNames = new Set(mmd.bones.map(b => b.name));
  const trackBones = remapResult.trackBones;
  const droppedSet = new Set(remapResult.dropped);

  // 1. Bone match
  let matched = 0;
  const missing = [];
  for (const bone of trackBones) {
    if (pmxBoneNames.has(bone)) matched++;
    else missing.push(bone);
  }
  const matchRate = trackBones.size > 0 ? matched / trackBones.size : 1;

  // 2. IK compatibility
  const iks = mmd.iks || [];
  const pmxHasIK = iks.length > 0;
  const vmdHasIKTracks = IK_TARGET_NAMES.some(n => trackBones.has(n));
  const vmdHasFK = ['左足', '右足', '左ひざ', '右ひざ'].some(n => trackBones.has(n));
  const ikConflict = vmdHasFK && pmxHasIK && !vmdHasIKTracks;

  // 3. Source model detection
  const hasDummy = DUMMY_BONES.some(n => trackBones.has(n));
  const dummyDropped = DUMMY_BONES.some(n => droppedSet.has(n));
  let sourceModel = null;
  if (hasDummy) sourceModel = 'ミリシタ';

  // 4. Twist bone coverage
  const twistAnimated = TWIST_BONES.filter(n => trackBones.has(n));
  const twistInPmx = TWIST_BONES.filter(n => pmxBoneNames.has(n));

  // 5. Arm extremes — check quaternion tracks for >120° peaks
  const armExtremes = {};
  for (const bone of ARM_BONES) {
    const trackName = `.bones[${bone}].quaternion`;
    const track = clip.tracks.find(t => t.name.endsWith(trackName));
    if (!track) continue;

    const values = track.values;
    let peakAngle = 0;
    let peakTime = 0;
    for (let i = 0; i < values.length; i += 4) {
      const qw = values[i + 3];
      const angle = quatAngle(qw);
      if (angle > peakAngle) {
        peakAngle = angle;
        peakTime = track.times[i / 4];
      }
    }
    if (peakAngle > 120) {
      armExtremes[bone] = { peakAngle: peakAngle.toFixed(1), peakTime: peakTime.toFixed(2) };
    }
  }

  // Score
  let score = 100;
  if (matchRate < 0.8) score -= 20;
  else if (matchRate < 0.9) score -= 10;
  if (ikConflict) score -= 5;
  if (dummyDropped) score -= 5;
  if (Object.keys(armExtremes).length > 0) score -= 10;
  score = Math.max(0, score);

  return {
    boneMatch: { matched, total: trackBones.size, rate: matchRate, missing },
    ikCompat: { pmxHasIK, vmdHasIKTracks, vmdHasFK, conflict: ikConflict },
    sourceModel,
    twistCoverage: { animated: twistAnimated, pmx: twistInPmx },
    dummyDropped,
    armExtremes,
    score,
  };
}
