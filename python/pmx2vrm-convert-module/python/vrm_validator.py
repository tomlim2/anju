"""VRM 0.x file validator — 6-layer structural validation.

Validates GLB structure, glTF conformance, VRM extension presence,
humanoid bone completeness, spring animation integrity, and material consistency.

Usage (CLI):
    python -m pmx2vrm_convert_module.python.vrm_validator model.vrm
    python -m pmx2vrm_convert_module.python.vrm_validator model.vrm --strict --json

Usage (API):
    from vrm_validator import validate
    result = validate("model.vrm")
    result = validate(raw_bytes)
    result = validate("model.vrm", strict=True)
"""

import json
import struct
import sys
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path


class Severity(Enum):
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


@dataclass
class Issue:
    severity: Severity
    layer: int
    message: str
    path: str = ""

    def to_dict(self):
        return {
            "severity": self.severity.value,
            "layer": self.layer,
            "message": self.message,
            "path": self.path,
        }


@dataclass
class ValidationResult:
    valid: bool = True
    issues: list = field(default_factory=list)
    vrm_version: str | None = None
    exporter: str | None = None
    bone_count: int = 0
    node_count: int = 0
    material_count: int = 0

    def to_dict(self):
        return {
            "valid": self.valid,
            "issues": [i.to_dict() for i in self.issues],
            "vrm_version": self.vrm_version,
            "exporter": self.exporter,
            "bone_count": self.bone_count,
            "node_count": self.node_count,
            "material_count": self.material_count,
        }


# VRM 0.x required humanoid bones (17 bones)
_REQUIRED_BONES = {
    "hips", "spine", "chest", "neck", "head",
    "leftUpperArm", "leftLowerArm", "leftHand",
    "rightUpperArm", "rightLowerArm", "rightHand",
    "leftUpperLeg", "leftLowerLeg", "leftFoot",
    "rightUpperLeg", "rightLowerLeg", "rightFoot",
}

# GLB chunk type constants
_CHUNK_JSON = 0x4E4F534A
_CHUNK_BIN = 0x004E4942


def validate(source, strict=False):
    """Validate a VRM 0.x file.

    Args:
        source: File path (str/Path) or raw bytes.
        strict: If True, any WARNING also sets valid=False.

    Returns:
        ValidationResult with issues found across all layers.
    """
    result = ValidationResult()

    # Read source
    if isinstance(source, (str, Path)):
        path = Path(source)
        if not path.exists():
            result.valid = False
            result.issues.append(Issue(Severity.ERROR, 0, f"File not found: {path}"))
            return result
        data = path.read_bytes()
    elif isinstance(source, (bytes, bytearray)):
        data = bytes(source)
    else:
        result.valid = False
        result.issues.append(Issue(Severity.ERROR, 0, "source must be file path or bytes"))
        return result

    # Layer 1: GLB structure
    gltf_json, ok = _layer1_glb(data, result)
    if not ok:
        return _finalize(result, strict)

    # Layer 2: glTF validity
    ok = _layer2_gltf(gltf_json, result)
    if not ok:
        return _finalize(result, strict)

    # Layer 3: VRM extension
    vrm_ext, ok = _layer3_vrm_extension(gltf_json, result)
    if not ok:
        return _finalize(result, strict)

    # Populate metadata
    result.vrm_version = vrm_ext.get("specVersion")
    result.exporter = vrm_ext.get("exporterVersion")
    result.node_count = len(gltf_json.get("nodes", []))
    result.material_count = len(gltf_json.get("materials", []))

    # Layer 4: Humanoid bones
    _layer4_humanoid(vrm_ext, result)

    # Layer 5: Spring animation
    _layer5_spring(vrm_ext, result)

    # Layer 6: Materials
    _layer6_materials(gltf_json, vrm_ext, result)

    return _finalize(result, strict)


def _finalize(result, strict):
    """Set valid flag based on issues."""
    has_error = any(i.severity == Severity.ERROR for i in result.issues)
    has_warning = any(i.severity == Severity.WARNING for i in result.issues)
    result.valid = not has_error and (not strict or not has_warning)
    return result


# ---------------------------------------------------------------------------
# Layer 1: GLB structure
# ---------------------------------------------------------------------------

def _layer1_glb(data, result):
    """Parse GLB header and extract JSON chunk. Returns (gltf_json, ok)."""
    if len(data) < 12:
        result.issues.append(Issue(Severity.ERROR, 1, "File too small for GLB header (< 12 bytes)"))
        return None, False

    magic, version, total_length = struct.unpack_from("<III", data, 0)

    if magic != 0x46546C67:
        result.issues.append(Issue(
            Severity.ERROR, 1,
            f"Invalid GLB magic: 0x{magic:08X} (expected 0x46546C67 'glTF')",
        ))
        return None, False

    if version != 2:
        result.issues.append(Issue(
            Severity.ERROR, 1,
            f"Unsupported GLB version: {version} (expected 2)",
        ))
        return None, False

    if total_length > len(data):
        result.issues.append(Issue(
            Severity.WARNING, 1,
            f"GLB header declares {total_length} bytes but file is {len(data)} bytes",
        ))

    # Parse JSON chunk
    if len(data) < 20:
        result.issues.append(Issue(Severity.ERROR, 1, "File too small for JSON chunk header"))
        return None, False

    json_len, json_type = struct.unpack_from("<II", data, 12)

    if json_type != _CHUNK_JSON:
        result.issues.append(Issue(
            Severity.ERROR, 1,
            f"First chunk is not JSON: 0x{json_type:08X} (expected 0x{_CHUNK_JSON:08X})",
        ))
        return None, False

    json_end = 20 + json_len
    if json_end > len(data):
        result.issues.append(Issue(Severity.ERROR, 1, "JSON chunk extends beyond file"))
        return None, False

    try:
        gltf_json = json.loads(data[20:json_end])
    except json.JSONDecodeError as e:
        result.issues.append(Issue(Severity.ERROR, 1, f"Malformed JSON chunk: {e}"))
        return None, False

    # Check BIN chunk presence
    if json_end < len(data):
        if json_end + 8 <= len(data):
            bin_len, bin_type = struct.unpack_from("<II", data, json_end)
            if bin_type != _CHUNK_BIN:
                result.issues.append(Issue(
                    Severity.WARNING, 1,
                    f"Second chunk is not BIN: 0x{bin_type:08X}",
                ))
        else:
            result.issues.append(Issue(
                Severity.WARNING, 1,
                "Trailing bytes after JSON chunk but too small for BIN chunk header",
            ))

    result.issues.append(Issue(Severity.INFO, 1, "GLB structure valid"))
    return gltf_json, True


# ---------------------------------------------------------------------------
# Layer 2: glTF validity
# ---------------------------------------------------------------------------

def _layer2_gltf(gltf_json, result):
    """Validate core glTF 2.0 structure. Returns ok (bool)."""
    fatal = False

    # asset.version
    asset = gltf_json.get("asset")
    if not isinstance(asset, dict):
        result.issues.append(Issue(Severity.ERROR, 2, "Missing 'asset' object"))
        return False

    asset_version = asset.get("version")
    if asset_version is None:
        result.issues.append(Issue(Severity.ERROR, 2, "Missing asset.version"))
        fatal = True
    elif not str(asset_version).startswith("2"):
        result.issues.append(Issue(
            Severity.ERROR, 2,
            f"Unexpected asset.version: '{asset_version}' (expected 2.x)",
        ))
        fatal = True

    nodes = gltf_json.get("nodes", [])
    num_nodes = len(nodes)

    # bufferView bounds
    buffer_views = gltf_json.get("bufferViews", [])
    buffers = gltf_json.get("buffers", [])
    for i, bv in enumerate(buffer_views):
        buf_idx = bv.get("buffer", 0)
        if buf_idx >= len(buffers):
            result.issues.append(Issue(
                Severity.ERROR, 2,
                f"buffer index {buf_idx} out of range ({len(buffers)} buffers)",
                path=f"bufferViews[{i}]",
            ))
            fatal = True

    # Node children range check + cycle detection
    for i, node in enumerate(nodes):
        children = node.get("children", [])
        for ci, child in enumerate(children):
            if not isinstance(child, int) or child < 0 or child >= num_nodes:
                result.issues.append(Issue(
                    Severity.ERROR, 2,
                    f"index {child} out of range ({num_nodes} nodes)",
                    path=f"nodes[{i}].children[{ci}]",
                ))
                fatal = True

    # Cycle detection via DFS
    if not fatal and num_nodes > 0:
        visited = [0] * num_nodes  # 0=unvisited, 1=in_stack, 2=done
        has_cycle = False

        def dfs(n):
            nonlocal has_cycle
            if has_cycle:
                return
            visited[n] = 1
            for child in nodes[n].get("children", []):
                if not isinstance(child, int) or child < 0 or child >= num_nodes:
                    continue
                if visited[child] == 1:
                    has_cycle = True
                    return
                if visited[child] == 0:
                    dfs(child)
            visited[n] = 2

        for n in range(num_nodes):
            if visited[n] == 0:
                dfs(n)
            if has_cycle:
                break

        if has_cycle:
            result.issues.append(Issue(Severity.ERROR, 2, "Cycle detected in node hierarchy"))
            fatal = True

    if fatal:
        return False

    result.issues.append(Issue(Severity.INFO, 2, "glTF structure valid"))
    return True


# ---------------------------------------------------------------------------
# Layer 3: VRM extension
# ---------------------------------------------------------------------------

def _layer3_vrm_extension(gltf_json, result):
    """Check VRM 0.x extension presence and required keys. Returns (vrm_ext, ok)."""
    extensions = gltf_json.get("extensions")
    if not isinstance(extensions, dict):
        result.issues.append(Issue(Severity.ERROR, 3, "No 'extensions' object in glTF"))
        return None, False

    vrm_ext = extensions.get("VRM")
    if vrm_ext is None:
        # Check for VRM 1.0
        if "VRMC_vrm" in extensions:
            result.issues.append(Issue(
                Severity.ERROR, 3,
                "Found VRMC_vrm (VRM 1.0) — this validator supports VRM 0.x only",
            ))
        else:
            result.issues.append(Issue(Severity.ERROR, 3, "Missing extensions.VRM"))
        return None, False

    if not isinstance(vrm_ext, dict):
        result.issues.append(Issue(Severity.ERROR, 3, "extensions.VRM is not an object"))
        return None, False

    # Required top-level VRM keys
    required = ("meta", "humanoid", "materialProperties")
    missing = [k for k in required if k not in vrm_ext]
    if missing:
        result.issues.append(Issue(
            Severity.ERROR, 3,
            f"Missing required VRM keys: {', '.join(missing)}",
        ))
        return None, False

    result.issues.append(Issue(Severity.INFO, 3, "VRM extension present"))
    return vrm_ext, True


# ---------------------------------------------------------------------------
# Layer 4: Humanoid bones
# ---------------------------------------------------------------------------

def _layer4_humanoid(vrm_ext, result):
    """Validate humanoid bone mapping."""
    humanoid = vrm_ext.get("humanoid", {})
    human_bones = humanoid.get("humanBones", [])

    if not isinstance(human_bones, list):
        result.issues.append(Issue(
            Severity.ERROR, 4,
            "humanoid.humanBones is not an array",
            path="humanoid.humanBones",
        ))
        return

    node_count = result.node_count
    seen_bones = set()
    seen_nodes = set()

    for i, entry in enumerate(human_bones):
        bone_name = entry.get("bone", "")
        node_idx = entry.get("node")

        # Duplicate bone name
        if bone_name in seen_bones:
            result.issues.append(Issue(
                Severity.WARNING, 4,
                f"Duplicate humanoid bone: '{bone_name}'",
                path=f"humanoid.humanBones[{i}]",
            ))
        seen_bones.add(bone_name)

        # Duplicate node index
        if node_idx is not None and node_idx in seen_nodes:
            result.issues.append(Issue(
                Severity.WARNING, 4,
                f"Duplicate node index {node_idx} (bone: '{bone_name}')",
                path=f"humanoid.humanBones[{i}]",
            ))
        if node_idx is not None:
            seen_nodes.add(node_idx)

        # Node index range
        if isinstance(node_idx, int) and node_count > 0 and (node_idx < 0 or node_idx >= node_count):
            result.issues.append(Issue(
                Severity.ERROR, 4,
                f"bone '{bone_name}': node index {node_idx} out of range ({node_count} nodes)",
                path=f"humanoid.humanBones[{i}]",
            ))

    result.bone_count = len(human_bones)

    # Required bones check
    missing = _REQUIRED_BONES - seen_bones
    if missing:
        result.issues.append(Issue(
            Severity.ERROR, 4,
            f"Missing required bones ({len(missing)}): {', '.join(sorted(missing))}",
            path="humanoid.humanBones",
        ))
    else:
        result.issues.append(Issue(
            Severity.INFO, 4,
            f"Humanoid bones complete ({len(seen_bones & _REQUIRED_BONES)}/{len(_REQUIRED_BONES)} required)",
        ))


# ---------------------------------------------------------------------------
# Layer 5: Spring animation
# ---------------------------------------------------------------------------

def _layer5_spring(vrm_ext, result):
    """Validate secondaryAnimation bone groups and collider groups."""
    sec_anim = vrm_ext.get("secondaryAnimation")
    if sec_anim is None:
        result.issues.append(Issue(Severity.INFO, 5, "No secondaryAnimation present"))
        return

    if not isinstance(sec_anim, dict):
        result.issues.append(Issue(
            Severity.WARNING, 5,
            "secondaryAnimation is not an object",
            path="secondaryAnimation",
        ))
        return

    node_count = result.node_count
    bone_groups = sec_anim.get("boneGroups", [])
    collider_groups = sec_anim.get("colliderGroups", [])
    num_collider_groups = len(collider_groups) if isinstance(collider_groups, list) else 0

    # Validate bone groups
    if isinstance(bone_groups, list):
        for gi, group in enumerate(bone_groups):
            if not isinstance(group, dict):
                continue

            # "stiffiness" is the correct VRM 0.x spelling (intentional typo)
            if "stiffness" in group and "stiffiness" not in group:
                result.issues.append(Issue(
                    Severity.WARNING, 5,
                    f"uses 'stiffness' instead of VRM 0.x 'stiffiness'",
                    path=f"secondaryAnimation.boneGroups[{gi}]",
                ))

            # Bone indices range
            bones = group.get("bones", [])
            if isinstance(bones, list):
                for bi, bone_idx in enumerate(bones):
                    if isinstance(bone_idx, int) and node_count > 0:
                        if bone_idx < 0 or bone_idx >= node_count:
                            result.issues.append(Issue(
                                Severity.WARNING, 5,
                                f"index {bone_idx} out of range ({node_count} nodes)",
                                path=f"secondaryAnimation.boneGroups[{gi}].bones[{bi}]",
                            ))

            # Center bone index
            center = group.get("center")
            if isinstance(center, int) and center >= 0 and node_count > 0:
                if center >= node_count:
                    result.issues.append(Issue(
                        Severity.WARNING, 5,
                        f"index {center} out of range ({node_count} nodes)",
                        path=f"secondaryAnimation.boneGroups[{gi}].center",
                    ))

            # Collider group references
            cg_refs = group.get("colliderGroups", [])
            if isinstance(cg_refs, list):
                for ci, cg_idx in enumerate(cg_refs):
                    if isinstance(cg_idx, int) and (cg_idx < 0 or cg_idx >= num_collider_groups):
                        result.issues.append(Issue(
                            Severity.WARNING, 5,
                            f"index {cg_idx} out of range ({num_collider_groups} collider groups)",
                            path=f"secondaryAnimation.boneGroups[{gi}].colliderGroups[{ci}]",
                        ))

    # Validate collider groups
    if isinstance(collider_groups, list):
        for gi, cg in enumerate(collider_groups):
            if not isinstance(cg, dict):
                continue
            cg_node = cg.get("node")
            if isinstance(cg_node, int) and node_count > 0:
                if cg_node < 0 or cg_node >= node_count:
                    result.issues.append(Issue(
                        Severity.WARNING, 5,
                        f"index {cg_node} out of range ({node_count} nodes)",
                        path=f"secondaryAnimation.colliderGroups[{gi}].node",
                    ))

    info_parts = []
    if isinstance(bone_groups, list):
        info_parts.append(f"{len(bone_groups)} bone groups")
    if isinstance(collider_groups, list):
        info_parts.append(f"{num_collider_groups} collider groups")
    if info_parts:
        result.issues.append(Issue(Severity.INFO, 5, f"Secondary animation: {', '.join(info_parts)}"))


# ---------------------------------------------------------------------------
# Layer 6: Materials
# ---------------------------------------------------------------------------

def _layer6_materials(gltf_json, vrm_ext, result):
    """Validate VRM materialProperties vs glTF materials."""
    gltf_mats = gltf_json.get("materials", [])
    vrm_mat_props = vrm_ext.get("materialProperties", [])

    num_gltf = len(gltf_mats)
    num_vrm = len(vrm_mat_props)

    if num_vrm != num_gltf:
        result.issues.append(Issue(
            Severity.WARNING, 6,
            f"materialProperties count ({num_vrm}) != glTF materials count ({num_gltf})",
            path="materialProperties",
        ))

    for i, mp in enumerate(vrm_mat_props):
        if not isinstance(mp, dict):
            result.issues.append(Issue(
                Severity.WARNING, 6,
                "not an object",
                path=f"materialProperties[{i}]",
            ))
            continue

        if "name" not in mp:
            result.issues.append(Issue(
                Severity.WARNING, 6,
                "missing 'name'",
                path=f"materialProperties[{i}]",
            ))

        if "shader" not in mp:
            result.issues.append(Issue(
                Severity.WARNING, 6,
                "missing 'shader'",
                path=f"materialProperties[{i}]",
            ))

    result.issues.append(Issue(
        Severity.INFO, 6,
        f"Materials: {num_gltf} glTF, {num_vrm} VRM properties",
    ))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _format_human(result, source_name):
    """Format result as human-readable text."""
    lines = [f"Validating: {source_name}"]

    # Header info
    parts = []
    if result.vrm_version is not None:
        parts.append(f"VRM 0.x | specVersion: {result.vrm_version}")
    if result.exporter:
        parts.append(f"exporter: {result.exporter}")
    if parts:
        lines.append(" | ".join(parts))

    stats = []
    if result.node_count:
        stats.append(f"Nodes: {result.node_count}")
    if result.material_count:
        stats.append(f"Materials: {result.material_count}")
    if result.bone_count:
        required_found = sum(
            1 for i in result.issues
            if i.layer == 4 and i.severity == Severity.INFO and "required" in i.message
        )
        stats.append(f"Humanoid bones: {result.bone_count}/{len(_REQUIRED_BONES)} required")
    if stats:
        lines.append(" | ".join(stats))

    lines.append("")

    # Layer results
    layer_names = {
        1: "GLB structure",
        2: "glTF validity",
        3: "VRM extension",
        4: "Humanoid bones",
        5: "Secondary animation",
        6: "Materials",
    }

    for layer_num in range(1, 7):
        layer_issues = [i for i in result.issues if i.layer == layer_num]
        if not layer_issues:
            continue

        errors = [i for i in layer_issues if i.severity == Severity.ERROR]
        warnings = [i for i in layer_issues if i.severity == Severity.WARNING]
        name = layer_names.get(layer_num, f"Layer {layer_num}")

        if errors:
            lines.append(f"[FAIL] {name}")
            for i in errors:
                detail = f"  - {i.message}"
                if i.path:
                    detail = f"  - {i.path}: {i.message}"
                lines.append(detail)
        elif warnings:
            lines.append(f"[WARN] {name}")
            for i in warnings:
                detail = f"  - {i.message}"
                if i.path:
                    detail = f"  - {i.path}: {i.message}"
                lines.append(detail)
        else:
            lines.append(f"[PASS] {name}")

    # Summary
    errors = [i for i in result.issues if i.severity == Severity.ERROR]
    warnings = [i for i in result.issues if i.severity == Severity.WARNING]

    lines.append("")
    if errors:
        parts = [f"{len(errors)} error{'s' if len(errors) != 1 else ''}"]
        if warnings:
            parts.append(f"{len(warnings)} warning{'s' if len(warnings) != 1 else ''}")
        lines.append(f"Result: INVALID ({', '.join(parts)})")
    elif warnings:
        lines.append(f"Result: VALID ({len(warnings)} warning{'s' if len(warnings) != 1 else ''})")
    else:
        lines.append("Result: VALID")

    return "\n".join(lines)


def main(argv=None):
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Validate VRM 0.x files",
        prog="vrm_validator",
    )
    parser.add_argument("file", help="Path to .vrm file")
    parser.add_argument("--strict", action="store_true", help="Treat warnings as errors")
    parser.add_argument("--json", action="store_true", dest="json_output", help="Output as JSON")
    args = parser.parse_args(argv)

    result = validate(args.file, strict=args.strict)

    if args.json_output:
        print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))
    else:
        print(_format_human(result, args.file))

    sys.exit(0 if result.valid else 1)


if __name__ == "__main__":
    main()
