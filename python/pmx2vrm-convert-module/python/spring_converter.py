"""Convert PMX rigid body + joint data to VRM 0.x secondaryAnimation.

Replicates VRM4U's PMX physics import pipeline (VrmConvertModel.cpp):

  CreateSwingHead  → Kinematic body on anchor bone  (mode 0 static RB)
  CreateSwingTail  → Simulated bodies on child bones (mode 1/2 dynamic RBs)
  createConstraint → Angular-limited constraint between each pair

Mapping to VRM 0.x:
  - Each spring chain  → one boneGroup
    · bones[]          = ordered bone indices, root → tip (BFS, directed)
    · center           = anchor bone index (the static RB's bone)
    · parameters       = from each RB individually (not averaged)
  - Static RBs         → colliderGroups (sphere approximation)
  - Dynamic×dynamic RB collisions disabled (like VRM4U DisableCollision)

Key difference from naive DFS:
  Joints carry an implicit direction (a → b).  We detect the parent→child
  direction by preferring static→dynamic edges, then propagate BFS in that
  directed order so the bones list is always root-to-tip.
"""

from collections import defaultdict, deque
import math


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sphere_radius(rb):
    """Approximate collision radius for any shape type (matches VRM4U logic)."""
    st = rb["shape_type"]
    sz = rb["shape_size"]
    if st == 0:          # Sphere → direct radius
        return sz[0]
    elif st == 2:        # Capsule → cylinder radius
        return sz[0]
    else:                # Box → half of longest side
        return max(sz) * 0.5


def _map_params(rb, joint=None):
    """Extract VRM spring parameters from a single rigid body (+ optional joint).

    Mirrors VRM4U CreateSwingHead/Tail parameter assignments:
      LinearDamping  = 10 * spring.dragForce   → dragForce = ld / 10
      stiffness      = joint spring_constant_rotation magnitude / 200
      gravityPower   = mass * 0.5
      hitRadius      = shape sphere radius
    """
    drag_force   = max(0.0, min(1.0, rb["linear_damping"]))
    gravity_power = max(0.0, min(2.0, rb["mass"] * 0.5))
    hit_radius   = max(0.0, _sphere_radius(rb))

    stiffiness = 0.0
    if joint is not None:
        scr = joint.get("spring_constant_rotation", [0, 0, 0])
        mag = math.sqrt(sum(v * v for v in scr))
        stiffiness = max(0.0, min(4.0, mag / 200.0))

    return drag_force, stiffiness, gravity_power, hit_radius


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def convert(rigid_bodies, joints, bones):
    """Convert PMX physics to VRM 0.x secondaryAnimation.

    Args:
        rigid_bodies: List of rigid body dicts from pmx_reader.
        joints:       List of joint dicts from pmx_reader.
        bones:        List of bone dicts from pmx_reader.

    Returns:
        dict with "boneGroups" and "colliderGroups" in VRM 0.x format.
    """
    if not rigid_bodies:
        return {"boneGroups": [], "colliderGroups": []}

    num_rb  = len(rigid_bodies)
    num_bon = len(bones)

    # ---- Step 1: Classify rigid bodies ----
    static_set  = {i for i, rb in enumerate(rigid_bodies) if rb["mode"] == 0}
    dynamic_set = {i for i, rb in enumerate(rigid_bodies) if rb["mode"] != 0}

    # ---- Step 2: Build *directed* joint graph (parent → child) ----
    # PMX joint: rigidbody_index_a is conventionally the parent body.
    # If a is static and b is dynamic → confirmed parent→child.
    # If both dynamic → use the declared direction (a→b).
    # Store best joint connecting each directed pair for parameter lookup.
    directed_children = defaultdict(list)  # rb_idx → [child_rb_idx, ...]
    edge_joint = {}                        # (parent, child) → joint dict

    for j in joints:
        a, b = j["rigidbody_index_a"], j["rigidbody_index_b"]
        if not (0 <= a < num_rb and 0 <= b < num_rb):
            continue
        if a == b:
            continue

        # Flip if b is clearly the parent (static) and a is child (dynamic)
        if b in static_set and a in dynamic_set:
            a, b = b, a

        directed_children[a].append(b)
        edge_joint[(a, b)] = j

    # ---- Step 3: BFS chains — anchor (static) → ordered dynamic sequence ----
    # Each entry: (anchor_rb_idx_or_-1, [ordered_dynamic_rb_indices])
    visited = set()
    chains  = []   # list of (anchor_rb, [rb0, rb1, ...]) root→tip order

    for anchor in sorted(static_set):
        for first_dyn in directed_children[anchor]:
            if first_dyn not in dynamic_set or first_dyn in visited:
                continue
            # BFS preserving directed order
            chain = []
            queue = deque([first_dyn])
            while queue:
                cur = queue.popleft()
                if cur in visited or cur not in dynamic_set:
                    continue
                visited.add(cur)
                chain.append(cur)
                for nxt in directed_children[cur]:
                    if nxt in dynamic_set and nxt not in visited:
                        queue.append(nxt)
            if chain:
                chains.append((anchor, chain))

    # Isolated dynamic bodies (no static anchor)
    for rb_idx in sorted(dynamic_set):
        if rb_idx not in visited:
            visited.add(rb_idx)
            chains.append((-1, [rb_idx]))

    # ---- Step 4: Build boneGroups ----
    bone_groups = []

    for anchor_rb, dyn_chain in chains:
        # Collect ordered, unique, valid bone indices
        seen_bones = set()
        bone_indices = []
        for rb_idx in dyn_chain:
            bi = rigid_bodies[rb_idx]["bone_index"]
            if 0 <= bi < num_bon and bi not in seen_bones:
                seen_bones.add(bi)
                bone_indices.append(bi)

        if not bone_indices:
            continue

        # Anchor (center) bone — the bone the static/kinematic RB is attached to
        center_bone = -1
        if anchor_rb >= 0:
            abi = rigid_bodies[anchor_rb]["bone_index"]
            if 0 <= abi < num_bon:
                center_bone = abi

        # Representative RB for group-level parameters = first dynamic body
        rep_rb  = rigid_bodies[dyn_chain[0]]
        rep_joint = edge_joint.get(
            (anchor_rb, dyn_chain[0]),
            edge_joint.get((dyn_chain[0], anchor_rb))
        ) if anchor_rb >= 0 else None

        drag_force, stiffiness, gravity_power, hit_radius = _map_params(rep_rb, rep_joint)

        # hitRadius: take max across chain (VRM4U uses per-body radius for capsule shapes)
        hit_radius = max(_sphere_radius(rigid_bodies[i]) for i in dyn_chain)

        bone_groups.append({
            "stiffiness":   round(stiffiness,    4),  # Double-i: VRM 0.x spec typo!
            "gravityPower": round(gravity_power,  4),
            "gravityDir":   {"x": 0, "y": -1, "z": 0},  # Object, NOT array
            "dragForce":    round(drag_force,     4),
            "hitRadius":    round(hit_radius,     4),
            "bones":        bone_indices,
            "colliderGroups": [],   # populated in Step 6
            "center":       center_bone,
            "comment":      "",
        })

    # ---- Step 5: Build colliderGroups from static rigid bodies ----
    # VRM4U: static RBs → PhysType_Kinematic collision bodies used for hit detection
    collider_by_bone = defaultdict(list)

    for rb_idx in sorted(static_set):
        rb = rigid_bodies[rb_idx]
        bi = rb["bone_index"]
        if bi < 0 or bi >= num_bon:
            continue

        radius   = _sphere_radius(rb)
        bone_pos = bones[bi]["position"]
        offset_x = float(rb["shape_position"][0] - bone_pos[0])
        offset_y = float(rb["shape_position"][1] - bone_pos[1])
        offset_z = float(rb["shape_position"][2] - bone_pos[2])

        collider_by_bone[bi].append({
            "offset": {
                "x": round(offset_x, 6),
                "y": round(offset_y, 6),
                "z": round(offset_z, 6),
            },
            "radius": round(float(radius), 6),
        })

    collider_groups = []
    cg_bone_map = {}  # bone_index → colliderGroup index

    for bi in sorted(collider_by_bone.keys()):
        cg_idx = len(collider_groups)
        cg_bone_map[bi] = cg_idx
        collider_groups.append({"node": bi, "colliders": collider_by_bone[bi]})

    # ---- Step 6: Link colliderGroups to boneGroups ----
    # VRM4U: only spring bodies that have direct joint connections to collider bones
    # are linked.  We replicate this by walking up the bone hierarchy from each
    # spring bone and including any ancestor that has a collider.
    #
    # Additionally, head/chest/upperChest always get included (hair, cloth etc.)
    body_bones = {"頭", "上半身", "上半身2", "首"}

    for bg in bone_groups:
        relevant = set()

        # Anchor bone itself → usually has a collider
        if bg["center"] >= 0 and bg["center"] in cg_bone_map:
            relevant.add(cg_bone_map[bg["center"]])

        for bone_idx in bg["bones"]:
            # Walk up hierarchy (max 12 steps) looking for collider assignments
            cur   = bone_idx
            depth = 0
            while 0 <= cur < num_bon and depth < 12:
                if cur in cg_bone_map:
                    relevant.add(cg_bone_map[cur])
                par = bones[cur]["parent_index"]
                if par < 0 or par >= num_bon or par == cur:
                    break
                cur = par
                depth += 1

        # Body bones' colliders affect everything (hair, skirt, etc.)
        for bi, cg_idx in cg_bone_map.items():
            if bones[bi]["name"] in body_bones:
                relevant.add(cg_idx)

        bg["colliderGroups"] = sorted(relevant)

    return {
        "boneGroups":    bone_groups,
        "colliderGroups": collider_groups,
    }
