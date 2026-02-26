/**
 * Convert PMX rigid body + joint data to VRM 0.x secondaryAnimation.
 *
 * Replicates VRM4U's PMX physics import pipeline (VrmConvertModel.cpp).
 */

import type { PmxBone, PmxRigidBody, PmxJoint, SecondaryAnimation, BoneGroup, ColliderGroup } from "./types.js";

// ── Helpers ──

function sphereRadius(rb: PmxRigidBody): number {
  const st = rb.shape_type;
  const sz = rb.shape_size;
  if (st === 0) return sz[0];       // Sphere
  if (st === 2) return sz[0];       // Capsule
  return Math.max(...sz) * 0.5;     // Box
}

const COLLIDER_RADIUS_SCALE = 0.5;
const HIT_RADIUS_SCALE = 0.4;

function rotationLimitRange(joint: PmxJoint | null): number {
  if (!joint) return 0.0;
  const rmin = joint.rotation_limit_min ?? [0, 0, 0];
  const rmax = joint.rotation_limit_max ?? [0, 0, 0];
  return (Math.abs(rmax[0] - rmin[0]) + Math.abs(rmax[1] - rmin[1]) + Math.abs(rmax[2] - rmin[2])) / 3.0;
}

function mapParams(
  rb: PmxRigidBody,
  joint: PmxJoint | null,
): [number, number, number, number] {
  let dragForce = Math.max(0.0, Math.min(1.0, rb.linear_damping));
  let hitRadius = Math.max(0.0, sphereRadius(rb));

  const avgRange = rotationLimitRange(joint);

  // Stiffiness
  let stiffiness = 0.0;
  if (joint) {
    const scr = joint.spring_constant_rotation ?? [0, 0, 0];
    const mag = Math.sqrt(scr[0] ** 2 + scr[1] ** 2 + scr[2] ** 2);
    if (mag > 1.0) {
      stiffiness = Math.max(0.0, Math.min(4.0, mag / 200.0));
    } else if (avgRange > 0.001) {
      stiffiness = Math.max(0.2, Math.min(4.0, Math.PI / avgRange * 0.5));
    } else {
      stiffiness = 4.0;
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
): SecondaryAnimation {
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

    // Trim bones below ground (Y < 0.05m)
    boneIndices = boneIndices.filter(bi => bones[bi].position[1] > 0.05);
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

    let [dragForce, stiffiness, gravityPower, hitRadius] = mapParams(repRb, repJoint);

    // hitRadius: max across chain, scaled
    hitRadius = Math.max(...dynChain.map(i => sphereRadius(rigidBodies[i]))) * HIT_RADIUS_SCALE;

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

    if (chainLen >= 6) {
      stiffiness = Math.min(stiffiness, 2.0);
      dragForce = Math.max(dragForce, 0.8);
      gravityPower = hangsDown ? Math.max(gravityPower, 0.15) : 0.0;
    } else if (chainLen >= 4) {
      stiffiness = Math.min(stiffiness, 3.5);
      dragForce = Math.max(dragForce, 0.8);
      gravityPower = hangsDown ? Math.max(gravityPower, 0.02) : 0.0;
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

    const radius = sphereRadius(rb) * COLLIDER_RADIUS_SCALE;
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
  const bodyBones = new Set([
    "頭", "上半身", "上半身2", "首",
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

    for (const [bi, cgIdx] of cgBoneMap) {
      if (bodyBones.has(bones[bi].name)) {
        relevant.add(cgIdx);
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
