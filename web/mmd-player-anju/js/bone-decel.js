import { Vector3 } from 'three/webgpu';

export class BoneDecelerationTracker {
  constructor({ boneNames = [], highThreshold = 20, lowThreshold = 3, smoothing = 0.3 } = {}) {
    this.boneNames = boneNames;
    this.highThreshold = highThreshold;
    this.lowThreshold = lowThreshold;
    this.smoothing = smoothing;
    this.enabled = true;

    this._bones = [];       // { name, bone, prevPos, smoothSpeed, prevSpeed, peakSpeed, lastHighDir }
    this._listeners = [];
    this._bound = false;
  }

  bind(mesh) {
    this.unbind();
    if (!mesh || !mesh.skeleton) return;

    const boneMap = new Map();
    for (const bone of mesh.skeleton.bones) {
      boneMap.set(bone.name, bone);
    }

    for (const name of this.boneNames) {
      const bone = boneMap.get(name);
      if (!bone) {
        console.warn(`[BoneDecelerationTracker] bone "${name}" not found`);
        continue;
      }
      const pos = new Vector3();
      bone.getWorldPosition(pos);
      this._bones.push({
        name,
        bone,
        prevPos: pos.clone(),
        smoothSpeed: 0,
        prevSpeed: 0,
        peakSpeed: 0,
        lastHighDir: new Vector3(),
      });
    }

    this._bound = true;
  }

  unbind() {
    this._bones.length = 0;
    this._bound = false;
  }

  update(delta) {
    if (!this.enabled || !this._bound || delta <= 0) return;

    const dt = Math.min(delta, 0.1);
    const currentPos = new Vector3();

    for (const entry of this._bones) {
      entry.bone.getWorldPosition(currentPos);

      // raw velocity
      const rawVel = currentPos.clone().sub(entry.prevPos).divideScalar(dt);
      entry.prevPos.copy(currentPos);

      const rawSpeed = rawVel.length();

      // EMA smooth speed
      entry.smoothSpeed += (rawSpeed - entry.smoothSpeed) * this.smoothing;

      // Track peak speed and direction while fast
      if (entry.smoothSpeed > this.highThreshold) {
        if (entry.smoothSpeed > entry.peakSpeed) {
          entry.peakSpeed = entry.smoothSpeed;
        }
        rawVel.normalize();
        entry.lastHighDir.copy(rawVel);
      }

      // Deceleration trigger: was fast, now slow
      if (entry.prevSpeed > this.highThreshold && entry.smoothSpeed < this.lowThreshold) {
        for (const cb of this._listeners) {
          cb(entry.name, currentPos.clone(), entry.lastHighDir.clone(), entry.peakSpeed);
        }
        entry.peakSpeed = 0;
      }

      entry.prevSpeed = entry.smoothSpeed;
    }
  }

  onTrigger(cb) {
    this._listeners.push(cb);
  }

  offTrigger(cb) {
    const idx = this._listeners.indexOf(cb);
    if (idx !== -1) this._listeners.splice(idx, 1);
  }
}
