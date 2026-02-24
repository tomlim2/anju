"""Convert PMX rigid body + joint data to VRM 0.x secondaryAnimation.

Pipeline:
  1. Classify rigid bodies (mode 0 -> collider, mode 1/2 -> spring)
  2. Build joint graph and discover dynamic chains via DFS
  3. Convert chains to VRM boneGroups with mapped parameters
  4. Convert mode 0 bodies to colliderGroups (sphere only)
"""

from collections import defaultdict


def convert(rigid_bodies, joints, bones):
    """Convert PMX physics to VRM 0.x secondaryAnimation.

    Args:
        rigid_bodies: List of rigid body dicts from pmx_reader.
        joints: List of joint dicts from pmx_reader.
        bones: List of bone dicts from pmx_reader.

    Returns:
        dict with "boneGroups" and "colliderGroups" in VRM 0.x format.
    """
    if not rigid_bodies:
        return {"boneGroups": [], "colliderGroups": []}

    num_rb = len(rigid_bodies)

    # Step 1: Classify rigid bodies
    static_indices = []    # mode 0 -> potential colliders
    dynamic_indices = []   # mode 1,2 -> spring bone sources

    for i, rb in enumerate(rigid_bodies):
        if rb["mode"] == 0:
            static_indices.append(i)
        else:
            dynamic_indices.append(i)

    dynamic_set = set(dynamic_indices)

    # Step 2: Build adjacency graph from joints
    adj = defaultdict(list)
    joint_params = {}

    for j in joints:
        a = j["rigidbody_index_a"]
        b = j["rigidbody_index_b"]
        if a < 0 or b < 0 or a >= num_rb or b >= num_rb:
            continue
        adj[a].append(b)
        adj[b].append(a)
        joint_params[(a, b)] = j
        joint_params[(b, a)] = j

    # Step 3: Discover dynamic chains via DFS from static bodies
    visited = set()
    chains = []

    for static_rb in static_indices:
        for neighbor in adj[static_rb]:
            if neighbor in dynamic_set and neighbor not in visited:
                chain = []
                stack = [neighbor]
                while stack:
                    current = stack.pop()
                    if current in visited or current not in dynamic_set:
                        continue
                    visited.add(current)
                    chain.append(current)
                    for next_rb in adj[current]:
                        if next_rb in dynamic_set and next_rb not in visited:
                            stack.append(next_rb)
                if chain:
                    chains.append(chain)

    # Catch isolated dynamic bodies
    for rb_idx in dynamic_indices:
        if rb_idx not in visited:
            visited.add(rb_idx)
            chains.append([rb_idx])

    # Step 4: Convert chains to boneGroups
    bone_groups = []

    for chain in chains:
        if not chain:
            continue

        bone_indices = []
        for rb_idx in chain:
            bi = rigid_bodies[rb_idx]["bone_index"]
            if 0 <= bi < len(bones):
                bone_indices.append(bi)

        if not bone_indices:
            continue

        # Average parameters across the chain
        n = len(chain)
        avg_drag = sum(rigid_bodies[i]["linear_damping"] for i in chain) / n
        avg_mass = sum(rigid_bodies[i]["mass"] for i in chain) / n
        avg_hit_radius = sum(rigid_bodies[i]["shape_size"][0] for i in chain) / n

        # Collect spring rotation constants from connected joints
        spring_rot_values = []
        for rb_idx in chain:
            for other_rb in adj[rb_idx]:
                key = (rb_idx, other_rb)
                if key in joint_params:
                    scr = joint_params[key]["spring_constant_rotation"]
                    avg_val = sum(abs(v) for v in scr) / 3.0
                    spring_rot_values.append(avg_val)

        avg_spring_rot = (
            sum(spring_rot_values) / len(spring_rot_values)
            if spring_rot_values else 50.0
        )

        # Parameter mapping
        drag_force = max(0.0, min(1.0, avg_drag))
        stiffiness = max(0.0, min(4.0, avg_spring_rot / 200.0))
        gravity_power = max(0.0, min(2.0, avg_mass * 0.5))
        hit_radius = max(0.0, avg_hit_radius)

        bone_groups.append({
            "stiffiness": round(stiffiness, 4),       # Double-i: VRM 0.x spec typo!
            "gravityPower": round(gravity_power, 4),
            "gravityDir": {"x": 0, "y": -1, "z": 0},  # Object, NOT array
            "dragForce": round(drag_force, 4),
            "hitRadius": round(hit_radius, 4),
            "bones": bone_indices,
            "colliderGroups": [],   # Populated below
            "center": -1,
            "comment": "",
        })

    # Step 5: Build colliderGroups from static rigid bodies
    collider_by_bone = defaultdict(list)

    for rb_idx in static_indices:
        rb = rigid_bodies[rb_idx]
        bi = rb["bone_index"]
        if bi < 0 or bi >= len(bones):
            continue

        # Sphere approximation for all shapes
        if rb["shape_type"] == 0:       # Sphere
            radius = rb["shape_size"][0]
        elif rb["shape_type"] == 2:     # Capsule -> use radius
            radius = rb["shape_size"][0]
        else:                            # Box -> approximate
            radius = max(rb["shape_size"]) * 0.5

        # Offset relative to bone position (already in glTF coordinate space)
        bone_pos = bones[bi]["position"]
        offset_x = rb["shape_position"][0] - bone_pos[0]
        offset_y = rb["shape_position"][1] - bone_pos[1]
        offset_z = rb["shape_position"][2] - bone_pos[2]

        collider_by_bone[bi].append({
            "offset": {
                "x": round(float(offset_x), 6),
                "y": round(float(offset_y), 6),
                "z": round(float(offset_z), 6),
            },
            "radius": round(float(radius), 6),
        })

    collider_groups = []
    cg_bone_map = {}   # bone_index -> colliderGroup index

    for bi in sorted(collider_by_bone.keys()):
        cg_idx = len(collider_groups)
        cg_bone_map[bi] = cg_idx
        collider_groups.append({
            "node": bi,
            "colliders": collider_by_bone[bi],
        })

    # Link bone groups to relevant collider groups
    for bg in bone_groups:
        relevant = set()
        for bone_idx in bg["bones"]:
            # Walk up hierarchy to find ancestor bones with colliders
            current = bone_idx
            depth = 0
            while current >= 0 and depth < 10:
                if current in cg_bone_map:
                    relevant.add(cg_bone_map[current])
                parent = bones[current]["parent_index"]
                if parent < 0 or parent >= len(bones):
                    break
                current = parent
                depth += 1

        # Also include head/chest colliders (commonly affect hair/clothing)
        for bi, cg_idx in cg_bone_map.items():
            if bones[bi]["name"] in ("頭", "上半身", "上半身2"):
                relevant.add(cg_idx)

        bg["colliderGroups"] = sorted(relevant)

    return {
        "boneGroups": bone_groups,
        "colliderGroups": collider_groups,
    }
