/**
 * Build VRM 0.x extension JSON and inject into glTF.
 *
 * IMPORTANT:
 *   - NEVER include "VRMC_vrm" — it triggers VRM 1.0 detection in VRM4U.
 *   - "stiffiness" (double-i) is the correct VRM 0.x spelling.
 *   - "violentUssageName" (double-s) is the correct VRM 0.x spelling.
 */

import type { GltfData, HumanoidBoneEntry, SecondaryAnimation, PmxMaterial } from "./types.js";

/** PMX morph name (Japanese/English) -> VRM 0.x preset name. */
const PMX_VRM_PRESET = new Map<string, string>([
  // Mouth / lip-sync
  ["あ", "a"], ["ああ", "a"], ["a", "a"],
  ["い", "i"], ["いい", "i"], ["i", "i"],
  ["う", "u"], ["うう", "u"], ["u", "u"],
  ["え", "e"], ["ええ", "e"], ["e", "e"],
  ["お", "o"], ["おお", "o"], ["o", "o"],
  // Blink
  ["まばたき", "blink"], ["瞬き", "blink"], ["blink", "blink"],
  ["左ウィンク", "blink_l"], ["ウィンク左", "blink_l"], ["wink_left", "blink_l"],
  ["右ウィンク", "blink_r"], ["ウィンク右", "blink_r"], ["wink_right", "blink_r"],
  // Expressions
  ["笑い", "joy"], ["にこ", "joy"], ["joy", "joy"],
  ["怒り", "angry"], ["angry", "angry"],
  ["悲しい", "sorrow"], ["悲し", "sorrow"], ["sorrow", "sorrow"],
  ["楽しい", "fun"], ["喜び", "fun"], ["fun", "fun"],
  // Neutral
  ["通常", "neutral"], ["neutral", "neutral"],
]);

export function build(
  gltfData: GltfData,
  humanoidBones: HumanoidBoneEntry[],
  secondaryAnimation: SecondaryAnimation,
  materialsInfo: PmxMaterial[],
): GltfData {
  const gltfJson = gltfData.json;

  // VRM 0.x meta (typos are intentional per VRM 0.x spec!)
  const vrmMeta = {
    title: "",
    author: "",
    version: "0.0",
    contactInformation: "",
    reference: "",
    allowedUserName: "Everyone",
    violentUssageName: "Disallow",    // Double-s: VRM 0.x spec typo!
    sexualUssageName: "Disallow",     // Double-s: VRM 0.x spec typo!
    commercialUssageName: "Disallow", // Double-s: VRM 0.x spec typo!
    otherPermissionUrl: "",
    licenseName: "Other",
    otherLicenseUrl: "",
    texture: -1,
  };

  // VRM humanoid
  const vrmHumanoid = {
    humanBones: humanoidBones,
    armStretch: 0.05,
    legStretch: 0.05,
    upperArmTwist: 0.5,
    lowerArmTwist: 0.5,
    upperLegTwist: 0.5,
    lowerLegTwist: 0.5,
    feetSpacing: 0,
    hasTranslationDoF: false,
  };

  // VRM materialProperties
  const vrmMatProps = materialsInfo.map(mat => ({
    name: mat.name,
    shader: "VRM_USE_GLTFSHADER",
    renderQueue: 2000,
    floatProperties: {},
    vectorProperties: {},
    textureProperties: {},
    keywordMap: {},
    tagMap: {},
  }));

  // VRM 0.x extension (NEVER include VRMC_vrm!)
  const vrmExt = {
    exporterVersion: "truepmx2vrm-0.1.0",
    specVersion: "0.0",
    meta: vrmMeta,
    humanoid: vrmHumanoid,
    firstPerson: {
      firstPersonBone: -1,
      firstPersonBoneOffset: { x: 0, y: 0, z: 0 },
      meshAnnotations: [] as any[],
      lookAtTypeName: "Bone",
      lookAtHorizontalInner: {
        curve: [0, 0, 0, 1, 1, 1, 1, 0],
        xRange: 90,
        yRange: 10,
      },
      lookAtHorizontalOuter: {
        curve: [0, 0, 0, 1, 1, 1, 1, 0],
        xRange: 90,
        yRange: 10,
      },
      lookAtVerticalDown: {
        curve: [0, 0, 0, 1, 1, 1, 1, 0],
        xRange: 90,
        yRange: 10,
      },
      lookAtVerticalUp: {
        curve: [0, 0, 0, 1, 1, 1, 1, 0],
        xRange: 90,
        yRange: 10,
      },
    },
    blendShapeMaster: buildBlendShapeMaster(gltfJson),
    secondaryAnimation,
    materialProperties: vrmMatProps,
  };

  gltfJson.extensions = { VRM: vrmExt };
  gltfJson.extensionsUsed = ["VRM"];

  return gltfData;
}

function buildBlendShapeMaster(gltfJson: Record<string, any>): Record<string, any> {
  let targetNames: string[] = [];
  const meshes = gltfJson.meshes ?? [];
  if (meshes.length > 0 && meshes[0].extras) {
    targetNames = meshes[0].extras.targetNames ?? [];
  }

  const usedPresets = new Set<string>();
  const groups: Record<string, any>[] = [];

  for (let morphIdx = 0; morphIdx < targetNames.length; morphIdx++) {
    const name = targetNames[morphIdx];
    let preset = PMX_VRM_PRESET.get(name) ?? "unknown";

    if (preset !== "unknown") {
      if (usedPresets.has(preset)) {
        preset = "unknown";
      } else {
        usedPresets.add(preset);
      }
    }

    groups.push({
      name,
      presetName: preset,
      binds: [{ mesh: 0, index: morphIdx, weight: 100 }],
      materialValues: [],
      isBinary: false,
    });
  }

  return { blendShapeGroups: groups };
}
