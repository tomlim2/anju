"""Build VRM 0.x extension JSON and inject into glTF.

IMPORTANT:
  - NEVER include "VRMC_vrm" — it triggers VRM 1.0 detection in VRM4U.
  - "stiffiness" (double-i) is the correct VRM 0.x spelling.
  - "violentUssageName" (double-s) is the correct VRM 0.x spelling.
"""


def build(gltf_data, humanoid_bones, secondary_animation, materials_info):
    """Build VRM 0.x extension and inject into glTF JSON.

    Args:
        gltf_data: dict from gltf_builder.build()
        humanoid_bones: list from bone_mapping.map_bones()
        secondary_animation: dict from spring_converter.convert()
        materials_info: list of PMX material dicts

    Returns:
        Modified gltf_data with VRM 0.x extension injected.
    """
    gltf_json = gltf_data["json"]

    # VRM 0.x meta (typos are intentional per VRM 0.x spec!)
    vrm_meta = {
        "title": "",
        "author": "",
        "version": "0.0",
        "contactInformation": "",
        "reference": "",
        "allowedUserName": "Everyone",
        "violentUssageName": "Disallow",    # Double-s: VRM 0.x spec typo!
        "sexualUssageName": "Disallow",     # Double-s: VRM 0.x spec typo!
        "commercialUssageName": "Disallow", # Double-s: VRM 0.x spec typo!
        "otherPermissionUrl": "",
        "licenseName": "Other",
        "otherLicenseUrl": "",
        "texture": -1,
    }

    # VRM humanoid
    vrm_humanoid = {
        "humanBones": humanoid_bones,
        "armStretch": 0.05,
        "legStretch": 0.05,
        "upperArmTwist": 0.5,
        "lowerArmTwist": 0.5,
        "upperLegTwist": 0.5,
        "lowerLegTwist": 0.5,
        "feetSpacing": 0,
        "hasTranslationDoF": False,
    }

    # VRM materialProperties
    vrm_mat_props = []
    for mat in materials_info:
        vrm_mat_props.append({
            "name": mat["name"],
            "shader": "VRM_USE_GLTFSHADER",
            "renderQueue": 2000,
            "floatProperties": {},
            "vectorProperties": {},
            "textureProperties": {},
            "keywordMap": {},
            "tagMap": {},
        })

    # VRM 0.x extension (NEVER include VRMC_vrm!)
    vrm_ext = {
        "exporterVersion": "truepmx2vrm-0.1.0",
        "specVersion": "0.0",
        "meta": vrm_meta,
        "humanoid": vrm_humanoid,
        "firstPerson": {
            "firstPersonBone": -1,
            "firstPersonBoneOffset": {"x": 0, "y": 0, "z": 0},
            "meshAnnotations": [],
            "lookAtTypeName": "Bone",
            "lookAtHorizontalInner": {
                "curve": [0, 0, 0, 1, 1, 1, 1, 0],
                "xRange": 90,
                "yRange": 10,
            },
            "lookAtHorizontalOuter": {
                "curve": [0, 0, 0, 1, 1, 1, 1, 0],
                "xRange": 90,
                "yRange": 10,
            },
            "lookAtVerticalDown": {
                "curve": [0, 0, 0, 1, 1, 1, 1, 0],
                "xRange": 90,
                "yRange": 10,
            },
            "lookAtVerticalUp": {
                "curve": [0, 0, 0, 1, 1, 1, 1, 0],
                "xRange": 90,
                "yRange": 10,
            },
        },
        "blendShapeMaster": {"blendShapeGroups": []},
        "secondaryAnimation": secondary_animation,
        "materialProperties": vrm_mat_props,
    }

    gltf_json["extensions"] = {"VRM": vrm_ext}
    gltf_json["extensionsUsed"] = ["VRM"]

    return gltf_data
