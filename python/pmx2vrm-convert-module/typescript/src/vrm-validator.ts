/**
 * VRM 0.x file validator — 6-layer structural validation.
 *
 * Validates GLB structure, glTF conformance, VRM extension presence,
 * humanoid bone completeness, spring animation integrity, and material consistency.
 */

import { readFile } from "node:fs/promises";
import { Severity } from "./types.js";
import type { ValidationIssue, ValidationResult } from "./types.js";

// VRM 0.x required humanoid bones (chest/upperChest optional — most PMX models
// have only 2-bone spine where 上半身2→upperChest, leaving chest unmapped)
const REQUIRED_BONES = new Set([
  "hips", "spine", "neck", "head",
  "leftUpperArm", "leftLowerArm", "leftHand",
  "rightUpperArm", "rightLowerArm", "rightHand",
  "leftUpperLeg", "leftLowerLeg", "leftFoot",
  "rightUpperLeg", "rightLowerLeg", "rightFoot",
]);

// GLB chunk type constants
const CHUNK_JSON = 0x4E4F534A;
const CHUNK_BIN = 0x004E4942;

// ── Issue helper ──

function issue(severity: Severity, layer: number, message: string, path = ""): ValidationIssue {
  return { severity, layer, message, path };
}

// ── Public API ──

export async function validate(
  source: string | Uint8Array,
  strict = false,
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    issues: [],
    vrm_version: null,
    exporter: null,
    bone_count: 0,
    node_count: 0,
    material_count: 0,
  };

  // Read source
  let data: Uint8Array;
  if (typeof source === "string") {
    try {
      const buf = await readFile(source);
      data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } catch {
      result.valid = false;
      result.issues.push(issue(Severity.ERROR, 0, `File not found: ${source}`));
      return result;
    }
  } else {
    data = source;
  }

  // Layer 1: GLB structure
  const [gltfJson, ok1] = layer1Glb(data, result);
  if (!ok1) return finalize(result, strict);

  // Layer 2: glTF validity
  const ok2 = layer2Gltf(gltfJson!, result);
  if (!ok2) return finalize(result, strict);

  // Layer 3: VRM extension
  const [vrmExt, ok3] = layer3VrmExtension(gltfJson!, result);
  if (!ok3) return finalize(result, strict);

  // Populate metadata
  result.vrm_version = vrmExt!.specVersion ?? null;
  result.exporter = vrmExt!.exporterVersion ?? null;
  result.node_count = (gltfJson!.nodes ?? []).length;
  result.material_count = (gltfJson!.materials ?? []).length;

  // Layer 4: Humanoid bones
  layer4Humanoid(vrmExt!, result);

  // Layer 5: Spring animation
  layer5Spring(vrmExt!, result);

  // Layer 6: Materials
  layer6Materials(gltfJson!, vrmExt!, result);

  return finalize(result, strict);
}

function finalize(result: ValidationResult, strict: boolean): ValidationResult {
  const hasError = result.issues.some(i => i.severity === Severity.ERROR);
  const hasWarning = result.issues.some(i => i.severity === Severity.WARNING);
  result.valid = !hasError && (!strict || !hasWarning);
  return result;
}

// ── Layer 1: GLB structure ──

function layer1Glb(
  data: Uint8Array,
  result: ValidationResult,
): [Record<string, any> | null, boolean] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  if (data.byteLength < 12) {
    result.issues.push(issue(Severity.ERROR, 1, "File too small for GLB header (< 12 bytes)"));
    return [null, false];
  }

  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  const totalLength = view.getUint32(8, true);

  if (magic !== 0x46546C67) {
    result.issues.push(issue(Severity.ERROR, 1,
      `Invalid GLB magic: 0x${magic.toString(16).padStart(8, "0")} (expected 0x46546C67 'glTF')`));
    return [null, false];
  }

  if (version !== 2) {
    result.issues.push(issue(Severity.ERROR, 1, `Unsupported GLB version: ${version} (expected 2)`));
    return [null, false];
  }

  if (totalLength > data.byteLength) {
    result.issues.push(issue(Severity.WARNING, 1,
      `GLB header declares ${totalLength} bytes but file is ${data.byteLength} bytes`));
  }

  if (data.byteLength < 20) {
    result.issues.push(issue(Severity.ERROR, 1, "File too small for JSON chunk header"));
    return [null, false];
  }

  const jsonLen = view.getUint32(12, true);
  const jsonType = view.getUint32(16, true);

  if (jsonType !== CHUNK_JSON) {
    result.issues.push(issue(Severity.ERROR, 1,
      `First chunk is not JSON: 0x${jsonType.toString(16).padStart(8, "0")} (expected 0x${CHUNK_JSON.toString(16).padStart(8, "0")})`));
    return [null, false];
  }

  const jsonEnd = 20 + jsonLen;
  if (jsonEnd > data.byteLength) {
    result.issues.push(issue(Severity.ERROR, 1, "JSON chunk extends beyond file"));
    return [null, false];
  }

  let gltfJson: Record<string, any>;
  try {
    const decoder = new TextDecoder("utf-8");
    const jsonStr = decoder.decode(data.slice(20, jsonEnd));
    gltfJson = JSON.parse(jsonStr);
  } catch (e: any) {
    result.issues.push(issue(Severity.ERROR, 1, `Malformed JSON chunk: ${e.message}`));
    return [null, false];
  }

  // Check BIN chunk presence
  if (jsonEnd < data.byteLength) {
    if (jsonEnd + 8 <= data.byteLength) {
      const binType = view.getUint32(jsonEnd + 4, true);
      if (binType !== CHUNK_BIN) {
        result.issues.push(issue(Severity.WARNING, 1,
          `Second chunk is not BIN: 0x${binType.toString(16).padStart(8, "0")}`));
      }
    } else {
      result.issues.push(issue(Severity.WARNING, 1,
        "Trailing bytes after JSON chunk but too small for BIN chunk header"));
    }
  }

  result.issues.push(issue(Severity.INFO, 1, "GLB structure valid"));
  return [gltfJson, true];
}

// ── Layer 2: glTF validity ──

function layer2Gltf(gltfJson: Record<string, any>, result: ValidationResult): boolean {
  let fatal = false;

  const asset = gltfJson.asset;
  if (!asset || typeof asset !== "object") {
    result.issues.push(issue(Severity.ERROR, 2, "Missing 'asset' object"));
    return false;
  }

  const assetVersion = asset.version;
  if (assetVersion == null) {
    result.issues.push(issue(Severity.ERROR, 2, "Missing asset.version"));
    fatal = true;
  } else if (!String(assetVersion).startsWith("2")) {
    result.issues.push(issue(Severity.ERROR, 2,
      `Unexpected asset.version: '${assetVersion}' (expected 2.x)`));
    fatal = true;
  }

  const nodes = gltfJson.nodes ?? [];
  const numNodes = nodes.length;

  // bufferView bounds
  const bufferViews = gltfJson.bufferViews ?? [];
  const buffers = gltfJson.buffers ?? [];
  for (let i = 0; i < bufferViews.length; i++) {
    const bufIdx = bufferViews[i].buffer ?? 0;
    if (bufIdx >= buffers.length) {
      result.issues.push(issue(Severity.ERROR, 2,
        `buffer index ${bufIdx} out of range (${buffers.length} buffers)`,
        `bufferViews[${i}]`));
      fatal = true;
    }
  }

  // Node children range check
  for (let i = 0; i < numNodes; i++) {
    const children = nodes[i].children ?? [];
    for (let ci = 0; ci < children.length; ci++) {
      const child = children[ci];
      if (typeof child !== "number" || child < 0 || child >= numNodes) {
        result.issues.push(issue(Severity.ERROR, 2,
          `index ${child} out of range (${numNodes} nodes)`,
          `nodes[${i}].children[${ci}]`));
        fatal = true;
      }
    }
  }

  // Cycle detection via DFS
  if (!fatal && numNodes > 0) {
    const visited = new Uint8Array(numNodes); // 0=unvisited, 1=in_stack, 2=done
    let hasCycle = false;

    function dfs(n: number): void {
      if (hasCycle) return;
      visited[n] = 1;
      for (const child of (nodes[n].children ?? [])) {
        if (typeof child !== "number" || child < 0 || child >= numNodes) continue;
        if (visited[child] === 1) { hasCycle = true; return; }
        if (visited[child] === 0) dfs(child);
      }
      visited[n] = 2;
    }

    for (let n = 0; n < numNodes; n++) {
      if (visited[n] === 0) dfs(n);
      if (hasCycle) break;
    }

    if (hasCycle) {
      result.issues.push(issue(Severity.ERROR, 2, "Cycle detected in node hierarchy"));
      fatal = true;
    }
  }

  if (fatal) return false;

  result.issues.push(issue(Severity.INFO, 2, "glTF structure valid"));
  return true;
}

// ── Layer 3: VRM extension ──

function layer3VrmExtension(
  gltfJson: Record<string, any>,
  result: ValidationResult,
): [Record<string, any> | null, boolean] {
  const extensions = gltfJson.extensions;
  if (!extensions || typeof extensions !== "object") {
    result.issues.push(issue(Severity.ERROR, 3, "No 'extensions' object in glTF"));
    return [null, false];
  }

  const vrmExt = extensions.VRM;
  if (vrmExt == null) {
    if ("VRMC_vrm" in extensions) {
      result.issues.push(issue(Severity.ERROR, 3,
        "Found VRMC_vrm (VRM 1.0) — this validator supports VRM 0.x only"));
    } else {
      result.issues.push(issue(Severity.ERROR, 3, "Missing extensions.VRM"));
    }
    return [null, false];
  }

  if (typeof vrmExt !== "object") {
    result.issues.push(issue(Severity.ERROR, 3, "extensions.VRM is not an object"));
    return [null, false];
  }

  const required = ["meta", "humanoid", "materialProperties"];
  const missing = required.filter(k => !(k in vrmExt));
  if (missing.length > 0) {
    result.issues.push(issue(Severity.ERROR, 3, `Missing required VRM keys: ${missing.join(", ")}`));
    return [null, false];
  }

  result.issues.push(issue(Severity.INFO, 3, "VRM extension present"));
  return [vrmExt, true];
}

// ── Layer 4: Humanoid bones ──

function layer4Humanoid(vrmExt: Record<string, any>, result: ValidationResult): void {
  const humanoid = vrmExt.humanoid ?? {};
  const humanBones = humanoid.humanBones ?? [];

  if (!Array.isArray(humanBones)) {
    result.issues.push(issue(Severity.ERROR, 4,
      "humanoid.humanBones is not an array", "humanoid.humanBones"));
    return;
  }

  const nodeCount = result.node_count;
  const seenBones = new Set<string>();
  const seenNodes = new Set<number>();

  for (let i = 0; i < humanBones.length; i++) {
    const entry = humanBones[i];
    const boneName = entry.bone ?? "";
    const nodeIdx = entry.node;

    if (seenBones.has(boneName)) {
      result.issues.push(issue(Severity.WARNING, 4,
        `Duplicate humanoid bone: '${boneName}'`, `humanoid.humanBones[${i}]`));
    }
    seenBones.add(boneName);

    if (nodeIdx != null && seenNodes.has(nodeIdx)) {
      result.issues.push(issue(Severity.WARNING, 4,
        `Duplicate node index ${nodeIdx} (bone: '${boneName}')`, `humanoid.humanBones[${i}]`));
    }
    if (nodeIdx != null) seenNodes.add(nodeIdx);

    if (typeof nodeIdx === "number" && nodeCount > 0 && (nodeIdx < 0 || nodeIdx >= nodeCount)) {
      result.issues.push(issue(Severity.ERROR, 4,
        `bone '${boneName}': node index ${nodeIdx} out of range (${nodeCount} nodes)`,
        `humanoid.humanBones[${i}]`));
    }
  }

  result.bone_count = humanBones.length;

  const missing = [...REQUIRED_BONES].filter(b => !seenBones.has(b));
  if (missing.length > 0) {
    result.issues.push(issue(Severity.ERROR, 4,
      `Missing required bones (${missing.length}): ${missing.sort().join(", ")}`,
      "humanoid.humanBones"));
  } else {
    const found = [...REQUIRED_BONES].filter(b => seenBones.has(b)).length;
    result.issues.push(issue(Severity.INFO, 4,
      `Humanoid bones complete (${found}/${REQUIRED_BONES.size} required)`));
  }
}

// ── Layer 5: Spring animation ──

function layer5Spring(vrmExt: Record<string, any>, result: ValidationResult): void {
  const secAnim = vrmExt.secondaryAnimation;
  if (secAnim == null) {
    result.issues.push(issue(Severity.INFO, 5, "No secondaryAnimation present"));
    return;
  }

  if (typeof secAnim !== "object") {
    result.issues.push(issue(Severity.WARNING, 5,
      "secondaryAnimation is not an object", "secondaryAnimation"));
    return;
  }

  const nodeCount = result.node_count;
  const boneGroups = secAnim.boneGroups ?? [];
  const colliderGroups = secAnim.colliderGroups ?? [];
  const numColliderGroups = Array.isArray(colliderGroups) ? colliderGroups.length : 0;

  if (Array.isArray(boneGroups)) {
    for (let gi = 0; gi < boneGroups.length; gi++) {
      const group = boneGroups[gi];
      if (!group || typeof group !== "object") continue;

      if ("stiffness" in group && !("stiffiness" in group)) {
        result.issues.push(issue(Severity.WARNING, 5,
          "uses 'stiffness' instead of VRM 0.x 'stiffiness'",
          `secondaryAnimation.boneGroups[${gi}]`));
      }

      const bones = group.bones ?? [];
      if (Array.isArray(bones)) {
        for (let bi = 0; bi < bones.length; bi++) {
          const boneIdx = bones[bi];
          if (typeof boneIdx === "number" && nodeCount > 0 && (boneIdx < 0 || boneIdx >= nodeCount)) {
            result.issues.push(issue(Severity.WARNING, 5,
              `index ${boneIdx} out of range (${nodeCount} nodes)`,
              `secondaryAnimation.boneGroups[${gi}].bones[${bi}]`));
          }
        }
      }

      const center = group.center;
      if (typeof center === "number" && center >= 0 && nodeCount > 0 && center >= nodeCount) {
        result.issues.push(issue(Severity.WARNING, 5,
          `index ${center} out of range (${nodeCount} nodes)`,
          `secondaryAnimation.boneGroups[${gi}].center`));
      }

      const cgRefs = group.colliderGroups ?? [];
      if (Array.isArray(cgRefs)) {
        for (let ci = 0; ci < cgRefs.length; ci++) {
          const cgIdx = cgRefs[ci];
          if (typeof cgIdx === "number" && (cgIdx < 0 || cgIdx >= numColliderGroups)) {
            result.issues.push(issue(Severity.WARNING, 5,
              `index ${cgIdx} out of range (${numColliderGroups} collider groups)`,
              `secondaryAnimation.boneGroups[${gi}].colliderGroups[${ci}]`));
          }
        }
      }
    }
  }

  if (Array.isArray(colliderGroups)) {
    for (let gi = 0; gi < colliderGroups.length; gi++) {
      const cg = colliderGroups[gi];
      if (!cg || typeof cg !== "object") continue;
      const cgNode = cg.node;
      if (typeof cgNode === "number" && nodeCount > 0 && (cgNode < 0 || cgNode >= nodeCount)) {
        result.issues.push(issue(Severity.WARNING, 5,
          `index ${cgNode} out of range (${nodeCount} nodes)`,
          `secondaryAnimation.colliderGroups[${gi}].node`));
      }
    }
  }

  const infoParts: string[] = [];
  if (Array.isArray(boneGroups)) infoParts.push(`${boneGroups.length} bone groups`);
  if (Array.isArray(colliderGroups)) infoParts.push(`${numColliderGroups} collider groups`);
  if (infoParts.length > 0) {
    result.issues.push(issue(Severity.INFO, 5, `Secondary animation: ${infoParts.join(", ")}`));
  }
}

// ── Layer 6: Materials ──

function layer6Materials(
  gltfJson: Record<string, any>,
  vrmExt: Record<string, any>,
  result: ValidationResult,
): void {
  const gltfMats = gltfJson.materials ?? [];
  const vrmMatProps = vrmExt.materialProperties ?? [];

  const numGltf = gltfMats.length;
  const numVrm = vrmMatProps.length;

  if (numVrm !== numGltf) {
    result.issues.push(issue(Severity.WARNING, 6,
      `materialProperties count (${numVrm}) != glTF materials count (${numGltf})`,
      "materialProperties"));
  }

  for (let i = 0; i < numVrm; i++) {
    const mp = vrmMatProps[i];
    if (!mp || typeof mp !== "object") {
      result.issues.push(issue(Severity.WARNING, 6, "not an object", `materialProperties[${i}]`));
      continue;
    }
    if (!("name" in mp)) {
      result.issues.push(issue(Severity.WARNING, 6, "missing 'name'", `materialProperties[${i}]`));
    }
    if (!("shader" in mp)) {
      result.issues.push(issue(Severity.WARNING, 6, "missing 'shader'", `materialProperties[${i}]`));
    }
  }

  result.issues.push(issue(Severity.INFO, 6,
    `Materials: ${numGltf} glTF, ${numVrm} VRM properties`));
}

// ── Human-readable formatter ──

export function formatHuman(result: ValidationResult, sourceName: string): string {
  const lines: string[] = [`Validating: ${sourceName}`];

  const parts: string[] = [];
  if (result.vrm_version != null) parts.push(`VRM 0.x | specVersion: ${result.vrm_version}`);
  if (result.exporter) parts.push(`exporter: ${result.exporter}`);
  if (parts.length > 0) lines.push(parts.join(" | "));

  const stats: string[] = [];
  if (result.node_count) stats.push(`Nodes: ${result.node_count}`);
  if (result.material_count) stats.push(`Materials: ${result.material_count}`);
  if (result.bone_count) stats.push(`Humanoid bones: ${result.bone_count}/${REQUIRED_BONES.size} required`);
  if (stats.length > 0) lines.push(stats.join(" | "));

  lines.push("");

  const layerNames: Record<number, string> = {
    1: "GLB structure",
    2: "glTF validity",
    3: "VRM extension",
    4: "Humanoid bones",
    5: "Secondary animation",
    6: "Materials",
  };

  for (let layerNum = 1; layerNum <= 6; layerNum++) {
    const layerIssues = result.issues.filter(i => i.layer === layerNum);
    if (layerIssues.length === 0) continue;

    const errors = layerIssues.filter(i => i.severity === Severity.ERROR);
    const warnings = layerIssues.filter(i => i.severity === Severity.WARNING);
    const name = layerNames[layerNum] ?? `Layer ${layerNum}`;

    if (errors.length > 0) {
      lines.push(`[FAIL] ${name}`);
      for (const i of errors) {
        lines.push(i.path ? `  - ${i.path}: ${i.message}` : `  - ${i.message}`);
      }
    } else if (warnings.length > 0) {
      lines.push(`[WARN] ${name}`);
      for (const i of warnings) {
        lines.push(i.path ? `  - ${i.path}: ${i.message}` : `  - ${i.message}`);
      }
    } else {
      lines.push(`[PASS] ${name}`);
    }
  }

  // Summary
  const errors = result.issues.filter(i => i.severity === Severity.ERROR);
  const warnings = result.issues.filter(i => i.severity === Severity.WARNING);

  lines.push("");
  if (errors.length > 0) {
    const ep: string[] = [`${errors.length} error${errors.length !== 1 ? "s" : ""}`];
    if (warnings.length > 0) ep.push(`${warnings.length} warning${warnings.length !== 1 ? "s" : ""}`);
    lines.push(`Result: INVALID (${ep.join(", ")})`);
  } else if (warnings.length > 0) {
    lines.push(`Result: VALID (${warnings.length} warning${warnings.length !== 1 ? "s" : ""})`);
  } else {
    lines.push("Result: VALID");
  }

  return lines.join("\n");
}

// ── CLI ──

async function main(): Promise<void> {
  const { program } = await import("commander");

  program
    .name("vrm-validator")
    .description("Validate VRM 0.x files")
    .argument("<file>", "Path to .vrm file")
    .option("--strict", "Treat warnings as errors")
    .option("--json", "Output as JSON")
    .action(async (file: string, opts: { strict?: boolean; json?: boolean }) => {
      const result = await validate(file, opts.strict ?? false);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatHuman(result, file));
      }

      process.exit(result.valid ? 0 : 1);
    });

  await program.parseAsync();
}

// Run CLI if executed directly
const isMain = process.argv[1] &&
  (process.argv[1].endsWith("vrm-validator.ts") || process.argv[1].endsWith("vrm-validator.js"));
if (isMain) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
