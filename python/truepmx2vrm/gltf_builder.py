"""Build glTF 2.0 skeleton, mesh, skin, materials, and textures from PMX data.

Produces a dict {"json": <gltf_json>, "bin": <bytes>} ready for GLB packing.
"""

import numpy as np

# glTF constants
FLOAT = 5126
UNSIGNED_SHORT = 5123
UNSIGNED_INT = 5125
ARRAY_BUFFER = 34962
ELEMENT_ARRAY_BUFFER = 34963


def _pad4(buf, pad_byte=b"\x00"):
    """Pad bytearray to 4-byte alignment in-place."""
    remainder = len(buf) % 4
    if remainder:
        buf.extend(pad_byte * (4 - remainder))


def build(pmx_data):
    """Build glTF 2.0 structure from normalized PMX data.

    Returns:
        dict: {"json": gltf_json_dict, "bin": binary_blob_bytes}
    """
    bones = pmx_data["bones"]
    positions = pmx_data["positions"]
    normals_arr = pmx_data["normals"]
    uvs = pmx_data["uvs"]
    joint_indices = pmx_data["joints"]
    skin_weights = pmx_data["weights"]
    all_indices = pmx_data["indices"]
    materials = pmx_data["materials"]
    textures = pmx_data["textures"]
    texture_mimes = pmx_data["texture_mimes"]

    num_bones = len(bones)
    num_verts = len(positions)

    # ---- Skeleton node tree ----
    nodes = []
    root_bones = []
    children_map = {i: [] for i in range(num_bones)}

    for i, bone in enumerate(bones):
        parent = bone["parent_index"]
        if parent < 0 or parent >= num_bones:
            root_bones.append(i)
        else:
            children_map[parent].append(i)

    for i, bone in enumerate(bones):
        parent = bone["parent_index"]
        if parent < 0 or parent >= num_bones:
            local_pos = bone["position"].tolist()
        else:
            local_pos = (bone["position"] - bones[parent]["position"]).tolist()

        node = {"name": bone["name"], "translation": local_pos}
        if children_map[i]:
            node["children"] = children_map[i]
        nodes.append(node)

    # Mesh node
    mesh_node_idx = num_bones
    nodes.append({"name": "mesh", "mesh": 0, "skin": 0})

    # Scene root node
    scene_root_idx = num_bones + 1
    nodes.append({
        "name": "root",
        "children": root_bones + [mesh_node_idx],
    })

    # ---- Inverse Bind Matrices ----
    ibms = np.tile(np.eye(4, dtype=np.float32), (num_bones, 1, 1))
    for i in range(num_bones):
        ibms[i, 0, 3] = -bones[i]["position"][0]
        ibms[i, 1, 3] = -bones[i]["position"][1]
        ibms[i, 2, 3] = -bones[i]["position"][2]

    # ---- Binary buffer ----
    buf = bytearray()
    buffer_views = []
    accessors = []

    def add_bv(data_bytes, target=None):
        offset = len(buf)
        buf.extend(data_bytes)
        _pad4(buf)
        bv = {"buffer": 0, "byteOffset": offset, "byteLength": len(data_bytes)}
        if target is not None:
            bv["target"] = target
        idx = len(buffer_views)
        buffer_views.append(bv)
        return idx

    def add_acc(bv_idx, comp_type, count, acc_type, min_v=None, max_v=None):
        acc = {
            "bufferView": bv_idx,
            "componentType": comp_type,
            "count": count,
            "type": acc_type,
        }
        if min_v is not None:
            acc["min"] = min_v
        if max_v is not None:
            acc["max"] = max_v
        idx = len(accessors)
        accessors.append(acc)
        return idx

    # Vertex attributes (shared across all primitives)
    pos_bv = add_bv(positions.tobytes(), ARRAY_BUFFER)
    pos_min = positions.min(axis=0).tolist()
    pos_max = positions.max(axis=0).tolist()
    pos_acc = add_acc(pos_bv, FLOAT, num_verts, "VEC3", pos_min, pos_max)

    norm_bv = add_bv(normals_arr.tobytes(), ARRAY_BUFFER)
    norm_acc = add_acc(norm_bv, FLOAT, num_verts, "VEC3")

    uv_bv = add_bv(uvs.tobytes(), ARRAY_BUFFER)
    uv_acc = add_acc(uv_bv, FLOAT, num_verts, "VEC2")

    joint_bv = add_bv(joint_indices.tobytes(), ARRAY_BUFFER)
    joint_acc = add_acc(joint_bv, UNSIGNED_SHORT, num_verts, "VEC4")

    weight_bv = add_bv(skin_weights.tobytes(), ARRAY_BUFFER)
    weight_acc = add_acc(weight_bv, FLOAT, num_verts, "VEC4")

    # Images & textures
    gltf_samplers = []
    gltf_images = []
    gltf_textures = []

    if textures:
        gltf_samplers.append({
            "magFilter": 9729,   # LINEAR
            "minFilter": 9987,   # LINEAR_MIPMAP_LINEAR
            "wrapS": 10497,      # REPEAT
            "wrapT": 10497,
        })

    for tex_data, mime in zip(textures, texture_mimes):
        img_bv = add_bv(tex_data)
        gltf_images.append({"bufferView": img_bv, "mimeType": mime})
        gltf_textures.append({"sampler": 0, "source": len(gltf_images) - 1})

    # Per-material primitives & materials
    idx_offset = 0
    primitives = []
    gltf_materials = []

    for mat in materials:
        count = mat["vertex_count"]
        mat_indices = all_indices[idx_offset:idx_offset + count]
        idx_offset += count

        idx_bv = add_bv(mat_indices.astype(np.uint32).tobytes(), ELEMENT_ARRAY_BUFFER)
        idx_acc = add_acc(idx_bv, UNSIGNED_INT, len(mat_indices), "SCALAR")

        primitives.append({
            "attributes": {
                "POSITION": pos_acc,
                "NORMAL": norm_acc,
                "TEXCOORD_0": uv_acc,
                "JOINTS_0": joint_acc,
                "WEIGHTS_0": weight_acc,
            },
            "indices": idx_acc,
            "material": len(gltf_materials),
            "mode": 4,
        })

        diffuse = mat["diffuse"]
        gltf_mat = {
            "name": mat["name"],
            "pbrMetallicRoughness": {
                "baseColorFactor": [
                    diffuse[0], diffuse[1], diffuse[2],
                    diffuse[3] if len(diffuse) > 3 else 1.0,
                ],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.9,
            },
            "doubleSided": True,
        }

        tex_idx = mat["texture_index"]
        if 0 <= tex_idx < len(gltf_textures):
            gltf_mat["pbrMetallicRoughness"]["baseColorTexture"] = {
                "index": tex_idx,
            }

        if len(diffuse) > 3 and diffuse[3] < 1.0:
            gltf_mat["alphaMode"] = "BLEND"

        gltf_materials.append(gltf_mat)

    # Inverse Bind Matrices
    # glTF stores mat4 in column-major order -> transpose before serializing
    ibm_bytes = np.ascontiguousarray(ibms.transpose(0, 2, 1)).tobytes()
    ibm_bv = add_bv(ibm_bytes)
    ibm_acc = add_acc(ibm_bv, FLOAT, num_bones, "MAT4")

    # Skin
    skin = {
        "inverseBindMatrices": ibm_acc,
        "joints": list(range(num_bones)),
        "skeleton": root_bones[0] if root_bones else 0,
    }

    # Buffer
    buffer_obj = {"byteLength": len(buf)}

    # Assemble glTF JSON
    gltf_json = {
        "asset": {"version": "2.0", "generator": "truepmx2vrm"},
        "scene": 0,
        "scenes": [{"nodes": [scene_root_idx]}],
        "nodes": nodes,
        "meshes": [{"name": "mesh", "primitives": primitives}],
        "skins": [skin],
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [buffer_obj],
        "materials": gltf_materials,
    }

    if gltf_textures:
        gltf_json["textures"] = gltf_textures
    if gltf_images:
        gltf_json["images"] = gltf_images
    if gltf_samplers:
        gltf_json["samplers"] = gltf_samplers

    return {"json": gltf_json, "bin": bytes(buf)}
