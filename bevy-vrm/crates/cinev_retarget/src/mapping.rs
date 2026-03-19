use glam::{Quat, Vec3};
use std::collections::HashMap;

use crate::config::RetargetConfig;
use crate::fbx::FbxData;
use crate::vrm_compat::VrmVersion;
use crate::{BoneTrack, RetargetError, RetargetedAnimation};

/// VRM virtual root bone name (matches bevy_vrm1's Vrm::ROOT_BONE)
const VRM_ROOT_BONE: &str = "VRMC_vrm.root_bone";

fn build_prefix_map(config: &RetargetConfig, fbx: &FbxData) -> HashMap<String, String> {
    let mut map = HashMap::new();

    let mut config_bones: Vec<&str> = Vec::new();
    for src in config.direct_map.keys() {
        config_bones.push(src);
    }
    for bones in config.accumulate.values() {
        for b in bones {
            config_bones.push(b);
        }
    }
    for bones in config.twist_fold.values() {
        for b in bones {
            config_bones.push(b);
        }
    }
    if let Some(ref rb) = config.root_bone {
        config_bones.push(rb);
    }

    for &cfg_bone in &config_bones {
        if fbx.tracks.contains_key(cfg_bone) || fbx.bones.contains_key(cfg_bone) {
            map.insert(cfg_bone.to_string(), cfg_bone.to_string());
            continue;
        }
        for prefix in &config.source_prefix {
            let prefixed = format!("{}{}", prefix, cfg_bone);
            if fbx.tracks.contains_key(&prefixed) || fbx.bones.contains_key(&prefixed) {
                map.insert(cfg_bone.to_string(), prefixed);
                break;
            }
        }
    }

    map
}

/// Convert UE Z-up translation to glTF Y-up (cm → meters).
/// Standard UE left-handed Z-up → glTF right-handed Y-up:
/// (ue_x, ue_y, ue_z) → (ue_x, ue_z, -ue_y)
/// Note: This gives WORLD space glTF coordinates.
/// The virtual root bone's local space may differ if parent has rotation (e.g., 180° Y for 0.x→1.0).
/// The caller (main.rs) should account for parent transforms if needed.
fn ue_to_gltf_translation(ue: Vec3) -> Vec3 {
    Vec3::new(ue.x * 0.01, ue.z * 0.01, -ue.y * 0.01)
}

pub fn retarget(
    fbx: &FbxData,
    config: &RetargetConfig,
    vrm_version: VrmVersion,
) -> Result<RetargetedAnimation, RetargetError> {
    let version_key = vrm_version.config_key();
    let frame_count = fbx.frame_count;
    let duration = fbx.duration;

    let prefix_map = build_prefix_map(config, fbx);

    let timestamps: Vec<f32> = (0..frame_count)
        .map(|i| i as f32 / 30.0)
        .collect();

    let mut result_tracks: Vec<BoneTrack> = Vec::new();

    let resolve = |cfg_name: &str| -> Option<&String> { prefix_map.get(cfg_name) };

    // Compute global rest rotation for each FBX bone
    // Full local rest = PreRotation * Lcl_Rotation_rest (both contribute to bind pose)
    let mut global_rest: HashMap<String, Quat> = HashMap::new();
    let mut local_rest: HashMap<String, Quat> = HashMap::new();
    // Topological order: process parents first
    let mut to_process: Vec<String> = fbx.bones.keys().cloned().collect();
    let mut processed = std::collections::HashSet::new();
    while !to_process.is_empty() {
        let mut progress = false;
        to_process.retain(|name| {
            let bone = &fbx.bones[name];
            let parent_done = bone.parent.as_ref().map_or(true, |p| processed.contains(p));
            if parent_done {
                let parent_global = bone.parent.as_ref()
                    .and_then(|p| global_rest.get(p))
                    .copied()
                    .unwrap_or(Quat::IDENTITY);
                let lcl_rot_rest = crate::fbx::euler_to_quat(
                    bone.rest_rotation_euler,
                    bone.rotation_order,
                );
                let full_local = bone.pre_rotation * lcl_rot_rest;
                local_rest.insert(name.clone(), full_local);
                global_rest.insert(name.clone(), parent_global * full_local);
                processed.insert(name.clone());
                progress = true;
                false // remove from to_process
            } else {
                true // keep
            }
        });
        if !progress { break; }
    }

    // 0. Root bone → VRM virtual root bone (translation + rotation)
    if let Some(ref root_name) = config.root_bone {
        if let Some(fbx_name) = resolve(root_name) {
            if let Some(track) = fbx.tracks.get(fbx_name) {
                let bone = fbx.bones.get(fbx_name);
                let src_rest = bone.map(|b| b.pre_rotation).unwrap_or(Quat::IDENTITY);

                // Root translations: UE Z-up → VRM Y-up, cm → m
                let translations: Vec<Vec3> = track
                    .translations
                    .iter()
                    .map(|&t| ue_to_gltf_translation(t))
                    .collect();

                let src_rest_global = global_rest.get(fbx_name).copied().unwrap_or(src_rest);
                let src_parent_rest_global = bone
                    .and_then(|b| b.parent.as_ref())
                    .and_then(|p| global_rest.get(p))
                    .copied()
                    .unwrap_or(Quat::IDENTITY);
                result_tracks.push(BoneTrack {
                    vrm_bone_name: VRM_ROOT_BONE.to_string(),
                    src_bone_name: fbx_name.clone(),
                    timestamps: timestamps.clone(),
                    rotations: track.rotations.clone(),
                    translations: Some(translations),
                    src_rest,
                    src_rest_global,
                    src_parent_rest_global,
                });
            }
        }
    }

    // 1. Direct mapping — raw deltas
    for (src_bone, vrm_bone_default) in &config.direct_map {
        let vrm_bone = config
            .resolve_vrm_bone(src_bone, version_key)
            .unwrap_or_else(|| vrm_bone_default.clone());

        if config.should_ignore(src_bone) {
            continue;
        }

        let fbx_name = match resolve(src_bone) {
            Some(n) => n,
            None => continue,
        };

        if let Some(track) = fbx.tracks.get(fbx_name) {
            let bone = fbx.bones.get(fbx_name);
            let src_rest = bone.map(|b| b.pre_rotation).unwrap_or(Quat::IDENTITY);

            let src_rest_global = global_rest.get(fbx_name).copied().unwrap_or(src_rest);

            // For hips: include pelvis translation (converted to glTF Y-up)
            let translations = if vrm_bone == "hips" {
                let bone_rest_t = bone.map(|b| b.rest_translation).unwrap_or(Vec3::ZERO);
                Some(track.translations.iter().map(|&t| {
                    // Delta from rest position, converted to glTF Y-up
                    let delta_t = t - bone_rest_t;
                    ue_to_gltf_translation(delta_t)
                }).collect())
            } else {
                None
            };

            let src_parent_rest_global = bone
                .and_then(|b| b.parent.as_ref())
                .and_then(|p| global_rest.get(p))
                .copied()
                .unwrap_or(Quat::IDENTITY);
            result_tracks.push(BoneTrack {
                vrm_bone_name: vrm_bone,
                src_bone_name: fbx_name.clone(),
                timestamps: timestamps.clone(),
                rotations: track.rotations.clone(),
                translations,
                src_rest,
                src_rest_global,
                src_parent_rest_global,
            });
        }
    }

    // 2. Accumulate chains (spine, neck, root+pelvis)
    for (vrm_bone, src_bones) in &config.accumulate {
        let mut accumulated = vec![Quat::IDENTITY; frame_count];
        let mut any_matched = false;
        let mut first_src_rest = Quat::IDENTITY;
        let is_hips = vrm_bone == "hips";

        for (bone_idx, cfg_name) in src_bones.iter().enumerate() {
            let fbx_name = match resolve(cfg_name) {
                Some(n) => n,
                None => continue,
            };

            if let Some(track) = fbx.tracks.get(fbx_name) {
                let bone = fbx.bones.get(fbx_name);
                if bone_idx == 0 {
                    first_src_rest = bone.map(|b| b.pre_rotation).unwrap_or(Quat::IDENTITY);
                }
                any_matched = true;

                for (i, &r) in track.rotations.iter().enumerate() {
                    if i < frame_count {
                        accumulated[i] = accumulated[i] * r;
                    }
                }
            }
        }

        if !any_matched {
            continue;
        }

        // Use LAST bone's global for src_rest_global (accumulated chain endpoint)
        // Use FIRST bone's parent for src_parent_rest_global (chain entry point)
        let first_fbx = src_bones.first().and_then(|n| resolve(n));
        let last_fbx = src_bones.iter().rev()
            .find_map(|n| resolve(n));
        let src_rest_global = last_fbx
            .and_then(|n| global_rest.get(n))
            .copied()
            .unwrap_or(first_src_rest);
        let src_parent_rest_global = first_fbx
            .and_then(|n| fbx.bones.get(n.as_str()))
            .and_then(|b| b.parent.as_ref())
            .and_then(|p| global_rest.get(p))
            .copied()
            .unwrap_or(Quat::IDENTITY);
        // For hips accumulate: include last bone's (pelvis) translation
        let translations = if is_hips {
            let last_cfg = src_bones.last();
            let last_fbx = last_cfg.and_then(|n| resolve(n));
            last_fbx.and_then(|name| {
                let bone = fbx.bones.get(name)?;
                let track = fbx.tracks.get(name)?;
                let bone_rest_t = bone.rest_translation;
                Some(track.translations.iter().map(|&t| {
                    let delta_t = t - bone_rest_t;
                    ue_to_gltf_translation(delta_t)
                }).collect())
            })
        } else {
            None
        };

        // Use last resolved FBX bone name for world rotation lookup
        let acc_src_name = last_fbx.cloned().unwrap_or_default();
        result_tracks.push(BoneTrack {
            vrm_bone_name: vrm_bone.clone(),
            src_bone_name: acc_src_name,
            timestamps: timestamps.clone(),
            rotations: accumulated,
            translations,
            src_rest: first_src_rest,
            src_rest_global,
            src_parent_rest_global,
        });
    }

    // 3. Twist fold — fold twist bone rotations into base bone track
    for (vrm_bone, twist_bones) in &config.twist_fold {
        if let Some(existing) = result_tracks.iter_mut().find(|t| t.vrm_bone_name == *vrm_bone) {
            for cfg_name in twist_bones {
                let fbx_name = match resolve(cfg_name) {
                    Some(n) => n,
                    None => continue,
                };

                if let Some(twist_track) = fbx.tracks.get(fbx_name) {
                    // Fold twist animation into base bone
                    for (i, &r) in twist_track.rotations.iter().enumerate() {
                        if i < existing.rotations.len() {
                            existing.rotations[i] = existing.rotations[i] * r;
                        }
                    }

                    // Also fold twist bone's rest rotation into src_rest_global
                    // so the retarget formula produces identity at rest
                    if let Some(twist_bone) = fbx.bones.get(fbx_name) {
                        let twist_lcl_rest = crate::fbx::euler_to_quat(
                            twist_bone.rest_rotation_euler,
                            twist_bone.rotation_order,
                        );
                        existing.src_rest_global = existing.src_rest_global * twist_lcl_rest;
                    }
                }
            }
        }
    }

    Ok(RetargetedAnimation {
        name: config.name.clone(),
        duration_secs: duration,
        bone_tracks: result_tracks,
        rest_pose_offsets: config.rest_pose_offsets.clone(),
    })
}
