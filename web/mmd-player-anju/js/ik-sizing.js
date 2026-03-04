import { Vector3 } from 'three/webgpu';

// Source model reference data per family.
// Measured from canonical PMX models with parse-pmx-bones.py.
const SOURCE_REFS = {
  // Hatsune Miku v2.0 (あにまさ式) — default for most VMDs
  // 左足(0.970, 11.679) → 左足首(0.970, 0.844), 左つま先(0.970, 0.000)
  'あにまさ式': { toeY: 0.0, legYSpan: 10.835 },

  // Project DIVA Snow Miku 2019 (FTDX)
  // 左足(0.891, 11.500) → 左足首(0.896, 1.169), 左つま先(0.675, 0.220)
  'Project DIVA': { toeY: 0.220, legYSpan: 10.331 },
};

const DEFAULT_FAMILY = 'あにまさ式';

/**
 * PMX bone-measurement IK sizing.
 *
 * Uses leg-length ratio for Y scaling only. XZ offsets are NOT scaled because
 * body bone chain geometry (groove → hip → thigh) uses target model rest
 * proportions that don't scale uniformly with legRatio.
 *
 * sourceFamily selects the correct reference bone data (あにまさ式, Project DIVA, etc.).
 *
 * - 全ての親/センター/グルーブ: Y offset × legRatio, XZ unchanged
 * - 足ＩＫ: Y += floor delta only (no legRatio — VMD positions preserved)
 */
export function autoSizeIK(clip, mesh, sourceFamily = null) {
  const skeleton = mesh.skeleton;
  if (!skeleton) return null;

  delete mesh.userData.ikSized;

  const boneMap = new Map();
  for (const bone of skeleton.bones) boneMap.set(bone.name, bone);

  // Required bones
  const centerBone = boneMap.get('センター');
  const ikL = boneMap.get('左足ＩＫ');
  const ikR = boneMap.get('右足ＩＫ');
  if (!centerBone || (!ikL && !ikR)) return null;

  // Leg chain for ratio
  const legBone = boneMap.get('左足') || boneMap.get('右足');
  const ankleBone = boneMap.get('左足首') || boneMap.get('右足首');
  if (!legBone || !ankleBone) return null;

  // --- Step 1: Measure target rest pose ---
  skeleton.pose();
  mesh.updateMatrixWorld(true);

  const tmp = new Vector3();

  legBone.getWorldPosition(tmp);
  const tgtLegY = tmp.y;
  ankleBone.getWorldPosition(tmp);
  const tgtAnkleY = tmp.y;
  const tgtLegYSpan = tgtLegY - tgtAnkleY;
  if (tgtLegYSpan <= 0) return null;

  let tgtToeWorldY = 0;
  const toeBone = boneMap.get('左つま先') || boneMap.get('右つま先');
  if (toeBone) {
    toeBone.getWorldPosition(tmp);
    tgtToeWorldY = tmp.y;
  }

  // --- Step 2: Ratios ---
  const family = sourceFamily && SOURCE_REFS[sourceFamily] ? sourceFamily : DEFAULT_FAMILY;
  const ref = SOURCE_REFS[family];
  const legRatio = tgtLegYSpan / ref.legYSpan;
  const ikFloorDelta = -(tgtToeWorldY - ref.toeY);

  if (Math.abs(legRatio - 1.0) < 0.02 && Math.abs(ikFloorDelta) < 0.1) {
    console.log(`[sizing] skip — legRatio=${legRatio.toFixed(3)}`);
    return null;
  }

  if (legRatio > 2.0 || legRatio < 0.3) {
    console.warn(`[sizing] abnormal legRatio=${legRatio.toFixed(3)}, skipping`);
    return null;
  }

  // --- Step 3: Apply ---
  const applied = [];

  // Movement bones: scale Y only (XZ unchanged to preserve rotation geometry)
  for (const boneName of ['全ての親', 'センター', 'グルーブ']) {
    const trackName = `.bones[${boneName}].position`;
    const track = clip.tracks.find(t => t.name.endsWith(trackName));
    if (!track) continue;

    const bone = boneMap.get(boneName);
    if (!bone) continue;

    const ry = bone.position.y;
    const v = track.values;
    for (let i = 0; i < v.length; i += 3) {
      v[i + 1] = ry + (v[i + 1] - ry) * legRatio;
    }
    applied.push(boneName);
  }

  // Foot IK: only floor delta on Y (no legRatio — VMD positions are correct
  // for the choreography, only ground contact height needs adjustment)
  for (const boneName of ['左足ＩＫ', '右足ＩＫ']) {
    const trackName = `.bones[${boneName}].position`;
    const track = clip.tracks.find(t => t.name.endsWith(trackName));
    if (!track) continue;

    const v = track.values;
    for (let i = 0; i < v.length; i += 3) {
      v[i + 1] += ikFloorDelta;
    }
    applied.push(boneName);
  }

  if (applied.length === 0) return null;

  mesh.userData.ikSized = true;

  console.log(
    `[sizing] ${family} | legRatio=${legRatio.toFixed(3)}, ikFloorDelta=${ikFloorDelta.toFixed(3)}` +
    ` | legSpan=${tgtLegYSpan.toFixed(3)}, toe=${tgtToeWorldY.toFixed(3)}` +
    ` → ${applied.join(', ')}`
  );
  return { legRatio, ikFloorDelta, applied };
}
