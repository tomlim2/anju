// Stage: one ribbon surface carrying the phrase texture, orbit controls,
// and a slow standing spin.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ParametricGeometry } from "three/addons/geometries/ParametricGeometry.js";
import { createTapeMaterial } from "./tape-material.js";
import { createPhraseTexture } from "./text-texture.js";

export const PALETTES = {
  manga: { paper: "#f2f3ef", ink: "#16181a", back: "#f2f3ef" },
  reverse: { paper: "#16181a", ink: "#f2f3ef", back: "#16181a" },
  rubine: { paper: "#f7ede8", ink: "#c22047", back: "#f7ede8" }
};

const RADIUS = 2.3;
const WIDTH = 0.62;
const SEGMENTS_U = 480;
const SEGMENTS_V = 8;

// Every surface maps u along the tape and v across it, so the phrase texture
// and edge rules work unchanged on all of them. Angles run clockwise so the
// outward face — the one the camera mostly sees — reads left-to-right; the
// far side is unavoidably mirrored, like type through a shop window.
const SURFACES = {
  band(u, v, target) {
    const angle = -u * Math.PI * 2;
    target.set(
      Math.cos(angle) * RADIUS,
      (v - 0.5) * WIDTH * 2,
      Math.sin(angle) * RADIUS
    );
  },
  mobius(u, v, target) {
    const angle = -u * Math.PI * 2;
    const across = (v - 0.5) * WIDTH * 2;
    const r = RADIUS + across * Math.cos(angle / 2);
    target.set(
      Math.cos(angle) * r,
      across * Math.sin(angle / 2),
      Math.sin(angle) * r
    );
  },
  coil(u, v, target) {
    const turns = 3;
    const angle = -u * Math.PI * 2 * turns;
    target.set(
      Math.cos(angle) * RADIUS,
      (u - 0.5) * 3.4 + (v - 0.5) * WIDTH * 1.6,
      Math.sin(angle) * RADIUS
    );
  }
};

// u-length of each surface relative to the band, used so REPEAT keeps the
// glyph aspect roughly constant when the tape gets longer.
const SURFACE_LENGTH = { band: 1, mobius: 1, coil: 3 };

export function createTapeScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 1.6, 8.6);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 4;
  controls.maxDistance = 16;

  const material = createTapeMaterial();
  const mesh = new THREE.Mesh(buildGeometry("band"), material);
  scene.add(mesh);

  let phrase = null;
  let surfaceName = "band";
  let repeatBase = 2;
  let flowSpeed = 0.06;
  let spinSpeed = 0.1;
  let flow = 0;

  function buildGeometry(name) {
    return new ParametricGeometry(SURFACES[name], SEGMENTS_U, SEGMENTS_V);
  }

  function applyRepeat() {
    if (!phrase) return;
    // Circumference in tile-heights ≈ 2πR / tape width; scale by how many
    // tiles fit and the surface's relative length.
    const tiles = Math.max(1, Math.round(repeatBase * SURFACE_LENGTH[surfaceName]));
    material.uniforms.uRepeat.value = tiles;
  }

  function setText(text, weight) {
    const next = createPhraseTexture(text, { weight });
    phrase?.texture.dispose();
    phrase = next;
    material.uniforms.uPhrase.value = next.texture;
    applyRepeat();
  }

  function setSurface(name) {
    if (!SURFACES[name]) return;
    surfaceName = name;
    const next = buildGeometry(name);
    mesh.geometry.dispose();
    mesh.geometry = next;
    applyRepeat();
  }

  function setPalette(palette) {
    material.uniforms.uPaperColor.value.set(palette.paper);
    material.uniforms.uInkColor.value.set(palette.ink);
    renderer.setClearColor(new THREE.Color(palette.back), 1);
  }

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    material.uniforms.uResolution.value.set(
      width * renderer.getPixelRatio(),
      height * renderer.getPixelRatio()
    );
  }

  function render(delta, elapsed) {
    flow += delta * flowSpeed * 2;
    material.uniforms.uFlow.value = flow;
    mesh.rotation.y += delta * spinSpeed;
    mesh.rotation.x = Math.sin(elapsed * 0.3) * 0.1;
    material.uniforms.uLightDirection.value.set(
      Math.cos(elapsed * 0.2), 0.8, Math.sin(elapsed * 0.2)
    );
    controls.update();
    renderer.render(scene, camera);
  }

  setText("안주 · 活字 · TYPE", 900);
  setPalette(PALETTES.manga);
  resize();

  return {
    setText,
    setSurface,
    setPalette,
    setRepeat: value => { repeatBase = value; applyRepeat(); },
    setFlow: value => { flowSpeed = value; },
    setSpin: value => { spinSpeed = value; },
    setTone: value => { material.uniforms.uToneCover.value = value; },
    setEdge: value => { material.uniforms.uEdgeRule.value = value; },
    resize,
    render
  };
}
