import { LoadingManager } from 'three/webgpu';
import { MMDLoader } from '../vendor/MMDLoader.js';
import { swapToToonMaterial } from './shader.js';
import { findMojibakeMatch } from './encoding.js';

export class MMDModelLoader {
  constructor(mmdScene) {
    this.mmdScene = mmdScene;
    this.mesh = null;
    this._blobUrls = [];
  }

  loadPMXFromBlobs(pmxFile, blobs) {
    // Pre-create blob URLs for all files, keyed by lowercase filename
    this._revokeBlobUrls();
    const urlMap = new Map();

    for (const [path, file] of blobs) {
      // Key by filename (lowercase, handle backslash paths from PMX)
      const name = path.split(/[/\\]/).pop().toLowerCase();
      if (!urlMap.has(name)) {
        const blobUrl = URL.createObjectURL(file);
        urlMap.set(name, blobUrl);
        this._blobUrls.push(blobUrl);
      }
    }

    // Build candidate set for mojibake fallback
    const candidateSet = new Set(urlMap.keys());

    // Custom LoadingManager that resolves texture filenames to blob URLs
    const manager = new LoadingManager();
    manager.resolveURL = (url) => {
      const decoded = decodeURIComponent(url);
      const filename = decoded.split(/[/\\]/).pop().toLowerCase();
      const direct = urlMap.get(filename);
      if (direct) return direct;

      // Mojibake fallback: try encoding round-trips
      const dotIdx = filename.lastIndexOf('.');
      if (dotIdx > 0) {
        const stem = filename.slice(0, dotIdx);
        const ext = filename.slice(dotIdx);
        const match = findMojibakeMatch(stem, ext, candidateSet);
        if (match) {
          console.info(`[MMD] Mojibake fallback: "${filename}" → "${match}"`);
          return urlMap.get(match);
        }
      }
      // Missing texture: return transparent 1px PNG for image files to suppress console errors
      if (/\.(png|jpe?g|bmp|tga|dds|gif|spa|sph)$/i.test(filename)) {
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      }
      return url;
    };

    const loader = new MMDLoader(manager);
    const pmxUrl = URL.createObjectURL(pmxFile);
    this._blobUrls.push(pmxUrl);

    return new Promise((resolve, reject) => {
      loader.load(pmxUrl, (mesh) => {
        this._removeCurrentMesh();
        swapToToonMaterial(mesh);

        this.mesh = mesh;
        this.mmdScene.scene.add(mesh);
        resolve(mesh);
      }, undefined, (err) => {
        reject(err);
      });
    });
  }

  _removeCurrentMesh() {
    if (this.mesh) {
      this.mmdScene.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      const mats = Array.isArray(this.mesh.material) ? this.mesh.material : [this.mesh.material];
      mats.forEach(m => {
        for (const key of ['map', 'normalMap', 'emissiveMap', 'alphaMap', 'matcap']) {
          if (m[key]) m[key].dispose();
        }
        m.dispose();
      });
      this.mesh = null;
    }
  }

  _revokeBlobUrls() {
    this._blobUrls.forEach(u => URL.revokeObjectURL(u));
    this._blobUrls = [];
  }
}
