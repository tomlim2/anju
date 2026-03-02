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
const SPAWN_Y_MIN = 20;
const SPAWN_Y_MAX = 28;
const FALL_SPEED_MIN = 1.5;
const FALL_SPEED_MAX = 4.0;
const LIFETIME = 4.0;
const FADE_Y = -2;

export class FallingLightEffect {
  constructor(scene) {
    this.scene = scene;
    this.enabled = true;

    this._posArr = new Float32Array(MAX * 3);
    this._speedArr = new Float32Array(MAX);
    this._ageArr = new Float32Array(MAX);

    // Stagger initial spawns across the full lifetime
    for (let i = 0; i < MAX; i++) {
      this._respawn(i);
      this._ageArr[i] = Math.random() * LIFETIME;
      // Set initial y based on pre-aged time (falling = subtract)
      this._posArr[i * 3 + 1] -= this._speedArr[i] * this._ageArr[i];
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

  _respawn(i) {
    const i3 = i * 3;
    this._posArr[i3] = (Math.random() - 0.5) * SPAWN_RANGE_X;
    this._posArr[i3 + 1] = SPAWN_Y_MIN + Math.random() * (SPAWN_Y_MAX - SPAWN_Y_MIN);
    this._posArr[i3 + 2] = (Math.random() - 0.5) * SPAWN_RANGE_Z;
    this._speedArr[i] = FALL_SPEED_MIN + Math.random() * (FALL_SPEED_MAX - FALL_SPEED_MIN);
    this._ageArr[i] = 0;
  }

  update(delta) {
    if (!this.enabled) {
      if (this._mesh.visible) {
        this._mesh.visible = false;
      }
      return;
    }
    if (!this._mesh.visible) this._mesh.visible = true;

    const dt = Math.min(delta, 0.1);
    const posArr = this._posArr;

    for (let i = 0; i < MAX; i++) {
      this._ageArr[i] += dt;

      if (this._ageArr[i] >= LIFETIME || posArr[i * 3 + 1] < FADE_Y) {
        this._respawn(i);
        continue;
      }

      // Fall (subtract speed)
      posArr[i * 3 + 1] -= this._speedArr[i] * dt;

      // Gentle horizontal drift
      posArr[i * 3] += Math.sin(this._ageArr[i] * 0.8 + i) * 0.3 * dt;
    }

    this._mesh.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this._mesh);
    this._mesh.geometry.dispose();
    this._mesh.material.dispose();
  }
}
