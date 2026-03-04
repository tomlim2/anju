import {
  InstancedMesh,
  RingGeometry,
  MeshBasicNodeMaterial,
  AdditiveBlending,
  Matrix4,
  Quaternion,
  Vector3,
  Color,
} from 'three/webgpu';

const MAX = 16;
const LIFETIME = 1.4;
const MIN_RADIUS = 1.5;
const MAX_RADIUS = 6.0;
const SPEED_LOW = 5;           // gentle step — minimum ripple
const SPEED_HIGH = 40;         // hard jump landing — full ripple
const RING_THICK = 0.06;       // ring width as fraction of outer radius

export class FootRippleEffect {
  constructor(scene) {
    this.scene = scene;
    this.enabled = true;

    this._ageArr = new Float32Array(MAX).fill(LIFETIME);
    this._posArr = new Float32Array(MAX * 3);
    this._radiusArr = new Float32Array(MAX);   // per-ripple max radius
    this._nextSlot = 0;

    this._events = [];
    this._nextIdx = 0;

    this._mat4 = new Matrix4();
    this._vec3 = new Vector3();
    this._scaleVec = new Vector3();
    this._color = new Color();
    this._flatQ = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

    const geo = new RingGeometry(1 - RING_THICK, 1, 32);
    const mat = new MeshBasicNodeMaterial();
    mat.transparent = true;
    mat.blending = AdditiveBlending;
    mat.depthWrite = false;
    mat.color.set(0xccddff);

    this._mesh = new InstancedMesh(geo, mat, MAX);
    this._mesh.frustumCulled = false;

    const zero = new Vector3(0, 0, 0);
    const black = new Color(0, 0, 0);
    for (let i = 0; i < MAX; i++) {
      this._mat4.compose(zero, this._flatQ, zero);
      this._mesh.setMatrixAt(i, this._mat4);
      this._mesh.setColorAt(i, black);
    }

    this.scene.add(this._mesh);
  }

  setEvents(events) {
    this._events = events;
    this._nextIdx = 0;
  }

  resetTime() {
    this._nextIdx = 0;
    this._ageArr.fill(LIFETIME);
  }

  seekTo(time) {
    let lo = 0, hi = this._events.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this._events[mid].time <= time) lo = mid + 1;
      else hi = mid;
    }
    this._nextIdx = lo;
    this._ageArr.fill(LIFETIME);
  }

  _spawn(x, z, speed) {
    const i = this._nextSlot;
    this._nextSlot = (this._nextSlot + 1) % MAX;
    const i3 = i * 3;
    this._posArr[i3] = x;
    this._posArr[i3 + 1] = 0.02;
    this._posArr[i3 + 2] = z;
    const t = Math.min(1, Math.max(0, (speed - SPEED_LOW) / (SPEED_HIGH - SPEED_LOW)));
    this._radiusArr[i] = MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
    this._ageArr[i] = 0;
  }

  update(delta, animationTime) {
    if (!this.enabled) {
      if (this._mesh.visible) this._mesh.visible = false;
      return;
    }
    if (!this._mesh.visible) this._mesh.visible = true;

    if (animationTime !== undefined) {
      while (this._nextIdx < this._events.length && this._events[this._nextIdx].time <= animationTime) {
        const evt = this._events[this._nextIdx];
        this._spawn(evt.position.x, evt.position.z, evt.speed || 0);
        this._nextIdx++;
      }
    }

    const dt = Math.min(delta, 0.1);

    for (let i = 0; i < MAX; i++) {
      this._ageArr[i] += dt;
      const i3 = i * 3;

      if (this._ageArr[i] >= LIFETIME) {
        this._vec3.set(0, -10, 0);
        this._scaleVec.set(0, 0, 0);
        this._color.setRGB(0, 0, 0);
      } else {
        const t = this._ageArr[i] / LIFETIME;
        const radius = this._radiusArr[i];
        const scale = radius * (1 - (1 - t) * (1 - t));       // ease-out
        const fade = (1 - t) * (1 - t);                        // quadratic fade

        this._vec3.set(this._posArr[i3], this._posArr[i3 + 1], this._posArr[i3 + 2]);
        this._scaleVec.set(scale, scale, scale);
        this._color.setRGB(fade * 0.7, fade * 0.7, fade * 0.7);
      }

      this._mesh.setColorAt(i, this._color);
      this._mat4.compose(this._vec3, this._flatQ, this._scaleVec);
      this._mesh.setMatrixAt(i, this._mat4);
    }

    this._mesh.instanceMatrix.needsUpdate = true;
    this._mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this._mesh);
    this._mesh.geometry.dispose();
    this._mesh.material.dispose();
  }
}
