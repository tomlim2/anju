"""PMX → VRM intake — folder, ZIP, or single PMX input → convert → rename → validate.

Accepts a single .pmx file, a flat ZIP containing .pmx files, or a folder.
Nested ZIPs (zip-in-zip) are NOT supported — extract them first.

Usage:
    python -m python.intake model.zip
    python -m python.intake model.pmx
    python -m python.intake ./models-folder
    python -m python.intake model.zip --output ./out
    python -m python.intake model.zip --scale 0.08 --no-spring --no-rename --no-validate
"""

import argparse
import os
import sys
import tempfile
import zipfile
from pathlib import Path

# Encodings to try when zip filenames are not UTF-8 (flag bit 11 unset).
# Order matters: most common CJK encodings first.
_FALLBACK_ENCODINGS = ["gbk", "shift_jis", "euc-kr", "big5"]

# Encoding roundtrips for UTF-8 flagged mojibake recovery.
# Covers ZIPs where CJK filenames were encoded in A, decoded as B, stored as UTF-8.
_UTF8_MOJIBAKE_ROUNDTRIPS = [
    ("euc-kr", "gbk"),
    ("shift_jis", "gbk"),
    ("big5", "gbk"),
    ("euc-kr", "shift_jis"),
    ("gbk", "shift_jis"),
]


def _is_likely_mojibake(name):
    """Check if a name contains mixed Korean hangul + CJK ideographs (mojibake indicator)."""
    stem = os.path.splitext(name)[0]
    has_hangul = any("\uac00" <= c <= "\ud7af" for c in stem)
    has_cjk = any("\u4e00" <= c <= "\u9fff" for c in stem)
    return has_hangul and has_cjk


def _recover_mojibake(name):
    """Try to recover original CJK name from mojibake.

    Handles two cases:
    1. UTF-8 flagged but double-encoded (GBK→EUC-KR→UTF-8): mixed hangul+CJK
    2. CP437 decoded non-UTF-8 entries: box-drawing / accented latin characters

    Returns recovered name or None if not mojibake.
    """
    stem = os.path.splitext(name)[0]
    ext = os.path.splitext(name)[1]

    if stem.isascii():
        return None

    # Case 1: Mixed Korean+CJK = UTF-8 mojibake
    if _is_likely_mojibake(name):
        for enc_from, enc_to in _UTF8_MOJIBAKE_ROUNDTRIPS:
            try:
                recovered = stem.encode(enc_from).decode(enc_to)
                if not _is_likely_mojibake(recovered + ext):
                    return recovered + ext
            except (UnicodeEncodeError, UnicodeDecodeError):
                continue

    # Case 2: CP437 garbage (non-UTF-8 entry decoded by Python as CP437)
    try:
        raw = stem.encode("cp437")
        for enc in _FALLBACK_ENCODINGS:
            try:
                recovered = raw.decode(enc)
                if recovered != stem:
                    return recovered + ext
            except (UnicodeDecodeError, LookupError):
                continue
    except (UnicodeEncodeError, UnicodeDecodeError):
        pass

    return None


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


def _recover_zip_entry(entry_name, utf8_flag):
    """Recover a ZIP entry name from mojibake.

    Applies per path component (directory + filename separately).
    Returns (recovered_name, is_mojibake).
    """
    parts = entry_name.replace("\\", "/").split("/")
    recovered_parts = []
    any_recovered = False

    for part in parts:
        if not part:
            recovered_parts.append(part)
            continue

        if utf8_flag:
            recovered = _recover_mojibake(part) if _is_likely_mojibake(part) else None
        else:
            decoded = _decode_zip_filename(part)
            recovered = decoded if decoded != part else None

        if recovered:
            recovered_parts.append(recovered)
            any_recovered = True
        else:
            recovered_parts.append(part)

    if any_recovered:
        return "/".join(recovered_parts), True
    return entry_name, False


def _extract_with_encoding_fix(zf, dest_dir):
    """Extract all entries from a ZipFile, fixing CJK filename encoding.

    Handles both non-UTF-8 (CP437 re-decode) and UTF-8 mojibake (roundtrip recovery).
    Returns a dict mapping original zip entry names to their decoded file paths.
    """
    entry_map = {}
    for info in zf.infolist():
        orig_name = info.filename
        utf8_flag = bool(info.flag_bits & 0x800)

        decoded_name, _ = _recover_zip_entry(orig_name, utf8_flag)

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
        (bool, set): Whether all required bones are mapped, and the set of mapped bones.
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


# ── ZIP scanning ──

def _scan_zipfile(zf):
    """Scan a ZipFile for PMX entries. Does not descend into nested zips.

    Detects mojibake entry names and recovers original CJK names.
    """
    results = []
    warnings = []

    for info in zf.infolist():
        entry = info.filename
        lower = entry.lower()
        utf8_flag = bool(info.flag_bits & 0x800)

        if lower.endswith(".pmx"):
            recovered_name, is_mojibake = _recover_zip_entry(entry, utf8_flag)
            pmx_bytes = zf.read(entry)
            humanoid, mapped = is_humanoid(pmx_bytes)
            results.append({
                "name": recovered_name,
                "zip_entry": entry,
                "humanoid": humanoid,
                "mapped_bones": mapped,
                "mapped_count": len(mapped),
                "mojibake": is_mojibake,
            })

        elif lower.endswith(".zip"):
            recovered_name, _ = _recover_zip_entry(entry, utf8_flag)
            warnings.append(recovered_name)

    return results, warnings


def scan_zip(zip_path):
    """Scan a zip for .pmx files (flat only) and classify as humanoid or not.

    Returns:
        (results, warnings) where results is a list of dicts with keys:
        name, zip_entry, humanoid, mapped_bones, mapped_count;
        and warnings is a list of nested .zip entry names found.
    """
    with zipfile.ZipFile(zip_path, "r") as zf:
        return _scan_zipfile(zf)


# ── Folder scanning ──

def scan_folder(folder_path):
    """Scan a folder recursively for .pmx files and classify as humanoid or not.

    Returns:
        List of dicts with keys: name, pmx_path, humanoid, mapped_bones, mapped_count.
    """
    folder_path = Path(folder_path)
    results = []

    for pmx_file in sorted(folder_path.rglob("*.pmx")):
        try:
            pmx_bytes = pmx_file.read_bytes()
            humanoid, mapped = is_humanoid(pmx_bytes)
            results.append({
                "name": str(pmx_file.relative_to(folder_path)),
                "pmx_path": str(pmx_file),
                "humanoid": humanoid,
                "mapped_bones": mapped,
                "mapped_count": len(mapped),
            })
        except Exception:
            pass  # Unreadable PMX, skip

    return results


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
    entry_map = None

    result_paths = []

    for r in scan_results:
        if entry_map is None:
            with zipfile.ZipFile(zip_str, "r") as zf:
                entry_map = _extract_with_encoding_fix(zf, tmp_dir)

        pmx_path = entry_map[r["zip_entry"]]
        result_paths.append((r, pmx_path))

    return result_paths


# ── Core conversion for a single PMX ──

def _convert_one(pmx_path, display_name, output_dir, output_paths, *,
                 scale, no_spring, no_rename, no_validate, name=None):
    """Convert a single PMX file to VRM. Returns the final output path."""
    from . import bone_mapping, gltf_builder
    from . import pmx_reader as pmx_mod
    from . import spring_converter, vrm_builder, vrm_validator
    from .vrm_renamer import rename_vrm
    from .__main__ import build_glb_buffer

    original_name = Path(pmx_path).name

    print(f"\nConverting: {display_name}")
    pmx_data = pmx_mod.read(pmx_path, scale=scale)
    print(f"  Vertices: {len(pmx_data['positions'])}, "
          f"Bones: {len(pmx_data['bones'])}, "
          f"Materials: {len(pmx_data['materials'])}")

    gltf_data = gltf_builder.build(pmx_data)
    humanoid_bones = bone_mapping.map_bones(
        pmx_data["bones"],
        pmx_data["skinned_bone_indices"],
    )

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

    glb_buffer = build_glb_buffer(gltf_data)

    # Rename step
    if name:
        # User-specified output name — ensure .vrm extension
        vrm_name = name if name.lower().endswith(".vrm") else f"{name}.vrm"
        final_buffer = glb_buffer
        print(f"  Output name: {vrm_name}")
    elif no_rename:
        # Use original PMX stem with .vrm extension
        stem = Path(original_name).stem
        vrm_name = f"{stem}.vrm"
        final_buffer = glb_buffer
    else:
        final_buffer, vrm_name = rename_vrm(glb_buffer, original_name)
        print(f"  Renamed: {original_name} -> {vrm_name}")

    vrm_stem = Path(vrm_name).stem
    vrm_path = output_dir / vrm_name

    # Avoid overwriting: append _2, _3, etc.
    counter = 2
    while vrm_path.exists() or str(vrm_path) in output_paths:
        vrm_path = output_dir / f"{vrm_stem}_{counter}.vrm"
        counter += 1

    with open(str(vrm_path), "wb") as f:
        f.write(final_buffer)

    # Validate step
    if not no_validate:
        result = vrm_validator.validate(str(vrm_path))
        errors = sum(1 for i in result.issues if i.severity.value == "ERROR")
        warns = sum(1 for i in result.issues if i.severity.value == "WARNING")
        if result.valid:
            parts = ["VALID"]
            if warns > 0:
                parts.append(f"{warns} warning{'s' if warns != 1 else ''}")
            print(f"  Validate: {', '.join(parts)}")
        else:
            print(f"  Validate: INVALID ({errors} error{'s' if errors != 1 else ''}, "
                  f"{warns} warning{'s' if warns != 1 else ''})")

    print(f"  -> {vrm_path}")
    return str(vrm_path)


# ── Public API ──

def process(input_path, output_dir=None, scale=0.08,
            no_spring=False, no_rename=False, no_validate=False, name=None):
    """Process input: find humanoid PMX files, convert each to VRM.

    Auto-detects input type: single .pmx file, .zip archive, or folder.

    Args:
        input_path: Path to .pmx file, .zip archive, or folder.
        output_dir: Output directory. Default: same directory as input.
        scale: Position scale factor (default 0.08).
        no_spring: Skip spring bone conversion.
        no_rename: Skip ASCII rename step.
        no_validate: Skip VRM validation step.
        name: Custom output VRM filename (without or with .vrm extension).

    Returns:
        List of output VRM file paths.

    Raises:
        FileNotFoundError: If input doesn't exist.
        ValueError: If no .pmx files found.
        RuntimeError: If no humanoid PMX models found.
    """
    input_path = Path(input_path)
    if not input_path.exists():
        raise FileNotFoundError(f"Input not found: {input_path}")

    is_dir = input_path.is_dir()
    is_pmx = input_path.suffix.lower() == ".pmx"

    if output_dir is None:
        output_dir = input_path if is_dir else input_path.parent
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    convert_kwargs = dict(
        scale=scale,
        no_spring=no_spring,
        no_rename=no_rename,
        no_validate=no_validate,
        name=name,
    )

    if is_pmx:
        return _process_single_pmx(input_path, output_dir, convert_kwargs)
    elif is_dir:
        return _process_folder(input_path, output_dir, convert_kwargs)
    else:
        return _process_zip(input_path, output_dir, convert_kwargs)


def _process_single_pmx(pmx_path, output_dir, convert_kwargs):
    """Process a single PMX file directly."""
    pmx_bytes = pmx_path.read_bytes()
    humanoid, mapped = is_humanoid(pmx_bytes)

    from .bone_mapping import VRM_REQUIRED_BONES
    tag = "humanoid" if humanoid else "SKIP"
    print(f"  {pmx_path.name} — {tag} ({len(mapped)}/{len(VRM_REQUIRED_BONES)} required bones)")

    if not humanoid:
        raise RuntimeError(
            f"Not a humanoid PMX: {pmx_path.name}. "
            f"Only {len(mapped)}/{len(VRM_REQUIRED_BONES)} required bones mapped."
        )

    output_paths = []
    final_path = _convert_one(
        str(pmx_path), pmx_path.name, output_dir, output_paths,
        **convert_kwargs,
    )
    output_paths.append(final_path)

    print(f"\nDone. {len(output_paths)} model(s) converted.")
    return output_paths


def _process_folder(folder_path, output_dir, convert_kwargs):
    """Process a folder of PMX files."""
    from .bone_mapping import VRM_REQUIRED_BONES

    print(f"Scanning folder: {folder_path}")
    results = scan_folder(str(folder_path))

    if not results:
        raise ValueError(f"No .pmx files found in {folder_path}")

    humanoids = [r for r in results if r["humanoid"]]

    for r in results:
        tag = "humanoid" if r["humanoid"] else "SKIP"
        print(f"  {r['name']} — {tag} ({r['mapped_count']}/{len(VRM_REQUIRED_BONES)} required bones)")

    if not humanoids:
        raise RuntimeError(
            f"No humanoid PMX found in {folder_path}. "
            f"Checked {len(results)} .pmx file(s)."
        )

    output_paths = []
    for entry in humanoids:
        final_path = _convert_one(
            entry["pmx_path"], entry["name"], output_dir, output_paths,
            **convert_kwargs,
        )
        output_paths.append(final_path)

    print(f"\nDone. {len(output_paths)} model(s) converted.")
    return output_paths


def _process_zip(zip_path, output_dir, convert_kwargs):
    """Process a ZIP archive of PMX files."""
    from .bone_mapping import VRM_REQUIRED_BONES

    print(f"Scanning: {zip_path.name}")
    results, warnings = scan_zip(str(zip_path))

    for nested in warnings:
        print(f"  \u26A0 Nested ZIP detected: {nested}. Extract it first, then convert the inner folder/zip.")

    if not results:
        raise ValueError(f"No .pmx files found in {zip_path.name}")

    humanoids = [r for r in results if r["humanoid"]]

    for r in results:
        tag = "humanoid" if r["humanoid"] else "SKIP"
        mojibake_hint = " (mojibake recovered)" if r.get("mojibake") else ""
        print(f"  {r['name']} — {tag} ({r['mapped_count']}/{len(VRM_REQUIRED_BONES)} required bones){mojibake_hint}")

    if not humanoids:
        raise RuntimeError(
            f"No humanoid PMX found in {zip_path.name}. "
            f"Checked {len(results)} .pmx file(s)."
        )

    output_paths = []

    with tempfile.TemporaryDirectory() as tmp_dir:
        pmx_files = extract_pmx_files(zip_path, humanoids, tmp_dir)

        for scan_result, pmx_path in pmx_files:
            final_path = _convert_one(
                pmx_path, scan_result["name"], output_dir, output_paths,
                **convert_kwargs,
            )
            output_paths.append(final_path)

    print(f"\nDone. {len(output_paths)} model(s) converted.")
    return output_paths


def main():
    parser = argparse.ArgumentParser(
        description="PMX -> VRM conversion (folder, ZIP, or single PMX input)")
    parser.add_argument("input", help="Input .pmx file, .zip archive, or folder")
    parser.add_argument("--output", "-o", help="Output directory (default: same as input)")
    parser.add_argument("--scale", type=float, default=0.08, help="Scale factor (default: 0.08)")
    parser.add_argument("--no-spring", action="store_true", help="Skip spring bones")
    parser.add_argument("--no-rename", action="store_true", help="Skip ASCII rename")
    parser.add_argument("--no-validate", action="store_true", help="Skip VRM validation")
    parser.add_argument("--name", help="Custom output VRM filename (e.g. MyCharacter)")
    args = parser.parse_args()

    try:
        process(
            args.input,
            output_dir=args.output,
            scale=args.scale,
            no_spring=args.no_spring,
            no_rename=args.no_rename,
            no_validate=args.no_validate,
            name=args.name,
        )
    except (FileNotFoundError, ValueError, RuntimeError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
