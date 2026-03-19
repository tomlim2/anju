pub mod config;
pub mod fbx;
pub mod mapping;
pub mod vrm_compat;

use glam::{Quat, Vec3};
use thiserror::Error;

use config::RetargetConfig;
use vrm_compat::VrmVersion;

#[derive(Error, Debug)]
pub enum RetargetError {
    #[error("FBX parse error: {0}")]
    FbxParse(String),
    #[error("config error: {0}")]
    Config(String),
    #[error("mapping error: {0}")]
    Mapping(String),
}

impl From<serde_json::Error> for RetargetError {
    fn from(e: serde_json::Error) -> Self {
        RetargetError::Config(e.to_string())
    }
}

#[derive(Debug)]
pub struct RetargetedAnimation {
    pub name: String,
    pub duration_secs: f32,
    pub bone_tracks: Vec<BoneTrack>,
}

#[derive(Debug)]
pub struct BoneTrack {
    pub vrm_bone_name: String,
    pub timestamps: Vec<f32>,
    /// Raw animation deltas (Lcl Rotation as quat, WITHOUT PreRotation)
    pub rotations: Vec<Quat>,
    pub translations: Option<Vec<Vec3>>,
    /// Source bone rest pose (FBX PreRotation) — needed for rest pose correction
    pub src_rest: Quat,
}

/// Computed world-space bone positions per frame for visualization.
#[derive(Debug)]
pub struct FbxSkeletonFrames {
    pub frame_count: usize,
    pub duration: f32,
    /// bone_name → Vec of world positions per frame
    pub bone_positions: std::collections::HashMap<String, Vec<[f32; 3]>>,
    /// bone_name → parent_name
    pub hierarchy: std::collections::HashMap<String, String>,
}

pub struct FbxDiagnostics {
    pub all_bones: Vec<String>,
    pub animated_bones: Vec<String>,
    pub matched_direct: Vec<(String, String)>,
    pub unmatched_config: Vec<String>,
}

/// Compute world-space bone positions for each frame of the FBX animation.
/// Used for debug visualization of the source skeleton.
pub fn compute_fbx_skeleton(fbx_data: &[u8]) -> Result<FbxSkeletonFrames, RetargetError> {
    let fbx = fbx::parse(fbx_data)?;

    let frame_count = fbx.frame_count;
    let duration = fbx.duration;

    // Build hierarchy (name → parent_name)
    let mut hierarchy: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    for (name, bone) in &fbx.bones {
        if let Some(ref parent) = bone.parent {
            hierarchy.insert(name.clone(), parent.clone());
        }
    }

    // Topological sort: process parents before children
    let mut ordered: Vec<String> = Vec::new();
    let mut visited: std::collections::HashSet<String> = std::collections::HashSet::new();

    fn visit(
        name: &str,
        bones: &std::collections::HashMap<String, fbx::FbxBone>,
        visited: &mut std::collections::HashSet<String>,
        ordered: &mut Vec<String>,
    ) {
        if visited.contains(name) { return; }
        if let Some(bone) = bones.get(name) {
            if let Some(ref parent) = bone.parent {
                visit(parent, bones, visited, ordered);
            }
        }
        visited.insert(name.to_string());
        ordered.push(name.to_string());
    }

    for name in fbx.bones.keys() {
        visit(name, &fbx.bones, &mut visited, &mut ordered);
    }

    // Compute world transforms per frame
    // world = parent_world * T(rest_translation) * PreRotation * animated_rotation
    let mut bone_positions: std::collections::HashMap<String, Vec<[f32; 3]>> =
        std::collections::HashMap::new();

    for frame in 0..frame_count {
        let mut world_transforms: std::collections::HashMap<String, (glam::Vec3, glam::Quat)> =
            std::collections::HashMap::new();

        for name in &ordered {
            let bone = match fbx.bones.get(name) {
                Some(b) => b,
                None => continue,
            };

            let (parent_pos, parent_rot) = bone
                .parent
                .as_ref()
                .and_then(|p| world_transforms.get(p))
                .copied()
                .unwrap_or((glam::Vec3::ZERO, glam::Quat::IDENTITY));

            let rest_t = bone.rest_translation;
            let pre_rot = bone.pre_rotation;

            let anim_rot = fbx.tracks.get(name)
                .and_then(|t| t.rotations.get(frame))
                .copied()
                .unwrap_or(glam::Quat::IDENTITY);

            let anim_t = fbx.tracks.get(name)
                .and_then(|t| t.translations.get(frame))
                .copied()
                .unwrap_or(rest_t);

            // World position = parent_world * local_translation
            // Local rotation = PreRotation * animated_rotation
            let local_rot = pre_rot * anim_rot;
            let world_pos = parent_pos + parent_rot * anim_t * 0.01; // cm → m
            let world_rot = parent_rot * local_rot;

            world_transforms.insert(name.clone(), (world_pos, world_rot));
        }

        for name in &ordered {
            if let Some(&(pos, _)) = world_transforms.get(name) {
                bone_positions
                    .entry(name.clone())
                    .or_default()
                    .push([pos.x, pos.y, pos.z]);
            }
        }
    }

    Ok(FbxSkeletonFrames {
        frame_count,
        duration,
        bone_positions,
        hierarchy,
    })
}

pub fn retarget(
    fbx_data: &[u8],
    config_json: &str,
    vrm_version: VrmVersion,
) -> Result<(RetargetedAnimation, FbxDiagnostics), RetargetError> {
    let config = RetargetConfig::from_json(config_json)?;
    let fbx = fbx::parse(fbx_data)?;

    let mut all_bones: Vec<String> = fbx.bones.keys().cloned().collect();
    all_bones.sort();
    let mut animated_bones: Vec<String> = fbx.tracks.keys().cloned().collect();
    animated_bones.sort();

    let version_key = vrm_version.config_key();
    let mut matched_direct = Vec::new();
    let mut unmatched_config = Vec::new();

    for (src, _vrm_default) in &config.direct_map {
        let vrm = config
            .resolve_vrm_bone(src, version_key)
            .unwrap_or_else(|| _vrm_default.clone());
        let found = fbx.tracks.contains_key(src)
            || config.source_prefix.iter().any(|p| {
                fbx.tracks.contains_key(&format!("{}{}", p, src))
            });
        if found {
            matched_direct.push((src.clone(), vrm));
        } else {
            unmatched_config.push(src.clone());
        }
    }

    let diag = FbxDiagnostics {
        all_bones,
        animated_bones,
        matched_direct,
        unmatched_config,
    };

    let anim = mapping::retarget(&fbx, &config, vrm_version)?;
    Ok((anim, diag))
}
