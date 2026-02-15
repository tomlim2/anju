import {
  SphereGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  BoxGeometry,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PRESETS = {
  sphere: () => new SphereGeometry(1, 64, 64),
  torus: () => new TorusGeometry(0.7, 0.3, 32, 64),
  torusknot: () => new TorusKnotGeometry(0.6, 0.2, 128, 32),
  box: () => new BoxGeometry(1.2, 1.2, 1.2, 4, 4, 4),
};

let suzanneGeometry = null;

export function getGeometry(name) {
  if (PRESETS[name]) return Promise.resolve(PRESETS[name]());

  if (name === 'suzanne') {
    if (suzanneGeometry) return Promise.resolve(suzanneGeometry.clone());
    return loadSuzanne();
  }

  return Promise.resolve(PRESETS.sphere());
}

function loadSuzanne() {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      'assets/suzanne.glb',
      (gltf) => {
        gltf.scene.traverse((child) => {
          if (child.isMesh) {
            suzanneGeometry = child.geometry;
            suzanneGeometry.computeVertexNormals();
          }
        });
        if (suzanneGeometry) {
          resolve(suzanneGeometry.clone());
        } else {
          // Fallback to sphere if no mesh found
          resolve(PRESETS.sphere());
        }
      },
      undefined,
      (err) => {
        console.warn('Failed to load suzanne.glb, falling back to sphere', err);
        resolve(PRESETS.sphere());
      }
    );
  });
}
