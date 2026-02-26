/**
 * Build glTF 2.0 skeleton, mesh, skin, materials, and textures from PMX data.
 *
 * Produces { json, bin } ready for GLB packing.
 */

import type { PmxData, GltfData } from "./types.js";

// glTF constants
const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;
const UNSIGNED_INT = 5125;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

// ── BufferBuilder ──

class BufferBuilder {
  private chunks: Uint8Array[] = [];
  private totalLength = 0;

  get length(): number {
    return this.totalLength;
  }

  append(data: Uint8Array): void {
    this.chunks.push(data);
    this.totalLength += data.byteLength;
  }

  /** Pad to 4-byte alignment. */
  pad4(): void {
    const remainder = this.totalLength % 4;
    if (remainder) {
      const padding = new Uint8Array(4 - remainder);
      this.chunks.push(padding);
      this.totalLength += padding.byteLength;
    }
  }

  toUint8Array(): Uint8Array {
    const result = new Uint8Array(this.totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  }
}

// ── Build ──

export function build(pmxData: PmxData): GltfData {
  const bones = pmxData.bones;
  const positions = pmxData.positions;
  const normalsArr = pmxData.normals;
  const uvs = pmxData.uvs;
  const jointIndices = pmxData.joints;
  const skinWeights = pmxData.weights;
  const allIndices = pmxData.indices;
  const materials = pmxData.materials;
  const textures = pmxData.textures;
  const textureMimes = pmxData.texture_mimes;

  const numBones = bones.length;
  const numVerts = positions.length / 3;

  // ---- Skeleton node tree ----
  const nodes: Record<string, any>[] = [];
  const rootBones: number[] = [];
  const childrenMap = new Map<number, number[]>();
  for (let i = 0; i < numBones; i++) childrenMap.set(i, []);

  for (let i = 0; i < numBones; i++) {
    const parent = bones[i].parent_index;
    if (parent < 0 || parent >= numBones) {
      rootBones.push(i);
    } else {
      childrenMap.get(parent)!.push(i);
    }
  }

  for (let i = 0; i < numBones; i++) {
    const bone = bones[i];
    const parent = bone.parent_index;
    let localPos: number[];
    if (parent < 0 || parent >= numBones) {
      localPos = [bone.position[0], bone.position[1], bone.position[2]];
    } else {
      const pp = bones[parent].position;
      localPos = [
        bone.position[0] - pp[0],
        bone.position[1] - pp[1],
        bone.position[2] - pp[2],
      ];
    }

    const node: Record<string, any> = { name: bone.name, translation: localPos };
    const children = childrenMap.get(i)!;
    if (children.length > 0) {
      node.children = children;
    }
    nodes.push(node);
  }

  // Mesh node
  const meshNodeIdx = numBones;
  nodes.push({ name: "mesh", mesh: 0, skin: 0 });

  // Scene root node
  const sceneRootIdx = numBones + 1;
  nodes.push({
    name: "root",
    children: [...rootBones, meshNodeIdx],
  });

  // ---- Inverse Bind Matrices ----
  // numBones x 16 floats (4x4 identity with translation)
  const ibmData = new Float32Array(numBones * 16);
  for (let i = 0; i < numBones; i++) {
    const base = i * 16;
    // Identity matrix (row-major)
    ibmData[base + 0] = 1;
    ibmData[base + 5] = 1;
    ibmData[base + 10] = 1;
    ibmData[base + 15] = 1;
    // Translation = -bone.position
    ibmData[base + 3] = -bones[i].position[0];
    ibmData[base + 7] = -bones[i].position[1];
    ibmData[base + 11] = -bones[i].position[2];
  }

  // ---- Binary buffer ----
  const buf = new BufferBuilder();
  const bufferViews: Record<string, any>[] = [];
  const accessors: Record<string, any>[] = [];

  function addBv(dataBytes: Uint8Array, target?: number): number {
    const offset = buf.length;
    buf.append(dataBytes);
    buf.pad4();
    const bv: Record<string, any> = {
      buffer: 0,
      byteOffset: offset,
      byteLength: dataBytes.byteLength,
    };
    if (target !== undefined) bv.target = target;
    const idx = bufferViews.length;
    bufferViews.push(bv);
    return idx;
  }

  function addAcc(
    bvIdx: number,
    compType: number,
    count: number,
    accType: string,
    minV?: number[],
    maxV?: number[],
  ): number {
    const acc: Record<string, any> = {
      bufferView: bvIdx,
      componentType: compType,
      count,
      type: accType,
    };
    if (minV !== undefined) acc.min = minV;
    if (maxV !== undefined) acc.max = maxV;
    const idx = accessors.length;
    accessors.push(acc);
    return idx;
  }

  // Vertex attributes
  const posBv = addBv(new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength), ARRAY_BUFFER);

  // Compute position min/max
  const posMin = [Infinity, Infinity, Infinity];
  const posMax = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < numVerts; i++) {
    const pi = i * 3;
    for (let c = 0; c < 3; c++) {
      const v = positions[pi + c];
      if (v < posMin[c]) posMin[c] = v;
      if (v > posMax[c]) posMax[c] = v;
    }
  }
  const posAcc = addAcc(posBv, FLOAT, numVerts, "VEC3", posMin, posMax);

  const normBv = addBv(new Uint8Array(normalsArr.buffer, normalsArr.byteOffset, normalsArr.byteLength), ARRAY_BUFFER);
  const normAcc = addAcc(normBv, FLOAT, numVerts, "VEC3");

  const uvBv = addBv(new Uint8Array(uvs.buffer, uvs.byteOffset, uvs.byteLength), ARRAY_BUFFER);
  const uvAcc = addAcc(uvBv, FLOAT, numVerts, "VEC2");

  const jointBv = addBv(new Uint8Array(jointIndices.buffer, jointIndices.byteOffset, jointIndices.byteLength), ARRAY_BUFFER);
  const jointAcc = addAcc(jointBv, UNSIGNED_SHORT, numVerts, "VEC4");

  const weightBv = addBv(new Uint8Array(skinWeights.buffer, skinWeights.byteOffset, skinWeights.byteLength), ARRAY_BUFFER);
  const weightAcc = addAcc(weightBv, FLOAT, numVerts, "VEC4");

  // Images & textures
  const gltfSamplers: Record<string, any>[] = [];
  const gltfImages: Record<string, any>[] = [];
  const gltfTextures: Record<string, any>[] = [];

  if (textures.length > 0) {
    gltfSamplers.push({
      magFilter: 9729,  // LINEAR
      minFilter: 9987,  // LINEAR_MIPMAP_LINEAR
      wrapS: 10497,     // REPEAT
      wrapT: 10497,
    });
  }

  for (let i = 0; i < textures.length; i++) {
    const imgBv = addBv(textures[i]);
    gltfImages.push({ bufferView: imgBv, mimeType: textureMimes[i] });
    gltfTextures.push({ sampler: 0, source: gltfImages.length - 1 });
  }

  // Per-material primitives & materials
  let idxOffset = 0;
  const primitives: Record<string, any>[] = [];
  const gltfMaterials: Record<string, any>[] = [];

  for (const mat of materials) {
    const count = mat.vertex_count;
    const matIndices = allIndices.slice(idxOffset, idxOffset + count);
    idxOffset += count;

    const idxBytes = new Uint8Array(matIndices.buffer, matIndices.byteOffset, matIndices.byteLength);
    const idxBv = addBv(idxBytes, ELEMENT_ARRAY_BUFFER);
    const idxAcc = addAcc(idxBv, UNSIGNED_INT, matIndices.length, "SCALAR");

    primitives.push({
      attributes: {
        POSITION: posAcc,
        NORMAL: normAcc,
        TEXCOORD_0: uvAcc,
        JOINTS_0: jointAcc,
        WEIGHTS_0: weightAcc,
      },
      indices: idxAcc,
      material: gltfMaterials.length,
      mode: 4,
    });

    const diffuse = mat.diffuse;
    const gltfMat: Record<string, any> = {
      name: mat.name,
      pbrMetallicRoughness: {
        baseColorFactor: [
          diffuse[0], diffuse[1], diffuse[2],
          diffuse.length > 3 ? diffuse[3] : 1.0,
        ],
        metallicFactor: 0.0,
        roughnessFactor: 0.9,
      },
      doubleSided: true,
    };

    const texIdx = mat.texture_index;
    if (texIdx >= 0 && texIdx < gltfTextures.length) {
      gltfMat.pbrMetallicRoughness.baseColorTexture = { index: texIdx };
    }

    if (diffuse.length > 3 && diffuse[3] < 1.0) {
      gltfMat.alphaMode = "BLEND";
    }

    gltfMaterials.push(gltfMat);
  }

  // Inverse Bind Matrices: row-major -> column-major (transpose each 4x4)
  const ibmColMajor = new Float32Array(numBones * 16);
  for (let i = 0; i < numBones; i++) {
    const src = i * 16;
    const dst = i * 16;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        ibmColMajor[dst + col * 4 + row] = ibmData[src + row * 4 + col];
      }
    }
  }

  const ibmBytes = new Uint8Array(ibmColMajor.buffer, ibmColMajor.byteOffset, ibmColMajor.byteLength);
  const ibmBv = addBv(ibmBytes);
  const ibmAcc = addAcc(ibmBv, FLOAT, numBones, "MAT4");

  // Skin
  const skin = {
    inverseBindMatrices: ibmAcc,
    joints: Array.from({ length: numBones }, (_, i) => i),
    skeleton: rootBones.length > 0 ? rootBones[0] : 0,
  };

  // ---- Morph targets (sparse accessors) ----
  const morphs = pmxData.morphs;
  const targetNames: string[] = [];
  const morphAccIndices: number[] = [];

  for (const morph of morphs) {
    if (morph.offsets.length === 0) continue;

    // Filter non-zero offsets
    let filtered = morph.offsets.filter(
      o => o.dx !== 0 || o.dy !== 0 || o.dz !== 0,
    );
    if (filtered.length === 0) continue;

    // Remove duplicate vertex indices (keep first, matching np.unique behavior)
    const seen = new Set<number>();
    const unique: typeof filtered = [];
    for (const o of filtered) {
      if (!seen.has(o.vi)) {
        seen.add(o.vi);
        unique.push(o);
      }
    }
    filtered = unique;

    // Sort by vertex index (required by glTF sparse spec)
    filtered.sort((a, b) => a.vi - b.vi);

    const sparseCount = filtered.length;
    const sparseIndices = new Uint32Array(sparseCount);
    const sparseValues = new Float32Array(sparseCount * 3);

    for (let i = 0; i < sparseCount; i++) {
      sparseIndices[i] = filtered[i].vi;
      sparseValues[i * 3] = filtered[i].dx;
      sparseValues[i * 3 + 1] = filtered[i].dy;
      sparseValues[i * 3 + 2] = filtered[i].dz;
    }

    const idxBv = addBv(new Uint8Array(sparseIndices.buffer, sparseIndices.byteOffset, sparseIndices.byteLength));
    const valBv = addBv(new Uint8Array(sparseValues.buffer, sparseValues.byteOffset, sparseValues.byteLength));

    const acc = {
      componentType: FLOAT,
      count: numVerts,
      type: "VEC3",
      sparse: {
        count: sparseCount,
        indices: {
          bufferView: idxBv,
          componentType: UNSIGNED_INT,
        },
        values: {
          bufferView: valBv,
        },
      },
    };

    const accIdx = accessors.length;
    accessors.push(acc);
    targetNames.push(morph.name);
    morphAccIndices.push(accIdx);
  }

  // Attach targets to every primitive
  if (morphAccIndices.length > 0) {
    const morphTargets = morphAccIndices.map(ai => ({ POSITION: ai }));
    for (const prim of primitives) {
      prim.targets = morphTargets;
    }
  }

  // Buffer
  const binData = buf.toUint8Array();
  const bufferObj = { byteLength: binData.byteLength };

  // Assemble glTF JSON
  const meshObj: Record<string, any> = { name: "mesh", primitives };
  if (targetNames.length > 0) {
    meshObj.extras = { targetNames };
  }

  const gltfJson: Record<string, any> = {
    asset: { version: "2.0", generator: "truepmx2vrm" },
    scene: 0,
    scenes: [{ nodes: [sceneRootIdx] }],
    nodes,
    meshes: [meshObj],
    skins: [skin],
    accessors,
    bufferViews,
    buffers: [bufferObj],
    materials: gltfMaterials,
  };

  if (gltfTextures.length > 0) gltfJson.textures = gltfTextures;
  if (gltfImages.length > 0) gltfJson.images = gltfImages;
  if (gltfSamplers.length > 0) gltfJson.samplers = gltfSamplers;

  return { json: gltfJson, bin: binData };
}
