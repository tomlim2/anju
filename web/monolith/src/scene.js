// The type field: one InstancedMesh of cubes that re-forms into each word.
//
// Instances are never created or destroyed — they only travel. A word change
// re-targets every cube and each one leaves on its own beat, so the field
// dissolves and reassembles instead of cutting.

import * as THREE from "three";
import { fitToBudget, hash01, sampleWord } from "./type-field.js";

const INSTANCES = 5200;
const PAPER = 0xf2f3ef;
const INK = 0x16181a;
const MORPH_SECONDS = 1.15;
const STAGGER = 0.42;
const BASE_YAW = -0.34;
const BASE_PITCH = 0.12;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

export function createTypeScene(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(PAPER, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PAPER, 46, 140);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  camera.position.set(0, 0, 44);

  // Flat-ish monochrome: enough directional bite to read the cube facets,
  // never enough to introduce a second hue.
  scene.add(new THREE.AmbientLight(0xffffff, 1.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-8, 12, 16);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.9);
  rim.position.set(10, -6, -8);
  scene.add(rim);

  const cube = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshLambertMaterial({ color: INK });
  const mesh = new THREE.InstancedMesh(cube, material, INSTANCES);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;

  const field = new THREE.Group();
  field.add(mesh);
  scene.add(field);

  let cell = 0.3;
  const from = new Float32Array(INSTANCES * 3);
  const to = new Float32Array(INSTANCES * 3);
  const now = new Float32Array(INSTANCES * 3);
  const fromActive = new Float32Array(INSTANCES);
  const toActive = new Float32Array(INSTANCES);

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  let morphStart = -Infinity;
  let morphing = false;
  let currentWord = null;
  let pointer = { x: 0, y: 0 };
  let aim = { x: 0, y: 0 };
  let clockOffset = 0;

  function applyTargets({ points, pitch }) {
    cell = pitch * 0.78;
    const targets = fitToBudget(points, INSTANCES);
    for (let i = 0; i < INSTANCES; i += 1) {
      const t = targets[i];
      to[i * 3] = t.x;
      to[i * 3 + 1] = t.y;
      // Depth scatter is measured in cubes, so the slab thickness stays the
      // same whether the word is two hanzi or seven letters.
      to[i * 3 + 2] = (hash01(i * 3 + 11) - 0.5) * pitch * 5;
      toActive[i] = t.active;
    }
  }

  function seed() {
    for (let i = 0; i < INSTANCES; i += 1) {
      now[i * 3] = to[i * 3];
      now[i * 3 + 1] = to[i * 3 + 1];
      now[i * 3 + 2] = to[i * 3 + 2];
      fromActive[i] = toActive[i];
    }
  }

  function setWord(word) {
    if (word === currentWord) return;
    currentWord = word;
    for (let i = 0; i < INSTANCES * 3; i += 1) from[i] = now[i];
    for (let i = 0; i < INSTANCES; i += 1) fromActive[i] = toActive[i];
    applyTargets(sampleWord(word, { budget: INSTANCES }));
    if (reducedMotion) {
      seed();
      morphing = false;
      writeMatrices();
      return;
    }
    morphStart = clockOffset;
    morphing = true;
  }

  function writeMatrices() {
    for (let i = 0; i < INSTANCES; i += 1) {
      const base = i * 3;
      position.set(now[base], now[base + 1], now[base + 2]);
      // fromActive carries the live value: surplus instances scale to nothing
      // instead of piling up at the origin.
      const size = cell * fromActive[i];
      scale.set(size, size, size);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  function advance(elapsed) {
    clockOffset = elapsed;
    if (!morphing) return;
    let settled = true;
    for (let i = 0; i < INSTANCES; i += 1) {
      const delay = hash01(i) * STAGGER;
      const raw = (elapsed - morphStart - delay) / MORPH_SECONDS;
      const t = raw <= 0 ? 0 : raw >= 1 ? 1 : easeInOutCubic(raw);
      if (t < 1) settled = false;
      const base = i * 3;
      // A bulge along z during flight reads as the field breathing apart
      // rather than sliding flat across the screen.
      const lift = Math.sin(Math.PI * t) * (2.5 + hash01(i * 5 + 3) * 5.5);
      now[base] = from[base] + (to[base] - from[base]) * t;
      now[base + 1] = from[base + 1] + (to[base + 1] - from[base + 1]) * t;
      now[base + 2] = from[base + 2] + (to[base + 2] - from[base + 2]) * t + lift;
      fromActive[i] = fromActive[i] + (toActive[i] - fromActive[i]) * t;
    }
    if (settled) morphing = false;
  }

  function setPointer(x, y) {
    aim.x = x;
    aim.y = y;
  }

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Pull back on narrow viewports so a long word still clears the gutters.
    const narrow = width < 900;
    camera.position.z = narrow ? 62 : 46;
    // The copy column owns the left of the page, so the field slides right of
    // it rather than sitting under the headline.
    field.position.x = narrow ? 0 : 9;
    field.position.y = narrow ? -9 : 0;
    camera.updateProjectionMatrix();
  }

  function render(elapsed) {
    pointer.x += (aim.x - pointer.x) * 0.06;
    pointer.y += (aim.y - pointer.y) * 0.06;
    const drift = reducedMotion ? 0 : Math.sin(elapsed * 0.22) * 0.05;
    // A standing three-quarter turn: straight on, the cubes would collapse
    // into a flat silhouette and the whole point would be lost.
    field.rotation.y = BASE_YAW + pointer.x * 0.34 + drift;
    field.rotation.x = BASE_PITCH - pointer.y * 0.24;
    advance(elapsed);
    writeMatrices();
    renderer.render(scene, camera);
  }

  function dispose() {
    cube.dispose();
    material.dispose();
    renderer.dispose();
  }

  applyTargets({ points: [], pitch: 0.3 });
  seed();
  resize();

  return { setWord, setPointer, resize, render, dispose, instances: INSTANCES };
}
