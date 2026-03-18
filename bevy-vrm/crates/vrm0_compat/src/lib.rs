mod glb;
pub mod humanoid;
pub mod meta;
pub mod materials;
pub mod expressions;
pub mod spring_bone;

use thiserror::Error;

#[derive(Error, Debug)]
pub enum ConvertError {
    #[error("invalid GLB: {0}")]
    InvalidGlb(&'static str),
    #[error("JSON error: {0}")]
    Json(String),
    #[error("missing field: {0}")]
    MissingField(&'static str),
}

/// Convert a VRM 0.x GLB binary to VRM 1.0 GLB binary.
///
/// Rewrites only the JSON chunk; BIN chunk (meshes, textures) passes through unchanged.
pub fn convert(glb_bytes: &[u8]) -> Result<Vec<u8>, ConvertError> {
    let glb::GlbParts { mut json, bin } = glb::parse(glb_bytes)?;

    // Extract VRM 0.x extension
    let vrm_ext = json
        .pointer("/extensions/VRM")
        .cloned()
        .ok_or(ConvertError::MissingField("extensions.VRM"))?;

    // --- Phase 1: Minimum rendering (mesh + textures) ---
    let humanoid = humanoid::convert(&vrm_ext["humanoid"])?;
    let vrm_meta = meta::convert(&vrm_ext["meta"])?;
    materials::convert(&mut json, &vrm_ext["materialProperties"])?;

    // --- Phase 2: Expressions ---
    let vrm_expressions = if vrm_ext.get("blendShapeMaster").is_some() {
        Some(expressions::convert(&vrm_ext["blendShapeMaster"])?)
    } else {
        None
    };

    // --- Phase 3: Spring bones ---
    let spring_bone = if vrm_ext.get("secondaryAnimation").is_some() {
        let nodes = json.get("nodes").cloned().unwrap_or(serde_json::json!([]));
        Some(spring_bone::convert(&vrm_ext["secondaryAnimation"], &nodes)?)
    } else {
        None
    };

    // Build VRMC_vrm extension
    let mut vrmc_vrm = serde_json::json!({
        "specVersion": "1.0",
        "humanoid": humanoid,
        "meta": vrm_meta,
    });

    if let Some(expr) = vrm_expressions {
        vrmc_vrm["expressions"] = expr;
    }

    // Insert extensions
    json["extensions"]["VRMC_vrm"] = vrmc_vrm;

    if let Some(sb) = spring_bone {
        json["extensions"]["VRMC_springBone"] = sb;
    }

    // Remove old VRM extension
    if let Some(ext) = json.get_mut("extensions").and_then(|v| v.as_object_mut()) {
        ext.remove("VRM");
    }

    // Rotate root nodes 180° around Y (VRM 0.x Z- forward → VRM 1.0 Z+ forward)
    flip_root_nodes(&mut json);

    // Update extensionsUsed
    update_extensions_used(&mut json);

    glb::rebuild(json, bin)
}

/// Apply 180° Y rotation to scene root nodes.
/// VRM 0.x mesh data faces Z-, VRM 1.0 expects Z+ forward.
/// Quaternion for 180° around Y: [x=0, y=1, z=0, w=0]
fn flip_root_nodes(json: &mut serde_json::Value) {
    // glTF rotation quaternion [x, y, z, w] for 180° Y rotation
    let rot_180_y = serde_json::json!([0.0, 1.0, 0.0, 0.0]);

    // Get scene root node indices
    let root_indices: Vec<u64> = json
        .pointer("/scenes/0/nodes")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_u64()).collect())
        .unwrap_or_default();

    if let Some(nodes) = json.get_mut("nodes").and_then(|v| v.as_array_mut()) {
        for &idx in &root_indices {
            if let Some(node) = nodes.get_mut(idx as usize) {
                // If node has no rotation, just set it
                // If it already has rotation, compose (but 0.x roots typically have identity)
                node["rotation"] = rot_180_y.clone();
            }
        }
    }
}

fn update_extensions_used(json: &mut serde_json::Value) {
    let used = json
        .get_mut("extensionsUsed")
        .and_then(|v| v.as_array_mut());

    if let Some(arr) = used {
        // Remove "VRM"
        arr.retain(|v| v.as_str() != Some("VRM"));

        // Add new extensions if not present
        let to_add = ["VRMC_vrm", "VRMC_materials_mtoon", "VRMC_springBone"];
        for ext in &to_add {
            if !arr.iter().any(|v| v.as_str() == Some(ext)) {
                arr.push(serde_json::json!(ext));
            }
        }
    } else {
        json["extensionsUsed"] = serde_json::json!([
            "VRMC_vrm",
            "VRMC_materials_mtoon",
            "VRMC_springBone",
            "KHR_materials_unlit",
            "KHR_texture_transform",
        ]);
    }
}
