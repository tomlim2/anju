/**
 * CLI entry point for PMX -> VRM 0.x conversion.
 *
 * Usage:
 *   npx tsx src/index.ts input.pmx output.vrm
 *   npx tsx src/index.ts input.pmx output.vrm --scale 0.08 --no-spring
 */

import { writeFile } from "node:fs/promises";
import type { GltfData } from "./types.js";

/**
 * Write glTF data as GLB binary with proper 4-byte alignment.
 *
 * GLB layout:
 *   [12-byte header: magic + version + total_length]
 *   [JSON chunk: length + type(0x4E4F534A) + data (space-padded)]
 *   [BIN chunk:  length + type(0x004E4942) + data (null-padded)]
 */
export async function writeGlb(gltfData: GltfData, outputPath: string): Promise<void> {
  const jsonStr = JSON.stringify(gltfData.json);
  const jsonBytes = new TextEncoder().encode(jsonStr);

  // Pad JSON to 4-byte alignment with spaces (0x20)
  const jsonPad = (4 - (jsonBytes.byteLength % 4)) % 4;
  const jsonPadded = new Uint8Array(jsonBytes.byteLength + jsonPad);
  jsonPadded.set(jsonBytes);
  for (let i = 0; i < jsonPad; i++) jsonPadded[jsonBytes.byteLength + i] = 0x20;

  // Pad BIN to 4-byte alignment with null bytes
  const binData = gltfData.bin;
  const binPad = (4 - (binData.byteLength % 4)) % 4;
  const binPadded = new Uint8Array(binData.byteLength + binPad);
  binPadded.set(binData);

  const totalLength = 12 + 8 + jsonPadded.byteLength + 8 + binPadded.byteLength;

  const output = new Uint8Array(totalLength);
  const view = new DataView(output.buffer);

  // GLB header
  view.setUint32(0, 0x46546C67, true);  // magic: 'glTF'
  view.setUint32(4, 2, true);            // version: 2
  view.setUint32(8, totalLength, true);   // total length

  // JSON chunk
  let offset = 12;
  view.setUint32(offset, jsonPadded.byteLength, true);
  view.setUint32(offset + 4, 0x4E4F534A, true); // JSON
  offset += 8;
  output.set(jsonPadded, offset);
  offset += jsonPadded.byteLength;

  // BIN chunk
  view.setUint32(offset, binPadded.byteLength, true);
  view.setUint32(offset + 4, 0x004E4942, true); // BIN
  offset += 8;
  output.set(binPadded, offset);

  await writeFile(outputPath, output);
}

// ── CLI ──

async function main(): Promise<void> {
  const { program } = await import("commander");
  const { read } = await import("./pmx-reader.js");
  const { build: buildGltf } = await import("./gltf-builder.js");
  const { mapBones } = await import("./bone-mapping.js");
  const { convert: convertSpring } = await import("./spring-converter.js");
  const { build: buildVrm } = await import("./vrm-builder.js");

  program
    .name("truepmx2vrm")
    .description("Convert PMX to VRM 0.x (.vrm) with spring bone preservation")
    .argument("<input>", "Input PMX file path")
    .argument("<output>", "Output VRM file path (.vrm)")
    .option("--scale <number>", "Position scale factor (default: 0.08)", parseFloat, 0.08)
    .option("--no-spring", "Skip spring bone conversion")
    .action(async (input: string, output: string, opts: { scale: number; spring: boolean }) => {
      // 1. Read PMX
      console.log(`Reading PMX: ${input}`);
      const pmxData = await read(input, opts.scale);
      console.log(`  Vertices:     ${pmxData.positions.length / 3}`);
      console.log(`  Bones:        ${pmxData.bones.length}`);
      console.log(`  Materials:    ${pmxData.materials.length}`);
      console.log(`  Textures:     ${pmxData.textures.length}`);
      console.log(`  Morphs:       ${pmxData.morphs.length} (vertex)`);
      console.log(`  Rigid bodies: ${pmxData.rigid_bodies.length}`);
      console.log(`  Joints:       ${pmxData.joints_phys.length}`);

      // 2. Build glTF skeleton / mesh / textures
      console.log("Building glTF skeleton/mesh/textures...");
      let gltfData = buildGltf(pmxData);

      // 3. Map bones to VRM humanoid
      console.log("Mapping bones to VRM humanoid...");
      const humanoidBones = mapBones(pmxData.bones, pmxData.skinned_bone_indices);
      console.log(`  Mapped ${humanoidBones.length} humanoid bones`);
      console.log(`  Skinned bones in model: ${pmxData.skinned_bone_indices.size} / ${pmxData.bones.length}`);

      const skinless = pmxData.bones
        .map((b, i) => ({ name: b.name, idx: i }))
        .filter(
          ({ idx }) =>
            !pmxData.skinned_bone_indices.has(idx) &&
            humanoidBones.some(e => e.node === idx),
        )
        .map(({ name }) => name);
      if (skinless.length > 0) {
        console.log(`  Warning: humanoid bone(s) with no skinning: ${skinless}`);
      }

      // 4. Convert physics to spring bones
      let secondaryAnimation;
      if (!opts.spring) {
        secondaryAnimation = { boneGroups: [], colliderGroups: [] };
        console.log("Skipping spring bone conversion (--no-spring)");
      } else {
        console.log("Converting physics to spring bones...");
        secondaryAnimation = convertSpring(
          pmxData.rigid_bodies,
          pmxData.joints_phys,
          pmxData.bones,
        );
        console.log(`  Bone groups:    ${secondaryAnimation.boneGroups.length}`);
        console.log(`  Collider groups: ${secondaryAnimation.colliderGroups.length}`);
      }

      // 5. Build VRM 0.x extension
      console.log("Building VRM 0.x extension...");
      gltfData = buildVrm(gltfData, humanoidBones, secondaryAnimation, pmxData.materials);

      // 6. Write GLB
      console.log(`Writing GLB: ${output}`);
      await writeGlb(gltfData, output);
      console.log("Done.");
    });

  await program.parseAsync();
}

// Run CLI if executed directly
const isMain = process.argv[1] &&
  (process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.js"));
if (isMain) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
