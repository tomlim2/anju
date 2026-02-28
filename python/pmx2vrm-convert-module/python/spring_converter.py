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


# PMX rigid bodies are Bullet Physics collision volumes that enclose mesh
# geometry.  VRM spring bones use thin line-segment collision, so the raw
# PMX radii are far too large.  These empirical factors bring the values
# into the typical VRM range.
_COLLIDER_RADIUS_SCALE = 0.3   # static RB → VRM collider sphere
_HIT_RADIUS_SCALE      = 0.2   # dynamic RB → VRM boneGroup hitRadius

# Tuning constants
_DRAG_FORCE_MAX = 0.8
_SPRING_CONSTANT_DIVISOR = 200.0
_STIFFINESS_MAX = 4.0
_CHAIN_LONG = 6
_CHAIN_MED = 4
_CHAIN_LONG_STIFFINESS_CAP = 2.0
_CHAIN_MED_STIFFINESS_CAP = 3.5
_CHAIN_DRAG_MIN = 0.8
_CHAIN_LONG_GRAVITY_MIN = 0.15
_CHAIN_LONG_GRAVITY_MAX = 0.5
_CHAIN_MED_GRAVITY_MIN = 0.02
_CHAIN_MED_GRAVITY_MAX = 0.3
_CHAIN_SHORT_STIFFINESS_MIN = 2.0
_CHAIN_SHORT_GRAVITY_MAX = 0.05
# Chain split: long hanging chains get a stiff root segment + flowing tip segment
# to prevent hip/body penetration while keeping natural cloth motion.
_SPLIT_MIN_CHAIN = 6          # only split chains with ≥ this many bones
_SPLIT_ROOT_RATIO = 0.4       # first 40% of bones = stiff segment
_SPLIT_ROOT_MIN = 2           # stiff segment has at least 2 bones
_SPLIT_ROOT_STIFFINESS = 3.5  # stiff segment restoring force
_SPLIT_ROOT_GRAVITY = 0.05    # stiff segment barely sags
_SPLIT_TIP_STIFFINESS = 1.5   # tip segment flows freely
_SPLIT_TIP_GRAVITY_MAX = 0.4  # tip segment gravity cap
_GROUND_Y_MIN = 0.05


def _rotation_limit_range(joint):
    """Average rotation limit range (radians) from a joint. 0 = locked."""
    if joint is None:
        return 0.0
    rmin = joint.get("rotation_limit_min", [0, 0, 0])
    rmax = joint.get("rotation_limit_max", [0, 0, 0])
    return sum(abs(rmax[i] - rmin[i]) for i in range(3)) / 3.0


def _map_params(rb, joint=None):
    """Extract VRM spring parameters from a single rigid body (+ optional joint).

    Key insight: MMD uses Bullet Physics hard constraints (rotation limits),
    VRM uses soft springs.  Tight rotation limits in PMX mean the part should
    barely move → high stiffiness, near-zero gravity.  Wide limits mean
    flowing motion → lower stiffiness, more gravity.

    Stiffiness derivation (priority order):
      1. spring_constant_rotation magnitude / 200  (if non-zero)
      2. rotation_limit range → tighter limits = higher stiffiness
      3. fallback: angular_damping as proxy
    """
    drag_force = max(0.0, min(_DRAG_FORCE_MAX, rb["linear_damping"]))
    hit_radius = max(0.0, _sphere_radius(rb))

    # Rotation limit range determines both stiffiness AND gravity
    avg_range = _rotation_limit_range(joint)

    # --- Stiffiness ---
    stiffiness = 0.0
    if joint is not None:
        scr = joint.get("spring_constant_rotation", [0, 0, 0])
        mag = math.sqrt(sum(v * v for v in scr))
        if mag > 1.0:
            stiffiness = max(0.0, min(_STIFFINESS_MAX, mag / _SPRING_CONSTANT_DIVISOR))
        elif avg_range > 0.001:
            stiffiness = max(0.2, min(_STIFFINESS_MAX, math.pi / avg_range * 0.5))
        else:
            stiffiness = _STIFFINESS_MAX

    if stiffiness < 0.01:
        stiffiness = max(0.2, min(2.0, rb["angular_damping"] * 1.5))

    # --- Gravity ---
    # Tight limits → gravity ≈ 0 (part stays at rest pose)
    # Wide limits (>0.5 rad avg) → gravity scales with mass
    if avg_range < 0.1:
        gravity_power = 0.0
    elif avg_range < 0.5:
        gravity_power = max(0.0, min(0.5, rb["mass"] * 0.1))
    else:
        gravity_power = max(0.0, min(1.0, rb["mass"] * 0.2))

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

    # ---- Step 3: Build chains following bone hierarchy (not joint graph) ----
    # Previous BFS through joints merged separate cloth strands into one
    # massive group (50+ bones).  Instead, build a bone→RB lookup and walk
    # the bone parent→child tree so each strand stays independent.

    # bone_index → dynamic RB index
    bone_to_dyn_rb = {}
    for rb_idx in dynamic_set:
        bi = rigid_bodies[rb_idx]["bone_index"]
        if 0 <= bi < num_bon:
            bone_to_dyn_rb[bi] = rb_idx

    # bone_index → [child_bone_indices] from the skeleton
    bone_children = defaultdict(list)
    for bi, bone in enumerate(bones):
        par = bone["parent_index"]
        if 0 <= par < num_bon and par != bi:
            bone_children[par].append(bi)

    def _walk_bone_chain(start_bone):
        """Walk bone hierarchy depth-first, collecting dynamic RBs."""
        chain = []
        stack = [start_bone]
        while stack:
            bi = stack.pop()
            if bi in bone_to_dyn_rb:
                rb_idx = bone_to_dyn_rb[bi]
                if rb_idx not in visited:
                    visited.add(rb_idx)
                    chain.append(rb_idx)
                    # Continue to children of this bone
                    for child_bi in bone_children[bi]:
                        stack.append(child_bi)
        return chain

    visited = set()
    chains  = []   # list of (anchor_rb, [rb0, rb1, ...]) root→tip order

    for anchor in sorted(static_set):
        anchor_bone = rigid_bodies[anchor]["bone_index"]
        if anchor_bone < 0 or anchor_bone >= num_bon:
            continue
        # Each child bone of the anchor starts its own chain
        for child_bone in bone_children[anchor_bone]:
            if child_bone not in bone_to_dyn_rb:
                continue
            if bone_to_dyn_rb[child_bone] in visited:
                continue
            chain = _walk_bone_chain(child_bone)
            if chain:
                chains.append((anchor, chain))

    # Also check direct joint connections for anchors whose children aren't
    # in the bone hierarchy (some PMX models attach RBs to non-child bones)
    for anchor in sorted(static_set):
        for first_dyn in directed_children[anchor]:
            if first_dyn not in dynamic_set or first_dyn in visited:
                continue
            dyn_bone = rigid_bodies[first_dyn]["bone_index"]
            chain = _walk_bone_chain(dyn_bone)
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

        # Trim bones below ground.  PMX models often have physics anchor
        # bones extending underground; these cause spring tips to stick
        # to the floor.
        bone_indices = [bi for bi in bone_indices if bones[bi]["position"][1] > _GROUND_Y_MIN]
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

        # Skip chains where joint rotation is fully locked (rigid attachment)
        if rep_joint is not None:
            rmin = rep_joint.get("rotation_limit_min", [0, 0, 0])
            rmax = rep_joint.get("rotation_limit_max", [0, 0, 0])
            scr = rep_joint.get("spring_constant_rotation", [0, 0, 0])
            if all(v == 0 for v in rmin) and all(v == 0 for v in rmax) and all(v == 0 for v in scr):
                continue

        drag_force, stiffiness, gravity_power, hit_radius = _map_params(rep_rb, rep_joint)

        # hitRadius: take max across chain, scaled down for VRM line-segment collision
        hit_radius = max(_sphere_radius(rigid_bodies[i]) for i in dyn_chain) * _HIT_RADIUS_SCALE

        # Detect chain direction from bone positions: average Y displacement
        # Downward chains (skirt, hair) get gravity; upward/lateral (wings) don't
        chain_len = len(bone_indices)
        avg_y = 0.0
        if chain_len >= 2:
            y_sum = sum(bones[bi]["position"][1] for bi in bone_indices)
            anchor_y = bones[bone_indices[0]]["position"][1]
            avg_y = (y_sum / chain_len) - anchor_y  # negative = hangs down

        hangs_down = avg_y < -0.01  # chain extends downward

        # -- Chain split for long hanging chains --
        # Root segment stays stiff (prevents body penetration),
        # tip segment flows freely (natural cloth/hair motion).
        if chain_len >= _SPLIT_MIN_CHAIN and hangs_down:
            split_at = max(_SPLIT_ROOT_MIN, int(chain_len * _SPLIT_ROOT_RATIO))
            root_bones = bone_indices[:split_at]
            tip_bones  = bone_indices[split_at:]

            drag_force = max(drag_force, _CHAIN_DRAG_MIN)

            # Root segment: stiff, minimal gravity
            bone_groups.append({
                "stiffiness":   round(_SPLIT_ROOT_STIFFINESS, 4),
                "gravityPower": round(_SPLIT_ROOT_GRAVITY,    4),
                "gravityDir":   {"x": 0, "y": -1, "z": 0},
                "dragForce":    round(drag_force,             4),
                "hitRadius":    round(hit_radius,             4),
                "bones":        root_bones,
                "colliderGroups": [],
                "center":       center_bone,
                "comment":      "",
            })

            # Tip segment: flows freely, center = last root bone
            tip_grav = min(gravity_power, _SPLIT_TIP_GRAVITY_MAX) if hangs_down else 0.0
            tip_grav = max(tip_grav, _CHAIN_LONG_GRAVITY_MIN)
            bone_groups.append({
                "stiffiness":   round(_SPLIT_TIP_STIFFINESS,  4),
                "gravityPower": round(tip_grav,               4),
                "gravityDir":   {"x": 0, "y": -1, "z": 0},
                "dragForce":    round(drag_force,             4),
                "hitRadius":    round(hit_radius,             4),
                "bones":        tip_bones,
                "colliderGroups": [],
                "center":       root_bones[-1],
                "comment":      "",
            })
            continue

        if chain_len >= _CHAIN_LONG:
            stiffiness = min(stiffiness, _CHAIN_LONG_STIFFINESS_CAP)
            drag_force = max(drag_force, _CHAIN_DRAG_MIN)
            if hangs_down:
                gravity_power = max(gravity_power, _CHAIN_LONG_GRAVITY_MIN)
                gravity_power = min(gravity_power, _CHAIN_LONG_GRAVITY_MAX)
            else:
                gravity_power = 0.0
        elif chain_len >= _CHAIN_MED:
            stiffiness = min(stiffiness, _CHAIN_MED_STIFFINESS_CAP)
            drag_force = max(drag_force, _CHAIN_DRAG_MIN)
            if hangs_down:
                gravity_power = max(gravity_power, _CHAIN_MED_GRAVITY_MIN)
                gravity_power = min(gravity_power, _CHAIN_MED_GRAVITY_MAX)
            else:
                gravity_power = 0.0
        else:
            # Short chains (ribbons, accessories): stiffer + cap gravity
            stiffiness = max(stiffiness, _CHAIN_SHORT_STIFFINESS_MIN)
            drag_force = max(drag_force, _CHAIN_DRAG_MIN)
            gravity_power = min(gravity_power, _CHAIN_SHORT_GRAVITY_MAX) if hangs_down else 0.0

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

        radius   = _sphere_radius(rb) * _COLLIDER_RADIUS_SCALE
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
    _upper_body_bones = {"頭", "上半身", "上半身2", "首"}
    _lower_body_bones = {
        "下半身",
        "右足", "左足", "右足D", "左足D",
        "右ひざ", "左ひざ", "右ひざD", "左ひざD",
    }

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

        # Body bones' colliders — filtered by region to prevent
        # upper-body colliders from pushing skirt chains outward
        center_name = ""
        if bg["center"] >= 0 and bg["center"] < num_bon:
            center_name = bones[bg["center"]]["name"]
        chain_is_lower = center_name in _lower_body_bones
        chain_is_upper = center_name in _upper_body_bones

        for bi, cg_idx in cg_bone_map.items():
            bone_name = bones[bi]["name"]
            if bone_name in _upper_body_bones:
                if not chain_is_lower:
                    relevant.add(cg_idx)
            elif bone_name in _lower_body_bones:
                if not chain_is_upper:
                    relevant.add(cg_idx)

        bg["colliderGroups"] = sorted(relevant)

    return {
        "boneGroups":    bone_groups,
        "colliderGroups": collider_groups,
    }
