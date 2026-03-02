import {
  PointsNodeMaterial,
  AdditiveBlending,
  Points,
  BufferGeometry,
  BufferAttribute,
} from 'three/webgpu';
import { float } from 'three/tsl';
import { VelocityEffect } from './velocity-effect.js';

const MAX = 256;
const BURST_COUNT = 24;
const LIFETIME = 0.25;
const BASE_SPEED = 3;
const DRAG = 0.85;
const OFFSCREEN_Y = -10000;

export class SparkBurstEffect extends VelocityEffect {
  constructor(scene, renderer) {
    super(scene, renderer);

    this._velArr = new Float32Array(MAX * 3);
    this._ageArr = new Float32Array(MAX);
    this._ageArr.fill(1.0);

    this._head = 0;
    this._activeCount = 0;
    this._events = [];
    this._nextIdx = 0;

    // Geometry — MAX points, dead ones parked offscreen
    const posArr = new Float32Array(MAX * 3);
    for (let i = 0; i < MAX; i++) posArr[i * 3 + 1] = OFFSCREEN_Y;

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(posArr, 3));
    this._posArr = posArr;

    // Material — plain white points, additive
    const mat = new PointsNodeMaterial();
    mat.transparent = true;
    mat.blending = AdditiveBlending;
    mat.depthWrite = false;
    mat.sizeNode = float(4.0);
    mat.sizeAttenuation = true;
    mat.color.set(0xffffff);

    this._mesh = new Points(geo, mat);
    this._mesh.frustumCulled = false;
    this.scene.add(this._mesh);
  }

  setEvents(events) {
    this._events = events;
    this._nextIdx = 0;
  }

  resetTime() {
    this._nextIdx = 0;
  }

  seekTo(time) {
    let lo = 0, hi = this._events.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this._events[mid].time <= time) lo = mid + 1;
      else hi = mid;
    }
    this._nextIdx = lo;
  }

  trigger(boneName, position, velocity, speed) {
    if (!this.enabled) return;

    const posArr = this._posArr;
    const velArr = this._velArr;
    const ageArr = this._ageArr;
    const vx = velocity.x, vy = velocity.y, vz = velocity.z;
    const len = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
    const dir = { x: vx / len, y: vy / len, z: vz / len };

    for (let j = 0; j < BURST_COUNT; j++) {
      const i = this._head;
      this._head = (this._head + 1) % MAX;

      const sx = dir.x + (Math.random() - 0.5) * 0.8;
      const sy = dir.y + (Math.random() - 0.5) * 0.8;
      const sz = dir.z + (Math.random() - 0.5) * 0.8;
      const len = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
      const spd = BASE_SPEED * (0.7 + Math.random() * 0.6);

      const i3 = i * 3;
      posArr[i3] = position.x;
      posArr[i3 + 1] = position.y;
      posArr[i3 + 2] = position.z;

      velArr[i3] = (sx / len) * spd;
      velArr[i3 + 1] = (sy / len) * spd;
      velArr[i3 + 2] = (sz / len) * spd;

      ageArr[i] = 0;
    }

    this._activeCount = MAX;
  }

  update(delta, animationTime) {
    if (!this.enabled) return;

    // Fire precomputed events
    while (this._nextIdx < this._events.length && this._events[this._nextIdx].time <= animationTime) {
      const evt = this._events[this._nextIdx];
      this.trigger(null, evt.position, evt.velocity, evt.speed);
      this._nextIdx++;
    }

    if (this._activeCount <= 0) return;

    const dt = Math.min(delta, 0.1);
    const posArr = this._posArr;
    const velArr = this._velArr;
    const ageArr = this._ageArr;
    let alive = 0;

    for (let i = 0; i < MAX; i++) {
      if (ageArr[i] >= 1.0) continue;

      ageArr[i] += dt / LIFETIME;

      if (ageArr[i] >= 1.0) {
        // Park dead particle offscreen
        posArr[i * 3 + 1] = OFFSCREEN_Y;
        continue;
      }

      alive++;
      const i3 = i * 3;
      posArr[i3] += velArr[i3] * dt;
      posArr[i3 + 1] += velArr[i3 + 1] * dt;
      posArr[i3 + 2] += velArr[i3 + 2] * dt;
      velArr[i3] *= DRAG;
      velArr[i3 + 1] *= DRAG;
      velArr[i3 + 2] *= DRAG;
    }

    this._activeCount = alive;
    this._mesh.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this._mesh);
    this._mesh.geometry.dispose();
    this._mesh.material.dispose();
  }
}
