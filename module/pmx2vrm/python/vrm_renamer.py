"""VRM Renamer — stores original filename in VRM metadata and
generates an ASCII-safe English filename for the output.
"""

import json
import re
import struct
from datetime import datetime
from pathlib import Path


# ── GLB helpers ──

def _parse_glb(data: bytes) -> tuple[dict, bytes]:
    """Parse a GLB buffer into its JSON and BIN chunks."""
    magic = struct.unpack_from("<I", data, 0)[0]
    if magic != 0x46546C67:
        raise ValueError("Not a valid GLB file")

    offset = 12

    # JSON chunk
    json_len, json_type = struct.unpack_from("<II", data, offset)
    if json_type != 0x4E4F534A:
        raise ValueError("Expected JSON chunk")
    offset += 8
    json_obj = json.loads(data[offset:offset + json_len].decode("utf-8"))
    offset += json_len

    # BIN chunk
    bin_len = struct.unpack_from("<I", data, offset)[0]
    offset += 8
    bin_data = data[offset:offset + bin_len]

    return json_obj, bin_data


def _build_glb(json_obj: dict, bin_data: bytes) -> bytes:
    """Rebuild a GLB buffer from JSON object and BIN data."""
    json_str = json.dumps(json_obj, ensure_ascii=False, separators=(",", ":"))
    json_bytes = json_str.encode("utf-8")

    # Pad JSON to 4-byte alignment with spaces
    json_pad = (4 - len(json_bytes) % 4) % 4
    json_bytes += b" " * json_pad

    # Pad BIN to 4-byte alignment with null bytes
    bin_padded = bytearray(bin_data)
    bin_pad = (4 - len(bin_padded) % 4) % 4
    bin_padded += b"\x00" * bin_pad

    total_length = 12 + 8 + len(json_bytes) + 8 + len(bin_padded)
    buf = bytearray(total_length)

    struct.pack_into("<III", buf, 0, 0x46546C67, 2, total_length)

    offset = 12
    struct.pack_into("<II", buf, offset, len(json_bytes), 0x4E4F534A)
    offset += 8
    buf[offset:offset + len(json_bytes)] = json_bytes
    offset += len(json_bytes)

    struct.pack_into("<II", buf, offset, len(bin_padded), 0x004E4942)
    offset += 8
    buf[offset:offset + len(bin_padded)] = bin_padded

    return bytes(buf)


# ── Naming helpers ──

def _has_non_ascii(s: str) -> bool:
    return bool(re.search(r"[^\x00-\x7f]", s))


def _timestamp_name() -> str:
    now = datetime.now()
    return f"vrm_{now.strftime('%Y%m%d_%H%M%S')}"


def _sanitize_ascii(name: str) -> str:
    name = re.sub(r"[^a-zA-Z0-9\-_.]", "_", name)
    name = re.sub(r"_+", "_", name)
    return name.strip("_")


def _strip_extension(name: str) -> str:
    return Path(name).stem


# ── Public API ──

def make_english_name(original_name: str) -> str:
    """Generate an ASCII-safe VRM filename from the original name.

    Rules:
        - Non-ASCII chars present -> timestamp: vrm_YYYYMMDD_HHmmss.vrm
        - All ASCII -> sanitize special chars to underscore + .vrm
    """
    stem = _strip_extension(original_name)

    if _has_non_ascii(stem):
        return f"{_timestamp_name()}.vrm"

    safe = _sanitize_ascii(stem)
    if not safe:
        return f"{_timestamp_name()}.vrm"

    return f"{safe}.vrm"


def rename_vrm(
    glb_data: bytes,
    original_name: str,
) -> tuple[bytes, str]:
    """Rename a VRM (GLB) file.

    1. Stores the original filename (without extension) in extensions.VRM.meta.title
    2. Returns the modified buffer and an ASCII-safe english filename

    Args:
        glb_data: The GLB binary data.
        original_name: Original filename (e.g. "芙宁娜_荒.pmx" or "Archer (1).pmx")

    Returns:
        (modified_buffer, english_name) tuple.
    """
    base_name = _strip_extension(original_name)

    # Parse GLB, inject original name into VRM meta
    json_obj, bin_data = _parse_glb(glb_data)

    vrm_ext = json_obj.get("extensions", {}).get("VRM", {})
    meta = vrm_ext.get("meta")
    if meta is not None:
        meta["title"] = base_name

    # Rebuild GLB with updated JSON
    buffer = _build_glb(json_obj, bin_data)

    # Generate english filename
    english_name = make_english_name(original_name)

    return buffer, english_name
