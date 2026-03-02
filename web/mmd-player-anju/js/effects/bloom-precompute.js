import { AnimationMixer, Vector3 } from 'three/webgpu';

const STEP = 1 / 30;
const HIGH_THRESHOLD = 20;
const LOW_THRESHOLD = 3;
const SMOOTHING = 0.3;

export function precomputeBloomEvents(mesh, clip, boneNames) {
  const mixer = new AnimationMixer(mesh);
  const action = mixer.clipAction(clip);
  action.play();

  const boneMap = new Map();
  for (const bone of mesh.skeleton.bones) {
    boneMap.set(bone.name, bone);
  }

  const entries = [];
  for (const name of boneNames) {
    const bone = boneMap.get(name);
    if (!bone) {
      console.warn(`[bloom] bone "${name}" not found`);
      continue;
    }
    entries.push({
      name,
      bone,
      prevPos: new Vector3(),
      smoothSpeed: 0,
      wasHigh: false,
      peakSpeed: 0,
      lastHighDir: new Vector3(),
    });
  }

  // Initialize positions at t=0
  mixer.setTime(0);
  mesh.updateMatrixWorld(true);
  for (const entry of entries) {
    entry.bone.getWorldPosition(entry.prevPos);
  }

  const events = [];
  const currentPos = new Vector3();
  const rawVel = new Vector3();
  const duration = clip.duration;

  for (let t = STEP; t <= duration; t += STEP) {
    mixer.setTime(t);
    mesh.updateMatrixWorld(true);

    for (const entry of entries) {
      entry.bone.getWorldPosition(currentPos);

      rawVel.copy(currentPos).sub(entry.prevPos).divideScalar(STEP);
      entry.prevPos.copy(currentPos);

      const rawSpeed = rawVel.length();
      entry.smoothSpeed += (rawSpeed - entry.smoothSpeed) * SMOOTHING;

      if (entry.smoothSpeed > HIGH_THRESHOLD) {
        entry.wasHigh = true;
        if (entry.smoothSpeed > entry.peakSpeed) {
          entry.peakSpeed = entry.smoothSpeed;
          rawVel.normalize();
          entry.lastHighDir.copy(rawVel);
        }
      }

      if (entry.wasHigh && entry.smoothSpeed < LOW_THRESHOLD) {
        entry.wasHigh = false;

        const dir = entry.lastHighDir;
        const isUpward = dir.y > 0.4;
        const dx = currentPos.x;
        const dz = currentPos.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const outDot = (dir.x * dx + dir.z * dz) / len;
        const isOutward = outDot > 0.5;

        if (isUpward || isOutward) {
          events.push({
            time: t,
            position: { x: currentPos.x, y: currentPos.y, z: currentPos.z },
            direction: { x: dir.x, y: dir.y, z: dir.z },
          });
        }

        entry.peakSpeed = 0;
      }
    }
  }

  // Cleanup
  action.stop();
  mixer.stopAllAction();
  mixer.uncacheRoot(mesh);
  mixer.uncacheClip(clip);

  if (mesh.skeleton) mesh.skeleton.pose();
  if (mesh.morphTargetInfluences) mesh.morphTargetInfluences.fill(0);
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);

  console.log(`[bloom] precomputed ${events.length} events`);
  return events;
}
