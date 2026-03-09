/**
 * Convert PMX rigid body + joint data to VRM 0.x secondaryAnimation.
 *
 * Replicates VRM4U's PMX physics import pipeline (VrmConvertModel.cpp).
 */

import type { PmxBone, PmxRigidBody, PmxJoint, SecondaryAnimation, BoneGroup, ColliderGroup } from "./types.js";

// ── Spring Presets (synced with python/spring_presets.json) ──

interface SpringPreset {
  collider_radius_scale: number;
  hit_radius_scale: number;
  drag_force_max: number;
  spring_constant_divisor: number;
  stiffiness_max: number;
  chain_long: number;
  chain_med: number;
  chain_long_stiffiness_cap: number;
  chain_med_stiffiness_cap: number;
  chain_drag_min: number;
  chain_long_gravity_min: number;
  chain_long_gravity_max: number;
  chain_med_gravity_min: number;
  chain_med_gravity_max: number;
  chain_short_stiffiness_min: number;
  chain_short_gravity_max: number;
  chain_short_drag_min: number;
  split_min_chain: number;
  split_root_ratio: number;
  split_root_min: number;
  split_root_stiffiness: number;
  split_root_gravity: number;
  split_tip_stiffiness: number;
  split_tip_gravity_max: number;
  ground_y_min: number;
}

const PRESETS: Record<string, SpringPreset> = {
  default: {
    // No gravity — ABP controls gravity uniformly
    collider_radius_scale: 0.3,
    hit_radius_scale: 0.2,
    drag_force_max: 0.6,
    spring_constant_divisor: 200.0,
    stiffiness_max: 4.0,
    chain_long: 6,
    chain_med: 4,
    chain_long_stiffiness_cap: 1.5,
    chain_med_stiffiness_cap: 2.5,
    chain_drag_min: 0.6,
    chain_long_gravity_min: 0.0,
    chain_long_gravity_max: 0.0,
    chain_med_gravity_min: 0.0,
    chain_med_gravity_max: 0.0,
    chain_short_stiffiness_min: 3.5,
    chain_short_gravity_max: 0.0,
    chain_short_drag_min: 0.9,
    split_min_chain: 6,
    split_root_ratio: 0.4,
    split_root_min: 2,
    split_root_stiffiness: 3.0,
    split_root_gravity: 0.0,
    split_tip_stiffiness: 1.2,
    split_tip_gravity_max: 0.0,
    ground_y_min: 0.05,
  },
  "with-gravity": {
    // Per-chain gravity from PMX physics data
    collider_radius_scale: 0.3,
    hit_radius_scale: 0.2,
    drag_force_max: 0.6,
    spring_constant_divisor: 200.0,
    stiffiness_max: 4.0,
    chain_long: 6,
    chain_med: 4,
    chain_long_stiffiness_cap: 1.5,
    chain_med_stiffiness_cap: 2.5,
    chain_drag_min: 0.6,
    chain_long_gravity_min: 0.1,
    chain_long_gravity_max: 0.6,
    chain_med_gravity_min: 0.03,
    chain_med_gravity_max: 0.4,
    chain_short_stiffiness_min: 3.5,
    chain_short_gravity_max: 0.0,
    chain_short_drag_min: 0.9,
    split_min_chain: 6,
    split_root_ratio: 0.4,
    split_root_min: 2,
    split_root_stiffiness: 3.0,
    split_root_gravity: 0.08,
    split_tip_stiffiness: 1.2,
    split_tip_gravity_max: 0.45,
    ground_y_min: 0.05,
  },
  realistic: {
    collider_radius_scale: 0.3,
    hit_radius_scale: 0.2,
    drag_force_max: 0.5,
    spring_constant_divisor: 200.0,
    stiffiness_max: 4.0,
    chain_long: 6,
    chain_med: 4,
    chain_long_stiffiness_cap: 1.2,
    chain_med_stiffiness_cap: 2.0,
    chain_drag_min: 0.4,
    chain_long_gravity_min: 0.1,
    chain_long_gravity_max: 0.8,
    chain_med_gravity_min: 0.05,
    chain_med_gravity_max: 0.5,
    chain_short_stiffiness_min: 3.5,
    chain_short_gravity_max: 0.0,
    chain_short_drag_min: 0.9,
    split_min_chain: 6,
    split_root_ratio: 0.4,
    split_root_min: 2,
    split_root_stiffiness: 2.5,
    split_root_gravity: 0.1,
    split_tip_stiffiness: 0.8,
    split_tip_gravity_max: 0.6,
    ground_y_min: 0.05,
  },
};

export function getPresetNames(): string[] {
  return Object.keys(PRESETS);
}

// ── Helpers ──

function sphereRadius(rb: PmxRigidBody): number {
  const st = rb.shape_type;
  const sz = rb.shape_size;
  if (st === 0) return sz[0];       // Sphere
  if (st === 2) return sz[0];       // Capsule
  return Math.max(...sz) * 0.5;     // Box
}

function rotationLimitRange(joint: PmxJoint | null): number {
  if (!joint) return 0.0;
  const rmin = joint.rotation_limit_min ?? [0, 0, 0];
  const rmax = joint.rotation_limit_max ?? [0, 0, 0];
  return (Math.abs(rmax[0] - rmin[0]) + Math.abs(rmax[1] - rmin[1]) + Math.abs(rmax[2] - rmin[2])) / 3.0;
}

function mapParams(
  rb: PmxRigidBody,
  joint: PmxJoint | null,
  p: SpringPreset,
): [number, number, number, number] {
  let dragForce = Math.max(0.0, Math.min(p.drag_force_max, rb.linear_damping));
  let hitRadius = Math.max(0.0, sphereRadius(rb));

  const avgRange = rotationLimitRange(joint);

  // Stiffiness
  let stiffiness = 0.0;
  if (joint) {
    const scr = joint.spring_constant_rotation ?? [0, 0, 0];
    const mag = Math.sqrt(scr[0] ** 2 + scr[1] ** 2 + scr[2] ** 2);
    if (mag > 1.0) {
      stiffiness = Math.max(0.0, Math.min(p.stiffiness_max, mag / p.spring_constant_divisor));
    } else if (avgRange > 0.001) {
      stiffiness = Math.max(0.2, Math.min(p.stiffiness_max, Math.PI / avgRange * 0.5));
    } else {
      stiffiness = p.stiffiness_max;
    }
  }

  if (stiffiness < 0.01) {
    stiffiness = Math.max(0.2, Math.min(2.0, rb.angular_damping * 1.5));
  }

  // Gravity
  let gravityPower: number;
  if (avgRange < 0.1) {
    gravityPower = 0.0;
  } else if (avgRange < 0.5) {
    gravityPower = Math.max(0.0, Math.min(0.5, rb.mass * 0.1));
  } else {
    gravityPower = Math.max(0.0, Math.min(1.0, rb.mass * 0.2));
  }

  return [dragForce, stiffiness, gravityPower, hitRadius];
}

// ── Map helper ──

function getOrCreate<K, V>(map: Map<K, V[]>, key: K): V[] {
  let arr = map.get(key);
  if (!arr) {
    arr = [];
    map.set(key, arr);
  }
  return arr;
}

// ── Main ──

export function convert(
  rigidBodies: PmxRigidBody[],
  joints: PmxJoint[],
  bones: PmxBone[],
  preset: string = "default",
): SecondaryAnimation {
  const p = PRESETS[preset];
  if (!p) {
    throw new Error(`Unknown spring preset '${preset}'. Available: ${Object.keys(PRESETS).join(", ")}`);
  }

  if (rigidBodies.length === 0) {
    return { boneGroups: [], colliderGroups: [] };
  }

  const numRb = rigidBodies.length;
  const numBon = bones.length;

  // Step 1: Classify rigid bodies
  const staticSet = new Set<number>();
  const dynamicSet = new Set<number>();
  for (let i = 0; i < numRb; i++) {
    if (rigidBodies[i].mode === 0) staticSet.add(i);
    else dynamicSet.add(i);
  }

  // Step 2: Build directed joint graph
  const directedChildren = new Map<number, number[]>();
  const edgeJoint = new Map<string, PmxJoint>();

  for (const j of joints) {
    let a = j.rigidbody_index_a;
    let b = j.rigidbody_index_b;
    if (!(a >= 0 && a < numRb && b >= 0 && b < numRb)) continue;
    if (a === b) continue;

    if (staticSet.has(b) && dynamicSet.has(a)) {
      [a, b] = [b, a];
    }

    getOrCreate(directedChildren, a).push(b);
    edgeJoint.set(`${a},${b}`, j);
  }

  // Step 3: Build chains following bone hierarchy
  const boneToDynRb = new Map<number, number>();
  for (const rbIdx of dynamicSet) {
    const bi = rigidBodies[rbIdx].bone_index;
    if (bi >= 0 && bi < numBon) {
      boneToDynRb.set(bi, rbIdx);
    }
  }

  const boneChildren = new Map<number, number[]>();
  for (let bi = 0; bi < numBon; bi++) {
    const par = bones[bi].parent_index;
    if (par >= 0 && par < numBon && par !== bi) {
      getOrCreate(boneChildren, par).push(bi);
    }
  }

  const visited = new Set<number>();
  const chains: [number, number[]][] = [];

  function walkBoneChain(startBone: number): number[] {
    const chain: number[] = [];
    const stack = [startBone];
    while (stack.length > 0) {
      const bi = stack.pop()!;
      const rbIdx = boneToDynRb.get(bi);
      if (rbIdx !== undefined && !visited.has(rbIdx)) {
        visited.add(rbIdx);
        chain.push(rbIdx);
        const children = boneChildren.get(bi) ?? [];
        for (const childBi of children) {
          stack.push(childBi);
        }
      }
    }
    return chain;
  }

  // Walk from static anchors
  const sortedStatic = [...staticSet].sort((a, b) => a - b);
  for (const anchor of sortedStatic) {
    const anchorBone = rigidBodies[anchor].bone_index;
    if (anchorBone < 0 || anchorBone >= numBon) continue;

    const children = boneChildren.get(anchorBone) ?? [];
    for (const childBone of children) {
      if (!boneToDynRb.has(childBone)) continue;
      if (visited.has(boneToDynRb.get(childBone)!)) continue;
      const chain = walkBoneChain(childBone);
      if (chain.length > 0) chains.push([anchor, chain]);
    }
  }

  // Also check direct joint connections
  for (const anchor of sortedStatic) {
    const dChildren = directedChildren.get(anchor) ?? [];
    for (const firstDyn of dChildren) {
      if (!dynamicSet.has(firstDyn) || visited.has(firstDyn)) continue;
      const dynBone = rigidBodies[firstDyn].bone_index;
      const chain = walkBoneChain(dynBone);
      if (chain.length > 0) chains.push([anchor, chain]);
    }
  }

  // Isolated dynamic bodies
  const sortedDynamic = [...dynamicSet].sort((a, b) => a - b);
  for (const rbIdx of sortedDynamic) {
    if (!visited.has(rbIdx)) {
      visited.add(rbIdx);
      chains.push([-1, [rbIdx]]);
    }
  }

  // Step 4: Build boneGroups
  const boneGroups: BoneGroup[] = [];

  for (const [anchorRb, dynChain] of chains) {
    const seenBones = new Set<number>();
    let boneIndices: number[] = [];
    for (const rbIdx of dynChain) {
      const bi = rigidBodies[rbIdx].bone_index;
      if (bi >= 0 && bi < numBon && !seenBones.has(bi)) {
        seenBones.add(bi);
        boneIndices.push(bi);
      }
    }

    if (boneIndices.length === 0) continue;

    // Trim bones below ground
    boneIndices = boneIndices.filter(bi => bones[bi].position[1] > p.ground_y_min);
    if (boneIndices.length === 0) continue;

    // Anchor (center) bone
    let centerBone = -1;
    if (anchorRb >= 0) {
      const abi = rigidBodies[anchorRb].bone_index;
      if (abi >= 0 && abi < numBon) centerBone = abi;
    }

    // Representative RB for group-level parameters
    const repRb = rigidBodies[dynChain[0]];
    let repJoint: PmxJoint | null = null;
    if (anchorRb >= 0) {
      repJoint = edgeJoint.get(`${anchorRb},${dynChain[0]}`) ??
                 edgeJoint.get(`${dynChain[0]},${anchorRb}`) ?? null;
    }

    // Skip chains where joint rotation is fully locked (rigid attachment)
    if (repJoint) {
      const rmin = repJoint.rotation_limit_min ?? [0, 0, 0];
      const rmax = repJoint.rotation_limit_max ?? [0, 0, 0];
      const scr = repJoint.spring_constant_rotation ?? [0, 0, 0];
      if (rmin.every(v => v === 0) && rmax.every(v => v === 0) && scr.every(v => v === 0)) continue;
    }

    let [dragForce, stiffiness, gravityPower, hitRadius] = mapParams(repRb, repJoint, p);

    // hitRadius: max across chain, scaled
    hitRadius = Math.max(...dynChain.map(i => sphereRadius(rigidBodies[i]))) * p.hit_radius_scale;

    // Detect chain direction
    const chainLen = boneIndices.length;
    let avgY = 0.0;
    if (chainLen >= 2) {
      let ySum = 0;
      for (const bi of boneIndices) ySum += bones[bi].position[1];
      const anchorY = bones[boneIndices[0]].position[1];
      avgY = (ySum / chainLen) - anchorY;
    }

    const hangsDown = avgY < -0.01;

    // Chain split: long hanging chains → stiff root + flowing tip
    if (chainLen >= p.split_min_chain && hangsDown) {
      const splitAt = Math.max(p.split_root_min, Math.floor(chainLen * p.split_root_ratio));
      const rootBones = boneIndices.slice(0, splitAt);
      const tipBones = boneIndices.slice(splitAt);
      dragForce = Math.max(dragForce, p.chain_drag_min);

      boneGroups.push({
        stiffiness: round4(p.split_root_stiffiness),
        gravityPower: round4(p.split_root_gravity),
        gravityDir: { x: 0, y: -1, z: 0 },
        dragForce: round4(dragForce),
        hitRadius: round4(hitRadius),
        bones: rootBones,
        colliderGroups: [],
        center: centerBone,
        comment: "",
      });

      const tipGrav = Math.max(
        p.chain_long_gravity_min,
        Math.min(gravityPower, p.split_tip_gravity_max),
      );
      boneGroups.push({
        stiffiness: round4(p.split_tip_stiffiness),
        gravityPower: round4(tipGrav),
        gravityDir: { x: 0, y: -1, z: 0 },
        dragForce: round4(dragForce),
        hitRadius: round4(hitRadius),
        bones: tipBones,
        colliderGroups: [],
        center: rootBones[rootBones.length - 1],
        comment: "",
      });
      continue;
    }

    if (chainLen >= p.chain_long) {
      stiffiness = Math.min(stiffiness, p.chain_long_stiffiness_cap);
      dragForce = Math.max(dragForce, p.chain_drag_min);
      gravityPower = hangsDown
        ? Math.min(Math.max(gravityPower, p.chain_long_gravity_min), p.chain_long_gravity_max)
        : 0.0;
    } else if (chainLen >= p.chain_med) {
      stiffiness = Math.min(stiffiness, p.chain_med_stiffiness_cap);
      dragForce = Math.max(dragForce, p.chain_drag_min);
      gravityPower = hangsDown
        ? Math.min(Math.max(gravityPower, p.chain_med_gravity_min), p.chain_med_gravity_max)
        : 0.0;
    } else {
      // Short chains (ribbons, accessories): nearly frozen
      stiffiness = Math.max(stiffiness, p.chain_short_stiffiness_min);
      dragForce = Math.max(dragForce, p.chain_short_drag_min);
      gravityPower = p.chain_short_gravity_max;
    }

    boneGroups.push({
      stiffiness: round4(stiffiness),
      gravityPower: round4(gravityPower),
      gravityDir: { x: 0, y: -1, z: 0 },
      dragForce: round4(dragForce),
      hitRadius: round4(hitRadius),
      bones: boneIndices,
      colliderGroups: [],
      center: centerBone,
      comment: "",
    });
  }

  // Step 5: Build colliderGroups from static rigid bodies
  const colliderByBone = new Map<number, { offset: { x: number; y: number; z: number }; radius: number }[]>();

  for (const rbIdx of sortedStatic) {
    const rb = rigidBodies[rbIdx];
    const bi = rb.bone_index;
    if (bi < 0 || bi >= numBon) continue;

    const radius = sphereRadius(rb) * p.collider_radius_scale;
    const bonePos = bones[bi].position;
    const offsetX = rb.shape_position[0] - bonePos[0];
    const offsetY = rb.shape_position[1] - bonePos[1];
    const offsetZ = rb.shape_position[2] - bonePos[2];

    getOrCreate(colliderByBone, bi).push({
      offset: {
        x: round6(offsetX),
        y: round6(offsetY),
        z: round6(offsetZ),
      },
      radius: round6(radius),
    });
  }

  const colliderGroups: ColliderGroup[] = [];
  const cgBoneMap = new Map<number, number>();

  const sortedColliderBones = [...colliderByBone.keys()].sort((a, b) => a - b);
  for (const bi of sortedColliderBones) {
    const cgIdx = colliderGroups.length;
    cgBoneMap.set(bi, cgIdx);
    colliderGroups.push({ node: bi, colliders: colliderByBone.get(bi)! });
  }

  // Step 6: Link colliderGroups to boneGroups
  const upperBodyBones = new Set(["頭", "上半身", "上半身2", "首"]);
  const lowerBodyBones = new Set([
    "下半身",
    "右足", "左足", "右足D", "左足D",
    "右ひざ", "左ひざ", "右ひざD", "左ひざD",
  ]);

  for (const bg of boneGroups) {
    const relevant = new Set<number>();

    if (bg.center >= 0 && cgBoneMap.has(bg.center)) {
      relevant.add(cgBoneMap.get(bg.center)!);
    }

    for (const boneIdx of bg.bones) {
      let cur = boneIdx;
      let depth = 0;
      while (cur >= 0 && cur < numBon && depth < 12) {
        if (cgBoneMap.has(cur)) relevant.add(cgBoneMap.get(cur)!);
        const par = bones[cur].parent_index;
        if (par < 0 || par >= numBon || par === cur) break;
        cur = par;
        depth++;
      }
    }

    // Body bones' colliders — filtered by region to prevent
    // upper-body colliders from pushing skirt chains outward
    const centerName = bg.center >= 0 && bg.center < numBon ? bones[bg.center].name : "";
    const chainIsLower = lowerBodyBones.has(centerName);
    const chainIsUpper = upperBodyBones.has(centerName);

    for (const [bi, cgIdx] of cgBoneMap) {
      const boneName = bones[bi].name;
      if (upperBodyBones.has(boneName)) {
        if (!chainIsLower) relevant.add(cgIdx);
      } else if (lowerBodyBones.has(boneName)) {
        if (!chainIsUpper) relevant.add(cgIdx);
      }
    }

    bg.colliderGroups = [...relevant].sort((a, b) => a - b);
  }

  return { boneGroups, colliderGroups };
}

// ── Rounding helpers ──

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function round6(v: number): number {
  return Math.round(v * 1000000) / 1000000;
}
