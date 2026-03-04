import { AnimationMixer, Vector3 } from 'three/webgpu';

const STEP = 1 / 30;
const THRESHOLD = 15;
const SMOOTHING = 0.3;
const COOLDOWN = 3; // frames (~0.1s)

export function precomputeSparkEvents(mesh, clip, boneNames) {
  const mixer = new AnimationMixer(mesh);
  const action = mixer.clipAction(clip);
  action.play();

  const boneMap = new Map();
  for (const bone of mesh.skeleton.bones) boneMap.set(bone.name, bone);

  const entries = [];
  for (const name of boneNames) {
    const bone = boneMap.get(name);
    if (!bone) continue;
    entries.push({ name, bone });
  }

  const duration = clip.duration;
  const N = Math.ceil(duration / STEP) + 1;
  const tmp = new Vector3();

  // Sample positions
  const positions = entries.map(() => []);
  for (let f = 0; f < N; f++) {
    mixer.setTime(Math.min(f * STEP, duration));
    mesh.updateMatrixWorld(true);
    for (let i = 0; i < entries.length; i++) {
      entries[i].bone.getWorldPosition(tmp);
      positions[i].push({ x: tmp.x, y: tmp.y, z: tmp.z });
    }
  }

  // Detect speed threshold crossings with EMA smoothing
  const events = [];
  for (let i = 0; i < entries.length; i++) {
    const pos = positions[i];
    let sx = 0, sy = 0, sz = 0;
    let cd = 0;

    for (let f = 1; f < N; f++) {
      const rx = (pos[f].x - pos[f - 1].x) / STEP;
      const ry = (pos[f].y - pos[f - 1].y) / STEP;
      const rz = (pos[f].z - pos[f - 1].z) / STEP;

      sx += (rx - sx) * SMOOTHING;
      sy += (ry - sy) * SMOOTHING;
      sz += (rz - sz) * SMOOTHING;

      const speed = Math.sqrt(sx * sx + sy * sy + sz * sz);

      if (cd > 0) { cd--; continue; }

      if (speed > THRESHOLD) {
        cd = COOLDOWN;
        events.push({
          time: f * STEP,
          position: { x: pos[f].x, y: pos[f].y, z: pos[f].z },
          velocity: { x: sx, y: sy, z: sz },
          speed,
        });
      }
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

  console.log(`[spark] precomputed ${events.length} events`);
  return events;
}

const FOOT_GROUND_Y = 2.0;
const FOOT_COOLDOWN = 10;    // ~0.33s at 30fps

export function precomputeFootEvents(mesh, clip, boneNames) {
  const mixer = new AnimationMixer(mesh);
  const action = mixer.clipAction(clip);
  action.play();

  const boneMap = new Map();
  for (const bone of mesh.skeleton.bones) boneMap.set(bone.name, bone);

  const entries = [];
  for (const name of boneNames) {
    const bone = boneMap.get(name);
    if (!bone) continue;
    entries.push({ name, bone });
  }

  if (entries.length === 0) {
    action.stop();
    mixer.stopAllAction();
    mixer.uncacheRoot(mesh);
    mixer.uncacheClip(clip);
    return [];
  }

  const duration = clip.duration;
  const N = Math.ceil(duration / STEP) + 1;
  const tmp = new Vector3();

  const positions = entries.map(() => []);
  for (let f = 0; f < N; f++) {
    mixer.setTime(Math.min(f * STEP, duration));
    mesh.updateMatrixWorld(true);
    for (let i = 0; i < entries.length; i++) {
      entries[i].bone.getWorldPosition(tmp);
      positions[i].push({ x: tmp.x, y: tmp.y, z: tmp.z });
    }
  }

  const events = [];
  for (let i = 0; i < entries.length; i++) {
    const pos = positions[i];
    let cd = 0;

    for (let f = 2; f < N; f++) {
      if (cd > 0) { cd--; continue; }

      // Detect local Y minimum near ground (foot descending then stopping/rising)
      const prevVy = pos[f - 1].y - pos[f - 2].y;
      const curVy = pos[f].y - pos[f - 1].y;
      const speed = Math.abs(prevVy / STEP);
      if (prevVy <= 0 && curVy >= 0 && pos[f - 1].y <= FOOT_GROUND_Y && speed > 1.0) {
        cd = FOOT_COOLDOWN;
        events.push({
          time: (f - 1) * STEP,
          position: { x: pos[f - 1].x, y: 0, z: pos[f - 1].z },
          speed,
        });
      }
    }
  }

  events.sort((a, b) => a.time - b.time);

  action.stop();
  mixer.stopAllAction();
  mixer.uncacheRoot(mesh);
  mixer.uncacheClip(clip);
  if (mesh.skeleton) mesh.skeleton.pose();
  if (mesh.morphTargetInfluences) mesh.morphTargetInfluences.fill(0);
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);

  for (let i = 0; i < entries.length; i++) {
    const ys = positions[i].map(p => p.y);
    console.log(`[ripple] ${entries[i].name} Y range: ${Math.min(...ys).toFixed(2)} ~ ${Math.max(...ys).toFixed(2)}`);
  }
  console.log(`[ripple] precomputed ${events.length} foot contact events (threshold=${FOOT_GROUND_Y})`);
  return events;
}
