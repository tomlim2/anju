"""PMX Japanese bone name to VRM humanoid bone mapping.

Reference: VRM4U/Source/VRM4U/Private/VrmUtil.cpp lines 110-274
"""

# PMX bone names (Japanese) → VRM humanoid bone names
PMX_TO_VRM_HUMANOID = {
    # Torso
    "センター": "hips",
    "上半身": "spine",
    "上半身2": "chest",
    "上半身3": "upperChest",
    "首": "neck",
    "頭": "head",
    # Left arm
    "左肩": "leftShoulder",
    "左腕": "leftUpperArm",
    "左ひじ": "leftLowerArm",
    "左手首": "leftHand",
    # Right arm
    "右肩": "rightShoulder",
    "右腕": "rightUpperArm",
    "右ひじ": "rightLowerArm",
    "右手首": "rightHand",
    # Left leg
    "左足": "leftUpperLeg",
    "左ひざ": "leftLowerLeg",
    "左足首": "leftFoot",
    "左つま先": "leftToes",
    # Right leg
    "右足": "rightUpperLeg",
    "右ひざ": "rightLowerLeg",
    "右足首": "rightFoot",
    "右つま先": "rightToes",
    # Eyes
    "左目": "leftEye",
    "右目": "rightEye",
    # Left hand fingers
    "左親指０": "leftThumbProximal",
    "左親指１": "leftThumbIntermediate",
    "左親指２": "leftThumbDistal",
    "左人指１": "leftIndexProximal",
    "左人指２": "leftIndexIntermediate",
    "左人指３": "leftIndexDistal",
    "左中指１": "leftMiddleProximal",
    "左中指２": "leftMiddleIntermediate",
    "左中指３": "leftMiddleDistal",
    "左薬指１": "leftRingProximal",
    "左薬指２": "leftRingIntermediate",
    "左薬指３": "leftRingDistal",
    "左小指１": "leftLittleProximal",
    "左小指２": "leftLittleIntermediate",
    "左小指３": "leftLittleDistal",
    # Right hand fingers
    "右親指０": "rightThumbProximal",
    "右親指１": "rightThumbIntermediate",
    "右親指２": "rightThumbDistal",
    "右人指１": "rightIndexProximal",
    "右人指２": "rightIndexIntermediate",
    "右人指３": "rightIndexDistal",
    "右中指１": "rightMiddleProximal",
    "右中指２": "rightMiddleIntermediate",
    "右中指３": "rightMiddleDistal",
    "右薬指１": "rightRingProximal",
    "右薬指２": "rightRingIntermediate",
    "右薬指３": "rightRingDistal",
    "右小指１": "rightLittleProximal",
    "右小指２": "rightLittleIntermediate",
    "右小指３": "rightLittleDistal",
}

# Alternative PMX bone names (D-bones, groove, waist)
# Reference: VRM4U/Source/VRM4U/Private/VrmUtil.cpp lines 186-215
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
    "hips", "spine", "chest", "neck", "head",
    "leftUpperArm", "leftLowerArm", "leftHand",
    "rightUpperArm", "rightLowerArm", "rightHand",
    "leftUpperLeg", "leftLowerLeg", "leftFoot",
    "rightUpperLeg", "rightLowerLeg", "rightFoot",
}


def map_bones(bones):
    """Map PMX bones to VRM humanoid bones.

    Args:
        bones: List of bone dicts with 'name' field (PMX Japanese names).

    Returns:
        List of dicts: [{"bone": "hips", "node": 0, "useDefaultValues": True}, ...]
    """
    humanoid_bones = []
    mapped = set()

    for node_index, bone in enumerate(bones):
        name = bone["name"]

        # Try replacement names first (D-bones -> standard names)
        lookup_name = PMX_BONE_REPLACEMENTS.get(name, name)

        vrm_name = PMX_TO_VRM_HUMANOID.get(lookup_name)
        if vrm_name is not None and vrm_name not in mapped:
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
