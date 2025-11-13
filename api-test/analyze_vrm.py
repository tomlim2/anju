import struct
import json

file_path = '1763017370392'

with open(file_path, 'rb') as f:
    # GLB Header (12 bytes)
    magic = f.read(4)
    version = struct.unpack('<I', f.read(4))[0]
    length = struct.unpack('<I', f.read(4))[0]

    print(f"GLB Header:")
    print(f"  Magic: {magic}")
    print(f"  Version: {version}")
    print(f"  Total Length: {length:,} bytes")
    print()

    # First Chunk (JSON)
    chunk_length = struct.unpack('<I', f.read(4))[0]
    chunk_type = f.read(4)

    print(f"First Chunk:")
    print(f"  Length: {chunk_length:,} bytes")
    print(f"  Type: {chunk_type}")
    print()

    # Read JSON data
    json_data = f.read(chunk_length).decode('utf-8')
    gltf = json.loads(json_data)

    print("GLTF Asset Info:")
    print(f"  Generator: {gltf.get('asset', {}).get('generator', 'N/A')}")
    print(f"  Version: {gltf.get('asset', {}).get('version', 'N/A')}")
    print()

    # VRM Extension
    if 'extensions' in gltf and 'VRM' in gltf['extensions']:
        vrm = gltf['extensions']['VRM']
        print("VRM Information:")

        if 'meta' in vrm:
            meta = vrm['meta']
            print(f"  Title: {meta.get('title', 'N/A')}")
            print(f"  Version: {meta.get('version', 'N/A')}")
            print(f"  Author: {meta.get('author', 'N/A')}")
            print(f"  Contact: {meta.get('contactInformation', 'N/A')}")
            print(f"  Reference: {meta.get('reference', 'N/A')}")
            print()

        if 'humanoid' in vrm:
            print(f"  Humanoid Bones: {len(vrm['humanoid'].get('humanBones', []))}")

        if 'blendShapeMaster' in vrm:
            print(f"  Blend Shapes: {len(vrm['blendShapeMaster'].get('blendShapeGroups', []))}")

    print()
    print("Scene Contents:")
    print(f"  Meshes: {len(gltf.get('meshes', []))}")
    print(f"  Materials: {len(gltf.get('materials', []))}")
    print(f"  Textures: {len(gltf.get('textures', []))}")
    print(f"  Images: {len(gltf.get('images', []))}")
    print(f"  Nodes: {len(gltf.get('nodes', []))}")
    print(f"  Skins: {len(gltf.get('skins', []))}")
    print(f"  Animations: {len(gltf.get('animations', []))}")
