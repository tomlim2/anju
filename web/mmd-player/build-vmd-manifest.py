#!/usr/bin/env python3
"""Scan vmd/ directory and generate a manifest.json for mmd-player.

For each leaf folder containing both a motion VMD and an audio file,
creates an entry grouped by artist.

Usage:
    python build-vmd-manifest.py [vmd_root]

If no argument is given, uses ./data/vmd as default.
"""

import json
import os
import re
import sys

VMD_EXTS = {'.vmd'}
AUDIO_EXTS = {'.wav', '.ogg', '.mp3'}

# VMD filenames to skip (camera, facial, lipsync, etc.)
SKIP_PATTERNS = re.compile(
    r'(camera|facials?|lipsync|lip_?sync|fac\b|partner|testcam|'
    r'cam_?mtn|reverse|ball_|light)',
    re.IGNORECASE,
)

# Prefer these names as the main motion VMD
PREFER_NAMES = {'motion.vmd', 'all.vmd'}


def pick_main_vmd(vmd_files):
    """Pick the main body motion VMD from a list of .vmd filenames."""
    # Filter out camera/facial/etc
    candidates = [f for f in vmd_files if not SKIP_PATTERNS.search(f)]
    if not candidates:
        return None

    # Prefer known names
    for c in candidates:
        if os.path.basename(c).lower() in PREFER_NAMES:
            return c

    # If only one candidate, use it
    if len(candidates) == 1:
        return candidates[0]

    # Pick the one with the largest file size (likely the full motion)
    return max(candidates, key=lambda f: os.path.getsize(f))


def pick_audio(audio_files):
    """Pick the best audio file (prefer wav > ogg > mp3)."""
    by_ext = {}
    for f in audio_files:
        ext = os.path.splitext(f)[1].lower()
        by_ext.setdefault(ext, []).append(f)

    for ext in ['.wav', '.ogg', '.mp3']:
        if ext in by_ext:
            return by_ext[ext][0]
    return None


def extract_artist(path, vmd_root):
    """Extract artist name from the path (first directory under vmd_root)."""
    rel = os.path.relpath(path, vmd_root)
    parts = rel.split(os.sep)
    if parts:
        name = parts[0]
        # Strip brackets: [ArtistName] → ArtistName
        if name.startswith('[') and name.endswith(']'):
            name = name[1:-1]
        return name
    return 'Unknown'


def extract_song_name(folder_path, vmd_root):
    """Extract a human-readable song name from the folder path."""
    rel = os.path.relpath(folder_path, vmd_root)
    parts = rel.split(os.sep)
    # Skip artist folder, use the deepest meaningful folder name
    # Skip folders that look like DeviantArt download names (_desc__...)
    meaningful = []
    for p in parts[1:]:
        if p.startswith('_desc__') or p.endswith('.rar'):
            continue
        meaningful.append(p)

    if meaningful:
        return meaningful[-1]
    return os.path.basename(folder_path)


def scan_vmd_root(vmd_root):
    """Walk vmd_root and find all folders with VMD + audio pairs."""
    artists = {}

    for dirpath, dirnames, filenames in os.walk(vmd_root):
        vmd_files = []
        audio_files = []

        for f in filenames:
            ext = os.path.splitext(f)[1].lower()
            full = os.path.join(dirpath, f)
            if ext in VMD_EXTS:
                vmd_files.append(full)
            elif ext in AUDIO_EXTS:
                audio_files.append(full)

        if not vmd_files or not audio_files:
            continue

        main_vmd = pick_main_vmd(vmd_files)
        audio = pick_audio(audio_files)

        if not main_vmd or not audio:
            continue

        artist = extract_artist(dirpath, vmd_root)
        song = extract_song_name(dirpath, vmd_root)

        # Make paths relative to manifest location (one level up from vmd/)
        vmd_rel = os.path.relpath(main_vmd, os.path.dirname(vmd_root))
        audio_rel = os.path.relpath(audio, os.path.dirname(vmd_root))

        artists.setdefault(artist, []).append({
            'name': song,
            'vmd': vmd_rel,
            'audio': audio_rel,
        })

    # Sort artists and songs
    result = []
    for name in sorted(artists.keys()):
        songs = sorted(artists[name], key=lambda s: s['name'])
        result.append({'name': name, 'songs': songs})

    return result


def main():
    if len(sys.argv) > 1:
        vmd_root = sys.argv[1]
    else:
        vmd_root = os.path.join(os.path.dirname(__file__), 'data', 'vmd')

    vmd_root = os.path.abspath(vmd_root)
    if not os.path.isdir(vmd_root):
        print(f'Error: {vmd_root} is not a directory', file=sys.stderr)
        sys.exit(1)

    artists = scan_vmd_root(vmd_root)

    total_songs = sum(len(a['songs']) for a in artists)
    print(f'Found {len(artists)} artists, {total_songs} songs', file=sys.stderr)

    manifest = {'artists': artists}
    out_path = os.path.join(os.path.dirname(__file__), 'data', 'vmd-manifest.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f'Written to {out_path}', file=sys.stderr)


if __name__ == '__main__':
    main()
