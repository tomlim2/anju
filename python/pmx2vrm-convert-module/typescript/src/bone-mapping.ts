/**
 * PMX Japanese bone name to VRM humanoid bone mapping.
 *
 * Reference: VRM4U/Source/VRM4U/Private/VrmUtil.cpp
 *   - table_ue4_pmx  (UE4 bone -> PMX Japanese bone name)
 *   - table_ue4_vrm  (UE4 bone -> VRM humanoid bone name)
 *   Combined these two tables gives the PMX -> VRM mapping used here.
 *
 * Spine chain: hips -> spine -> chest -> upperChest -> neck
 *   センター  -> hips
 *   上半身   -> spine
 *   上半身2  -> chest
 *   上半身3  -> upperChest  (rare, most models stop at 上半身2)
 *
 * Note: VRM4U maps 上半身 to both spine and chest by creating two UE bones
 * from one PMX bone. We can't do that in direct PMX->VRM, so each PMX bone
 * maps to exactly one VRM humanoid bone.
 */

import type { PmxBone, HumanoidBoneEntry } from "./types.js";

/** PMX bone names (Japanese) -> list of VRM humanoid bone names. */
export const PMX_TO_VRM_HUMANOID = new Map<string, string[]>([
  // Torso
  ["センター", ["hips"]],
  ["上半身", ["spine"]],
  ["上半身2", ["chest"]],
  ["上半身3", ["upperChest"]],
  ["首", ["neck"]],
  ["頭", ["head"]],
  // Left arm
  ["左肩", ["leftShoulder"]],
  ["左腕", ["leftUpperArm"]],
  ["左ひじ", ["leftLowerArm"]],
  ["左手首", ["leftHand"]],
  // Right arm
  ["右肩", ["rightShoulder"]],
  ["右腕", ["rightUpperArm"]],
  ["右ひじ", ["rightLowerArm"]],
  ["右手首", ["rightHand"]],
  // Left leg
  ["左足", ["leftUpperLeg"]],
  ["左ひざ", ["leftLowerLeg"]],
  ["左足首", ["leftFoot"]],
  ["左つま先", ["leftToes"]],
  // Right leg
  ["右足", ["rightUpperLeg"]],
  ["右ひざ", ["rightLowerLeg"]],
  ["右足首", ["rightFoot"]],
  ["右つま先", ["rightToes"]],
  // Eyes
  ["左目", ["leftEye"]],
  ["右目", ["rightEye"]],
  // Left hand fingers
  ["左親指０", ["leftThumbProximal"]],
  ["左親指１", ["leftThumbIntermediate"]],
  ["左親指２", ["leftThumbDistal"]],
  ["左人指１", ["leftIndexProximal"]],
  ["左人指２", ["leftIndexIntermediate"]],
  ["左人指３", ["leftIndexDistal"]],
  ["左中指１", ["leftMiddleProximal"]],
  ["左中指２", ["leftMiddleIntermediate"]],
  ["左中指３", ["leftMiddleDistal"]],
  ["左薬指１", ["leftRingProximal"]],
  ["左薬指２", ["leftRingIntermediate"]],
  ["左薬指３", ["leftRingDistal"]],
  ["左小指１", ["leftLittleProximal"]],
  ["左小指２", ["leftLittleIntermediate"]],
  ["左小指３", ["leftLittleDistal"]],
  // Right hand fingers
  ["右親指０", ["rightThumbProximal"]],
  ["右親指１", ["rightThumbIntermediate"]],
  ["右親指２", ["rightThumbDistal"]],
  ["右人指１", ["rightIndexProximal"]],
  ["右人指２", ["rightIndexIntermediate"]],
  ["右人指３", ["rightIndexDistal"]],
  ["右中指１", ["rightMiddleProximal"]],
  ["右中指２", ["rightMiddleIntermediate"]],
  ["右中指３", ["rightMiddleDistal"]],
  ["右薬指１", ["rightRingProximal"]],
  ["右薬指２", ["rightRingIntermediate"]],
  ["右薬指３", ["rightRingDistal"]],
  ["右小指１", ["rightLittleProximal"]],
  ["右小指２", ["rightLittleIntermediate"]],
  ["右小指３", ["rightLittleDistal"]],
]);

/** Alternative PMX bone names (D-bones, groove, waist). */
export const PMX_BONE_REPLACEMENTS = new Map<string, string>([
  ["左足D", "左足"],
  ["左ひざD", "左ひざ"],
  ["左足首D", "左足首"],
  ["左足先EX", "左つま先"],
  ["右足D", "右足"],
  ["右ひざD", "右ひざ"],
  ["右足首D", "右足首"],
  ["右足先EX", "右つま先"],
  ["腰", "センター"],
  ["グルーブ", "センター"],
]);

/** VRM humanoid bone list in canonical order. */
export const VRM_HUMANOID_BONE_LIST: string[] = [
  "hips",
  "leftUpperLeg", "rightUpperLeg",
  "leftLowerLeg", "rightLowerLeg",
  "leftFoot", "rightFoot",
  "spine", "chest",
  "neck", "head",
  "leftShoulder", "rightShoulder",
  "leftUpperArm", "rightUpperArm",
  "leftLowerArm", "rightLowerArm",
  "leftHand", "rightHand",
  "leftToes", "rightToes",
  "leftEye", "rightEye", "jaw",
  "leftThumbProximal", "leftThumbIntermediate", "leftThumbDistal",
  "leftIndexProximal", "leftIndexIntermediate", "leftIndexDistal",
  "leftMiddleProximal", "leftMiddleIntermediate", "leftMiddleDistal",
  "leftRingProximal", "leftRingIntermediate", "leftRingDistal",
  "leftLittleProximal", "leftLittleIntermediate", "leftLittleDistal",
  "rightThumbProximal", "rightThumbIntermediate", "rightThumbDistal",
  "rightIndexProximal", "rightIndexIntermediate", "rightIndexDistal",
  "rightMiddleProximal", "rightMiddleIntermediate", "rightMiddleDistal",
  "rightRingProximal", "rightRingIntermediate", "rightRingDistal",
  "rightLittleProximal", "rightLittleIntermediate", "rightLittleDistal",
  "upperChest",
];

/** Required humanoid bones for valid VRM (17 bones). */
export const VRM_REQUIRED_BONES = new Set<string>([
  "hips", "spine", "neck", "head",
  "leftUpperArm", "leftLowerArm", "leftHand",
  "rightUpperArm", "rightLowerArm", "rightHand",
  "leftUpperLeg", "leftLowerLeg", "leftFoot",
  "rightUpperLeg", "rightLowerLeg", "rightFoot",
]);

/**
 * Map PMX bones to VRM humanoid bones.
 *
 * Selection priority per VRM slot (highest first):
 *   1. Bone with skinning data (node_index in skinned_bone_indices)
 *   2. First name match in bone list order (fallback)
 */
export function mapBones(
  bones: PmxBone[],
  skinnedBoneIndices?: Set<number>,
): HumanoidBoneEntry[] {
  // Dynamic spine chain: adjust mapping based on how many spine bones exist
  const effectiveNames = new Set(
    bones.map(b => PMX_BONE_REPLACEMENTS.get(b.name) ?? b.name),
  );
  const hasUpperBody3 = effectiveNames.has("上半身3");

  const mapping = new Map(PMX_TO_VRM_HUMANOID);
  if (!hasUpperBody3) {
    // 2-bone spine: 上半身→spine, 上半身2→upperChest (skip chest)
    mapping.set("上半身2", ["upperChest"]);
  }

  // Pass 1: collect all candidates per VRM slot
  const candidates = new Map<string, { nodeIndex: number; hasSkin: boolean }[]>();

  for (let nodeIndex = 0; nodeIndex < bones.length; nodeIndex++) {
    const name = bones[nodeIndex].name;
    const lookupName = PMX_BONE_REPLACEMENTS.get(name) ?? name;
    const vrmNames = mapping.get(lookupName) ?? [];
    const hasSkin = skinnedBoneIndices == null || skinnedBoneIndices.has(nodeIndex);

    for (const vrmName of vrmNames) {
      let list = candidates.get(vrmName);
      if (!list) {
        list = [];
        candidates.set(vrmName, list);
      }
      list.push({ nodeIndex, hasSkin });
    }
  }

  // Pass 2: pick the best candidate per VRM slot in canonical order
  const humanoidBones: HumanoidBoneEntry[] = [];
  const mapped = new Set<string>();

  for (const vrmName of VRM_HUMANOID_BONE_LIST) {
    if (!candidates.has(vrmName) || mapped.has(vrmName)) continue;

    const cands = candidates.get(vrmName)!;
    const skinned = cands.filter(c => c.hasSkin);
    const best = skinned.length > 0 ? skinned[0] : cands[0];

    if (skinnedBoneIndices != null && skinned.length === 0) {
      console.log(`  Note: '${vrmName}' mapped to node ${best.nodeIndex} (no skinning data found)`);
    }

    humanoidBones.push({
      bone: vrmName,
      node: best.nodeIndex,
      useDefaultValues: true,
    });
    mapped.add(vrmName);
  }

  const missing = new Set([...VRM_REQUIRED_BONES].filter(b => !mapped.has(b)));
  if (missing.size > 0) {
    console.log(`Warning: Missing required humanoid bones: ${[...missing].join(", ")}`);
  }

  return humanoidBones;
}
