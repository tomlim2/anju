import {
  SphereGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  BoxGeometry,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PRESETS = {
  sphere: () => new SphereGeometry(1, 64, 64),
  torus: () => new TorusGeometry(0.7, 0.3, 32, 64),
  torusknot: () => new TorusKnotGeometry(0.6, 0.2, 128, 32),
  box: () => new BoxGeometry(1.2, 1.2, 1.2, 4, 4, 4),
};

let agusGeometry = null;

export function getGeometry(name) {
  if (PRESETS[name]) return Promise.resolve(PRESETS[name]());

  if (name === 'agus') {
    if (agusGeometry) return Promise.resolve(agusGeometry.clone());
    return loadSuzanne();
  }

  return Promise.resolve(PRESETS.sphere());
}

function loadSuzanne() {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      'assets/agus.glb',
      (gltf) => {
        const geometries = [];
        gltf.scene.traverse((child) => {
          if (child.isMesh) geometries.push(child.geometry);
        });
        if (geometries.length) {
          agusGeometry = geometries.length > 1 ? mergeGeometries(geometries) : geometries[0];
          agusGeometry.translate(0, -1, 0);
          resolve(agusGeometry.clone());
        } else {
          resolve(PRESETS.sphere());
        }
      },
      undefined,
      (err) => {
        console.warn('Failed to load agus.glb, falling back to sphere', err);
        resolve(PRESETS.sphere());
      }
    );
  });
}
