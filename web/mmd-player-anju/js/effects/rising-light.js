import {
  InstancedMesh,
  PlaneGeometry,
  MeshBasicNodeMaterial,
  AdditiveBlending,
  Matrix4,
  Quaternion,
  Vector3,
  DoubleSide,
  Color,
} from 'three/webgpu';

const MAX = 512;
const SPAWN_RANGE_X = 160;
const SPAWN_RANGE_Z = 160;
const SPAWN_Y_MIN = -2;
const SPAWN_Y_MAX = 5;
const RISE_SPEED_MIN = 1.5;
const RISE_SPEED_MAX = 4.0;
const LIFETIME = 12.0;
const FADE_Y = 50;
const PLANE_SCALE = 0.5;
const FADE_RATIO = 0.3;         // last 30% of lifetime fades out
const Y_FADE_START = 35;        // start Y-fade before FADE_Y

// Wind field parameters
const WIND_DECAY = 0.98;       // slow decay — wind lingers long
const WIND_STRENGTH = 18.0;    // strong horizontal push
const WIND_RISE_BOOST = 6.0;   // big upward surge on impulse
const WIND_RADIUS = 10;        // effective impulse radius

export class RisingLightEffect {
  constructor(scene, camera) {
    this.scene = scene;
    this._camera = camera;
    this.enabled = true;

    this._posArr = new Float32Array(MAX * 3);
    this._velArr = new Float32Array(MAX * 3); // per-particle velocity (x, y, z)
    this._baseSpeed = new Float32Array(MAX);  // base rise speed
    this._ageArr = new Float32Array(MAX);

    // Precomputed events
    this._events = [];
    this._nextIdx = 0;

    // Reusable objects for matrix composition
    this._mat4 = new Matrix4();
    this._vec3 = new Vector3();
    this._scaleVec = new Vector3();
    this._color = new Color();

    // Stagger initial spawns
    for (let i = 0; i < MAX; i++) {
      this._respawn(i);
      this._ageArr[i] = Math.random() * LIFETIME;
      this._posArr[i * 3 + 1] += this._baseSpeed[i] * this._ageArr[i];
    }

    const geo = new PlaneGeometry(1, 1);
    const mat = new MeshBasicNodeMaterial();
    mat.transparent = true;
    mat.blending = AdditiveBlending;
    mat.depthWrite = false;
    mat.side = DoubleSide;
    mat.color.set(0xffeedd);

    this._mesh = new InstancedMesh(geo, mat, MAX);
    this._mesh.frustumCulled = false;

    // Set initial instance matrices and colors
    const initQ = new Quaternion();
    const white = new Color(1, 1, 1);
    for (let i = 0; i < MAX; i++) {
      const i3 = i * 3;
      this._vec3.set(this._posArr[i3], this._posArr[i3 + 1], this._posArr[i3 + 2]);
      this._scaleVec.set(PLANE_SCALE, PLANE_SCALE, PLANE_SCALE);
      this._mat4.compose(this._vec3, initQ, this._scaleVec);
      this._mesh.setMatrixAt(i, this._mat4);
      this._mesh.setColorAt(i, white);
    }

    this.scene.add(this._mesh);
  }

  setEvents(events) {
    this._events = events;
    this.resetTime();
  }

  resetTime() {
    this._nextIdx = 0;
    this._velArr.fill(0);
    for (let i = 0; i < MAX; i++) {
      this._respawn(i);
      this._ageArr[i] = Math.random() * LIFETIME;
      this._posArr[i * 3 + 1] += this._baseSpeed[i] * this._ageArr[i];
    }
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

      // Full range: sharp falloff — 1/(1+(d/r)^4)
      const r = dist / WIND_RADIUS;
      const falloff = 1 / (1 + r * r * r * r);
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
    const camQ = this._camera.quaternion;

    for (let i = 0; i < MAX; i++) {
      this._ageArr[i] += dt;
      const i3 = i * 3;

      if (this._ageArr[i] >= LIFETIME || posArr[i3 + 1] > FADE_Y) {
        this._respawn(i);
      } else {
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

      // Fade: in + out + Y-based (min wins)
      const fadeInEnd = LIFETIME * FADE_RATIO;
      const fadeOutStart = LIFETIME * (1 - FADE_RATIO);
      let fade = 1;
      if (this._ageArr[i] < fadeInEnd) {
        fade = Math.min(fade, this._ageArr[i] / fadeInEnd);
      } else if (this._ageArr[i] > fadeOutStart) {
        fade = Math.min(fade, 1 - (this._ageArr[i] - fadeOutStart) / (LIFETIME - fadeOutStart));
      }
      const y = posArr[i3 + 1];
      if (y > Y_FADE_START) {
        fade = Math.min(fade, 1 - (y - Y_FADE_START) / (FADE_Y - Y_FADE_START));
      }
      fade = Math.max(0, fade);
      this._color.setRGB(fade, fade, fade);
      this._mesh.setColorAt(i, this._color);

      // Billboard matrix: face camera, uniform scale
      this._vec3.set(posArr[i3], posArr[i3 + 1], posArr[i3 + 2]);
      this._scaleVec.set(PLANE_SCALE, PLANE_SCALE, PLANE_SCALE);
      this._mat4.compose(this._vec3, camQ, this._scaleVec);
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
