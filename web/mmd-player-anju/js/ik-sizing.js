import { AnimationMixer, Vector3 } from 'three/webgpu';

const STEP = 1 / 30;

/**
 * Scale IK/center/groove position Y by target-to-source hip height ratio.
 * Fixes foot floating/sinking when VMD was authored for a different body proportion.
 */
export function autoSizeIK(clip, mesh) {
  const skeleton = mesh.skeleton;
  if (!skeleton) return null;

  const boneMap = new Map();
  for (const bone of skeleton.bones) boneMap.set(bone.name, bone);

  // --- Step 1: Target hip Y from rest pose ---
  const centerBone = boneMap.get('センター');
  const ikL = boneMap.get('左足ＩＫ');
  const ikR = boneMap.get('右足ＩＫ');
  if (!centerBone || !ikL || !ikR) return null;

  skeleton.pose();
  mesh.updateMatrixWorld(true);

  const tmp = new Vector3();
  centerBone.getWorldPosition(tmp);
  const targetHipY = tmp.y;

  ikL.getWorldPosition(tmp);
  const targetIkY = tmp.y;

  if (targetHipY <= 0) return null;

  // --- Step 2: Source hip estimation via animation sampling ---
  const mixer = new AnimationMixer(mesh);
  const action = mixer.clipAction(clip);
  action.play();

  const duration = clip.duration;
  const N = Math.ceil(duration / STEP) + 1;
  const groundThreshold = targetIkY + 1.0;

  const contactCenterYs = [];

  for (let f = 0; f < N; f++) {
    mixer.setTime(Math.min(f * STEP, duration));
    mesh.updateMatrixWorld(true);

    // Check if either foot IK is near ground
    ikL.getWorldPosition(tmp);
    const lyIK = tmp.y;
    ikR.getWorldPosition(tmp);
    const ryIK = tmp.y;

    if (lyIK <= groundThreshold || ryIK <= groundThreshold) {
      centerBone.getWorldPosition(tmp);
      contactCenterYs.push(tmp.y);
    }
  }

  // Cleanup mixer
  action.stop();
  mixer.stopAllAction();
  mixer.uncacheRoot(mesh);
  mixer.uncacheClip(clip);
  skeleton.pose();
  if (mesh.morphTargetInfluences) mesh.morphTargetInfluences.fill(0);
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);

  if (contactCenterYs.length === 0) return null;

  // Median of ground-contact center Y = source hip height estimate
  contactCenterYs.sort((a, b) => a - b);
  const mid = contactCenterYs.length >> 1;
  const sourceHipY = contactCenterYs.length % 2
    ? contactCenterYs[mid]
    : (contactCenterYs[mid - 1] + contactCenterYs[mid]) / 2;

  if (sourceHipY <= 0) return null;

  // --- Step 3: Ratio & apply ---
  const ratio = targetHipY / sourceHipY;

  if (Math.abs(ratio - 1.0) < 0.05) {
    console.log(`[sizing] skip ratio=${ratio.toFixed(3)} (within 5%)`);
    return null;
  }

  if (ratio > 2.0 || ratio < 0.5) {
    console.warn(`[sizing] abnormal ratio=${ratio.toFixed(3)}, skipping`);
    return null;
  }

  const TARGET_BONES = ['センター', 'グルーブ', '左足ＩＫ', '右足ＩＫ'];
  const applied = [];

  for (const boneName of TARGET_BONES) {
    const trackName = `.bones[${boneName}].position`;
    const track = clip.tracks.find(t => t.name.endsWith(trackName));
    if (!track) continue;

    const values = track.values;
    for (let i = 1; i < values.length; i += 3) {
      values[i] *= ratio; // Y component
    }
    applied.push(boneName);
  }

  if (applied.length === 0) return null;

  console.log(`[sizing] ratio=${ratio.toFixed(3)} target=${targetHipY.toFixed(1)} source=${sourceHipY.toFixed(1)} → ${applied.join(', ')}`);
  return { ratio, targetHipY, sourceHipY, applied };
}
