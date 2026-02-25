"""CLI entry point for PMX -> VRM 0.x conversion.

Usage:
    python -m truepmx2vrm input.pmx output.vrm
    python -m truepmx2vrm input.pmx output.vrm --scale 0.08 --no-spring
"""

import argparse
import json
import struct
import sys


def write_glb(gltf_data, output_path):
    """Write glTF data as GLB binary with proper 4-byte alignment.

    GLB layout:
      [12-byte header: magic + version + total_length]
      [JSON chunk: length + type(0x4E4F534A) + data (space-padded)]
      [BIN chunk:  length + type(0x004E4942) + data (null-padded)]
    """
    json_str = json.dumps(gltf_data["json"], ensure_ascii=False, separators=(",", ":"))
    json_bytes = json_str.encode("utf-8")

    # Pad JSON to 4-byte alignment with spaces
    json_pad = (4 - len(json_bytes) % 4) % 4
    json_bytes += b" " * json_pad

    bin_data = bytearray(gltf_data["bin"])
    # Pad BIN to 4-byte alignment with null bytes
    bin_pad = (4 - len(bin_data) % 4) % 4
    bin_data += b"\x00" * bin_pad

    total_length = 12 + 8 + len(json_bytes) + 8 + len(bin_data)

    with open(output_path, "wb") as f:
        # GLB header
        f.write(struct.pack("<III", 0x46546C67, 2, total_length))
        # JSON chunk
        f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
        f.write(json_bytes)
        # BIN chunk
        f.write(struct.pack("<II", len(bin_data), 0x004E4942))
        f.write(bytes(bin_data))


def main():
    parser = argparse.ArgumentParser(
        description="Convert PMX to VRM 0.x (.vrm) with spring bone preservation",
    )
    parser.add_argument("input", help="Input PMX file path")
    parser.add_argument("output", help="Output VRM file path (.vrm)")
    parser.add_argument(
        "--scale", type=float, default=0.08,
        help="Position scale factor (default: 0.08, i.e. 1 PMX unit = 8cm)",
    )
    parser.add_argument(
        "--no-spring", action="store_true",
        help="Skip spring bone conversion",
    )
    args = parser.parse_args()

    from . import pmx_reader, gltf_builder, bone_mapping, spring_converter, vrm_builder

    # 1. Read PMX
    print(f"Reading PMX: {args.input}")
    pmx_data = pmx_reader.read(args.input, scale=args.scale)
    print(f"  Vertices:     {len(pmx_data['positions'])}")
    print(f"  Bones:        {len(pmx_data['bones'])}")
    print(f"  Materials:    {len(pmx_data['materials'])}")
    print(f"  Textures:     {len(pmx_data['textures'])}")
    print(f"  Rigid bodies: {len(pmx_data['rigid_bodies'])}")
    print(f"  Joints:       {len(pmx_data['joints_phys'])}")

    # 2. Build glTF skeleton / mesh / textures
    print("Building glTF skeleton/mesh/textures...")
    gltf_data = gltf_builder.build(pmx_data)

    # 3. Map bones to VRM humanoid
    print("Mapping bones to VRM humanoid...")
    humanoid_bones = bone_mapping.map_bones(pmx_data["bones"])
    print(f"  Mapped {len(humanoid_bones)} humanoid bones")

    # 4. Convert physics to spring bones
    if args.no_spring:
        secondary_animation = {"boneGroups": [], "colliderGroups": []}
        print("Skipping spring bone conversion (--no-spring)")
    else:
        print("Converting physics to spring bones...")
        secondary_animation = spring_converter.convert(
            pmx_data["rigid_bodies"],
            pmx_data["joints_phys"],
            pmx_data["bones"],
        )
        print(f"  Bone groups:    {len(secondary_animation['boneGroups'])}")
        print(f"  Collider groups: {len(secondary_animation['colliderGroups'])}")

    # 5. Build VRM 0.x extension
    print("Building VRM 0.x extension...")
    gltf_data = vrm_builder.build(
        gltf_data, humanoid_bones, secondary_animation, pmx_data["materials"],
    )

    # 6. Write GLB
    print(f"Writing GLB: {args.output}")
    write_glb(gltf_data, args.output)
    print("Done.")


if __name__ == "__main__":
    main()
