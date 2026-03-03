/**
 * Humanoid check — extracted from intake.ts.
 *
 * Scans PMX bone names to determine if a model is humanoid (VRM-compatible).
 */

import { PmxReader } from "./pmx-reader.js";
import {
  PMX_BONE_REPLACEMENTS,
  PMX_TO_VRM_HUMANOID,
  VRM_REQUIRED_BONES,
} from "./bone-mapping.js";

function scanBones(pmxBytes: Uint8Array): string[] {
  try {
    const reader = new PmxReader(pmxBytes);
    const raw = reader.read();
    return raw.bones.map((b: any) => b.name);
  } catch {
    return [];
  }
}

export function isHumanoid(pmxBytes: Uint8Array): [boolean, Set<string>] {
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
