/**
 * Browser conversion entry point — ZIP in, VRM out, no filesystem.
 *
 * Orchestrates the full PMX → VRM pipeline using browser adapters.
 */

import { loadZip } from "./zip-reader.js";
import { BrowserImageEncoder } from "./image-encoder.js";
import { BrowserTextCodec } from "./text-codec.js";
import { read as readPmx } from "../core/pmx-reader.js";
import { isHumanoid } from "../core/humanoid-check.js";
import { build as buildGltf } from "../core/gltf-builder.js";
import { convert as convertSpring } from "../core/spring-converter.js";
import { build as buildVrm } from "../core/vrm-builder.js";
import { writeGlb } from "../core/glb-writer.js";
import { mapBones } from "../core/bone-mapping.js";
import { renameVrm } from "../core/vrm-renamer.js";
import { validate } from "../core/vrm-validator.js";
import { basename } from "../core/path-utils.js";
import type { ConvertDeps, VrmOutput } from "../core/types.js";

export interface ConvertOptions {
  scale?: number;
  noSpring?: boolean;
}

export async function convertZip(
  zipBuffer: ArrayBuffer,
  opts: ConvertOptions = {},
): Promise<VrmOutput[]> {
  const deps: ConvertDeps = {
    image: new BrowserImageEncoder(),
    text: new BrowserTextCodec(),
  };
  const scale = opts.scale ?? 0.08;
  const zip = await loadZip(zipBuffer);

  // Find .pmx entries (skip macOS resource forks)
  const pmxEntries = Object.entries(zip.files)
    .filter(([name, file]) =>
      !file.dir &&
      name.toLowerCase().endsWith(".pmx") &&
      !name.startsWith("__MACOSX"),
    );

  const results: VrmOutput[] = [];

  for (const [name, entry] of pmxEntries) {
    const logs: string[] = [];
    const pmxBytes = await entry.async("uint8array");

    // Skip non-humanoid PMX
    const [ok] = isHumanoid(pmxBytes);
    if (!ok) {
      logs.push(`skip non-humanoid: ${name}`);
      continue;
    }

    // Collect textures from same directory in ZIP
    const dir = name.substring(0, name.lastIndexOf("/") + 1);
    const textures = new Map<string, Uint8Array>();
    for (const [tName, tEntry] of Object.entries(zip.files)) {
      if (tEntry.dir) continue;
      if (tName === name) continue;
      if (!tName.startsWith(dir)) continue;
      textures.set(tName.substring(dir.length), await tEntry.async("uint8array"));
    }

    // Core pipeline (mirrors adapter-node/intake.ts convertOne)
    logs.push(`Converting: ${name}`);
    const pmxData = await readPmx(pmxBytes, textures, deps, scale);
    logs.push(
      `  Vertices: ${pmxData.positions.length / 3}, ` +
      `Bones: ${pmxData.bones.length}, ` +
      `Materials: ${pmxData.materials.length}`,
    );

    let gltfData = buildGltf(pmxData);
    const humanoidBones = mapBones(pmxData.bones, pmxData.skinned_bone_indices);

    const secondary = opts.noSpring
      ? { boneGroups: [], colliderGroups: [] }
      : convertSpring(pmxData.rigid_bodies, pmxData.joints_phys, pmxData.bones);

    gltfData = buildVrm(gltfData, humanoidBones, secondary, pmxData.materials);
    const glbBytes = writeGlb(gltfData);

    // Rename step
    const pmxBasename = basename(name);
    const { buffer: renamedBuf, englishName } = renameVrm(glbBytes, pmxBasename);
    logs.push(`  Renamed: ${pmxBasename} -> ${englishName}`);

    // Validate
    const validation = validate(renamedBuf);

    results.push({
      name: englishName,
      vrm: renamedBuf,
      validation,
      logs,
    });
  }

  return results;
}
