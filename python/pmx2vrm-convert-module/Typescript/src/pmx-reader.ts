/**
 * Custom PMX 2.0 binary reader with coordinate transformation.
 *
 * Handles extended UV (unlike pymeshio) and normalizes data for glTF/VRM.
 * Coordinate transform: PMX left-hand (X right, Y up, +Z toward viewer/front)
 *     -> glTF right-hand, VRM/Unity convention (+Z forward):
 *     Negate X (left-hand -> right-hand) + winding reversal.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { PmxBone, PmxMaterial, PmxMorph, PmxMorphOffset, PmxRigidBody, PmxJoint, PmxData } from "./types.js";

// ── BinaryReader ──

class BinaryReader {
  private view: DataView;
  private offset: number;

  constructor(data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.offset = 0;
  }

  readBytes(n: number): Uint8Array {
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, n);
    this.offset += n;
    return bytes;
  }

  readInt8(): number {
    const v = this.view.getInt8(this.offset);
    this.offset += 1;
    return v;
  }

  readUint8(): number {
    const v = this.view.getUint8(this.offset);
    this.offset += 1;
    return v;
  }

  readInt16(): number {
    const v = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return v;
  }

  readUint16(): number {
    const v = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return v;
  }

  readInt32(): number {
    const v = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return v;
  }

  readUint32(): number {
    const v = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }

  readFloat(): number {
    const v = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return v;
  }

  readVec2(): [number, number] {
    const a = this.readFloat();
    const b = this.readFloat();
    return [a, b];
  }

  readVec3(): [number, number, number] {
    const a = this.readFloat();
    const b = this.readFloat();
    const c = this.readFloat();
    return [a, b, c];
  }

  readVec4(): [number, number, number, number] {
    const a = this.readFloat();
    const b = this.readFloat();
    const c = this.readFloat();
    const d = this.readFloat();
    return [a, b, c, d];
  }
}

// ── Raw parsed data (before coordinate transform) ──

interface PmxRawBone {
  name: string;
  english_name: string;
  position: [number, number, number];
  parent_index: number;
}

interface PmxRawMorphOffset {
  vi: number;
  dx: number;
  dy: number;
  dz: number;
}

interface PmxRawMorph {
  name: string;
  english_name: string;
  offsets: PmxRawMorphOffset[];
}

interface PmxRawData {
  model_name: string;
  num_vertices: number;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  joint_indices: Uint16Array;
  skin_weights: Float32Array;
  indices: Uint32Array;
  texture_paths: string[];
  materials: PmxMaterial[];
  bones: PmxRawBone[];
  morphs: PmxRawMorph[];
  rigid_bodies: PmxRigidBody[];
  joints: PmxJoint[];
}

// ── PmxReader ──

class PmxReader {
  private r: BinaryReader;
  private textEncoding = 0;
  private extendedUv = 0;
  private vertexIndexSize = 0;
  private textureIndexSize = 0;
  private materialIndexSize = 0;
  private boneIndexSize = 0;
  private morphIndexSize = 0;
  private rigidbodyIndexSize = 0;

  constructor(data: Uint8Array) {
    this.r = new BinaryReader(data);
  }

  private readText(): string {
    const length = this.r.readInt32();
    if (length <= 0) return "";
    const bytes = this.r.readBytes(length);
    if (this.textEncoding === 0) {
      const decoder = new TextDecoder("utf-16le");
      return decoder.decode(bytes);
    } else {
      const decoder = new TextDecoder("utf-8");
      return decoder.decode(bytes);
    }
  }

  private readIndex(size: number): number {
    if (size === 1) return this.r.readInt8();
    if (size === 2) return this.r.readInt16();
    if (size === 4) return this.r.readInt32();
    throw new Error(`Invalid index size: ${size}`);
  }

  private readUnsignedIndex(size: number): number {
    if (size === 1) return this.r.readUint8();
    if (size === 2) return this.r.readUint16();
    if (size === 4) return this.r.readUint32();
    throw new Error(`Invalid index size: ${size}`);
  }

  private readVertexIndex(): number {
    if (this.vertexIndexSize <= 2) return this.readUnsignedIndex(this.vertexIndexSize);
    return this.readIndex(this.vertexIndexSize);
  }

  private readBoneIndex(): number { return this.readIndex(this.boneIndexSize); }
  private readTextureIndex(): number { return this.readIndex(this.textureIndexSize); }
  private readMaterialIndex(): number { return this.readIndex(this.materialIndexSize); }
  private readMorphIndex(): number { return this.readIndex(this.morphIndexSize); }
  private readRigidbodyIndex(): number { return this.readIndex(this.rigidbodyIndexSize); }

  read(): PmxRawData {
    const r = this.r;

    // --- Header ---
    const magic = r.readBytes(4);
    const magicStr = String.fromCharCode(...magic);
    if (magicStr !== "PMX ") throw new Error(`Invalid PMX magic: ${magicStr}`);

    const version = r.readFloat();
    const globalsCount = r.readUint8();
    const globalsData = r.readBytes(globalsCount);

    this.textEncoding = globalsData[0];
    this.extendedUv = globalsData[1];
    this.vertexIndexSize = globalsData[2];
    this.textureIndexSize = globalsData[3];
    this.materialIndexSize = globalsData[4];
    this.boneIndexSize = globalsData[5];
    this.morphIndexSize = globalsData[6];
    this.rigidbodyIndexSize = globalsData[7];

    // --- Model info ---
    const modelName = this.readText();
    const modelEnglishName = this.readText();
    const modelComment = this.readText();
    const modelEnglishComment = this.readText();

    // --- Vertices ---
    const numVertices = r.readInt32();
    const positions = new Float32Array(numVertices * 3);
    const normals = new Float32Array(numVertices * 3);
    const uvs = new Float32Array(numVertices * 2);
    const jointIndices = new Uint16Array(numVertices * 4);
    const skinWeights = new Float32Array(numVertices * 4);

    for (let i = 0; i < numVertices; i++) {
      const pi = i * 3;
      const [px, py, pz] = r.readVec3();
      positions[pi] = px;
      positions[pi + 1] = py;
      positions[pi + 2] = pz;

      const [nx, ny, nz] = r.readVec3();
      normals[pi] = nx;
      normals[pi + 1] = ny;
      normals[pi + 2] = nz;

      const ui = i * 2;
      const [u, v] = r.readVec2();
      uvs[ui] = u;
      uvs[ui + 1] = v;

      // Skip extended UV
      for (let e = 0; e < this.extendedUv; e++) r.readVec4();

      const ji = i * 4;
      const deformType = r.readUint8();

      if (deformType === 0) { // Bdef1
        const b0 = Math.max(0, this.readBoneIndex());
        jointIndices[ji] = b0;
        jointIndices[ji + 1] = 0;
        jointIndices[ji + 2] = 0;
        jointIndices[ji + 3] = 0;
        skinWeights[ji] = 1.0;
        skinWeights[ji + 1] = 0.0;
        skinWeights[ji + 2] = 0.0;
        skinWeights[ji + 3] = 0.0;
      } else if (deformType === 1) { // Bdef2
        const b0 = Math.max(0, this.readBoneIndex());
        const b1 = Math.max(0, this.readBoneIndex());
        const w0 = r.readFloat();
        jointIndices[ji] = b0;
        jointIndices[ji + 1] = b1;
        jointIndices[ji + 2] = 0;
        jointIndices[ji + 3] = 0;
        skinWeights[ji] = w0;
        skinWeights[ji + 1] = 1.0 - w0;
        skinWeights[ji + 2] = 0.0;
        skinWeights[ji + 3] = 0.0;
      } else if (deformType === 2) { // Bdef4
        const b0 = Math.max(0, this.readBoneIndex());
        const b1 = Math.max(0, this.readBoneIndex());
        const b2 = Math.max(0, this.readBoneIndex());
        const b3 = Math.max(0, this.readBoneIndex());
        const w0 = r.readFloat();
        const w1 = r.readFloat();
        const w2 = r.readFloat();
        const w3 = r.readFloat();
        jointIndices[ji] = b0;
        jointIndices[ji + 1] = b1;
        jointIndices[ji + 2] = b2;
        jointIndices[ji + 3] = b3;
        skinWeights[ji] = w0;
        skinWeights[ji + 1] = w1;
        skinWeights[ji + 2] = w2;
        skinWeights[ji + 3] = w3;
      } else if (deformType === 3) { // Sdef
        const b0 = Math.max(0, this.readBoneIndex());
        const b1 = Math.max(0, this.readBoneIndex());
        const w0 = r.readFloat();
        r.readVec3(); // C
        r.readVec3(); // R0
        r.readVec3(); // R1
        jointIndices[ji] = b0;
        jointIndices[ji + 1] = b1;
        jointIndices[ji + 2] = 0;
        jointIndices[ji + 3] = 0;
        skinWeights[ji] = w0;
        skinWeights[ji + 1] = 1.0 - w0;
        skinWeights[ji + 2] = 0.0;
        skinWeights[ji + 3] = 0.0;
      } else if (deformType === 4) { // Qdef
        const b0 = Math.max(0, this.readBoneIndex());
        const b1 = Math.max(0, this.readBoneIndex());
        const b2 = Math.max(0, this.readBoneIndex());
        const b3 = Math.max(0, this.readBoneIndex());
        const w0 = r.readFloat();
        const w1 = r.readFloat();
        const w2 = r.readFloat();
        const w3 = r.readFloat();
        jointIndices[ji] = b0;
        jointIndices[ji + 1] = b1;
        jointIndices[ji + 2] = b2;
        jointIndices[ji + 3] = b3;
        skinWeights[ji] = w0;
        skinWeights[ji + 1] = w1;
        skinWeights[ji + 2] = w2;
        skinWeights[ji + 3] = w3;
      } else {
        jointIndices[ji] = 0;
        jointIndices[ji + 1] = 0;
        jointIndices[ji + 2] = 0;
        jointIndices[ji + 3] = 0;
        skinWeights[ji] = 1.0;
        skinWeights[ji + 1] = 0.0;
        skinWeights[ji + 2] = 0.0;
        skinWeights[ji + 3] = 0.0;
      }

      // Edge factor
      r.readFloat();
    }

    // --- Indices ---
    const numIndices = r.readInt32();
    const indicesRaw = new Uint32Array(numIndices);
    for (let i = 0; i < numIndices; i++) {
      indicesRaw[i] = this.readVertexIndex();
    }

    // --- Textures ---
    const numTextures = r.readInt32();
    const texturePaths: string[] = [];
    for (let i = 0; i < numTextures; i++) {
      texturePaths.push(this.readText());
    }

    // --- Materials ---
    const numMaterials = r.readInt32();
    const materials: PmxMaterial[] = [];
    for (let i = 0; i < numMaterials; i++) {
      const matName = this.readText();
      const matEnglishName = this.readText();
      const [diffR, diffG, diffB, diffA] = r.readVec4();
      const [specR, specG, specB] = r.readVec3();
      const specFactor = r.readFloat();
      const [ambR, ambG, ambB] = r.readVec3();
      const flag = r.readUint8();
      const [edgeR, edgeG, edgeB, edgeA] = r.readVec4();
      const edgeSize = r.readFloat();
      const textureIndex = this.readTextureIndex();
      const sphereTextureIndex = this.readTextureIndex();
      const sphereMode = r.readUint8();
      const toonSharingFlag = r.readUint8();
      if (toonSharingFlag === 0) {
        this.readTextureIndex();
      } else {
        r.readUint8();
      }
      const comment = this.readText();
      const vertexCount = r.readInt32();

      materials.push({
        name: matName,
        diffuse: [diffR, diffG, diffB, diffA],
        texture_index: textureIndex,
        vertex_count: vertexCount,
      });
    }

    // --- Bones ---
    const numBones = r.readInt32();
    const bones: PmxRawBone[] = [];
    for (let i = 0; i < numBones; i++) {
      const boneName = this.readText();
      const boneEnglishName = this.readText();
      const [bx, by, bz] = r.readVec3();
      const parentIndex = this.readBoneIndex();
      const layer = r.readInt32();
      const flag = r.readUint16();

      // Tail position
      if (flag & 0x0001) {
        this.readBoneIndex();
      } else {
        r.readVec3();
      }

      // External parent
      if (flag & (0x0100 | 0x0200)) {
        this.readBoneIndex();
        r.readFloat();
      }

      // Fixed axis
      if (flag & 0x0400) r.readVec3();

      // Local coordinate
      if (flag & 0x0800) {
        r.readVec3();
        r.readVec3();
      }

      // External parent deform
      if (flag & 0x2000) r.readInt32();

      // IK
      if (flag & 0x0020) {
        this.readBoneIndex();
        r.readInt32();
        r.readFloat();
        const ikLinkCount = r.readInt32();
        for (let k = 0; k < ikLinkCount; k++) {
          this.readBoneIndex();
          const hasLimit = r.readUint8();
          if (hasLimit) {
            r.readVec3();
            r.readVec3();
          }
        }
      }

      bones.push({
        name: boneName,
        english_name: boneEnglishName,
        position: [bx, by, bz],
        parent_index: parentIndex,
      });
    }

    // --- Morphs ---
    const numMorphs = r.readInt32();
    const morphsRaw: PmxRawMorph[] = [];
    for (let i = 0; i < numMorphs; i++) {
      const morphName = this.readText();
      const morphEnglish = this.readText();
      r.readUint8(); // panel
      const morphType = r.readUint8();
      const offsetCount = r.readInt32();
      const vertexOffsets: PmxRawMorphOffset[] = [];

      for (let j = 0; j < offsetCount; j++) {
        if (morphType === 0) { // group
          this.readMorphIndex();
          r.readFloat();
        } else if (morphType === 1) { // vertex
          const vi = this.readUnsignedIndex(this.vertexIndexSize);
          const [dx, dy, dz] = r.readVec3();
          vertexOffsets.push({ vi, dx, dy, dz });
        } else if (morphType === 2) { // bone
          this.readBoneIndex();
          r.readVec3();
          r.readVec4();
        } else if (morphType >= 3 && morphType <= 7) { // UV / extended UV
          this.readUnsignedIndex(this.vertexIndexSize);
          r.readVec4();
        } else if (morphType === 8) { // material
          this.readMaterialIndex();
          r.readUint8();
          r.readVec4(); // diffuse
          r.readVec3(); // specular
          r.readFloat(); // specular factor
          r.readVec3(); // ambient
          r.readVec4(); // edge color
          r.readFloat(); // edge size
          r.readVec4(); // tex tint
          r.readVec4(); // env tint
          r.readVec4(); // toon tint
        } else if (morphType === 9) { // flip
          this.readMorphIndex();
          r.readFloat();
        } else if (morphType === 10) { // impulse
          this.readRigidbodyIndex();
          r.readUint8();
          r.readVec3();
          r.readVec3();
        }
      }

      if (morphType === 1 && vertexOffsets.length > 0) {
        morphsRaw.push({
          name: morphName,
          english_name: morphEnglish,
          offsets: vertexOffsets,
        });
      }
    }

    // --- Display slots (skip) ---
    const numDisplaySlots = r.readInt32();
    for (let i = 0; i < numDisplaySlots; i++) {
      this.readText();
      this.readText();
      const isSpecial = r.readUint8();
      const count = r.readInt32();
      for (let j = 0; j < count; j++) {
        const displayType = r.readUint8();
        if (displayType === 0) {
          this.readBoneIndex();
        } else {
          this.readMorphIndex();
        }
      }
    }

    // --- Rigid Bodies ---
    const numRigidbodies = r.readInt32();
    const rigidBodies: PmxRigidBody[] = [];
    for (let i = 0; i < numRigidbodies; i++) {
      const rbName = this.readText();
      const rbEnglishName = this.readText();
      const boneIndex = this.readBoneIndex();
      const collisionGroup = r.readUint8();
      const noCollisionGroup = r.readUint16();
      const shapeType = r.readUint8();
      const shapeSize = r.readVec3();
      const shapePosition = r.readVec3();
      const shapeRotation = r.readVec3();
      const mass = r.readFloat();
      const linearDamping = r.readFloat();
      const angularDamping = r.readFloat();
      const restitution = r.readFloat();
      const friction = r.readFloat();
      const mode = r.readUint8();

      rigidBodies.push({
        name: rbName,
        bone_index: boneIndex,
        collision_group: collisionGroup,
        no_collision_group: noCollisionGroup,
        shape_type: shapeType,
        shape_size: [...shapeSize],
        shape_position: [...shapePosition],
        shape_rotation: [...shapeRotation],
        mass,
        linear_damping: linearDamping,
        angular_damping: angularDamping,
        restitution,
        friction,
        mode,
      });
    }

    // --- Joints ---
    const numJoints = r.readInt32();
    const joints: PmxJoint[] = [];
    for (let i = 0; i < numJoints; i++) {
      const jName = this.readText();
      const jEnglishName = this.readText();
      const jointType = r.readUint8();
      const rbA = this.readRigidbodyIndex();
      const rbB = this.readRigidbodyIndex();
      const position = r.readVec3();
      const rotation = r.readVec3();
      const translationLimitMin = r.readVec3();
      const translationLimitMax = r.readVec3();
      const rotationLimitMin = r.readVec3();
      const rotationLimitMax = r.readVec3();
      const springConstantTranslation = r.readVec3();
      const springConstantRotation = r.readVec3();

      joints.push({
        name: jName,
        rigidbody_index_a: rbA,
        rigidbody_index_b: rbB,
        position: [...position],
        rotation: [...rotation],
        rotation_limit_min: [...rotationLimitMin],
        rotation_limit_max: [...rotationLimitMax],
        spring_constant_translation: [...springConstantTranslation],
        spring_constant_rotation: [...springConstantRotation],
      });
    }

    return {
      model_name: modelName,
      num_vertices: numVertices,
      positions,
      normals,
      uvs,
      joint_indices: jointIndices,
      skin_weights: skinWeights,
      indices: indicesRaw,
      texture_paths: texturePaths,
      materials,
      bones,
      morphs: morphsRaw,
      rigid_bodies: rigidBodies,
      joints,
    };
  }
}

// ── Texture loader ──

/**
 * Parse TGA (uncompressed and RLE) into raw RGBA pixels.
 * Covers the formats commonly used in MMD models.
 */
function decodeTga(buf: Buffer): { width: number; height: number; data: Buffer } {
  const idLen = buf[0];
  const colorMapType = buf[1];
  const imageType = buf[2];
  const width = buf.readUInt16LE(12);
  const height = buf.readUInt16LE(14);
  const bpp = buf[16];
  const descriptor = buf[17];

  const headerSize = 18 + idLen + (colorMapType ? buf.readUInt16LE(5) * Math.ceil(buf[7] / 8) : 0);
  const channels = bpp / 8;
  const pixelCount = width * height;
  const pixels = Buffer.alloc(pixelCount * 4);

  let src = headerSize;

  function writePixel(dst: number, offset: number) {
    if (channels >= 3) {
      // TGA stores BGR(A)
      pixels[dst] = buf[offset + 2];
      pixels[dst + 1] = buf[offset + 1];
      pixels[dst + 2] = buf[offset];
      pixels[dst + 3] = channels === 4 ? buf[offset + 3] : 255;
    } else if (channels === 1) {
      pixels[dst] = buf[offset];
      pixels[dst + 1] = buf[offset];
      pixels[dst + 2] = buf[offset];
      pixels[dst + 3] = 255;
    }
  }

  if (imageType === 2 || imageType === 3) {
    // Uncompressed
    for (let i = 0; i < pixelCount; i++) {
      writePixel(i * 4, src);
      src += channels;
    }
  } else if (imageType === 10 || imageType === 11) {
    // RLE compressed
    let pi = 0;
    while (pi < pixelCount) {
      const header = buf[src++];
      const count = (header & 0x7F) + 1;
      if (header & 0x80) {
        // Run-length packet
        for (let j = 0; j < count && pi < pixelCount; j++, pi++) {
          writePixel(pi * 4, src);
        }
        src += channels;
      } else {
        // Raw packet
        for (let j = 0; j < count && pi < pixelCount; j++, pi++) {
          writePixel(pi * 4, src);
          src += channels;
        }
      }
    }
  } else {
    throw new Error(`Unsupported TGA image type: ${imageType}`);
  }

  // Flip vertically if origin is bottom-left (bit 5 of descriptor = 0)
  const topDown = (descriptor & 0x20) !== 0;
  if (!topDown) {
    const rowBytes = width * 4;
    const tmp = Buffer.alloc(rowBytes);
    for (let y = 0; y < Math.floor(height / 2); y++) {
      const topOff = y * rowBytes;
      const botOff = (height - 1 - y) * rowBytes;
      pixels.copy(tmp, 0, topOff, topOff + rowBytes);
      pixels.copy(pixels, topOff, botOff, botOff + rowBytes);
      tmp.copy(pixels, botOff);
    }
  }

  return { width, height, data: pixels };
}

/**
 * Parse BMP into raw RGBA pixels.
 * Handles 24-bit and 32-bit uncompressed BMPs (common in MMD).
 */
function decodeBmp(buf: Buffer): { width: number; height: number; data: Buffer } {
  if (buf[0] !== 0x42 || buf[1] !== 0x4D) throw new Error("Not a BMP file");

  const dataOffset = buf.readUInt32LE(10);
  const width = buf.readInt32LE(18);
  const rawHeight = buf.readInt32LE(22);
  const height = Math.abs(rawHeight);
  const bpp = buf.readUInt16LE(28);
  const compression = buf.readUInt32LE(30);

  if (compression !== 0 && compression !== 3) {
    throw new Error(`Unsupported BMP compression: ${compression}`);
  }
  if (bpp !== 24 && bpp !== 32 && bpp !== 8) {
    throw new Error(`Unsupported BMP bpp: ${bpp}`);
  }

  const pixels = Buffer.alloc(width * height * 4);
  const channels = bpp / 8;
  const rowSize = Math.ceil((width * channels) / 4) * 4; // rows padded to 4 bytes
  const bottomUp = rawHeight > 0;

  for (let y = 0; y < height; y++) {
    const srcY = bottomUp ? (height - 1 - y) : y;
    const rowStart = dataOffset + srcY * rowSize;
    for (let x = 0; x < width; x++) {
      const dst = (y * width + x) * 4;
      const src = rowStart + x * channels;
      if (channels >= 3) {
        // BMP stores BGR(A)
        pixels[dst] = buf[src + 2];
        pixels[dst + 1] = buf[src + 1];
        pixels[dst + 2] = buf[src];
        pixels[dst + 3] = channels === 4 ? buf[src + 3] : 255;
      } else {
        // 8-bit grayscale
        pixels[dst] = buf[src];
        pixels[dst + 1] = buf[src];
        pixels[dst + 2] = buf[src];
        pixels[dst + 3] = 255;
      }
    }
  }

  return { width, height, data: pixels };
}

/**
 * Load a texture file and convert to PNG.
 * Supports all sharp-native formats plus TGA and BMP fallback.
 */
async function loadTextureAsPng(filePath: string): Promise<Buffer> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".tga") {
    const raw = await readFile(filePath);
    const { width, height, data } = decodeTga(Buffer.from(raw));
    return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  }

  // Try sharp first (PNG, JPEG, WebP, TIFF, GIF, etc.)
  try {
    return await sharp(filePath).png().toBuffer();
  } catch {
    // Fallback: try BMP decoder for formats sharp can't handle
    if (ext === ".bmp") {
      const raw = await readFile(filePath);
      const { width, height, data } = decodeBmp(Buffer.from(raw));
      return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
    }
    throw new Error(`Unsupported image format: ${ext}`);
  }
}

// ── Public API ──

/**
 * Read PMX file and return normalized data for the converter pipeline.
 *
 * Applies coordinate transform (X-negate for left->right hand) and scale.
 */
export async function read(pmxPath: string, scale = 0.08): Promise<PmxData> {
  const pmxDir = path.dirname(path.resolve(pmxPath));
  const fileData = await readFile(pmxPath);
  const data = new Uint8Array(fileData.buffer, fileData.byteOffset, fileData.byteLength);

  const reader = new PmxReader(data);
  const raw = reader.read();

  const numVerts = raw.num_vertices;

  // --- Apply coordinate transform + scale ---
  const positions = new Float32Array(raw.positions);
  for (let i = 0; i < numVerts; i++) {
    const pi = i * 3;
    positions[pi] *= -scale;     // X-flip
    positions[pi + 1] *= scale;  // Y
    positions[pi + 2] *= scale;  // Z
  }

  const normals = new Float32Array(raw.normals);
  for (let i = 0; i < numVerts; i++) {
    normals[i * 3] *= -1; // X-flip normals (no scale)
  }

  const uvs = raw.uvs;
  const jointIndices = raw.joint_indices;
  const skinWeights = new Float32Array(raw.skin_weights);

  // Normalize weights
  for (let i = 0; i < numVerts; i++) {
    const wi = i * 4;
    let sum = skinWeights[wi] + skinWeights[wi + 1] + skinWeights[wi + 2] + skinWeights[wi + 3];
    if (sum === 0) sum = 1.0;
    skinWeights[wi] /= sum;
    skinWeights[wi + 1] /= sum;
    skinWeights[wi + 2] /= sum;
    skinWeights[wi + 3] /= sum;
  }

  // Bones that actually drive vertices (weight > 0)
  const skinnedBoneIndices = new Set<number>();
  for (let i = 0; i < numVerts; i++) {
    const wi = i * 4;
    const ji = i * 4;
    for (let k = 0; k < 4; k++) {
      if (skinWeights[wi + k] > 0) {
        skinnedBoneIndices.add(jointIndices[ji + k]);
      }
    }
  }

  // Winding reversal: (a,b,c) -> (a,c,b)
  const numTris = raw.indices.length / 3;
  const indices = new Uint32Array(raw.indices.length);
  for (let t = 0; t < numTris; t++) {
    const base = t * 3;
    indices[base] = raw.indices[base];
    indices[base + 1] = raw.indices[base + 2]; // swap 1 and 2
    indices[base + 2] = raw.indices[base + 1];
  }

  // Bones: apply coordinate transform + scale
  const bones: PmxBone[] = raw.bones.map(b => ({
    name: b.name,
    english_name: b.english_name,
    position: new Float32Array([
      -b.position[0] * scale,
      b.position[1] * scale,
      b.position[2] * scale,
    ]),
    parent_index: b.parent_index,
  }));

  // Materials (pass through)
  const materials = raw.materials;

  // Textures: load + convert to PNG
  const textures: Uint8Array[] = [];
  const textureMimes: string[] = [];

  for (const texPath of raw.texture_paths) {
    const fullPath = path.join(pmxDir, texPath.replace(/\\/g, path.sep).replace(/\//g, path.sep));
    try {
      const pngBuffer = await loadTextureAsPng(fullPath);
      textures.push(new Uint8Array(pngBuffer));
      textureMimes.push("image/png");
    } catch (e: any) {
      console.log(`Warning: Failed to load texture '${texPath}': ${e.message}`);
      // 1x1 white fallback
      const fallback = await sharp({
        create: { width: 1, height: 1, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
      }).png().toBuffer();
      textures.push(new Uint8Array(fallback));
      textureMimes.push("image/png");
    }
  }

  // Rigid bodies: apply coordinate transform + scale
  const rigidBodies: PmxRigidBody[] = raw.rigid_bodies.map(rb => ({
    ...rb,
    shape_size: [rb.shape_size[0] * scale, rb.shape_size[1] * scale, rb.shape_size[2] * scale],
    shape_position: [-rb.shape_position[0] * scale, rb.shape_position[1] * scale, rb.shape_position[2] * scale],
  }));

  // Joints: apply coordinate transform + scale
  // Only pass fields used by spring converter (match Python pipeline).
  // rotation_limit_min/max are intentionally excluded — the spring converter
  // uses spring_constant_rotation as the primary stiffiness source, and
  // including rotation limits produces overly aggressive gravity values.
  const jointsPhys: PmxJoint[] = raw.joints.map(j => ({
    name: j.name,
    rigidbody_index_a: j.rigidbody_index_a,
    rigidbody_index_b: j.rigidbody_index_b,
    position: [-j.position[0] * scale, j.position[1] * scale, j.position[2] * scale],
    rotation: j.rotation,
    spring_constant_translation: j.spring_constant_translation,
    spring_constant_rotation: j.spring_constant_rotation,
  }));

  // Morphs: apply same X-negate + scale as vertex positions
  const morphs: PmxMorph[] = raw.morphs.map(m => ({
    name: m.name,
    english_name: m.english_name,
    offsets: m.offsets.map(o => ({
      vi: o.vi,
      dx: -o.dx * scale,
      dy: o.dy * scale,
      dz: o.dz * scale,
    })),
  }));

  return {
    positions,
    normals,
    uvs,
    joints: jointIndices,
    weights: skinWeights,
    indices,
    materials,
    bones,
    skinned_bone_indices: skinnedBoneIndices,
    textures,
    texture_mimes: textureMimes,
    morphs,
    rigid_bodies: rigidBodies,
    joints_phys: jointsPhys,
    pmx_dir: pmxDir,
  };
}

/** Export PmxReader for intake humanoid scanning (no file I/O). */
export { PmxReader };
