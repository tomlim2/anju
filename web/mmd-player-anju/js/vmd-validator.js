// VMD↔PMX compatibility validator (browser ES module).
// Operates on Three.js clip + mesh data — no binary parsing needed.

const TWIST_BONES = ['左腕捩', '右腕捩', '左手捩', '右手捩'];
const DUMMY_BONES = ['左ダミー', '右ダミー'];
const ARM_BONES = ['左腕', '右腕', '左ひじ', '右ひじ'];
const IK_TARGET_NAMES = ['左足ＩＫ', '右足ＩＫ'];

const SEMI_STANDARD_BONES = [
  '上半身2', 'グルーブ', '腰',
  '左肩P', '右肩P', '左肩C', '右肩C',
  '左腕捩', '右腕捩', '左手捩', '右手捩',
  '左足IK親', '右足IK親',
];

const TRANSLATION_BONES = ['センター', '左足ＩＫ', '右足ＩＫ'];

function quatAngle(qw) {
  return 2 * Math.acos(Math.min(1, Math.abs(qw))) * (180 / Math.PI);
}

/**
 * Validate clip compatibility with mesh.
 * @param {THREE.AnimationClip} clip
 * @param {THREE.SkinnedMesh} mesh
 * @param {{ remapped: string[], dropped: string[], ignored: string[], trackBones: Set<string> }} remapResult
 * @param {object|null} vmdMeta - from extractVmdMeta() (optional)
 * @returns {object} validation report
 */
export function validateClip(clip, mesh, remapResult, vmdMeta = null) {
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

  // 6. 準標準ボーン coverage
  const semiStdUsed = [];
  const semiStdMissing = [];
  if (vmdMeta) {
    for (const bone of SEMI_STANDARD_BONES) {
      if (vmdMeta.boneNames.has(bone)) {
        semiStdUsed.push(bone);
        if (!pmxBoneNames.has(bone)) semiStdMissing.push(bone);
      }
    }
  }

  // 7. 全ての親 position
  let zenoyaPosition = false;
  {
    const trackName = '.bones[全ての親].position';
    const track = clip.tracks.find(t => t.name.endsWith(trackName));
    if (track) {
      const v = track.values;
      for (let i = 0; i < v.length; i += 3) {
        if (Math.abs(v[i]) > 0.01 || Math.abs(v[i + 1]) > 0.01 || Math.abs(v[i + 2]) > 0.01) {
          zenoyaPosition = true;
          break;
        }
      }
    }
  }

  // 8. Morph match
  let morphMatch = null;
  if (vmdMeta && vmdMeta.morphNames.size > 0) {
    const pmxMorphNames = new Set(Object.keys(mesh.morphTargetDictionary || {}));
    let morphMatched = 0;
    const morphMissing = [];
    for (const name of vmdMeta.morphNames) {
      if (pmxMorphNames.has(name)) morphMatched++;
      else morphMissing.push(name);
    }
    const morphTotal = vmdMeta.morphNames.size;
    morphMatch = {
      matched: morphMatched,
      total: morphTotal,
      rate: morphTotal > 0 ? morphMatched / morphTotal : 1,
      missing: morphMissing,
    };
  }

  // 9. Camera VMD
  const isCamera = vmdMeta ? vmdMeta.isCamera : false;

  // 10. Translation magnitude
  const translationWarns = [];
  for (const bone of TRANSLATION_BONES) {
    const trackName = `.bones[${bone}].position`;
    const track = clip.tracks.find(t => t.name.endsWith(trackName));
    if (!track) continue;
    const v = track.values;
    let peak = 0;
    for (let i = 0; i < v.length; i += 3) {
      const mag = Math.sqrt(v[i] * v[i] + v[i + 1] * v[i + 1] + v[i + 2] * v[i + 2]);
      if (mag > peak) peak = mag;
    }
    if (peak > 50) {
      translationWarns.push(`${bone} (${peak.toFixed(1)})`);
    }
  }

  // 11. IK state summary (info only)
  const ikBoneNames = iks.map(ik => {
    const target = mmd.bones[ik.target];
    return target ? target.name : `bone#${ik.target}`;
  });
  const ikSummary = { pmxIks: ikBoneNames, vmdHasIK: vmdHasIKTracks };

  // Score
  let score = 100;
  if (matchRate < 0.8) score -= 20;
  else if (matchRate < 0.9) score -= 10;
  if (ikConflict) score -= 5;
  if (dummyDropped) score -= 5;
  if (Object.keys(armExtremes).length > 0) score -= 10;
  if (semiStdMissing.length > 0) score -= 5;
  if (zenoyaPosition) score -= 3;
  if (morphMatch) {
    if (morphMatch.rate < 0.5) score -= 10;
    else if (morphMatch.rate < 0.8) score -= 5;
  }
  if (isCamera) score -= 20;
  if (translationWarns.length > 0) score -= 3;
  score = Math.max(0, score);

  return {
    boneMatch: { matched, total: trackBones.size, rate: matchRate, missing },
    ikCompat: { pmxHasIK, vmdHasIKTracks, vmdHasFK, conflict: ikConflict },
    sourceModel,
    twistCoverage: { animated: twistAnimated, pmx: twistInPmx },
    dummyDropped,
    armExtremes,
    semiStdCoverage: { used: semiStdUsed, missing: semiStdMissing },
    zenoyaPosition,
    morphMatch,
    isCamera,
    translationWarns,
    ikSummary,
    score,
  };
}
