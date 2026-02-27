"""VRM Renamer — store original filename in VRM metadata and generate ASCII-safe name.

Works on the gltf_data dict directly (before write_glb), so no GLB re-parsing needed.
"""

import re
from datetime import datetime
from pathlib import Path


def _has_non_ascii(s: str) -> bool:
    return bool(re.search(r"[^\x00-\x7f]", s))


def _timestamp_name() -> str:
    now = datetime.now()
    return f"vrm_{now.strftime('%Y%m%d_%H%M%S')}"


def _sanitize_ascii(name: str) -> str:
    name = re.sub(r"[^a-zA-Z0-9\-_.]", "_", name)
    name = re.sub(r"_+", "_", name)
    return name.strip("_")


def make_english_name(original_name: str) -> str:
    """Generate an ASCII-safe VRM filename from the original name.

    Rules:
        - Non-ASCII chars present → timestamp: vrm_YYYYMMDD_HHmmss.vrm
        - All ASCII → sanitize special chars to underscore + .vrm

    Args:
        original_name: Original filename (e.g. "芙宁娜_荒.pmx", "Archer (1).pmx")

    Returns:
        English filename with .vrm extension (e.g. "vrm_20260227_120000.vrm", "Archer_1.vrm")
    """
    stem = Path(original_name).stem

    if _has_non_ascii(stem):
        return f"{_timestamp_name()}.vrm"

    safe = _sanitize_ascii(stem)
    if not safe:
        return f"{_timestamp_name()}.vrm"

    return f"{safe}.vrm"


def inject_original_name(gltf_data: dict, original_name: str) -> None:
    """Store the original filename (without extension) in extensions.VRM.meta.title.

    Modifies gltf_data["json"] in-place. Must be called after vrm_builder.build()
    and before write_glb().

    Args:
        gltf_data: The gltf_data dict (with "json" and "bin" keys).
        original_name: Original filename (e.g. "芙宁娜_荒.pmx").
    """
    stem = Path(original_name).stem
    vrm_ext = gltf_data["json"].get("extensions", {}).get("VRM", {})
    meta = vrm_ext.get("meta")
    if meta is not None:
        meta["title"] = stem
