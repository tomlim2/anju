import {
  PointsNodeMaterial,
  AdditiveBlending,
  Points,
  BufferGeometry,
  BufferAttribute,
} from 'three/webgpu';
import { float } from 'three/tsl';

const MAX = 256;
const BURST_COUNT = 32;
const BASE_SPEED = 2.0;
const DRAG = 0.92;
const OFFSCREEN_Y = -10000;

export class BloomBurstEffect {
  constructor(scene) {
    this.scene = scene;
    this.enabled = true;

    this._velArr = new Float32Array(MAX * 3);
    this._ageArr = new Float32Array(MAX);
    this._lifetimeArr = new Float32Array(MAX);
    this._ageArr.fill(1.0);
    this._lifetimeArr.fill(0.3);

    this._head = 0;
    this._activeCount = 0;

    // Geometry — MAX points, dead ones parked offscreen
    const posArr = new Float32Array(MAX * 3);
    for (let i = 0; i < MAX; i++) posArr[i * 3 + 1] = OFFSCREEN_Y;

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(posArr, 3));
    this._posArr = posArr;

    // Material — warm white, additive
    const mat = new PointsNodeMaterial();
    mat.transparent = true;
    mat.blending = AdditiveBlending;
    mat.depthWrite = false;
    mat.sizeNode = float(6.0);
    mat.sizeAttenuation = true;
    mat.color.set(0xffeedd);

    this._mesh = new Points(geo, mat);
    this._mesh.frustumCulled = false;
    this.scene.add(this._mesh);
  }

  trigger(boneName, position, normalDir, peakSpeed) {
    if (!this.enabled) return;

    const posArr = this._posArr;
    const velArr = this._velArr;
    const ageArr = this._ageArr;
    const lifetimeArr = this._lifetimeArr;

    // Map peakSpeed to lifetime: faster motion → longer bloom
    const lifetime = 0.2 + Math.min(peakSpeed / 40, 1.0) * 0.6;

    for (let j = 0; j < BURST_COUNT; j++) {
      const i = this._head;
      this._head = (this._head + 1) % MAX;

      // Spread around normalDir
      const sx = normalDir.x + (Math.random() - 0.5) * 1.2;
      const sy = normalDir.y + (Math.random() - 0.5) * 1.2;
      const sz = normalDir.z + (Math.random() - 0.5) * 1.2;
      const len = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
      const spd = BASE_SPEED * (0.5 + Math.random() * 0.8);

      const i3 = i * 3;
      posArr[i3] = position.x;
      posArr[i3 + 1] = position.y;
      posArr[i3 + 2] = position.z;

      velArr[i3] = (sx / len) * spd;
      velArr[i3 + 1] = (sy / len) * spd;
      velArr[i3 + 2] = (sz / len) * spd;

      ageArr[i] = 0;
      lifetimeArr[i] = lifetime * (0.8 + Math.random() * 0.4);
    }

    this._activeCount = MAX;
  }

  update(delta) {
    if (!this.enabled || this._activeCount <= 0) return;

    const dt = Math.min(delta, 0.1);
    const posArr = this._posArr;
    const velArr = this._velArr;
    const ageArr = this._ageArr;
    const lifetimeArr = this._lifetimeArr;
    let alive = 0;

    for (let i = 0; i < MAX; i++) {
      if (ageArr[i] >= 1.0) continue;

      ageArr[i] += dt / lifetimeArr[i];

      if (ageArr[i] >= 1.0) {
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
