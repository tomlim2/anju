import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { read as readPmx } from "@converter/pmx-reader.js";
import { build as buildGltf } from "@converter/gltf-builder.js";
import { mapBones } from "@converter/bone-mapping.js";
import { convert as convertSpring } from "@converter/spring-converter.js";
import { build as buildVrm } from "@converter/vrm-builder.js";
import { validate } from "@converter/vrm-validator.js";
import type { GltfData } from "@converter/types.js";

export const maxDuration = 120;

function buildGlbBuffer(gltfData: GltfData): Uint8Array {
  const jsonStr = JSON.stringify(gltfData.json);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  const jsonPad = (4 - (jsonBytes.byteLength % 4)) % 4;
  const jsonPadded = new Uint8Array(jsonBytes.byteLength + jsonPad);
  jsonPadded.set(jsonBytes);
  for (let i = 0; i < jsonPad; i++) jsonPadded[jsonBytes.byteLength + i] = 0x20;

  const binData = gltfData.bin;
  const binPad = (4 - (binData.byteLength % 4)) % 4;
  const binPadded = new Uint8Array(binData.byteLength + binPad);
  binPadded.set(binData);

  const totalLength = 12 + 8 + jsonPadded.byteLength + 8 + binPadded.byteLength;
  const output = new Uint8Array(totalLength);
  const view = new DataView(output.buffer);

  view.setUint32(0, 0x46546C67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);

  let offset = 12;
  view.setUint32(offset, jsonPadded.byteLength, true);
  view.setUint32(offset + 4, 0x4E4F534A, true);
  offset += 8;
  output.set(jsonPadded, offset);
  offset += jsonPadded.byteLength;

  view.setUint32(offset, binPadded.byteLength, true);
  view.setUint32(offset + 4, 0x004E4942, true);
  offset += 8;
  output.set(binPadded, offset);

  return output;
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  let tmpDir = "";

  try {
    const form = await req.formData();
    const scale = parseFloat(String(form.get("scale") ?? "0.08"));
    const noSpring = form.get("noSpring") === "true";

    tmpDir = path.join(tmpdir(), `truepmx2vrm-web-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });

    // Support both folder upload (files[]+paths[]) and legacy single file
    const files = form.getAll("files") as File[];
    const paths = form.getAll("paths") as string[];
    let pmxPath = "";
    let originalName = "";

    if (files.length > 0 && paths.length === files.length) {
      // Folder mode: write all files preserving relative paths
      let largestPmxSize = 0;
      for (let i = 0; i < files.length; i++) {
        const relPath = paths[i];
        const dest = path.join(tmpDir, ...relPath.split("/"));
        await mkdir(path.dirname(dest), { recursive: true });
        const buf = Buffer.from(await files[i].arrayBuffer());
        await writeFile(dest, buf);
        // Pick the largest PMX (humanoid > accessories)
        if (relPath.toLowerCase().endsWith(".pmx") && files[i].size > largestPmxSize) {
          largestPmxSize = files[i].size;
          pmxPath = dest;
          originalName = files[i].name;
        }
      }
    } else {
      // Legacy single file mode
      const file = form.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }
      originalName = file.name;
      pmxPath = path.join(tmpDir, originalName);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(pmxPath, buffer);
    }

    if (!pmxPath) {
      return NextResponse.json({ error: "No .pmx file found in upload" }, { status: 400 });
    }

    // 1. Read PMX
    log("Reading PMX...");
    const pmxData = await readPmx(pmxPath, scale);
    log(`  Vertices: ${pmxData.positions.length / 3}, Bones: ${pmxData.bones.length}, Materials: ${pmxData.materials.length}, Morphs: ${pmxData.morphs.length}`);

    // 2. Build glTF
    log("Building glTF...");
    let gltfData = buildGltf(pmxData);

    // 3. Map bones
    log("Mapping bones...");
    const humanoidBones = mapBones(pmxData.bones, pmxData.skinned_bone_indices);
    log(`  Mapped ${humanoidBones.length} humanoid bones`);

    if (humanoidBones.length < 15) {
      return NextResponse.json({
        error: `Not a humanoid PMX: only ${humanoidBones.length}/15 required bones mapped. This file may be an accessory or prop.`,
        logs,
      }, { status: 400 });
    }

    // 4. Spring bones
    let secondary;
    if (noSpring) {
      secondary = { boneGroups: [], colliderGroups: [] };
      log("Skipped spring bones");
    } else {
      log("Converting spring bones...");
      secondary = convertSpring(pmxData.rigid_bodies, pmxData.joints_phys, pmxData.bones);
      log(`  ${secondary.boneGroups.length} bone groups, ${secondary.colliderGroups.length} collider groups`);
    }

    // 5. Build VRM
    log("Building VRM extension...");
    gltfData = buildVrm(gltfData, humanoidBones, secondary, pmxData.materials);

    // 6. Build GLB
    log("Building GLB...");
    const glbBuffer = buildGlbBuffer(gltfData);

    // 7. Validate
    log("Validating...");
    const validation = await validate(glbBuffer);

    const elapsed = Date.now() - start;
    log(`Done in ${elapsed}ms (${(glbBuffer.byteLength / 1024).toFixed(0)} KB)`);

    const vrmName = originalName.replace(/\.pmx$/i, ".vrm");
    const safeFilename = encodeURIComponent(vrmName);

    return new NextResponse(Buffer.from(glbBuffer) as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "model/gltf-binary",
        "Content-Disposition": `attachment; filename*=UTF-8''${safeFilename}`,
        "X-Convert-Time": String(elapsed),
        "X-Convert-Logs": Buffer.from(JSON.stringify(logs)).toString("base64"),
        "X-Validation": Buffer.from(JSON.stringify(validation)).toString("base64"),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, logs }, { status: 500 });
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
