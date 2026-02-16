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

const glbCache = {};

export function getModel(name) {
  if (PRESETS[name]) {
    return Promise.resolve({ geometry: PRESETS[name](), scene: null, animations: [] });
  }
  return loadGLB(name);
}

// Backward compat
export function getGeometry(name) {
  return getModel(name).then((result) => result.geometry);
}

function loadGLB(name) {
  if (glbCache[name]) {
    const cached = glbCache[name];
    return Promise.resolve({
      geometry: cached.geometry ? cached.geometry.clone() : null,
      scene: cached.scene ? cached.scene.clone(true) : null,
      animations: cached.animations,
    });
  }

  const paths = {
    amongus: 'assets/among_us.glb',
  };
  const path = paths[name];
  if (!path) return Promise.resolve({ geometry: PRESETS.sphere(), scene: null, animations: [] });

  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      path,
      (gltf) => {
        try {
          const hasAnimations = gltf.animations && gltf.animations.length > 0;

          // Merge geometries for static fallback (skip if animated — not needed)
          let geometry = null;
          if (!hasAnimations) {
            const geometries = [];
            gltf.scene.traverse((child) => {
              if (child.isMesh) geometries.push(child.geometry);
            });
            if (geometries.length) {
              geometry = geometries.length > 1 ? mergeGeometries(geometries) : geometries[0];
            }
          }

          glbCache[name] = {
            geometry,
            scene: hasAnimations ? gltf.scene : null,
            animations: gltf.animations || [],
          };

          resolve({
            geometry: geometry ? geometry.clone() : null,
            scene: hasAnimations ? gltf.scene : null,
            animations: gltf.animations || [],
          });
        } catch (err) {
          resolve({ geometry: PRESETS.sphere(), scene: null, animations: [] });
        }
      },
      undefined,
      (error) => {
        console.warn(`Failed to load ${path}`, error);
        resolve({ geometry: PRESETS.sphere(), scene: null, animations: [] });
      }
    );
  });
}
