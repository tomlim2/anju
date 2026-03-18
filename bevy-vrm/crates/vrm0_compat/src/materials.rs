use crate::ConvertError;
use serde_json::{json, Value};

/// Gamma → linear conversion for a single channel.
fn gamma_to_linear(v: f64) -> f64 {
    v.powf(2.2)
}

/// Convert a VRM 0.x RGBA color array (gamma) to linear [R, G, B].
fn color_to_linear(arr: &[Value]) -> [f64; 3] {
    let r = arr.first().and_then(|v| v.as_f64()).unwrap_or(1.0);
    let g = arr.get(1).and_then(|v| v.as_f64()).unwrap_or(1.0);
    let b = arr.get(2).and_then(|v| v.as_f64()).unwrap_or(1.0);
    [gamma_to_linear(r), gamma_to_linear(g), gamma_to_linear(b)]
}

/// Convert a VRM 0.x RGBA color array (gamma) to linear [R, G, B, A].
fn color_to_linear_rgba(arr: &[Value]) -> [f64; 4] {
    let rgb = color_to_linear(arr);
    let a = arr.get(3).and_then(|v| v.as_f64()).unwrap_or(1.0);
    [rgb[0], rgb[1], rgb[2], a]
}

/// Get float property from VRM 0.x floatProperties object.
fn get_float(props: &Value, key: &str) -> Option<f64> {
    props.get("floatProperties")?.get(key)?.as_f64()
}

/// Get vector property from VRM 0.x vectorProperties object.
fn get_vec<'a>(props: &'a Value, key: &str) -> Option<&'a Vec<Value>> {
    props.get("vectorProperties")?.get(key)?.as_array()
}

/// Get texture index from VRM 0.x textureProperties object.
fn get_tex(props: &Value, key: &str) -> Option<i64> {
    props.get("textureProperties")?.get(key)?.as_i64()
}

/// Map VRM 0.x _OutlineWidthMode to VRM 1.0 outlineWidthMode string.
fn outline_width_mode(mode: f64) -> &'static str {
    match mode as i32 {
        1 => "worldCoordinates",
        2 => "screenCoordinates",
        _ => "none",
    }
}

/// Convert VRM 0.x materialProperties[] → glTF materials[] with VRMC_materials_mtoon extensions.
///
/// Modifies the root JSON in-place:
/// - Updates each material in `json["materials"]` with proper PBR + MToon extension data
pub fn convert(json: &mut Value, material_properties: &Value) -> Result<(), ConvertError> {
    let mat_props = match material_properties.as_array() {
        Some(arr) => arr,
        None => return Ok(()), // no materials to convert
    };

    let materials = json
        .get_mut("materials")
        .and_then(|v| v.as_array_mut())
        .ok_or(ConvertError::MissingField("materials"))?;

    for (i, props) in mat_props.iter().enumerate() {
        let shader = props.get("shader").and_then(|v| v.as_str()).unwrap_or("");

        // Only convert MToon materials
        if shader != "VRM/MToon" && shader != "VRM/UnlitTransparentZWrite" {
            continue;
        }

        if i >= materials.len() {
            break;
        }

        let mat = &mut materials[i];

        // --- PBR base ---
        let base_color = get_vec(props, "_Color")
            .map(|c| color_to_linear_rgba(c))
            .unwrap_or([1.0, 1.0, 1.0, 1.0]);

        let mut pbr = json!({
            "baseColorFactor": base_color,
            "metallicFactor": 0.0,
            "roughnessFactor": 0.9,
        });

        // Base color texture
        if let Some(tex_idx) = get_tex(props, "_MainTex") {
            pbr["baseColorTexture"] = json!({ "index": tex_idx });
        }

        mat["pbrMetallicRoughness"] = pbr;

        // Alpha mode from renderQueue
        let render_queue = get_float(props, "_BlendMode").unwrap_or(0.0) as i32;
        match render_queue {
            1 => {
                mat["alphaMode"] = json!("MASK");
                let cutoff = get_float(props, "_Cutoff").unwrap_or(0.5);
                mat["alphaCutoff"] = json!(cutoff);
            }
            2 | 3 => {
                mat["alphaMode"] = json!("BLEND");
            }
            _ => {
                mat["alphaMode"] = json!("OPAQUE");
            }
        }

        // Double-sided
        mat["doubleSided"] = json!(true);

        // --- VRMC_materials_mtoon extension ---
        let shade_color = get_vec(props, "_ShadeColor")
            .map(|c| color_to_linear(c))
            .unwrap_or([0.8, 0.8, 0.8]);

        let shading_toony = get_float(props, "_ShadeToony").unwrap_or(0.9);
        let shading_shift = get_float(props, "_ShadeShift").unwrap_or(0.0);

        let outline_width = get_float(props, "_OutlineWidth").unwrap_or(0.0) * 0.01; // cm→m
        let outline_mode = get_float(props, "_OutlineWidthMode").unwrap_or(0.0);
        let outline_color = get_vec(props, "_OutlineColor")
            .map(|c| color_to_linear(c))
            .unwrap_or([0.0, 0.0, 0.0]);
        let outline_lighting_mix =
            get_float(props, "_OutlineColorMode").unwrap_or(0.0).min(1.0);

        let rim_color = get_vec(props, "_RimColor")
            .map(|c| color_to_linear(c))
            .unwrap_or([0.0, 0.0, 0.0]);
        let rim_fresnel = get_float(props, "_RimFresnelPower").unwrap_or(5.0);
        let rim_lift = get_float(props, "_RimLift").unwrap_or(0.0);
        let rim_lighting_mix = get_float(props, "_RimLightingMix").unwrap_or(1.0);

        // UV animation
        let uv_scroll_x = get_float(props, "_UvAnimScrollX").unwrap_or(0.0);
        let uv_scroll_y = get_float(props, "_UvAnimScrollY").map(|v| -v).unwrap_or(0.0); // Y invert
        let uv_rotation = get_float(props, "_UvAnimRotation").unwrap_or(0.0);

        let render_queue_val =
            props.get("renderQueue").and_then(|v| v.as_f64()).unwrap_or(3000.0);
        let render_queue_offset = render_queue_val - 3000.0;

        let mut mtoon = json!({
            "specVersion": "1.0",
            "shadeColorFactor": shade_color,
            "shadingToonyFactor": shading_toony,
            "shadingShiftFactor": shading_shift,
            "matcapFactor": [0.0, 0.0, 0.0],
            "parametricRimColorFactor": rim_color,
            "parametricRimFresnelPowerFactor": rim_fresnel,
            "parametricRimLiftFactor": rim_lift,
            "rimLightingMixFactor": rim_lighting_mix,
            "outlineWidthMode": outline_width_mode(outline_mode),
            "outlineWidthFactor": outline_width,
            "outlineColorFactor": outline_color,
            "outlineLightingMixFactor": outline_lighting_mix,
            "uvAnimationScrollXSpeedFactor": uv_scroll_x,
            "uvAnimationScrollYSpeedFactor": uv_scroll_y,
            "uvAnimationRotationSpeedFactor": uv_rotation,
            "renderQueueOffsetNumber": render_queue_offset,
            "giEqualizationFactor": 0.9,
            "transparentWithZWrite": false,
        });

        // Shade multiply texture
        if let Some(tex_idx) = get_tex(props, "_ShadeTexture") {
            mtoon["shadeMultiplyTexture"] = json!({
                "index": tex_idx,
                "extensions": {
                    "KHR_texture_transform": {
                        "offset": [0.0, 0.0],
                        "scale": [1.0, 1.0]
                    }
                }
            });
        }

        // Insert extension into material
        if mat.get("extensions").is_none() {
            mat["extensions"] = json!({});
        }
        mat["extensions"]["VRMC_materials_mtoon"] = mtoon;
    }

    Ok(())
}
