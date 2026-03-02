import { Vector3 } from 'three/webgpu';

export class BoneVelocityTracker {
  constructor({ boneNames = [], threshold = 15, smoothing = 0.3, cooldown = 0.08 } = {}) {
    this.boneNames = boneNames;
    this.threshold = threshold;
    this.smoothing = smoothing;
    this.cooldown = cooldown;
    this.enabled = true;

    this._bones = [];       // { name, bone, prevPos, smoothVel, cooldown }
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
        console.warn(`[BoneVelocityTracker] bone "${name}" not found`);
        continue;
      }
      const pos = new Vector3();
      bone.getWorldPosition(pos);
      this._bones.push({
        name,
        bone,
        prevPos: pos.clone(),
        smoothVel: new Vector3(),
        cooldown: 0,
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

      // EMA smoothing
      entry.smoothVel.lerp(rawVel, this.smoothing);

      // cooldown countdown
      entry.cooldown = Math.max(0, entry.cooldown - dt);

      // threshold check
      const speed = entry.smoothVel.length();
      if (speed > this.threshold && entry.cooldown <= 0) {
        entry.cooldown = this.cooldown;
        const v = entry.smoothVel;
        console.log(`[Trigger] ${entry.name} pos(${currentPos.x.toFixed(1)},${currentPos.y.toFixed(1)},${currentPos.z.toFixed(1)}) vel(${v.x.toFixed(1)},${v.y.toFixed(1)},${v.z.toFixed(1)}) spd=${speed.toFixed(1)}`);
        for (const cb of this._listeners) {
          cb(entry.name, currentPos.clone(), entry.smoothVel.clone(), speed);
        }
      }
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
