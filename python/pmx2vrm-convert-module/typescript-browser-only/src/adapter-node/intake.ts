/**
 * Node.js CLI adapter — wraps core functions with file I/O.
 *
 * Unified PMX → VRM CLI — folder or ZIP input → convert → rename → validate.
 */

import { readFile, writeFile, mkdir, readdir, rm, unlink } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import JSZip from "jszip";
import { NodeImageEncoder } from "./image-encoder.js";
import { NodeTextCodec } from "./text-codec.js";
import { read as readPmx } from "../core/pmx-reader.js";
import { isHumanoid } from "../core/humanoid-check.js";
import { build as buildGltf } from "../core/gltf-builder.js";
import { convert as convertSpring } from "../core/spring-converter.js";
import { build as buildVrm } from "../core/vrm-builder.js";
import { writeGlb } from "../core/glb-writer.js";
import { renameVrm } from "../core/vrm-renamer.js";
import { validate } from "../core/vrm-validator.js";
import { mapBones } from "../core/bone-mapping.js";
import { extname as pExtname } from "../core/path-utils.js";
import { Severity } from "../core/types.js";
import type { ConvertDeps } from "../core/types.js";

const textCodec = new NodeTextCodec();
const ZIP_OPTS = {
  decodeFileName: (bytes: Uint8Array | string[] | Buffer) => {
    if (bytes instanceof Uint8Array) return textCodec.decodeFileName(bytes);
    if (Array.isArray(bytes)) return bytes.join("");
    return textCodec.decodeFileName(new Uint8Array(bytes));
  },
};

function makeDeps(): ConvertDeps {
  return {
    image: new NodeImageEncoder(),
    text: textCodec,
  };
}

// ── Texture collector ──

/**
 * Collect sibling texture files from a directory into a Map.
 */
async function collectTexturesFromDir(pmxDir: string): Promise<Map<string, Uint8Array>> {
  const textures = new Map<string, Uint8Array>();
  const entries = await readdir(pmxDir, { withFileTypes: true, recursive: true });

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    const parentDir = (entry as any).parentPath ?? (entry as any).path ?? pmxDir;
    const fullPath = path.join(parentDir, entry.name);
    const relativePath = path.relative(pmxDir, fullPath);

    try {
      const data = await readFile(fullPath);
      textures.set(relativePath.replace(/\\/g, "/"), new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    } catch {
      // Skip unreadable files
    }
  }

  return textures;
}

// ── Scanning ──

interface ScanResult {
  name: string;
  zipEntry: string;
  humanoid: boolean;
  mappedBones: Set<string>;
  mappedCount: number;
}

interface FolderPmx {
  pmxPath: string;
  name: string;
  humanoid: boolean;
  mappedBones: Set<string>;
  mappedCount: number;
}

import { VRM_REQUIRED_BONES } from "../core/bone-mapping.js";

async function scanZip(zipPath: string): Promise<{ results: ScanResult[]; warnings: string[] }> {
  const data = await readFile(zipPath);
  const zip = await JSZip.loadAsync(data, ZIP_OPTS);
  const results: ScanResult[] = [];
  const warnings: string[] = [];

  for (const [entryName, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    const lower = entryName.toLowerCase();

    if (lower.endsWith(".pmx")) {
      const pmxBytes = await file.async("uint8array");
      const [humanoid, mapped] = isHumanoid(pmxBytes);
      results.push({
        name: entryName,
        zipEntry: entryName,
        humanoid,
        mappedBones: mapped,
        mappedCount: mapped.size,
      });
    } else if (lower.endsWith(".zip")) {
      warnings.push(entryName);
    }
  }

  return { results, warnings };
}

async function scanFolder(folderPath: string): Promise<FolderPmx[]> {
  const results: FolderPmx[] = [];
  const entries = await readdir(folderPath, { withFileTypes: true, recursive: true });

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (!entry.name.toLowerCase().endsWith(".pmx")) continue;

    const parentDir = (entry as any).parentPath ?? (entry as any).path ?? folderPath;
    const fullPath = path.join(parentDir, entry.name);
    const relativeName = path.relative(folderPath, fullPath);

    try {
      const pmxBytes = new Uint8Array(await readFile(fullPath));
      const [humanoid, mapped] = isHumanoid(pmxBytes);
      results.push({
        pmxPath: fullPath,
        name: relativeName,
        humanoid,
        mappedBones: mapped,
        mappedCount: mapped.size,
      });
    } catch {
      // Unreadable PMX, skip
    }
  }

  return results;
}

// ── Conversion ──

interface ConvertOpts {
  scale: number;
  noSpring: boolean;
  noRename: boolean;
  noValidate: boolean;
}

async function convertOne(
  pmxBytes: Uint8Array,
  textures: Map<string, Uint8Array>,
  pmxDisplayName: string,
  outDir: string,
  outputPaths: string[],
  opts: ConvertOpts,
  pmxBasename: string,
): Promise<string> {
  const deps = makeDeps();
  const decodedStem = path.parse(pmxBasename).name;
  let vrmPath = path.join(outDir, `${decodedStem}.vrm`);

  // Avoid overwriting
  let counter = 2;
  while (existsSync(vrmPath) || outputPaths.includes(vrmPath)) {
    vrmPath = path.join(outDir, `${decodedStem}_${counter}.vrm`);
    counter++;
  }

  console.log(`\nConverting: ${pmxDisplayName}`);
  const pmxData = await readPmx(pmxBytes, textures, deps, opts.scale);
  console.log(
    `  Vertices: ${pmxData.positions.length / 3}, ` +
    `Bones: ${pmxData.bones.length}, ` +
    `Materials: ${pmxData.materials.length}`,
  );

  let gltfData = buildGltf(pmxData);
  const humanoidBones = mapBones(pmxData.bones, pmxData.skinned_bone_indices);

  let secondary;
  if (opts.noSpring) {
    secondary = { boneGroups: [], colliderGroups: [] };
  } else {
    secondary = convertSpring(
      pmxData.rigid_bodies,
      pmxData.joints_phys,
      pmxData.bones,
    );
  }

  gltfData = buildVrm(gltfData, humanoidBones, secondary, pmxData.materials);
  const glbBytes = writeGlb(gltfData);
  await writeFile(vrmPath, glbBytes);

  // Rename step
  let finalPath = vrmPath;
  if (!opts.noRename) {
    const { buffer: renamedBuf, englishName } = renameVrm(glbBytes, pmxBasename);
    finalPath = path.join(outDir, englishName);

    if (finalPath !== vrmPath && (existsSync(finalPath) || outputPaths.includes(finalPath))) {
      const stem = path.parse(englishName).name;
      let rc = 2;
      while (existsSync(finalPath) || outputPaths.includes(finalPath)) {
        finalPath = path.join(outDir, `${stem}_${rc}.vrm`);
        rc++;
      }
    }

    await writeFile(finalPath, renamedBuf);
    if (finalPath !== vrmPath) {
      await unlink(vrmPath).catch(() => {});
    }
    console.log(`  Renamed: ${pmxBasename} -> ${path.basename(finalPath)}`);
  }

  // Validate step
  if (!opts.noValidate) {
    const vrmBuf = await readFile(finalPath);
    const result = validate(
      new Uint8Array(vrmBuf.buffer, vrmBuf.byteOffset, vrmBuf.byteLength),
    );
    const errors = result.issues.filter(i => i.severity === Severity.ERROR).length;
    const warnings = result.issues.filter(i => i.severity === Severity.WARNING).length;
    if (result.valid) {
      const parts = ["VALID"];
      if (warnings > 0) parts.push(`${warnings} warning${warnings !== 1 ? "s" : ""}`);
      console.log(`  Validate: ${parts.join(", ")}`);
    } else {
      console.log(`  Validate: INVALID (${errors} error${errors !== 1 ? "s" : ""}, ${warnings} warning${warnings !== 1 ? "s" : ""})`);
    }
  }

  console.log(`  -> ${finalPath}`);
  return finalPath;
}

// ── Public API ──

export interface ProcessOptions {
  outputDir?: string;
  scale?: number;
  noSpring?: boolean;
  noRename?: boolean;
  noValidate?: boolean;
}

export async function process_(
  inputPath: string,
  options: ProcessOptions = {},
): Promise<string[]> {
  const resolved = path.resolve(inputPath);
  if (!existsSync(resolved)) {
    throw new Error(`Input not found: ${resolved}`);
  }

  const isDir = statSync(resolved).isDirectory();
  const {
    scale = 0.08,
    noSpring = false,
    noRename = false,
    noValidate = false,
  } = options;
  const outDir = options.outputDir
    ? path.resolve(options.outputDir)
    : isDir ? resolved : path.dirname(resolved);
  await mkdir(outDir, { recursive: true });

  const convertOpts: ConvertOpts = { scale, noSpring, noRename, noValidate };

  if (isDir) {
    return processFolder(resolved, outDir, convertOpts);
  } else {
    return processZip(resolved, outDir, convertOpts);
  }
}

// ── Folder processing ──

async function processFolder(
  folderPath: string,
  outDir: string,
  opts: ConvertOpts,
): Promise<string[]> {
  console.log(`Scanning folder: ${folderPath}`);
  const results = await scanFolder(folderPath);

  if (results.length === 0) {
    throw new Error(`No .pmx files found in ${folderPath}`);
  }

  const humanoids = results.filter(r => r.humanoid);

  for (const r of results) {
    const tag = r.humanoid ? "humanoid" : "SKIP";
    console.log(`  ${r.name} — ${tag} (${r.mappedCount}/${VRM_REQUIRED_BONES.size} required bones)`);
  }

  if (humanoids.length === 0) {
    throw new Error(
      `No humanoid PMX found in ${folderPath}. Checked ${results.length} .pmx file(s).`,
    );
  }

  const outputPaths: string[] = [];
  for (const entry of humanoids) {
    const pmxBytes = new Uint8Array(await readFile(entry.pmxPath));
    const pmxDir = path.dirname(entry.pmxPath);
    const textures = await collectTexturesFromDir(pmxDir);

    const finalPath = await convertOne(
      pmxBytes, textures, entry.name, outDir, outputPaths, opts, path.basename(entry.pmxPath),
    );
    outputPaths.push(finalPath);
  }

  console.log(`\nDone. ${outputPaths.length} model(s) converted.`);
  return outputPaths;
}

// ── ZIP processing ──

async function processZip(
  zipPath: string,
  outDir: string,
  opts: ConvertOpts,
): Promise<string[]> {
  console.log(`Scanning: ${path.basename(zipPath)}`);
  const { results, warnings } = await scanZip(zipPath);

  for (const nested of warnings) {
    console.log(`  \u26A0 Nested ZIP detected: ${nested}. Extract it first, then convert the inner folder/zip.`);
  }

  if (results.length === 0) {
    throw new Error(`No .pmx files found in ${path.basename(zipPath)}`);
  }

  const humanoids = results.filter(r => r.humanoid);

  for (const r of results) {
    const tag = r.humanoid ? "humanoid" : "SKIP";
    console.log(`  ${r.name} — ${tag} (${r.mappedCount}/${VRM_REQUIRED_BONES.size} required bones)`);
  }

  if (humanoids.length === 0) {
    throw new Error(
      `No humanoid PMX found in ${path.basename(zipPath)}. Checked ${results.length} .pmx file(s).`,
    );
  }

  const outputPaths: string[] = [];

  // Load full zip once
  const zipData = await readFile(zipPath);
  const zip = await JSZip.loadAsync(zipData, ZIP_OPTS);

  for (const scanResult of humanoids) {
    // Extract PMX bytes
    const pmxFile = zip.file(scanResult.zipEntry);
    if (!pmxFile) throw new Error(`PMX entry not found: ${scanResult.zipEntry}`);
    const pmxBytes = await pmxFile.async("uint8array");

    // Collect textures from zip (same directory)
    const pmxDir = path.dirname(scanResult.zipEntry);
    const textures = new Map<string, Uint8Array>();
    for (const [entryName, file] of Object.entries(zip.files)) {
      if (file.dir) continue;
      if (entryName === scanResult.zipEntry) continue;

      const entryDir = path.dirname(entryName);
      if (!entryDir.startsWith(pmxDir)) continue;

      const relativePath = pmxDir && pmxDir !== "."
        ? entryName.slice(pmxDir.length + 1)
        : entryName;
      try {
        textures.set(relativePath.replace(/\\/g, "/"), await file.async("uint8array"));
      } catch {
        // Skip
      }
    }

    const pmxBasename = path.basename(scanResult.zipEntry);
    const finalPath = await convertOne(
      pmxBytes, textures, scanResult.name, outDir, outputPaths, opts, pmxBasename,
    );
    outputPaths.push(finalPath);
  }

  console.log(`\nDone. ${outputPaths.length} model(s) converted.`);
  return outputPaths;
}

// ── CLI ──

async function main(): Promise<void> {
  const { program } = await import("commander");

  program
    .name("intake")
    .description("PMX -> VRM conversion (folder or ZIP input)")
    .argument("<input>", "Input folder or zip file path")
    .option("-o, --output <dir>", "Output directory (default: same as input)")
    .option("--scale <number>", "Scale factor (default: 0.08)", parseFloat, 0.08)
    .option("--no-spring", "Skip spring bones")
    .option("--no-rename", "Skip ASCII rename step")
    .option("--no-validate", "Skip validation step")
    .action(async (input: string, opts: {
      output?: string;
      scale: number;
      spring: boolean;
      rename: boolean;
      validate: boolean;
    }) => {
      try {
        await process_(input, {
          outputDir: opts.output,
          scale: opts.scale,
          noSpring: !opts.spring,
          noRename: !opts.rename,
          noValidate: !opts.validate,
        });
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
