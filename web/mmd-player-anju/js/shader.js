import {
  MeshToonNodeMaterial,
  DataTexture,
  RedFormat,
  NearestFilter,
  Color,
} from 'three/webgpu';
import {
  Fn,
  uniform,
  normalView,
  positionView,
  float,
  dot,
  normalize,
  pow,
  clamp,
} from 'three/tsl';

/**
 * Create a 3-band toon gradient texture.
 */
function createGradientMap(bands = 3) {
  const size = bands;
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    data[i] = Math.round((i / (size - 1)) * 255);
  }
  const tex = new DataTexture(data, size, 1, RedFormat);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Swap MMDLoader's ShaderMaterial to MeshToonNodeMaterial with TSL toon shading.
 */
export function swapToToonMaterial(mesh) {
  const gradientMap = createGradientMap(4);
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

  const swapped = materials.map((mat) => {
    const toon = new MeshToonNodeMaterial();
    toon.gradientMap = gradientMap;

    // Transfer base properties
    if (mat.map) toon.map = mat.map;
    if (mat.color) toon.color.copy(mat.color);
    toon.side = mat.side;
    toon.transparent = mat.transparent;
    toon.opacity = mat.opacity;

    // TSL rim lighting
    const rimColor = uniform(new Color(0x88ccff));
    const rimPower = uniform(3.0);
    const rimStrength = uniform(0.4);

    toon.emissiveNode = Fn(() => {
      // Both normalView and positionView are in view space
      const viewDir = normalize(positionView.negate());
      const ndotv = clamp(dot(normalView, viewDir), 0.0, 1.0);
      const rimFactor = float(1.0).sub(ndotv);
      const rim = pow(rimFactor, rimPower).mul(rimStrength);
      return rimColor.mul(rim);
    })();

    mat.dispose();
    return toon;
  });

  mesh.material = swapped.length === 1 ? swapped[0] : swapped;
  return mesh;
}
