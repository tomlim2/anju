use crate::ConvertError;
use serde_json::{json, Value};

/// VRM 0.x preset name → VRM 1.0 preset name
fn rename_preset(name: &str) -> Option<&'static str> {
    Some(match name.to_lowercase().as_str() {
        "joy" | "happy" => "happy",
        "angry" => "angry",
        "sorrow" | "sad" => "sad",
        "fun" | "relaxed" => "relaxed",
        "surprised" => "surprised",
        "neutral" => "neutral",
        "a" | "aa" => "aa",
        "i" | "ih" => "ih",
        "u" | "ou" => "ou",
        "e" | "ee" => "ee",
        "o" | "oh" => "oh",
        "blink" => "blink",
        "blink_l" | "blinkleft" => "blinkLeft",
        "blink_r" | "blinkright" => "blinkRight",
        "lookup" | "lookUp" => "lookUp",
        "lookdown" | "lookDown" => "lookDown",
        "lookleft" | "lookLeft" => "lookLeft",
        "lookright" | "lookRight" => "lookRight",
        _ => return None,
    })
}

/// Convert VRM 0.x blendShapeMaster → VRM 1.0 expressions.
///
/// Input: `extensions.VRM.blendShapeMaster`
/// Output: `VRMC_vrm.expressions` value
pub fn convert(blend_shape_master: &Value) -> Result<Value, ConvertError> {
    let groups = match blend_shape_master
        .get("blendShapeGroups")
        .and_then(|v| v.as_array())
    {
        Some(arr) => arr,
        None => return Ok(json!({ "preset": {}, "custom": {} })),
    };

    let mut preset = serde_json::Map::new();
    let mut custom = serde_json::Map::new();

    for group in groups {
        let preset_name = group.get("presetName").and_then(|v| v.as_str()).unwrap_or("");
        let name = group.get("name").and_then(|v| v.as_str()).unwrap_or("");

        // Convert morph target binds
        let binds = group
            .get("binds")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|bind| {
                        let mesh = bind.get("mesh")?.as_u64()?;
                        let index = bind.get("index")?.as_u64()?;
                        let weight = bind.get("weight")?.as_f64().unwrap_or(0.0);
                        Some(json!({
                            "node": mesh,  // VRM 0.x mesh index maps to node
                            "index": index,
                            "weight": weight / 100.0  // 0-100 → 0.0-1.0
                        }))
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        let expression = json!({
            "morphTargetBinds": binds,
            "materialColorBinds": [],
            "textureTransformBinds": [],
            "isBinary": group.get("isBinary").and_then(|v| v.as_bool()).unwrap_or(false),
            "overrideBlink": "none",
            "overrideLookAt": "none",
            "overrideMouth": "none",
        });

        if let Some(renamed) = rename_preset(preset_name) {
            preset.insert(renamed.to_string(), expression);
        } else if !name.is_empty() {
            custom.insert(name.to_string(), expression);
        }
    }

    Ok(json!({
        "preset": preset,
        "custom": custom,
    }))
}
