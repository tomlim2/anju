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

                result_tracks.push(BoneTrack {
                    vrm_bone_name: VRM_ROOT_BONE.to_string(),
                    timestamps: timestamps.clone(),
                    rotations: track.rotations.clone(),
                    translations: Some(translations),
                    src_rest,
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
            let bone_pre = bone.map(|b| b.pre_rotation).unwrap_or(Quat::IDENTITY);

            result_tracks.push(BoneTrack {
                vrm_bone_name: vrm_bone,
                timestamps: timestamps.clone(),
                rotations: track.rotations.clone(),
                translations: None,
                src_rest: bone_pre,
            });
        }
    }

    // 2. Accumulate chains (spine, neck)
    for (vrm_bone, src_bones) in &config.accumulate {
        let mut accumulated = vec![Quat::IDENTITY; frame_count];
        let mut any_matched = false;
        let mut first_src_rest = Quat::IDENTITY;

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

        result_tracks.push(BoneTrack {
            vrm_bone_name: vrm_bone.clone(),
            timestamps: timestamps.clone(),
            rotations: accumulated,
            translations: None,
            src_rest: first_src_rest,
        });
    }

    // 3. Twist fold
    for (vrm_bone, twist_bones) in &config.twist_fold {
        if let Some(existing) = result_tracks.iter_mut().find(|t| t.vrm_bone_name == *vrm_bone) {
            for cfg_name in twist_bones {
                let fbx_name = match resolve(cfg_name) {
                    Some(n) => n,
                    None => continue,
                };

                if let Some(twist_track) = fbx.tracks.get(fbx_name) {
                    for (i, &r) in twist_track.rotations.iter().enumerate() {
                        if i < existing.rotations.len() {
                            existing.rotations[i] = existing.rotations[i] * r;
                        }
                    }
                }
            }
        }
    }

    Ok(RetargetedAnimation {
        name: config.name.clone(),
        duration_secs: duration,
        bone_tracks: result_tracks,
    })
}
