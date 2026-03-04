#!/usr/bin/env python3
"""Parse VMD bone motion data for IK sizing analysis.

Extracts position/rotation keyframes for specific bones,
prints statistics (min/max/mean Y values, frame ranges).

Usage: python3 parse-vmd-tracks.py <vmd_file> [--bone <name>] [--all]
"""

import struct
import sys
import json
from pathlib import Path
from collections import defaultdict


def parse_vmd(filepath):
    """Parse VMD file and return bone keyframes grouped by bone name."""
    with open(filepath, 'rb') as f:
        # Header
        magic = f.read(30)
        if b'Vocaloid Motion Data' not in magic:
            raise ValueError(f'Not a VMD file')

        model_name_raw = f.read(20)
        try:
            model_name = model_name_raw.split(b'\x00')[0].decode('shift_jis')
        except:
            model_name = model_name_raw.hex()

        print(f'VMD Model: {model_name}')

        # Bone keyframes
        bone_count = struct.unpack('<I', f.read(4))[0]
        print(f'Bone keyframes: {bone_count}')

        bones = defaultdict(list)

        for _ in range(bone_count):
            name_raw = f.read(15)
            try:
                name = name_raw.split(b'\x00')[0].decode('shift_jis')
            except:
                name = name_raw.hex()

            frame = struct.unpack('<I', f.read(4))[0]
            pos = struct.unpack('<3f', f.read(12))
            rot = struct.unpack('<4f', f.read(16))
            interp = f.read(64)

            bones[name].append({
                'frame': frame,
                'position': list(pos),
                'rotation': list(rot),
            })

        # Sort by frame
        for name in bones:
            bones[name].sort(key=lambda k: k['frame'])

        # Morph keyframes
        morph_count = struct.unpack('<I', f.read(4))[0]
        print(f'Morph keyframes: {morph_count}')

        return model_name, dict(bones)


def print_bone_stats(name, keyframes):
    """Print statistics for a bone's keyframes."""
    if not keyframes:
        print(f'  {name}: no keyframes')
        return

    xs = [k['position'][0] for k in keyframes]
    ys = [k['position'][1] for k in keyframes]
    zs = [k['position'][2] for k in keyframes]
    frames = [k['frame'] for k in keyframes]

    print(f'\n  {name}  ({len(keyframes)} keyframes, frames {min(frames)}~{max(frames)})')
    print(f'    X: min={min(xs):>8.3f}  max={max(xs):>8.3f}  mean={sum(xs)/len(xs):>8.3f}')
    print(f'    Y: min={min(ys):>8.3f}  max={max(ys):>8.3f}  mean={sum(ys)/len(ys):>8.3f}')
    print(f'    Z: min={min(zs):>8.3f}  max={max(zs):>8.3f}  mean={sum(zs)/len(zs):>8.3f}')

    # Find frames where Y is near minimum (ground contact candidates)
    y_sorted = sorted(ys)
    y_5th = y_sorted[max(0, len(y_sorted) // 20)]  # 5th percentile
    ground_frames = [(k['frame'], k['position'][1]) for k in keyframes if k['position'][1] <= y_5th + 0.1]
    if ground_frames:
        print(f'    Ground contact candidates (Y ≤ {y_5th + 0.1:.3f}):')
        for gf, gy in ground_frames[:10]:
            print(f'      frame {gf}: Y={gy:.3f}')
        if len(ground_frames) > 10:
            print(f'      ... +{len(ground_frames) - 10} more')


def main():
    if len(sys.argv) < 2:
        print(f'Usage: {sys.argv[0]} <vmd_file> [--bone <name>] [--all] [--json]')
        sys.exit(1)

    filepath = sys.argv[1]
    filter_bone = None
    show_all = False
    output_json = False

    for i, arg in enumerate(sys.argv[2:], 2):
        if arg == '--bone' and i + 1 < len(sys.argv):
            filter_bone = sys.argv[i + 1]
        if arg == '--all':
            show_all = True
        if arg == '--json':
            output_json = True

    model_name, bones = parse_vmd(filepath)

    if output_json:
        if filter_bone:
            data = {filter_bone: bones.get(filter_bone, [])}
        else:
            data = bones
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return

    # Key bones for IK sizing
    KEY_BONES = ['センター', 'グルーブ', '左足ＩＫ', '右足ＩＫ',
                 '左つま先ＩＫ', '右つま先ＩＫ', '全ての親']

    print(f'\n{"="*60}')
    print(f'All bones with keyframes ({len(bones)} unique):')
    for name, kfs in sorted(bones.items(), key=lambda x: -len(x[1])):
        print(f'  {name}: {len(kfs)} keyframes')

    print(f'\n{"="*60}')
    print('Position track statistics:')

    if filter_bone:
        if filter_bone in bones:
            print_bone_stats(filter_bone, bones[filter_bone])
        else:
            print(f'  Bone "{filter_bone}" not found in VMD')
    elif show_all:
        for name in sorted(bones.keys()):
            print_bone_stats(name, bones[name])
    else:
        for name in KEY_BONES:
            if name in bones:
                print_bone_stats(name, bones[name])
            else:
                print(f'\n  {name}: NOT in VMD')


if __name__ == '__main__':
    main()
