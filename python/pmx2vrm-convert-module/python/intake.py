"""ZIP intake — scan a zip for humanoid PMX models, then convert to VRM.

Handles nested zips (zip-in-zip) which is common for MMD model distributions.

Usage:
    python -m pmx2vrm_convert_module.python.intake model.zip
    python -m pmx2vrm_convert_module.python.intake model.zip --output ./out
    python -m pmx2vrm_convert_module.python.intake model.zip --scale 0.08 --no-spring
"""

import argparse
import io
import os
import sys
import tempfile
import zipfile
from pathlib import Path

# Encodings to try when zip filenames are not UTF-8 (flag bit 11 unset).
# Order matters: most common CJK encodings first.
_FALLBACK_ENCODINGS = ["gbk", "shift_jis", "euc-kr", "big5"]


def _decode_zip_filename(raw_name):
    """Re-decode a zip filename that was incorrectly decoded as CP437.

    Python's zipfile decodes non-UTF-8 names as CP437. For CJK zips (GBK,
    Shift-JIS, etc.) this produces garbage. We re-encode to CP437 bytes and
    try common CJK encodings.
    """
    try:
        raw_bytes = raw_name.encode("cp437")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return raw_name

    for enc in _FALLBACK_ENCODINGS:
        try:
            return raw_bytes.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue

    return raw_name


def _extract_with_encoding_fix(zf, dest_dir):
    """Extract all entries from a ZipFile, fixing CJK filename encoding.

    Returns a dict mapping original zip entry names to their decoded file paths.
    """
    entry_map = {}
    for info in zf.infolist():
        orig_name = info.filename

        # If UTF-8 flag is set, filename is already correct
        if info.flag_bits & 0x800:
            decoded_name = orig_name
        else:
            decoded_name = _decode_zip_filename(orig_name)

        # Sanitize path separators
        decoded_name = decoded_name.replace("\\", "/")

        target_path = os.path.join(dest_dir, decoded_name)
        entry_map[orig_name] = target_path

        if info.is_dir():
            os.makedirs(target_path, exist_ok=True)
        else:
            os.makedirs(os.path.dirname(target_path), exist_ok=True)
            with zf.open(info) as src, open(target_path, "wb") as dst:
                dst.write(src.read())

    return entry_map


def _scan_bones(pmx_bytes):
    """Extract bone names from raw PMX bytes."""
    from .pmx_reader import PmxReader

    try:
        reader = PmxReader(pmx_bytes)
        raw = reader.read()
        return [b["name"] for b in raw["bones_raw"]]
    except Exception:
        return []


def is_humanoid(pmx_bytes):
    """Check if PMX binary contains a humanoid skeleton.

    Returns:
        (bool, set): Whether all 17 required bones are mapped, and the set of mapped bones.
    """
    from .bone_mapping import (
        PMX_BONE_REPLACEMENTS,
        PMX_TO_VRM_HUMANOID,
        VRM_REQUIRED_BONES,
    )

    bone_names = _scan_bones(pmx_bytes)
    if not bone_names:
        return False, set()

    mapped = set()
    for name in bone_names:
        lookup = PMX_BONE_REPLACEMENTS.get(name, name)
        vrm_names = PMX_TO_VRM_HUMANOID.get(lookup, [])
        for vrm_name in vrm_names:
            if vrm_name in VRM_REQUIRED_BONES:
                mapped.add(vrm_name)

    return len(mapped) >= len(VRM_REQUIRED_BONES), mapped


def _scan_zipfile(zf, prefix=""):
    """Recursively scan a ZipFile for PMX entries, descending into nested zips."""
    results = []

    for entry in zf.namelist():
        lower = entry.lower()

        if lower.endswith(".pmx"):
            pmx_bytes = zf.read(entry)
            humanoid, mapped = is_humanoid(pmx_bytes)
            results.append({
                "name": f"{prefix}{entry}" if prefix else entry,
                "zip_entry": entry,
                "parent_zip": prefix.rstrip("/") if prefix else None,
                "humanoid": humanoid,
                "mapped_bones": mapped,
                "mapped_count": len(mapped),
            })

        elif lower.endswith(".zip"):
            inner_bytes = zf.read(entry)
            try:
                inner_zf = zipfile.ZipFile(io.BytesIO(inner_bytes), "r")
                nested_prefix = f"{prefix}{entry}/"
                results.extend(_scan_zipfile(inner_zf, prefix=nested_prefix))
                inner_zf.close()
            except zipfile.BadZipFile:
                pass

    return results


def scan_zip(zip_path):
    """Scan a zip for .pmx files (including nested zips) and classify as humanoid or not.

    Returns:
        List of dicts with keys: name, zip_entry, parent_zip, humanoid, mapped_bones, mapped_count
    """
    with zipfile.ZipFile(zip_path, "r") as zf:
        return _scan_zipfile(zf)


def _extract_nested_zip(zip_path, parent_zip_entry, tmp_dir):
    """Extract a nested zip's contents to tmp_dir with encoding fix.

    Returns (extract_dir, entry_map) where entry_map maps original names to decoded paths.
    """
    with zipfile.ZipFile(zip_path, "r") as outer:
        inner_bytes = outer.read(parent_zip_entry)

    decoded_stem = _decode_zip_filename(Path(parent_zip_entry).stem)
    extract_dir = os.path.join(tmp_dir, decoded_stem)
    os.makedirs(extract_dir, exist_ok=True)

    inner_zf = zipfile.ZipFile(io.BytesIO(inner_bytes), "r")
    entry_map = _extract_with_encoding_fix(inner_zf, extract_dir)
    inner_zf.close()
    return extract_dir, entry_map


def extract_pmx_files(zip_path, scan_results, tmp_dir):
    """Extract PMX files from a zip based on scan results.

    Separates extraction from conversion so frontends/backends can
    use extracted files independently.

    Args:
        zip_path: Path to the zip file (str or Path).
        scan_results: List of scan result dicts (from scan_zip).
        tmp_dir: Directory to extract files into.

    Returns:
        List of (scan_result, pmx_path) tuples.
    """
    zip_str = str(zip_path)
    extracted_nested = {}
    outer_entry_map = None

    result_paths = []

    for r in scan_results:
        parent = r["parent_zip"]

        if parent is not None:
            if parent not in extracted_nested:
                extracted_nested[parent] = _extract_nested_zip(
                    zip_str, parent, tmp_dir,
                )
            _, entry_map = extracted_nested[parent]
        else:
            if outer_entry_map is None:
                with zipfile.ZipFile(zip_str, "r") as zf:
                    outer_entry_map = _extract_with_encoding_fix(zf, tmp_dir)
            entry_map = outer_entry_map

        pmx_path = entry_map[r["zip_entry"]]
        result_paths.append((r, pmx_path))

    return result_paths


def process(zip_path, output_dir=None, scale=0.08, no_spring=False):
    """Process zip: find humanoid PMX files, convert each to VRM.

    Handles nested zips automatically.

    Args:
        zip_path: Path to input zip file.
        output_dir: Output directory. Default: same directory as zip.
        scale: Position scale factor (default 0.08).
        no_spring: Skip spring bone conversion.

    Returns:
        List of output VRM file paths.

    Raises:
        FileNotFoundError: If zip doesn't exist.
        ValueError: If no .pmx files found in zip.
        RuntimeError: If no humanoid PMX models found.
    """
    zip_path = Path(zip_path)
    if not zip_path.exists():
        raise FileNotFoundError(f"Zip not found: {zip_path}")

    if output_dir is None:
        output_dir = zip_path.parent
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. Scan
    print(f"Scanning: {zip_path.name}")
    results = scan_zip(str(zip_path))

    if not results:
        raise ValueError(f"No .pmx files found in {zip_path.name}")

    humanoids = [r for r in results if r["humanoid"]]

    for r in results:
        tag = "humanoid" if r["humanoid"] else "SKIP"
        print(f"  {r['name']} — {tag} ({r['mapped_count']}/17 required bones)")

    if not humanoids:
        raise RuntimeError(
            f"No humanoid PMX found in {zip_path.name}. "
            f"Checked {len(results)} .pmx file(s)."
        )

    # 2. Extract and convert
    from . import bone_mapping, gltf_builder
    from . import pmx_reader as pmx_mod
    from . import spring_converter, vrm_builder
    from .vrm_renamer import rename_vrm
    from .__main__ import build_glb_buffer

    output_paths = []

    with tempfile.TemporaryDirectory() as tmp_dir:
        pmx_files = extract_pmx_files(zip_path, humanoids, tmp_dir)

        for scan_result, pmx_path in pmx_files:
            original_name = Path(pmx_path).name

            print(f"\nConverting: {scan_result['name']}")
            pmx_data = pmx_mod.read(pmx_path, scale=scale)
            print(f"  Vertices: {len(pmx_data['positions'])}, "
                  f"Bones: {len(pmx_data['bones'])}, "
                  f"Materials: {len(pmx_data['materials'])}")

            gltf_data = gltf_builder.build(pmx_data)
            humanoid_bones = bone_mapping.map_bones(pmx_data["bones"])

            if no_spring:
                secondary = {"boneGroups": [], "colliderGroups": []}
            else:
                secondary = spring_converter.convert(
                    pmx_data["rigid_bodies"],
                    pmx_data["joints_phys"],
                    pmx_data["bones"],
                )

            gltf_data = vrm_builder.build(
                gltf_data, humanoid_bones, secondary, pmx_data["materials"],
            )

            # Build GLB -> Rename VRM (matches TS pipeline)
            glb_buffer = build_glb_buffer(gltf_data)
            renamed_buffer, english_name = rename_vrm(glb_buffer, original_name)

            english_stem = Path(english_name).stem
            vrm_path = output_dir / english_name

            # Avoid overwriting: append _2, _3, etc.
            counter = 2
            while vrm_path.exists() or str(vrm_path) in output_paths:
                vrm_path = output_dir / f"{english_stem}_{counter}.vrm"
                counter += 1

            print(f"  Rename: {original_name} -> {vrm_path.name}")

            with open(str(vrm_path), "wb") as f:
                f.write(renamed_buffer)
            output_paths.append(str(vrm_path))
            print(f"  -> {vrm_path}")

    print(f"\nDone. {len(output_paths)} model(s) converted.")
    return output_paths


def main():
    parser = argparse.ArgumentParser(description="ZIP intake for PMX -> VRM conversion")
    parser.add_argument("input", help="Input zip file path")
    parser.add_argument("--output", "-o", help="Output directory (default: same as zip)")
    parser.add_argument("--scale", type=float, default=0.08, help="Scale factor (default: 0.08)")
    parser.add_argument("--no-spring", action="store_true", help="Skip spring bones")
    args = parser.parse_args()

    try:
        process(args.input, output_dir=args.output, scale=args.scale, no_spring=args.no_spring)
    except (FileNotFoundError, ValueError, RuntimeError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
