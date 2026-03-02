import {
  PointsNodeMaterial,
  AdditiveBlending,
  Points,
  BufferGeometry,
  BufferAttribute,
} from 'three/webgpu';
import { float } from 'three/tsl';

const MAX = 128;
const SPAWN_RANGE_X = 30;
const SPAWN_RANGE_Z = 30;
const SPAWN_Y_MIN = -2;
const SPAWN_Y_MAX = 5;
const RISE_SPEED_MIN = 1.5;
const RISE_SPEED_MAX = 4.0;
const LIFETIME = 4.0;
const FADE_Y = 25;

// Wind field parameters
const WIND_DECAY = 0.98;       // slow decay — wind lingers long
const WIND_STRENGTH = 18.0;    // strong horizontal push
const WIND_RISE_BOOST = 6.0;   // big upward surge on impulse
const WIND_RADIUS = 25;        // wide influence radius

export class RisingLightEffect {
  constructor(scene) {
    this.scene = scene;
    this.enabled = true;

    this._posArr = new Float32Array(MAX * 3);
    this._velArr = new Float32Array(MAX * 3); // per-particle velocity (x, y, z)
    this._baseSpeed = new Float32Array(MAX);  // base rise speed
    this._ageArr = new Float32Array(MAX);

    // Precomputed events
    this._events = [];
    this._nextIdx = 0;

    // Stagger initial spawns
    for (let i = 0; i < MAX; i++) {
      this._respawn(i);
      this._ageArr[i] = Math.random() * LIFETIME;
      this._posArr[i * 3 + 1] += this._baseSpeed[i] * this._ageArr[i];
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(this._posArr, 3));

    const mat = new PointsNodeMaterial();
    mat.transparent = true;
    mat.blending = AdditiveBlending;
    mat.depthWrite = false;
    mat.sizeNode = float(2.5);
    mat.sizeAttenuation = true;
    mat.color.set(0xaaddff);

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

  _respawn(i) {
    const i3 = i * 3;
    this._posArr[i3] = (Math.random() - 0.5) * SPAWN_RANGE_X;
    this._posArr[i3 + 1] = SPAWN_Y_MIN + Math.random() * (SPAWN_Y_MAX - SPAWN_Y_MIN);
    this._posArr[i3 + 2] = (Math.random() - 0.5) * SPAWN_RANGE_Z;
    this._baseSpeed[i] = RISE_SPEED_MIN + Math.random() * (RISE_SPEED_MAX - RISE_SPEED_MIN);
    this._velArr[i3] = 0;
    this._velArr[i3 + 1] = 0;
    this._velArr[i3 + 2] = 0;
    this._ageArr[i] = 0;
  }

  _applyImpulse(evt) {
    if (evt.speed < 25) return;

    const vx = evt.velocity.x;
    const vz = evt.velocity.z;
    const hLen = Math.sqrt(vx * vx + vz * vz) || 1;
    const dirX = vx / hLen;
    const dirZ = vz / hLen;

    // Per-particle kick: closer = stronger, farther = weaker
    const cx = evt.position.x;
    const cz = evt.position.z;
    const posArr = this._posArr;
    const velArr = this._velArr;

    for (let i = 0; i < MAX; i++) {
      const i3 = i * 3;
      const dx = posArr[i3] - cx;
      const dz = posArr[i3 + 2] - cz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > WIND_RADIUS) continue;

      const falloff = 1 - dist / WIND_RADIUS;
      velArr[i3] += dirX * WIND_STRENGTH * falloff;
      velArr[i3 + 1] += WIND_RISE_BOOST * falloff;
      velArr[i3 + 2] += dirZ * WIND_STRENGTH * falloff;
    }
  }

  update(delta, animationTime) {
    if (!this.enabled) {
      if (this._mesh.visible) this._mesh.visible = false;
      return;
    }
    if (!this._mesh.visible) this._mesh.visible = true;

    // Fire precomputed impulses
    if (animationTime !== undefined) {
      while (this._nextIdx < this._events.length && this._events[this._nextIdx].time <= animationTime) {
        this._applyImpulse(this._events[this._nextIdx]);
        this._nextIdx++;
      }
    }

    const dt = Math.min(delta, 0.1);
    const posArr = this._posArr;
    const velArr = this._velArr;

    for (let i = 0; i < MAX; i++) {
      this._ageArr[i] += dt;

      if (this._ageArr[i] >= LIFETIME || posArr[i * 3 + 1] > FADE_Y) {
        this._respawn(i);
        continue;
      }

      const i3 = i * 3;

      // Decay per-particle velocity
      velArr[i3] *= WIND_DECAY;
      velArr[i3 + 1] *= WIND_DECAY;
      velArr[i3 + 2] *= WIND_DECAY;

      // Base rise + per-particle impulse
      posArr[i3] += velArr[i3] * dt;
      posArr[i3 + 1] += (this._baseSpeed[i] + velArr[i3 + 1]) * dt;
      posArr[i3 + 2] += velArr[i3 + 2] * dt;

      // Gentle sine drift
      posArr[i3] += Math.sin(this._ageArr[i] * 0.8 + i) * 0.3 * dt;
    }

    this._mesh.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this._mesh);
    this._mesh.geometry.dispose();
    this._mesh.material.dispose();
  }
}
