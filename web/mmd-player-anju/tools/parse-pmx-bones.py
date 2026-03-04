#!/usr/bin/env python3
"""Parse PMX bone positions for IK sizing analysis.

Extracts bone names, world positions (rest pose), parent indices,
and IK chain info from a PMX 2.0/2.1 file.

Usage: python3 parse-pmx-bones.py <pmx_file> [--filter <keyword>]
"""

import struct
import sys
import json
from pathlib import Path


def read_text(f, encoding_flag):
    """Read PMX text field (length-prefixed)."""
    size = struct.unpack('<i', f.read(4))[0]
    if size <= 0:
        return ''
    raw = f.read(size)
    enc = 'utf-16-le' if encoding_flag == 0 else 'utf-8'
    return raw.decode(enc, errors='replace')


def read_index(f, index_size):
    """Read variable-size index."""
    if index_size == 1:
        return struct.unpack('<b', f.read(1))[0]
    elif index_size == 2:
        return struct.unpack('<h', f.read(2))[0]
    elif index_size == 4:
        return struct.unpack('<i', f.read(4))[0]
    return -1


def parse_pmx_bones(filepath):
    """Parse PMX file and return bone data."""
    with open(filepath, 'rb') as f:
        # Header
        magic = f.read(4)
        if magic != b'PMX ':
            raise ValueError(f'Not a PMX file: {magic}')

        version = struct.unpack('<f', f.read(4))[0]
        globals_count = struct.unpack('<b', f.read(1))[0]
        globals_data = f.read(globals_count)

        encoding_flag = globals_data[0]
        additional_vec4 = globals_data[1]
        vertex_index_size = globals_data[2]
        texture_index_size = globals_data[3]
        material_index_size = globals_data[4]
        bone_index_size = globals_data[5]
        morph_index_size = globals_data[6]
        rigidbody_index_size = globals_data[7]

        # Model info
        name_jp = read_text(f, encoding_flag)
        name_en = read_text(f, encoding_flag)
        comment_jp = read_text(f, encoding_flag)
        comment_en = read_text(f, encoding_flag)

        print(f'Model: {name_jp} (v{version})')
        print(f'Encoding: {"UTF-16LE" if encoding_flag == 0 else "UTF-8"}')
        print(f'Bone index size: {bone_index_size} bytes')
        print()

        # Skip vertices
        vertex_count = struct.unpack('<i', f.read(4))[0]
        for _ in range(vertex_count):
            f.read(12)  # position
            f.read(12)  # normal
            f.read(8)   # uv
            f.read(16 * additional_vec4)  # additional vec4s
            weight_type = struct.unpack('<b', f.read(1))[0]
            if weight_type == 0:  # BDEF1
                read_index(f, bone_index_size)
            elif weight_type == 1:  # BDEF2
                read_index(f, bone_index_size)
                read_index(f, bone_index_size)
                f.read(4)  # weight
            elif weight_type == 2:  # BDEF4
                for _ in range(4):
                    read_index(f, bone_index_size)
                f.read(16)  # 4 weights
            elif weight_type == 3:  # SDEF
                read_index(f, bone_index_size)
                read_index(f, bone_index_size)
                f.read(4)   # weight
                f.read(12)  # C
                f.read(12)  # R0
                f.read(12)  # R1
            elif weight_type == 4:  # QDEF
                for _ in range(4):
                    read_index(f, bone_index_size)
                f.read(16)
            f.read(4)  # edge scale

        # Skip faces
        face_count = struct.unpack('<i', f.read(4))[0]
        for _ in range(face_count):
            read_index(f, vertex_index_size)

        # Skip textures
        texture_count = struct.unpack('<i', f.read(4))[0]
        for _ in range(texture_count):
            read_text(f, encoding_flag)

        # Skip materials
        material_count = struct.unpack('<i', f.read(4))[0]
        for _ in range(material_count):
            read_text(f, encoding_flag)  # name jp
            read_text(f, encoding_flag)  # name en
            f.read(16)  # diffuse
            f.read(12)  # specular
            f.read(4)   # specular strength
            f.read(12)  # ambient (PMX 2.0) / 16 bytes in some versions
            f.read(1)   # drawing flags
            f.read(16)  # edge color
            f.read(4)   # edge size
            read_index(f, texture_index_size)  # texture
            read_index(f, texture_index_size)  # sphere texture
            f.read(1)   # sphere mode
            toon_flag = struct.unpack('<b', f.read(1))[0]
            if toon_flag == 0:
                read_index(f, texture_index_size)
            else:
                f.read(1)
            read_text(f, encoding_flag)  # memo
            f.read(4)   # face count

        # Parse bones
        bone_count = struct.unpack('<i', f.read(4))[0]
        print(f'Bone count: {bone_count}')
        print('=' * 80)

        bones = []
        for i in range(bone_count):
            name_jp = read_text(f, encoding_flag)
            name_en = read_text(f, encoding_flag)
            pos = struct.unpack('<3f', f.read(12))
            parent_idx = read_index(f, bone_index_size)
            transform_class = struct.unpack('<i', f.read(4))[0]
            flag = struct.unpack('<H', f.read(2))[0]

            bone = {
                'index': i,
                'name': name_jp,
                'name_en': name_en,
                'position': list(pos),  # WORLD position
                'parent': parent_idx,
                'flag': flag,
                'ik': None,
            }

            # Connect type
            if flag & 0x0001:
                read_index(f, bone_index_size)
            else:
                f.read(12)

            # Grant (inherit rotation/translation)
            if flag & 0x0100 or flag & 0x0200:
                read_index(f, bone_index_size)
                f.read(4)

            # Fixed axis
            if flag & 0x0400:
                f.read(12)

            # Local coordinate
            if flag & 0x0800:
                f.read(12)  # X vector
                f.read(12)  # Z vector

            # External parent
            if flag & 0x2000:
                f.read(4)

            # IK
            if flag & 0x0020:
                effector = read_index(f, bone_index_size)
                iteration = struct.unpack('<i', f.read(4))[0]
                max_angle = struct.unpack('<f', f.read(4))[0]
                link_count = struct.unpack('<i', f.read(4))[0]
                links = []
                for _ in range(link_count):
                    link_idx = read_index(f, bone_index_size)
                    has_limit = struct.unpack('<b', f.read(1))[0]
                    lower = upper = None
                    if has_limit:
                        lower = struct.unpack('<3f', f.read(12))
                        upper = struct.unpack('<3f', f.read(12))
                    links.append({
                        'bone_index': link_idx,
                        'has_limit': bool(has_limit),
                        'lower': list(lower) if lower else None,
                        'upper': list(upper) if upper else None,
                    })
                bone['ik'] = {
                    'effector': effector,
                    'iteration': iteration,
                    'max_angle': max_angle,
                    'links': links,
                }

            bones.append(bone)

        return bones


def main():
    if len(sys.argv) < 2:
        print(f'Usage: {sys.argv[0]} <pmx_file> [--filter <keyword>] [--json]')
        sys.exit(1)

    filepath = sys.argv[1]
    keyword = None
    output_json = False

    for i, arg in enumerate(sys.argv[2:], 2):
        if arg == '--filter' and i + 1 < len(sys.argv):
            keyword = sys.argv[i + 1]
        if arg == '--json':
            output_json = True

    bones = parse_pmx_bones(filepath)

    # Key bones for IK sizing
    KEY_BONES = ['全ての親', 'センター', 'グルーブ', '腰',
                 '左足', '右足', '左ひざ', '右ひざ',
                 '左足首', '右足首', '左つま先', '右つま先',
                 '左足ＩＫ', '右足ＩＫ', '左つま先ＩＫ', '右つま先ＩＫ',
                 '左足IK親', '右足IK親']

    if output_json:
        result = []
        for b in bones:
            if keyword and keyword not in b['name'] and keyword not in (b['name_en'] or ''):
                continue
            result.append(b)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    print(f'\n{"idx":>4}  {"name":<16} {"parent":>6}  {"posX":>8} {"posY":>8} {"posZ":>8}  {"flags"}')
    print('-' * 80)

    for b in bones:
        show = False
        if keyword:
            show = keyword in b['name'] or keyword in (b['name_en'] or '')
        else:
            show = b['name'] in KEY_BONES

        if not show:
            continue

        ik_mark = ' [IK]' if b['ik'] else ''
        parent_name = bones[b['parent']]['name'] if 0 <= b['parent'] < len(bones) else '(root)'
        print(f'{b["index"]:>4}  {b["name"]:<16} {parent_name:>16}  '
              f'{b["position"][0]:>8.3f} {b["position"][1]:>8.3f} {b["position"][2]:>8.3f}'
              f'{ik_mark}')

        if b['ik']:
            eff = bones[b['ik']['effector']]
            print(f'       IK → effector: {eff["name"]}, iter={b["ik"]["iteration"]}, maxAngle={b["ik"]["max_angle"]:.4f}')
            for link in b['ik']['links']:
                ln = bones[link['bone_index']]
                lim = f' limit={link["lower"]}~{link["upper"]}' if link['has_limit'] else ''
                print(f'       chain: {ln["name"]}{lim}')


if __name__ == '__main__':
    main()
