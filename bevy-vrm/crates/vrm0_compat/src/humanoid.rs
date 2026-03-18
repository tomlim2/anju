use crate::ConvertError;
use serde_json::{json, Value};

/// VRM 0.x bone name → VRM 1.0 bone name remap table.
/// Only entries that differ are listed; unlisted names pass through as-is.
const BONE_RENAMES: &[(&str, &str)] = &[
    ("leftThumbIntermediate", "leftThumbMetacarpal"),
    ("rightThumbIntermediate", "rightThumbMetacarpal"),
    ("leftThumbProximal", "leftThumbProximal"),
    ("rightThumbProximal", "rightThumbProximal"),
];

fn rename_bone(name: &str) -> &str {
    for &(old, new) in BONE_RENAMES {
        if name == old {
            return new;
        }
    }
    name
}

/// Convert VRM 0.x humanoid (array of bone objects) → VRM 1.0 humanoid (object map).
///
/// Input:  `{ "humanBones": [{"bone":"hips","node":0}, ...] }`
/// Output: `{ "humanBones": {"hips":{"node":0}, ...} }`
pub fn convert(humanoid: &Value) -> Result<Value, ConvertError> {
    let bones_array = humanoid
        .get("humanBones")
        .and_then(|v| v.as_array())
        .ok_or(ConvertError::MissingField("humanoid.humanBones"))?;

    let mut bones_map = serde_json::Map::new();

    for bone in bones_array {
        let bone_name = bone
            .get("bone")
            .and_then(|v| v.as_str())
            .ok_or(ConvertError::MissingField("humanBones[].bone"))?;
        let node = bone
            .get("node")
            .ok_or(ConvertError::MissingField("humanBones[].node"))?;

        let renamed = rename_bone(bone_name);
        bones_map.insert(renamed.to_string(), json!({ "node": node }));
    }

    Ok(json!({ "humanBones": bones_map }))
}
