/**
 * Unified PMX → VRM CLI — folder or ZIP input → convert → rename → validate.
 *
 * Accepts a flat ZIP containing .pmx files or a folder.
 * Nested ZIPs (zip-in-zip) are NOT supported — extract them first.
 *
 * Usage:
 *   npx tsx src/intake.ts <input>              # folder or ZIP auto-detect
 *   npx tsx src/intake.ts <input> -o ./out
 *   npx tsx src/intake.ts <input> --no-spring
 *   npx tsx src/intake.ts <input> --no-rename
 *   npx tsx src/intake.ts <input> --no-validate
 */

import { readFile, writeFile, mkdir, readdir, stat, rm, unlink } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
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
import { renameVrm } from "./vrm-renamer.js";
import { validate } from "./vrm-validator.js";
import { Severity } from "./types.js";

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
  humanoid: boolean;
  mappedBones: Set<string>;
  mappedCount: number;
}

interface ScanOutput {
  results: ScanResult[];
  warnings: string[];
}

/** Folder scan result — PMX file on disk (no zip extraction needed). */
interface FolderPmx {
  /** Absolute path to the .pmx file */
  pmxPath: string;
  /** Display name (relative to input folder) */
  name: string;
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

// ── ZIP scanning ──

async function scanZipFile(zip: JSZip): Promise<ScanOutput> {
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

export async function scanZip(zipPath: string): Promise<ScanOutput> {
  const data = await readFile(zipPath);
  const zip = await JSZip.loadAsync(data, ZIP_OPTS);
  return scanZipFile(zip);
}

// ── Folder scanning ──

async function scanFolder(folderPath: string): Promise<FolderPmx[]> {
  const results: FolderPmx[] = [];
  const entries = await readdir(folderPath, { withFileTypes: true, recursive: true });

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (!entry.name.toLowerCase().endsWith(".pmx")) continue;

    // entry.parentPath is the directory containing this entry (Node 20+)
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

// ── ZIP extraction ──

async function extractPmxToTmp(
  zipPath: string,
  scanResult: ScanResult,
  tmpDir: string,
): Promise<string> {
  const data = await readFile(zipPath);
  const zip = await JSZip.loadAsync(data, ZIP_OPTS);

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

// ── Core conversion for a single PMX ──

interface ConvertOpts {
  scale: number;
  noSpring: boolean;
  noRename: boolean;
  noValidate: boolean;
}

async function convertOne(
  pmxPath: string,
  pmxDisplayName: string,
  outDir: string,
  outputPaths: string[],
  opts: ConvertOpts,
): Promise<string> {
  const decodedStem = path.parse(pmxPath).name;
  let vrmPath = path.join(outDir, `${decodedStem}.vrm`);

  // Avoid overwriting
  let counter = 2;
  while (existsSync(vrmPath) || outputPaths.includes(vrmPath)) {
    vrmPath = path.join(outDir, `${decodedStem}_${counter}.vrm`);
    counter++;
  }

  console.log(`\nConverting: ${pmxDisplayName}`);
  const pmxData = await readPmx(pmxPath, opts.scale);
  console.log(
    `  Vertices: ${pmxData.positions.length / 3}, ` +
    `Bones: ${pmxData.bones.length}, ` +
    `Materials: ${pmxData.materials.length}`,
  );

  let gltfData = buildGltf(pmxData);
  const humanoidBones = mapBones(pmxData.bones);

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
  await writeGlb(gltfData, vrmPath);

  // Rename step
  let finalPath = vrmPath;
  if (!opts.noRename) {
    const written = await readFile(vrmPath);
    const pmxBasename = path.basename(pmxPath);
    const { buffer: renamedBuf, englishName } = renameVrm(
      new Uint8Array(written.buffer, written.byteOffset, written.byteLength),
      pmxBasename,
    );
    finalPath = path.join(outDir, englishName);

    // Avoid overwriting the renamed file too
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
    const result = await validate(
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
    const finalPath = await convertOne(
      entry.pmxPath, entry.name, outDir, outputPaths, opts,
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
  const tmpBase = path.join(tmpdir(), `truepmx2vrm-${Date.now()}`);
  await mkdir(tmpBase, { recursive: true });

  try {
    for (const scanResult of humanoids) {
      const tmpDir = path.join(tmpBase, `pmx-${outputPaths.length}`);
      await mkdir(tmpDir, { recursive: true });

      const pmxPath = await extractPmxToTmp(zipPath, scanResult, tmpDir);
      const finalPath = await convertOne(
        pmxPath, scanResult.name, outDir, outputPaths, opts,
      );
      outputPaths.push(finalPath);
    }
  } finally {
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
