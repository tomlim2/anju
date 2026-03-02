import { AnimationMixer, Vector3 } from 'three/webgpu';

const STEP = 1 / 30;
const FAST_SPEED = 25;   // speed above this → "was fast"
const STOP_SPEED = 3;    // speed below this → "stopped"

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
      bone,
      prevPos: new Vector3(),
      lastFastDir: new Vector3(),
      wasFast: false,
    });
  }

  // Initialize at t=0
  mixer.setTime(0);
  mesh.updateMatrixWorld(true);
  for (const entry of entries) {
    entry.bone.getWorldPosition(entry.prevPos);
  }

  const events = [];
  const pos = new Vector3();
  const vel = new Vector3();
  const duration = clip.duration;

  for (let t = STEP; t <= duration; t += STEP) {
    mixer.setTime(t);
    mesh.updateMatrixWorld(true);

    for (const entry of entries) {
      entry.bone.getWorldPosition(pos);

      vel.copy(pos).sub(entry.prevPos).divideScalar(STEP);
      const speed = vel.length();

      // Track: was this bone moving fast recently?
      if (speed > FAST_SPEED) {
        entry.wasFast = true;
        vel.divideScalar(speed);  // normalize
        entry.lastFastDir.copy(vel);
      }

      // Fire: was fast, now stopped
      if (entry.wasFast && speed < STOP_SPEED) {
        entry.wasFast = false;
        events.push({
          time: t,
          position: { x: pos.x, y: pos.y, z: pos.z },
          direction: { x: entry.lastFastDir.x, y: entry.lastFastDir.y, z: entry.lastFastDir.z },
        });
      }

      entry.prevPos.copy(pos);
    }
  }

  events.sort((a, b) => a.time - b.time);

  // Cleanup
  action.stop();
  mixer.stopAllAction();
  mixer.uncacheRoot(mesh);
  mixer.uncacheClip(clip);

  if (mesh.skeleton) mesh.skeleton.pose();
  if (mesh.morphTargetInfluences) mesh.morphTargetInfluences.fill(0);
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);

  // Debug: speed distribution and event timing
  const early = events.filter(e => e.time < 30);
  const late = events.filter(e => e.time >= 30);
  console.log(`[bloom] precomputed ${events.length} events (first 30s: ${early.length}, after: ${late.length})`);
  if (early.length > 0) {
    console.log(`[bloom] first 30s events:`, early.map(e => e.time.toFixed(2) + 's'));
  }
  return events;
}
