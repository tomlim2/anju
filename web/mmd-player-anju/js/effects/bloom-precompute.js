import { AnimationMixer, Vector3 } from 'three/webgpu';

const STEP = 1 / 30;
const STRAIGHT_DOT = 0.9;
const UNFURL_LOOKBACK = 10;    // frames
const UNFURL_THRESHOLD = 0.3;  // center Y rise

// --- Signal processing ---

function gaussKernel(sigma, size) {
  const half = (size - 1) / 2;
  const k = [];
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const v = Math.exp(-((i - half) ** 2) / (2 * sigma * sigma));
    k.push(v);
    sum += v;
  }
  return k.map(v => v / sum);
}

function smooth(arr, kernel) {
  const half = (kernel.length - 1) / 2;
  const out = new Float64Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    let s = 0, w = 0;
    for (let k = 0; k < kernel.length; k++) {
      const j = i + k - half;
      if (j >= 0 && j < arr.length) { s += arr[j] * kernel[k]; w += kernel[k]; }
    }
    out[i] = s / w;
  }
  return out;
}

function diff(arr) {
  const out = new Float64Array(arr.length);
  for (let i = 1; i < arr.length; i++) out[i] = (arr[i] - arr[i - 1]) / STEP;
  out[0] = out[1] || 0;
  return out;
}

function findPeaks(signal) {
  const peaks = [];
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
      peaks.push({ idx: i, val: signal[i] });
    }
  }
  return peaks;
}

function filterHeight(peaks, mult) {
  if (peaks.length < 3) return peaks;
  const vals = peaks.map(p => p.val).sort((a, b) => a - b);
  const median = vals[Math.floor(vals.length / 2)];
  return peaks.filter(p => p.val >= median * mult);
}

function filterDistance(peaks, minDist) {
  const sorted = [...peaks].sort((a, b) => b.val - a.val);
  const kept = [];
  for (const p of sorted) {
    if (!kept.some(k => Math.abs(k.idx - p.idx) < minDist)) kept.push(p);
  }
  return kept.sort((a, b) => a.idx - b.idx);
}

function nearestBeat(beats, time) {
  let lo = 0, hi = beats.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid] < time) lo = mid + 1;
    else hi = mid - 1;
  }
  let best = Infinity;
  if (lo < beats.length) best = Math.abs(beats[lo] - time);
  if (lo > 0) best = Math.min(best, Math.abs(beats[lo - 1] - time));
  return best;
}

// --- Bone maps ---

const FINGER_MAP = { '左手首': '左中指１', '右手首': '右中指１' };
const UPPER_ARM_MAP = { '左手首': '左腕', '右手首': '右腕' };
const ELBOW_MAP = { '左手首': '左ひじ', '右手首': '右ひじ' };

// --- Allocate XYZ arrays ---

function xyz(n) {
  return { x: new Float64Array(n), y: new Float64Array(n), z: new Float64Array(n) };
}

function storePos(dst, f, v3) {
  dst.x[f] = v3.x; dst.y[f] = v3.y; dst.z[f] = v3.z;
}

// --- Main ---

export function precomputeBloomEvents(mesh, clip, boneNames, options = {}) {
  const {
    beatTimestamps = null,
    beatTolerance = 0.15,
    minPeakDistance = 10,
    jerkHeightMult = 3,
  } = options;

  const mixer = new AnimationMixer(mesh);
  const action = mixer.clipAction(clip);
  action.play();

  const boneMap = new Map();
  for (const bone of mesh.skeleton.bones) boneMap.set(bone.name, bone);

  const headBone = boneMap.get('頭') || null;
  const centerBone = boneMap.get('センター') || null;

  const entries = [];
  for (const name of boneNames) {
    const bone = boneMap.get(name);
    if (!bone) { console.warn(`[bloom] bone "${name}" not found`); continue; }
    entries.push({
      name, bone,
      finger: boneMap.get(FINGER_MAP[name]) || null,
      upperArm: boneMap.get(UPPER_ARM_MAP[name]) || null,
      elbow: boneMap.get(ELBOW_MAP[name]) || null,
    });
  }

  const duration = clip.duration;
  const N = Math.ceil(duration / STEP) + 1;

  // Phase 1: Sample all bone world positions at 30fps
  const entryData = entries.map(e => ({
    wrist: xyz(N),
    finger: e.finger ? xyz(N) : null,
    upper: e.upperArm ? xyz(N) : null,
    elbow: e.elbow ? xyz(N) : null,
  }));
  const headData = headBone ? xyz(N) : null;
  const centerData = centerBone ? xyz(N) : null;

  const tmp = new Vector3();
  for (let f = 0; f < N; f++) {
    mixer.setTime(Math.min(f * STEP, duration));
    mesh.updateMatrixWorld(true);

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i], d = entryData[i];
      e.bone.getWorldPosition(tmp); storePos(d.wrist, f, tmp);
      if (e.finger) { e.finger.getWorldPosition(tmp); storePos(d.finger, f, tmp); }
      if (e.upperArm) { e.upperArm.getWorldPosition(tmp); storePos(d.upper, f, tmp); }
      if (e.elbow) { e.elbow.getWorldPosition(tmp); storePos(d.elbow, f, tmp); }
    }
    if (headBone) { headBone.getWorldPosition(tmp); storePos(headData, f, tmp); }
    if (centerBone) { centerBone.getWorldPosition(tmp); storePos(centerData, f, tmp); }
  }

  // Phase 2: Compute jerk per wrist, find peaks
  const kernel = gaussKernel(3, 13);
  const events = [];

  for (let i = 0; i < entries.length; i++) {
    const d = entryData[i];
    const w = d.wrist;

    // Smooth position per axis, then differentiate 3 times → jerk
    const sx = smooth(w.x, kernel), sy = smooth(w.y, kernel), sz = smooth(w.z, kernel);
    const vx = diff(sx), vy = diff(sy), vz = diff(sz);
    const ax = diff(vx), ay = diff(vy), az = diff(vz);
    const jx = diff(ax), jy = diff(ay), jz = diff(az);

    // Jerk magnitude
    const jerkMag = new Float64Array(N);
    for (let f = 0; f < N; f++) {
      jerkMag[f] = Math.sqrt(jx[f] * jx[f] + jy[f] * jy[f] + jz[f] * jz[f]);
    }

    // Find and filter peaks
    let peaks = findPeaks(jerkMag);
    peaks = filterHeight(peaks, jerkHeightMult);
    peaks = filterDistance(peaks, minPeakDistance);

    // Beat gating
    if (beatTimestamps && beatTimestamps.length > 0) {
      peaks = peaks.filter(p => nearestBeat(beatTimestamps, p.idx * STEP) <= beatTolerance);
    }

    // Phase 3: Classify pose at each peak
    for (const peak of peaks) {
      const f = peak.idx;
      const t = f * STEP;

      let poseType = 'hit';

      // sky_reach: hand above head AND arm straight
      if (headData && d.upper && d.elbow) {
        const handY = w.y[f];
        const headY = headData.y[f];
        // Arm straightness: dot(upper→elbow, elbow→wrist)
        const ux = d.elbow.x[f] - d.upper.x[f];
        const uy = d.elbow.y[f] - d.upper.y[f];
        const uz = d.elbow.z[f] - d.upper.z[f];
        const ul = Math.sqrt(ux * ux + uy * uy + uz * uz);
        const fx = w.x[f] - d.elbow.x[f];
        const fy = w.y[f] - d.elbow.y[f];
        const fz = w.z[f] - d.elbow.z[f];
        const fl = Math.sqrt(fx * fx + fy * fy + fz * fz);
        if (ul > 0 && fl > 0) {
          const dot = (ux * fx + uy * fy + uz * fz) / (ul * fl);
          if (handY > headY && dot > STRAIGHT_DOT) {
            poseType = 'sky_reach';
          }
        }
      }

      // body_unfurl: center Y rising fast
      if (centerData && poseType === 'hit' && f >= UNFURL_LOOKBACK) {
        const rise = centerData.y[f] - centerData.y[f - UNFURL_LOOKBACK];
        if (rise > UNFURL_THRESHOLD) {
          poseType = 'body_unfurl';
        }
      }

      // Direction: wrist → finger
      let dir = { x: 0, y: 1, z: 0 };
      if (d.finger) {
        const dx = d.finger.x[f] - w.x[f];
        const dy = d.finger.y[f] - w.y[f];
        const dz = d.finger.z[f] - w.z[f];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len > 0) dir = { x: dx / len, y: dy / len, z: dz / len };
      }

      events.push({
        time: t,
        position: { x: w.x[f], y: w.y[f], z: w.z[f] },
        direction: dir,
        type: poseType,
        jerk: peak.val,
      });
    }
  }

  events.sort((a, b) => a.time - b.time);

  // Merge events within 0.15s (both wrists hitting simultaneously)
  const merged = [];
  for (const e of events) {
    const last = merged[merged.length - 1];
    if (last && e.time - last.time < 0.15) {
      if (e.jerk > last.jerk) merged[merged.length - 1] = e;
    } else {
      merged.push(e);
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

  // Debug
  const byType = {};
  for (const e of merged) byType[e.type] = (byType[e.type] || 0) + 1;
  console.log(`[bloom] precomputed ${merged.length} events`, byType);
  const first30 = merged.filter(e => e.time < 30);
  if (first30.length > 0) {
    console.log(`[bloom] first 30s:`, first30.map(e => `${e.time.toFixed(1)}s[${e.type}]`).join(', '));
  }

  return merged;
}
