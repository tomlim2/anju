/**
 * Shared interfaces for the truepmx2vrm pipeline.
 *
 * Python has no equivalent file — these types were implicit dicts.
 */

// ── PMX data structures ──

export interface PmxBone {
  name: string;
  english_name: string;
  position: Float32Array;
  parent_index: number;
}

export interface PmxMaterial {
  name: string;
  diffuse: number[];
  texture_index: number;
  vertex_count: number;
}

export interface PmxMorphOffset {
  /** [vertex_index, dx, dy, dz] in glTF space after transform */
  vi: number;
  dx: number;
  dy: number;
  dz: number;
}

export interface PmxMorph {
  name: string;
  english_name: string;
  offsets: PmxMorphOffset[];
}

export interface PmxRigidBody {
  name: string;
  bone_index: number;
  collision_group: number;
  no_collision_group: number;
  shape_type: number;
  shape_size: number[];
  shape_position: number[];
  shape_rotation: number[];
  mass: number;
  linear_damping: number;
  angular_damping: number;
  restitution: number;
  friction: number;
  mode: number;
}

export interface PmxJoint {
  name: string;
  rigidbody_index_a: number;
  rigidbody_index_b: number;
  position: number[];
  rotation: number[];
  rotation_limit_min?: number[];
  rotation_limit_max?: number[];
  spring_constant_translation: number[];
  spring_constant_rotation: number[];
}

/** Normalized PMX data ready for the converter pipeline. */
export interface PmxData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  joints: Uint16Array;
  weights: Float32Array;
  indices: Uint32Array;
  materials: PmxMaterial[];
  bones: PmxBone[];
  skinned_bone_indices: Set<number>;
  textures: Uint8Array[];
  texture_mimes: string[];
  morphs: PmxMorph[];
  rigid_bodies: PmxRigidBody[];
  joints_phys: PmxJoint[];
  pmx_dir: string;
}

// ── glTF / VRM structures ──

export interface GltfData {
  json: Record<string, any>;
  bin: Uint8Array;
}

export interface HumanoidBoneEntry {
  bone: string;
  node: number;
  useDefaultValues: boolean;
}

export interface BoneGroup {
  stiffiness: number;
  gravityPower: number;
  gravityDir: { x: number; y: number; z: number };
  dragForce: number;
  hitRadius: number;
  bones: number[];
  colliderGroups: number[];
  center: number;
  comment: string;
}

export interface ColliderGroup {
  node: number;
  colliders: { offset: { x: number; y: number; z: number }; radius: number }[];
}

export interface SecondaryAnimation {
  boneGroups: BoneGroup[];
  colliderGroups: ColliderGroup[];
}

// ── Validator ──

export enum Severity {
  ERROR = "ERROR",
  WARNING = "WARNING",
  INFO = "INFO",
}

export interface ValidationIssue {
  severity: Severity;
  layer: number;
  message: string;
  path: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  vrm_version: string | null;
  exporter: string | null;
  bone_count: number;
  node_count: number;
  material_count: number;
}
