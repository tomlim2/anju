"""Custom PMX 2.0 binary reader with coordinate transformation.

Handles extended UV (unlike pymeshio) and normalizes data for glTF/VRM.
Coordinate transform: PMX left-hand (X right, Y up, Z front)
    -> glTF right-hand (X right, Y up, Z back): Z-flip + winding reversal.
"""

import os
import struct
from io import BytesIO

import numpy as np
from PIL import Image


class _BinaryReader:
    """Low-level binary reader for PMX format."""

    def __init__(self, data: bytes):
        self._io = BytesIO(data)

    def read_bytes(self, n):
        return self._io.read(n)

    def read_int8(self):
        return struct.unpack("<b", self._io.read(1))[0]

    def read_uint8(self):
        return struct.unpack("<B", self._io.read(1))[0]

    def read_int16(self):
        return struct.unpack("<h", self._io.read(2))[0]

    def read_uint16(self):
        return struct.unpack("<H", self._io.read(2))[0]

    def read_int32(self):
        return struct.unpack("<i", self._io.read(4))[0]

    def read_uint32(self):
        return struct.unpack("<I", self._io.read(4))[0]

    def read_float(self):
        return struct.unpack("<f", self._io.read(4))[0]

    def read_vec2(self):
        return struct.unpack("<2f", self._io.read(8))

    def read_vec3(self):
        return struct.unpack("<3f", self._io.read(12))

    def read_vec4(self):
        return struct.unpack("<4f", self._io.read(16))


class PmxReader:
    """PMX 2.0 format reader."""

    def __init__(self, data: bytes):
        self._r = _BinaryReader(data)
        self._text_encoding = 0
        self._extended_uv = 0
        self._vertex_index_size = 0
        self._texture_index_size = 0
        self._material_index_size = 0
        self._bone_index_size = 0
        self._morph_index_size = 0
        self._rigidbody_index_size = 0

    def _read_text(self):
        length = self._r.read_int32()
        if length <= 0:
            return ""
        data = self._r.read_bytes(length)
        if self._text_encoding == 0:
            return data.decode("utf-16-le")
        else:
            return data.decode("utf-8")

    def _read_index(self, size):
        """Read a signed index of given byte size."""
        if size == 1:
            return self._r.read_int8()
        elif size == 2:
            return self._r.read_int16()
        elif size == 4:
            return self._r.read_int32()
        raise ValueError(f"Invalid index size: {size}")

    def _read_unsigned_index(self, size):
        """Read an unsigned index of given byte size."""
        if size == 1:
            return self._r.read_uint8()
        elif size == 2:
            return self._r.read_uint16()
        elif size == 4:
            return self._r.read_uint32()
        raise ValueError(f"Invalid index size: {size}")

    def _read_vertex_index(self):
        if self._vertex_index_size <= 2:
            return self._read_unsigned_index(self._vertex_index_size)
        return self._read_index(self._vertex_index_size)

    def _read_bone_index(self):
        return self._read_index(self._bone_index_size)

    def _read_texture_index(self):
        return self._read_index(self._texture_index_size)

    def _read_material_index(self):
        return self._read_index(self._material_index_size)

    def _read_morph_index(self):
        return self._read_index(self._morph_index_size)

    def _read_rigidbody_index(self):
        return self._read_index(self._rigidbody_index_size)

    def read(self):
        """Parse complete PMX file. Returns dict with all model data."""
        r = self._r

        # --- Header ---
        magic = r.read_bytes(4)
        assert magic == b"PMX ", f"Invalid PMX magic: {magic}"
        version = r.read_float()
        globals_count = r.read_uint8()
        globals_data = r.read_bytes(globals_count)

        self._text_encoding = globals_data[0]
        self._extended_uv = globals_data[1]
        self._vertex_index_size = globals_data[2]
        self._texture_index_size = globals_data[3]
        self._material_index_size = globals_data[4]
        self._bone_index_size = globals_data[5]
        self._morph_index_size = globals_data[6]
        self._rigidbody_index_size = globals_data[7]

        # --- Model info ---
        model_name = self._read_text()
        model_english_name = self._read_text()
        model_comment = self._read_text()
        model_english_comment = self._read_text()

        # --- Vertices ---
        num_vertices = r.read_int32()
        positions = np.zeros((num_vertices, 3), dtype=np.float32)
        normals = np.zeros((num_vertices, 3), dtype=np.float32)
        uvs = np.zeros((num_vertices, 2), dtype=np.float32)
        joint_indices = np.zeros((num_vertices, 4), dtype=np.uint16)
        skin_weights = np.zeros((num_vertices, 4), dtype=np.float32)

        for i in range(num_vertices):
            positions[i] = r.read_vec3()
            normals[i] = r.read_vec3()
            uvs[i] = r.read_vec2()

            # Skip extended UV (Vec4 each)
            for _ in range(self._extended_uv):
                r.read_vec4()

            # Deform type
            deform_type = r.read_uint8()
            if deform_type == 0:  # Bdef1
                b0 = max(0, self._read_bone_index())
                joint_indices[i] = [b0, 0, 0, 0]
                skin_weights[i] = [1.0, 0.0, 0.0, 0.0]
            elif deform_type == 1:  # Bdef2
                b0 = max(0, self._read_bone_index())
                b1 = max(0, self._read_bone_index())
                w0 = r.read_float()
                joint_indices[i] = [b0, b1, 0, 0]
                skin_weights[i] = [w0, 1.0 - w0, 0.0, 0.0]
            elif deform_type == 2:  # Bdef4
                b0 = max(0, self._read_bone_index())
                b1 = max(0, self._read_bone_index())
                b2 = max(0, self._read_bone_index())
                b3 = max(0, self._read_bone_index())
                w0 = r.read_float()
                w1 = r.read_float()
                w2 = r.read_float()
                w3 = r.read_float()
                joint_indices[i] = [b0, b1, b2, b3]
                skin_weights[i] = [w0, w1, w2, w3]
            elif deform_type == 3:  # Sdef
                b0 = max(0, self._read_bone_index())
                b1 = max(0, self._read_bone_index())
                w0 = r.read_float()
                r.read_vec3()  # C
                r.read_vec3()  # R0
                r.read_vec3()  # R1
                joint_indices[i] = [b0, b1, 0, 0]
                skin_weights[i] = [w0, 1.0 - w0, 0.0, 0.0]
            elif deform_type == 4:  # Qdef
                b0 = max(0, self._read_bone_index())
                b1 = max(0, self._read_bone_index())
                b2 = max(0, self._read_bone_index())
                b3 = max(0, self._read_bone_index())
                w0 = r.read_float()
                w1 = r.read_float()
                w2 = r.read_float()
                w3 = r.read_float()
                joint_indices[i] = [b0, b1, b2, b3]
                skin_weights[i] = [w0, w1, w2, w3]
            else:
                joint_indices[i] = [0, 0, 0, 0]
                skin_weights[i] = [1.0, 0.0, 0.0, 0.0]

            # Edge factor
            r.read_float()

        # --- Indices ---
        num_indices = r.read_int32()
        indices_raw = np.zeros(num_indices, dtype=np.uint32)
        for i in range(num_indices):
            indices_raw[i] = self._read_vertex_index()

        # --- Textures ---
        num_textures = r.read_int32()
        texture_paths = []
        for _ in range(num_textures):
            texture_paths.append(self._read_text())

        # --- Materials ---
        num_materials = r.read_int32()
        materials = []
        for _ in range(num_materials):
            mat_name = self._read_text()
            mat_english_name = self._read_text()
            diffuse_r, diffuse_g, diffuse_b, diffuse_a = r.read_vec4()
            spec_r, spec_g, spec_b = r.read_vec3()
            spec_factor = r.read_float()
            amb_r, amb_g, amb_b = r.read_vec3()
            flag = r.read_uint8()
            edge_r, edge_g, edge_b, edge_a = r.read_vec4()
            edge_size = r.read_float()
            texture_index = self._read_texture_index()
            sphere_texture_index = self._read_texture_index()
            sphere_mode = r.read_uint8()
            toon_sharing_flag = r.read_uint8()
            if toon_sharing_flag == 0:
                toon_texture_index = self._read_texture_index()
            else:
                toon_texture_index = r.read_uint8()
            comment = self._read_text()
            vertex_count = r.read_int32()

            materials.append({
                "name": mat_name,
                "diffuse": [diffuse_r, diffuse_g, diffuse_b, diffuse_a],
                "texture_index": texture_index,
                "vertex_count": vertex_count,
            })

        # --- Bones ---
        num_bones = r.read_int32()
        bones = []
        for _ in range(num_bones):
            bone_name = self._read_text()
            bone_english_name = self._read_text()
            bx, by, bz = r.read_vec3()
            parent_index = self._read_bone_index()
            layer = r.read_int32()
            flag = r.read_uint16()

            # Tail position
            if flag & 0x0001:  # TAILPOS_IS_BONE
                self._read_bone_index()
            else:
                r.read_vec3()

            # External parent
            if flag & (0x0100 | 0x0200):  # EXTERNAL_ROTATION | EXTERNAL_TRANSLATION
                self._read_bone_index()
                r.read_float()

            # Fixed axis
            if flag & 0x0400:
                r.read_vec3()

            # Local coordinate
            if flag & 0x0800:
                r.read_vec3()  # local X
                r.read_vec3()  # local Z

            # External parent deform
            if flag & 0x2000:
                r.read_int32()

            # IK
            if flag & 0x0020:
                self._read_bone_index()  # target
                r.read_int32()  # loop
                r.read_float()  # limit_radian
                ik_link_count = r.read_int32()
                for _ in range(ik_link_count):
                    self._read_bone_index()  # bone
                    has_limit = r.read_uint8()
                    if has_limit:
                        r.read_vec3()  # min
                        r.read_vec3()  # max

            bones.append({
                "name": bone_name,
                "english_name": bone_english_name,
                "position": np.array([bx, by, bz], dtype=np.float32),
                "parent_index": parent_index,
            })

        # --- Morphs (skip) ---
        num_morphs = r.read_int32()
        for _ in range(num_morphs):
            self._read_text()  # name
            self._read_text()  # english name
            r.read_uint8()  # panel
            morph_type = r.read_uint8()
            offset_count = r.read_int32()
            for _ in range(offset_count):
                if morph_type == 0:  # group
                    self._read_morph_index()
                    r.read_float()
                elif morph_type == 1:  # vertex
                    self._read_unsigned_index(self._vertex_index_size)
                    r.read_vec3()
                elif morph_type == 2:  # bone
                    self._read_bone_index()
                    r.read_vec3()
                    r.read_vec4()
                elif 3 <= morph_type <= 7:  # UV / extended UV
                    self._read_unsigned_index(self._vertex_index_size)
                    r.read_vec4()
                elif morph_type == 8:  # material
                    self._read_material_index()
                    r.read_uint8()
                    r.read_vec4()  # diffuse
                    r.read_vec3()  # specular
                    r.read_float()  # specular factor
                    r.read_vec3()  # ambient
                    r.read_vec4()  # edge color
                    r.read_float()  # edge size
                    r.read_vec4()  # tex tint
                    r.read_vec4()  # env tint
                    r.read_vec4()  # toon tint
                elif morph_type == 9:  # flip
                    self._read_morph_index()
                    r.read_float()
                elif morph_type == 10:  # impulse
                    self._read_rigidbody_index()
                    r.read_uint8()
                    r.read_vec3()
                    r.read_vec3()

        # --- Display slots (skip) ---
        num_display_slots = r.read_int32()
        for _ in range(num_display_slots):
            self._read_text()
            self._read_text()
            is_special = r.read_uint8()
            count = r.read_int32()
            for _ in range(count):
                display_type = r.read_uint8()
                if display_type == 0:
                    self._read_bone_index()
                else:
                    self._read_morph_index()

        # --- Rigid Bodies ---
        num_rigidbodies = r.read_int32()
        rigid_bodies = []
        for _ in range(num_rigidbodies):
            rb_name = self._read_text()
            rb_english_name = self._read_text()
            bone_index = self._read_bone_index()
            collision_group = r.read_uint8()
            no_collision_group = r.read_uint16()
            shape_type = r.read_uint8()
            shape_size = r.read_vec3()
            shape_position = r.read_vec3()
            shape_rotation = r.read_vec3()
            mass = r.read_float()
            linear_damping = r.read_float()
            angular_damping = r.read_float()
            restitution = r.read_float()
            friction = r.read_float()
            mode = r.read_uint8()

            rigid_bodies.append({
                "name": rb_name,
                "bone_index": bone_index,
                "collision_group": collision_group,
                "no_collision_group": no_collision_group,
                "shape_type": shape_type,
                "shape_size": list(shape_size),
                "shape_position": list(shape_position),
                "shape_rotation": list(shape_rotation),
                "mass": mass,
                "linear_damping": linear_damping,
                "angular_damping": angular_damping,
                "restitution": restitution,
                "friction": friction,
                "mode": mode,
            })

        # --- Joints ---
        num_joints = r.read_int32()
        joints = []
        for _ in range(num_joints):
            j_name = self._read_text()
            j_english_name = self._read_text()
            joint_type = r.read_uint8()
            rb_a = self._read_rigidbody_index()
            rb_b = self._read_rigidbody_index()
            position = r.read_vec3()
            rotation = r.read_vec3()
            translation_limit_min = r.read_vec3()
            translation_limit_max = r.read_vec3()
            rotation_limit_min = r.read_vec3()
            rotation_limit_max = r.read_vec3()
            spring_constant_translation = r.read_vec3()
            spring_constant_rotation = r.read_vec3()

            joints.append({
                "name": j_name,
                "rigidbody_index_a": rb_a,
                "rigidbody_index_b": rb_b,
                "position": list(position),
                "rotation": list(rotation),
                "spring_constant_translation": list(spring_constant_translation),
                "spring_constant_rotation": list(spring_constant_rotation),
            })

        return {
            "model_name": model_name,
            "vertices": num_vertices,
            "positions_raw": positions,
            "normals_raw": normals,
            "uvs_raw": uvs,
            "joint_indices_raw": joint_indices,
            "skin_weights_raw": skin_weights,
            "indices_raw": indices_raw,
            "texture_paths": texture_paths,
            "materials": materials,
            "bones_raw": bones,
            "rigid_bodies_raw": rigid_bodies,
            "joints_raw": joints,
        }


def read(pmx_path, scale=0.08):
    """Read PMX file and return normalized data for the converter pipeline.

    Args:
        pmx_path: Path to .pmx file.
        scale: Position scale factor. Default 0.08 (1 PMX unit ~ 8cm).

    Returns:
        dict with keys: positions, normals, uvs, joints, weights,
                        indices, materials, bones, textures, texture_mimes,
                        rigid_bodies, joints_phys, pmx_dir
    """
    pmx_dir = os.path.dirname(os.path.abspath(pmx_path))

    with open(pmx_path, "rb") as f:
        data = f.read()

    reader = PmxReader(data)
    raw = reader.read()

    # --- Apply coordinate transform + scale ---
    positions = raw["positions_raw"].copy()
    positions[:, 0] *= scale
    positions[:, 1] *= scale
    positions[:, 2] *= -scale  # Z-flip

    normals = raw["normals_raw"].copy()
    normals[:, 2] *= -1  # Z-flip (no scale for normals)

    uvs = raw["uvs_raw"]

    joint_indices = raw["joint_indices_raw"]
    skin_weights = raw["skin_weights_raw"]

    # Normalize weights
    weight_sums = skin_weights.sum(axis=1, keepdims=True)
    weight_sums = np.where(weight_sums == 0, 1.0, weight_sums)
    skin_weights = skin_weights / weight_sums

    # Winding reversal: (a,b,c) -> (a,c,b)
    num_tris = len(raw["indices_raw"]) // 3
    indices = raw["indices_raw"].reshape(num_tris, 3)[:, [0, 2, 1]].flatten()

    # Bones: apply coordinate transform + scale
    bones = []
    for b in raw["bones_raw"]:
        pos = b["position"]
        bones.append({
            "name": b["name"],
            "english_name": b["english_name"],
            "position": np.array(
                [pos[0] * scale, pos[1] * scale, -pos[2] * scale],
                dtype=np.float32,
            ),
            "parent_index": b["parent_index"],
        })

    # Materials (pass through)
    materials = raw["materials"]

    # Textures: load + convert to PNG
    textures = []
    texture_mimes = []
    for tex_path in raw["texture_paths"]:
        full_path = os.path.join(
            pmx_dir,
            tex_path.replace("\\", os.sep).replace("/", os.sep),
        )
        try:
            img = Image.open(full_path)
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGBA")
            buf = BytesIO()
            img.save(buf, format="PNG")
            textures.append(buf.getvalue())
            texture_mimes.append("image/png")
        except Exception as e:
            print(f"Warning: Failed to load texture '{tex_path}': {e}")
            img = Image.new("RGBA", (1, 1), (255, 255, 255, 255))
            buf = BytesIO()
            img.save(buf, format="PNG")
            textures.append(buf.getvalue())
            texture_mimes.append("image/png")

    # Rigid bodies: apply coordinate transform + scale
    rigid_bodies = []
    for rb in raw["rigid_bodies_raw"]:
        sp = rb["shape_position"]
        ss = rb["shape_size"]
        rigid_bodies.append({
            "name": rb["name"],
            "bone_index": rb["bone_index"],
            "collision_group": rb["collision_group"],
            "no_collision_group": rb["no_collision_group"],
            "shape_type": rb["shape_type"],
            "shape_size": [ss[0] * scale, ss[1] * scale, ss[2] * scale],
            "shape_position": [sp[0] * scale, sp[1] * scale, -sp[2] * scale],
            "shape_rotation": rb["shape_rotation"],
            "mass": rb["mass"],
            "linear_damping": rb["linear_damping"],
            "angular_damping": rb["angular_damping"],
            "restitution": rb["restitution"],
            "friction": rb["friction"],
            "mode": rb["mode"],
        })

    # Joints: apply coordinate transform + scale
    joints_phys = []
    for j in raw["joints_raw"]:
        jp = j["position"]
        joints_phys.append({
            "name": j["name"],
            "rigidbody_index_a": j["rigidbody_index_a"],
            "rigidbody_index_b": j["rigidbody_index_b"],
            "position": [jp[0] * scale, jp[1] * scale, -jp[2] * scale],
            "rotation": j["rotation"],
            "spring_constant_translation": j["spring_constant_translation"],
            "spring_constant_rotation": j["spring_constant_rotation"],
        })

    return {
        "positions": positions,
        "normals": normals,
        "uvs": uvs,
        "joints": joint_indices,
        "weights": skin_weights,
        "indices": indices,
        "materials": materials,
        "bones": bones,
        "textures": textures,
        "texture_mimes": texture_mimes,
        "rigid_bodies": rigid_bodies,
        "joints_phys": joints_phys,
        "pmx_dir": pmx_dir,
    }
