/**
 * ZIP intake — scan a zip for humanoid PMX models, then convert to VRM.
 *
 * Handles nested zips (zip-in-zip) which is common for MMD model distributions.
 *
 * Usage:
 *   npx tsx src/intake.ts model.zip
 *   npx tsx src/intake.ts model.zip --output ./out
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import JSZip from "jszip";
import iconv from "iconv-lite";
import { PmxReader } from "./pmx-reader.js";
import {
  PMX_BONE_REPLACEMENTS,
  PMX_TO_VRM_HUMANOID,
  VRM_REQUIRED_BONES,
  mapBones,
} from "./bone-mapping.js";
import { read as readPmx } from "./pmx-reader.js";
import { build as buildGltf } from "./gltf-builder.js";
import { convert as convertSpring } from "./spring-converter.js";
import { build as buildVrm } from "./vrm-builder.js";
import { writeGlb } from "./index.js";

// Encodings to try when zip filenames are not UTF-8
const FALLBACK_ENCODINGS = ["shiftjis", "gbk", "euc-kr", "big5"];

/**
 * Custom filename decoder for JSZip.loadAsync().
 * Receives raw bytes from the zip central directory and decodes them properly.
 * Tries UTF-8 first (modern zips), then Shift-JIS (most common for MMD), then other CJK.
 */
function smartDecodeFilename(bytes: Uint8Array): string {
  try {
    const utf8 = new TextDecoder("utf-8", { fatal: true });
    return utf8.decode(bytes);
  } catch {}

  for (const enc of FALLBACK_ENCODINGS) {
    try {
      const decoded = iconv.decode(Buffer.from(bytes), enc);
      if (!decoded.includes("\uFFFD")) return decoded;
    } catch {
      continue;
    }
  }

  return new TextDecoder("utf-8").decode(bytes);
}

const ZIP_OPTS = { decodeFileName: smartDecodeFilename };

interface ScanResult {
  name: string;
  zipEntry: string;
  parentZip: string | null;
  humanoid: boolean;
  mappedBones: Set<string>;
  mappedCount: number;
}

function scanBones(pmxBytes: Uint8Array): string[] {
  try {
    const reader = new PmxReader(pmxBytes);
    const raw = reader.read();
    return raw.bones.map((b: any) => b.name);
  } catch {
    return [];
  }
}

function isHumanoid(pmxBytes: Uint8Array): [boolean, Set<string>] {
  const boneNames = scanBones(pmxBytes);
  if (boneNames.length === 0) return [false, new Set()];

  const mapped = new Set<string>();
  for (const name of boneNames) {
    const lookup = PMX_BONE_REPLACEMENTS.get(name) ?? name;
    const vrmNames = PMX_TO_VRM_HUMANOID.get(lookup) ?? [];
    for (const vrmName of vrmNames) {
      if (VRM_REQUIRED_BONES.has(vrmName)) mapped.add(vrmName);
    }
  }

  return [mapped.size >= VRM_REQUIRED_BONES.size, mapped];
}

async function scanZipFile(
  zip: JSZip,
  prefix = "",
): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  for (const [entryName, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    const lower = entryName.toLowerCase();

    if (lower.endsWith(".pmx")) {
      const pmxBytes = await file.async("uint8array");
      const [humanoid, mapped] = isHumanoid(pmxBytes);
      results.push({
        name: prefix ? `${prefix}${entryName}` : entryName,
        zipEntry: entryName,
        parentZip: prefix ? prefix.replace(/\/$/, "") : null,
        humanoid,
        mappedBones: mapped,
        mappedCount: mapped.size,
      });
    } else if (lower.endsWith(".zip")) {
      const innerBytes = await file.async("uint8array");
      try {
        const innerZip = await JSZip.loadAsync(innerBytes, ZIP_OPTS);
        const nestedPrefix = `${prefix}${entryName}/`;
        const nested = await scanZipFile(innerZip, nestedPrefix);
        results.push(...nested);
      } catch {
        // Bad inner zip, skip
      }
    }
  }

  return results;
}

export async function scanZip(zipPath: string): Promise<ScanResult[]> {
  const data = await readFile(zipPath);
  const zip = await JSZip.loadAsync(data, ZIP_OPTS);
  return scanZipFile(zip);
}

async function extractPmxToTmp(
  zipPath: string,
  scanResult: ScanResult,
  tmpDir: string,
): Promise<string> {
  const data = await readFile(zipPath);
  let zip = await JSZip.loadAsync(data, ZIP_OPTS);

  // If nested zip, open the inner zip first
  if (scanResult.parentZip) {
    const parentEntry = scanResult.parentZip;
    // Find the parent zip entry in the outer zip
    // The parentZip is the full prefix, which is the nested zip entry
    const innerZipEntry = Object.keys(zip.files).find(
      name => scanResult.name.startsWith(name + "/") || name === parentEntry,
    );
    if (innerZipEntry) {
      const innerBytes = await zip.file(innerZipEntry)!.async("uint8array");
      zip = await JSZip.loadAsync(innerBytes, ZIP_OPTS);
    }
  }

  // Extract the PMX file
  const pmxFile = zip.file(scanResult.zipEntry);
  if (!pmxFile) throw new Error(`PMX entry not found: ${scanResult.zipEntry}`);

  const pmxBytes = await pmxFile.async("uint8array");
  const pmxBasename = path.basename(scanResult.zipEntry);
  const pmxPath = path.join(tmpDir, pmxBasename);
  await writeFile(pmxPath, pmxBytes);

  // Extract sibling files (textures etc.) from the same directory in the zip
  const pmxDir = path.dirname(scanResult.zipEntry);
  for (const [entryName, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    if (entryName === scanResult.zipEntry) continue;

    // Only extract files in the same directory or subdirectories
    const entryDir = path.dirname(entryName);
    if (!entryDir.startsWith(pmxDir)) continue;

    const relativePath = pmxDir ? entryName.slice(pmxDir.length + 1) : entryName;
    const targetPath = path.join(tmpDir, relativePath);
    const targetDir = path.dirname(targetPath);
    try {
      await mkdir(targetDir, { recursive: true });
      const bytes = await file.async("uint8array");
      await writeFile(targetPath, bytes);
    } catch {
      // Skip files with names the OS can't handle (rare encoding edge cases)
    }
  }

  return pmxPath;
}

export async function process_(
  zipPath: string,
  outputDir?: string,
  scale = 0.08,
  noSpring = false,
): Promise<string[]> {
  const resolvedZip = path.resolve(zipPath);
  if (!existsSync(resolvedZip)) {
    throw new Error(`Zip not found: ${resolvedZip}`);
  }

  const outDir = outputDir ? path.resolve(outputDir) : path.dirname(resolvedZip);
  await mkdir(outDir, { recursive: true });

  // 1. Scan
  console.log(`Scanning: ${path.basename(zipPath)}`);
  const results = await scanZip(resolvedZip);

  if (results.length === 0) {
    throw new Error(`No .pmx files found in ${path.basename(zipPath)}`);
  }

  const humanoids = results.filter(r => r.humanoid);

  for (const r of results) {
    const tag = r.humanoid ? "humanoid" : "SKIP";
    console.log(`  ${r.name} — ${tag} (${r.mappedCount}/17 required bones)`);
  }

  if (humanoids.length === 0) {
    throw new Error(
      `No humanoid PMX found in ${path.basename(zipPath)}. Checked ${results.length} .pmx file(s).`,
    );
  }

  // 2. Extract and convert
  const outputPaths: string[] = [];

  // Use OS temp directory
  const tmpBase = path.join(tmpdir(), `truepmx2vrm-${Date.now()}`);
  await mkdir(tmpBase, { recursive: true });

  try {
    for (const scanResult of humanoids) {
      const tmpDir = path.join(tmpBase, `pmx-${outputPaths.length}`);
      await mkdir(tmpDir, { recursive: true });

      const pmxPath = await extractPmxToTmp(resolvedZip, scanResult, tmpDir);
      const decodedStem = path.parse(pmxPath).name;
      let vrmPath = path.join(outDir, `${decodedStem}.vrm`);

      // Avoid overwriting
      let counter = 2;
      while (existsSync(vrmPath) || outputPaths.includes(vrmPath)) {
        vrmPath = path.join(outDir, `${decodedStem}_${counter}.vrm`);
        counter++;
      }

      console.log(`\nConverting: ${scanResult.name}`);
      const pmxData = await readPmx(pmxPath, scale);
      console.log(
        `  Vertices: ${pmxData.positions.length / 3}, ` +
        `Bones: ${pmxData.bones.length}, ` +
        `Materials: ${pmxData.materials.length}`,
      );

      let gltfData = buildGltf(pmxData);
      const humanoidBones = mapBones(pmxData.bones);

      let secondary;
      if (noSpring) {
        secondary = { boneGroups: [], colliderGroups: [] };
      } else {
        secondary = convertSpring(
          pmxData.rigid_bodies,
          pmxData.joints_phys,
          pmxData.bones,
        );
      }

      gltfData = buildVrm(gltfData, humanoidBones, secondary, pmxData.materials);

      await writeGlb(gltfData, vrmPath);
      outputPaths.push(vrmPath);
      console.log(`  -> ${vrmPath}`);
    }
  } finally {
    // Cleanup temp directory
    const { rm } = await import("node:fs/promises");
    await rm(tmpBase, { recursive: true, force: true }).catch(() => {});
  }

  console.log(`\nDone. ${outputPaths.length} model(s) converted.`);
  return outputPaths;
}

// ── CLI ──

async function main(): Promise<void> {
  const { program } = await import("commander");

  program
    .name("intake")
    .description("ZIP intake for PMX -> VRM conversion")
    .argument("<input>", "Input zip file path")
    .option("-o, --output <dir>", "Output directory (default: same as zip)")
    .option("--scale <number>", "Scale factor (default: 0.08)", parseFloat, 0.08)
    .option("--no-spring", "Skip spring bones")
    .action(async (input: string, opts: { output?: string; scale: number; spring: boolean }) => {
      try {
        await process_(input, opts.output, opts.scale, !opts.spring);
      } catch (e: any) {
        console.error(`Error: ${e.message}`);
        process.exit(1);
      }
    });

  await program.parseAsync();
}

const isMain = process.argv[1] &&
  (process.argv[1].endsWith("intake.ts") || process.argv[1].endsWith("intake.js"));
if (isMain) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
