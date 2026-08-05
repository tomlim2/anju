// Stage: one hero mesh with an inverted-hull twin, an orbiting light,
// and a ground disc that catches the silhouette.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createOutlineMaterial, createToonMaterial } from "./toon-material.js";

export const PALETTES = {
  manga: { paper: "#f2f3ef", base: "#f2f3ef", shadow: "#16181a", ink: "#16181a" },
  sunset: { paper: "#fff4e8", base: "#ffb46b", shadow: "#8a2c4f", ink: "#3d1130" },
  mint: { paper: "#eefaf3", base: "#a8e6c8", shadow: "#1d5c46", ink: "#0d2b20" }
};

const MODEL_BUILDERS = {
  knot: () => new THREE.TorusKnotGeometry(1.05, 0.34, 256, 48),
  sphere: () => new THREE.SphereGeometry(1.35, 96, 64),
  capsule: () => new THREE.CapsuleGeometry(0.85, 1.3, 12, 48),
  torus: () => new THREE.TorusGeometry(1.15, 0.48, 48, 128)
};

export function createCelScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 1.3, 9.4);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 3.5;
  controls.maxDistance = 14;
  controls.target.set(0, 0.2, 0);

  const material = createToonMaterial();
  const outlineMaterial = createOutlineMaterial();

  const hero = new THREE.Mesh(MODEL_BUILDERS.knot(), material);
  const hull = new THREE.Mesh(hero.geometry, outlineMaterial);
  hero.position.y = 0.4;
  hull.position.copy(hero.position);
  scene.add(hero, hull);

  // The ground is the same toon material so its terminator and screentone
  // match the hero — it reads as one printed panel, not a mesh on a floor.
  const ground = new THREE.Mesh(new THREE.CircleGeometry(3.4, 96), material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.45;
  scene.add(ground);

  const groundHull = new THREE.Mesh(new THREE.RingGeometry(3.36, 3.4, 96), new THREE.MeshBasicMaterial({ color: "#16181a" }));
  groundHull.rotation.x = -Math.PI / 2;
  groundHull.position.y = -1.449;
  scene.add(groundHull);

  let lightAngle = 0.9;
  let lightAuto = true;

  function setModel(name) {
    const build = MODEL_BUILDERS[name];
    if (!build) return;
    const next = build();
    hero.geometry.dispose();
    hero.geometry = next;
    hull.geometry = next;
  }

  function setPalette(palette) {
    material.uniforms.uBaseColor.value.set(palette.base);
    material.uniforms.uShadowColor.value.set(palette.shadow);
    material.uniforms.uPaperColor.value.set(palette.paper);
    outlineMaterial.uniforms.uInkColor.value.set(palette.ink);
    groundHull.material.color.set(palette.ink);
    renderer.setClearColor(new THREE.Color(palette.paper), 1);
  }

  function setUniform(name, value) {
    if (name === "uWidth") {
      outlineMaterial.uniforms.uWidth.value = value;
      return;
    }
    material.uniforms[name].value = value;
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

  function render(delta) {
    if (lightAuto) lightAngle += delta * 0.25;
    material.uniforms.uLightDirection.value.set(
      Math.cos(lightAngle), 0.75, Math.sin(lightAngle)
    );
    material.uniforms.uCameraPositionW.value.copy(camera.position);
    hero.rotation.y += delta * 0.12;
    hull.rotation.copy(hero.rotation);
    controls.update();
    renderer.render(scene, camera);
  }

  setPalette(PALETTES.manga);
  resize();

  return {
    setModel,
    setPalette,
    setUniform,
    setLightAuto: value => { lightAuto = value; },
    resize,
    render
  };
}
