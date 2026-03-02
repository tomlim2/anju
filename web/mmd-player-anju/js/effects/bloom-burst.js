import {
  Sprite,
  SpriteMaterial,
  AdditiveBlending,
  CanvasTexture,
} from 'three/webgpu';

const MAX = 4;
const LIFETIME = 1.2;
const TRAVEL = 20;
const DRAG = 0.97;
const SIZE = 3.0;
const OFFSCREEN_Y = -10000;

function createGlowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,238,221,0.6)');
  gradient.addColorStop(1, 'rgba(255,238,221,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

export class BloomBurstEffect {
  constructor(scene) {
    this.scene = scene;
    this.enabled = true;

    this._pool = [];
    this._head = 0;

    const tex = createGlowTexture();

    for (let i = 0; i < MAX; i++) {
      const mat = new SpriteMaterial({
        map: tex,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        color: 0xffeedd,
      });
      const sprite = new Sprite(mat);
      sprite.scale.set(SIZE, SIZE, 1);
      sprite.position.y = OFFSCREEN_Y;
      sprite.frustumCulled = false;
      this.scene.add(sprite);

      this._pool.push({
        sprite,
        vx: 0, vy: 0, vz: 0,
        age: 1.0,
      });
    }

    this._activeCount = 0;
    this._events = [];
    this._nextIdx = 0;
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

  _trigger(position, direction) {
    const entry = this._pool[this._head];
    this._head = (this._head + 1) % MAX;

    entry.sprite.position.set(position.x, position.y, position.z);
    entry.sprite.scale.set(SIZE, SIZE, 1);
    entry.sprite.material.opacity = 1;
    entry.vx = direction.x * TRAVEL;
    entry.vy = direction.y * TRAVEL;
    entry.vz = direction.z * TRAVEL;
    entry.age = 0;
    this._activeCount = Math.min(this._activeCount + 1, MAX);
  }

  update(delta, animationTime) {
    if (!this.enabled) return;

    // Fire events keyed to actual animation time — no drift
    while (this._nextIdx < this._events.length && this._events[this._nextIdx].time <= animationTime) {
      const evt = this._events[this._nextIdx];
      this._trigger(evt.position, evt.direction);
      this._nextIdx++;
    }

    // Animate active sprites
    if (this._activeCount <= 0) return;

    const dt = Math.min(delta, 0.1);
    let alive = 0;

    for (const entry of this._pool) {
      if (entry.age >= 1.0) continue;

      entry.age += dt / LIFETIME;

      if (entry.age >= 1.0) {
        entry.sprite.position.y = OFFSCREEN_Y;
        continue;
      }

      alive++;
      const pos = entry.sprite.position;
      pos.x += entry.vx * dt;
      pos.y += entry.vy * dt;
      pos.z += entry.vz * dt;
      entry.vx *= DRAG;
      entry.vy *= DRAG;
      entry.vz *= DRAG;

      entry.sprite.material.opacity = 1 - entry.age;
    }

    this._activeCount = alive;
  }

  dispose() {
    for (const entry of this._pool) {
      this.scene.remove(entry.sprite);
      entry.sprite.material.map.dispose();
      entry.sprite.material.dispose();
    }
  }
}
