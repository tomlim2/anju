"""PMX Japanese bone name to VRM humanoid bone mapping.

Reference: VRM4U/Source/VRM4U/Private/VrmUtil.cpp
  - table_ue4_pmx  (UE4 bone → PMX Japanese bone name)
  - table_ue4_vrm  (UE4 bone → VRM humanoid bone name)
  Combined these two tables gives the PMX → VRM mapping used here.

Spine chain: hips -> spine -> chest -> upperChest -> neck
  センター  -> hips
  上半身   -> spine
  上半身2  -> chest
  上半身3  -> upperChest  (rare, most models stop at 上半身2)

Note: VRM4U maps 上半身 to both spine and chest by creating two UE bones
from one PMX bone. We can't do that in direct PMX->VRM, so each PMX bone
maps to exactly one VRM humanoid bone.
"""

PMX_TO_VRM_HUMANOID = {
    # Torso
    "センター": ["hips"],
    "上半身":   ["spine"],
    "上半身2":  ["chest"],
    "上半身3":  ["upperChest"],
    "首": ["neck"],
    "頭": ["head"],
    # Left arm
    "左肩": ["leftShoulder"],
    "左腕": ["leftUpperArm"],
    "左ひじ": ["leftLowerArm"],
    "左手首": ["leftHand"],
    # Right arm
    "右肩": ["rightShoulder"],
    "右腕": ["rightUpperArm"],
    "右ひじ": ["rightLowerArm"],
    "右手首": ["rightHand"],
    # Left leg
    "左足": ["leftUpperLeg"],
    "左ひざ": ["leftLowerLeg"],
    "左足首": ["leftFoot"],
    "左つま先": ["leftToes"],
    # Right leg
    "右足": ["rightUpperLeg"],
    "右ひざ": ["rightLowerLeg"],
    "右足首": ["rightFoot"],
    "右つま先": ["rightToes"],
    # Eyes
    "左目": ["leftEye"],
    "右目": ["rightEye"],
    # Left hand fingers
    "左親指０": ["leftThumbProximal"],
    "左親指１": ["leftThumbIntermediate"],
    "左親指２": ["leftThumbDistal"],
    "左人指１": ["leftIndexProximal"],
    "左人指２": ["leftIndexIntermediate"],
    "左人指３": ["leftIndexDistal"],
    "左中指１": ["leftMiddleProximal"],
    "左中指２": ["leftMiddleIntermediate"],
    "左中指３": ["leftMiddleDistal"],
    "左薬指１": ["leftRingProximal"],
    "左薬指２": ["leftRingIntermediate"],
    "左薬指３": ["leftRingDistal"],
    "左小指１": ["leftLittleProximal"],
    "左小指２": ["leftLittleIntermediate"],
    "左小指３": ["leftLittleDistal"],
    # Right hand fingers
    "右親指０": ["rightThumbProximal"],
    "右親指１": ["rightThumbIntermediate"],
    "右親指２": ["rightThumbDistal"],
    "右人指１": ["rightIndexProximal"],
    "右人指２": ["rightIndexIntermediate"],
    "右人指３": ["rightIndexDistal"],
    "右中指１": ["rightMiddleProximal"],
    "右中指２": ["rightMiddleIntermediate"],
    "右中指３": ["rightMiddleDistal"],
    "右薬指１": ["rightRingProximal"],
    "右薬指２": ["rightRingIntermediate"],
    "右薬指３": ["rightRingDistal"],
    "右小指１": ["rightLittleProximal"],
    "右小指２": ["rightLittleIntermediate"],
    "右小指３": ["rightLittleDistal"],
}

# Alternative PMX bone names (D-bones, groove, waist)
# Reference: VRM4U/Source/VRM4U/Private/VrmUtil.cpp GetReplacedPMXBone()
# VRM4U checks both the standard name AND its D-bone variant;
# we instead normalise D-bone names to their standard equivalents upfront.
# グルーブ→センター is an extension not present in VRM4U (safe to keep).
PMX_BONE_REPLACEMENTS = {
    "左足D": "左足",
    "左ひざD": "左ひざ",
    "左足首D": "左足首",
    "左足先EX": "左つま先",
    "右足D": "右足",
    "右ひざD": "右ひざ",
    "右足首D": "右足首",
    "右足先EX": "右つま先",
    "腰": "センター",
    "グルーブ": "センター",
}

# VRM humanoid bone list in canonical order
# Reference: VRM4U/Source/VRM4U/Private/VrmUtil.cpp lines 218-274
VRM_HUMANOID_BONE_LIST = [
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
]

# Required humanoid bones for valid VRM
VRM_REQUIRED_BONES = {
    "hips", "spine", "neck", "head",
    "leftUpperArm", "leftLowerArm", "leftHand",
    "rightUpperArm", "rightLowerArm", "rightHand",
    "leftUpperLeg", "leftLowerLeg", "leftFoot",
    "rightUpperLeg", "rightLowerLeg", "rightFoot",
}


def map_bones(bones, skinned_bone_indices=None):
    """Map PMX bones to VRM humanoid bones.

    Args:
        bones: List of bone dicts with 'name' field (PMX Japanese names).
        skinned_bone_indices: Optional set of bone indices that actually
            drive vertices (weight > 0).  When provided, the bone with real
            skinning data is preferred over a name-only match when multiple
            PMX bones compete for the same VRM slot (e.g. 左足 vs 左足D).

    Returns:
        List of dicts: [{"bone": "hips", "node": 0, "useDefaultValues": True}, ...]

    Selection priority per VRM slot (highest first):
        1. Bone with skinning data  (node_index in skinned_bone_indices)
        2. First name match in bone list order (fallback)
    """
    from collections import defaultdict

    # Dynamic spine chain: adjust mapping based on how many spine bones exist
    effective_names = {PMX_BONE_REPLACEMENTS.get(b["name"], b["name"]) for b in bones}
    has_upper_body_3 = "上半身3" in effective_names

    mapping = dict(PMX_TO_VRM_HUMANOID)
    if not has_upper_body_3:
        # 2-bone spine: 上半身→spine, 上半身2→upperChest (skip chest)
        mapping["上半身2"] = ["upperChest"]

    # Pass 1: collect all candidates per VRM slot
    # candidates[vrm_name] = list of (node_index, has_skin)
    candidates = defaultdict(list)

    for node_index, bone in enumerate(bones):
        name = bone["name"]
        lookup_name = PMX_BONE_REPLACEMENTS.get(name, name)
        vrm_names = mapping.get(lookup_name, [])
        has_skin = (skinned_bone_indices is None) or (node_index in skinned_bone_indices)
        for vrm_name in vrm_names:
            candidates[vrm_name].append((node_index, has_skin))

    # Pass 2: for each VRM slot, pick the best candidate and emit one entry.
    # Iterate in canonical VRM order so the output list is stable.
    humanoid_bones = []
    mapped = set()

    for vrm_name in VRM_HUMANOID_BONE_LIST:
        if vrm_name not in candidates or vrm_name in mapped:
            continue
        cands = candidates[vrm_name]
        # Prefer skinned bone; among ties, first occurrence (lowest node index)
        skinned = [c for c in cands if c[1]]
        node_index, _ = skinned[0] if skinned else cands[0]
        if skinned_bone_indices is not None and not skinned:
            print(f"  Note: '{vrm_name}' mapped to node {node_index} (no skinning data found)")
        humanoid_bones.append({
            "bone": vrm_name,
            "node": node_index,
            "useDefaultValues": True,
        })
        mapped.add(vrm_name)

    missing = VRM_REQUIRED_BONES - mapped
    if missing:
        print(f"Warning: Missing required humanoid bones: {missing}")

    return humanoid_bones
