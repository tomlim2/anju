// Bone retarget: detect source model and apply quaternion offsets to correct
// rest pose differences (e.g. ミリシタ arms fold inward on standard Miku).

import { Quaternion } from 'three';

const SOURCE_PROFILES = {
  millishita: {
    detect: (trackBones, droppedBones) =>
      droppedBones.has('左ダミー') || droppedBones.has('右ダミー'),
    offsets: {
      '左腕':  [0, 0,  0.130, 0.991],   // ~15° Z-axis outward
      '右腕':  [0, 0, -0.130, 0.991],   // mirrored
    },
  },
};

/**
 * Pre-multiply a quaternion offset onto every keyframe of a quaternion track.
 * offset * original for each sample.
 */
function applyTrackOffset(track, offset) {
  const oq = new Quaternion(offset[0], offset[1], offset[2], offset[3]).normalize();
  const kq = new Quaternion();
  const values = track.values;

  for (let i = 0; i < values.length; i += 4) {
    kq.set(values[i], values[i + 1], values[i + 2], values[i + 3]);
    kq.premultiply(oq);
    values[i]     = kq.x;
    values[i + 1] = kq.y;
    values[i + 2] = kq.z;
    values[i + 3] = kq.w;
  }
}

/**
 * Detect source model profile and apply bone offsets to clip tracks.
 * @param {THREE.AnimationClip} clip
 * @param {Set<string>} trackBones - bone names present in VMD tracks
 * @param {Set<string>} droppedBones - bone names missing from PMX
 * @returns {{ profile: string|null, applied: string[] }}
 */
export function retargetClip(clip, trackBones, droppedBones) {
  for (const [name, profile] of Object.entries(SOURCE_PROFILES)) {
    if (!profile.detect(trackBones, droppedBones)) continue;

    const applied = [];
    for (const [boneName, offset] of Object.entries(profile.offsets)) {
      const trackName = `.bones[${boneName}].quaternion`;
      const track = clip.tracks.find(t => t.name.endsWith(trackName));
      if (!track) continue;

      applyTrackOffset(track, offset);
      applied.push(boneName);
    }

    console.info(`[MMD] Retarget: ${name} profile, applied to: ${applied.join(', ')}`);
    return { profile: name, applied };
  }

  return { profile: null, applied: [] };
}
