use fbxcel::low::v7400::AttributeValue;
use fbxcel::pull_parser::any::AnyParser;
use fbxcel::tree::v7400::{Loader, NodeHandle};
use glam::{Quat, Vec3};
use std::collections::HashMap;
use std::io::Cursor;

use crate::RetargetError;

const FBX_TIME_UNIT: f64 = 46186158000.0;
const SAMPLE_RATE: f32 = 30.0;

#[derive(Debug)]
pub struct FbxData {
    pub bones: HashMap<String, FbxBone>,
    pub tracks: HashMap<String, FbxBoneTrack>,
    pub duration: f32,
    pub frame_count: usize,
}

#[derive(Debug)]
pub struct FbxBone {
    pub parent: Option<String>,
    pub pre_rotation: Quat,
    pub rest_translation: Vec3,
    pub rest_rotation_euler: Vec3,
    pub rotation_order: u8,
}

#[derive(Debug, Clone)]
pub struct FbxBoneTrack {
    pub rotations: Vec<Quat>,
    pub translations: Vec<Vec3>,
}

struct RawModel {
    id: i64,
    name: String,
    pre_rotation: Vec3,
    rest_translation: Vec3,
    rest_rotation: Vec3,
    rotation_order: u8,
}

struct RawAnimCurve {
    id: i64,
    key_times: Vec<f64>,
    key_values: Vec<f32>,
}

struct RawAnimCurveNode {
    id: i64,
}

#[derive(Clone, Copy)]
enum CurveChannel {
    X,
    Y,
    Z,
}

#[derive(Clone, Copy)]
enum CurveProperty {
    Translation,
    Rotation,
}

pub fn parse(data: &[u8]) -> Result<FbxData, RetargetError> {
    let cursor = Cursor::new(data);
    let reader = std::io::BufReader::new(cursor);

    let mut parser = match AnyParser::from_seekable_reader(reader)
        .map_err(|e| RetargetError::FbxParse(format!("FBX header: {}", e)))?
    {
        AnyParser::V7400(p) => p,
        _ => return Err(RetargetError::FbxParse("unsupported FBX version".into())),
    };

    let (tree, _) = Loader::new()
        .load(&mut parser)
        .map_err(|e| RetargetError::FbxParse(format!("FBX tree: {}", e)))?;

    let root = tree.root();

    let mut models: Vec<RawModel> = Vec::new();
    let mut anim_curves: Vec<RawAnimCurve> = Vec::new();
    let mut anim_curve_nodes: Vec<RawAnimCurveNode> = Vec::new();

    let mut oo_connections: Vec<(i64, i64)> = Vec::new();
    let mut op_connections: Vec<(i64, i64, String)> = Vec::new();

    for top_node in root.children() {
        match top_node.name() {
            "Objects" => {
                for obj_node in top_node.children() {
                    match obj_node.name() {
                        "Model" => {
                            if let Some(model) = parse_model(&obj_node) {
                                models.push(model);
                            }
                        }
                        "AnimationCurve" => {
                            if let Some(curve) = parse_anim_curve(&obj_node) {
                                anim_curves.push(curve);
                            }
                        }
                        "AnimationCurveNode" => {
                            if let Some(node) = parse_anim_curve_node(&obj_node) {
                                anim_curve_nodes.push(node);
                            }
                        }
                        _ => {}
                    }
                }
            }
            "Connections" => {
                for conn_node in top_node.children() {
                    if conn_node.name() != "C" {
                        continue;
                    }
                    let attrs = conn_node.attributes();
                    let conn_type = match attrs.get(0).and_then(|a| a.get_string()) {
                        Some(s) => s.to_string(),
                        None => continue,
                    };
                    let child_id = attrs.get(1).and_then(|a| a.get_i64()).unwrap_or(0);
                    let parent_id = attrs.get(2).and_then(|a| a.get_i64()).unwrap_or(0);

                    match conn_type.as_str() {
                        "OO" => oo_connections.push((child_id, parent_id)),
                        "OP" => {
                            let prop = attrs
                                .get(3)
                                .and_then(|a| a.get_string())
                                .unwrap_or("")
                                .to_string();
                            op_connections.push((child_id, parent_id, prop));
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }

    // Build lookups
    let model_id_to_idx: HashMap<i64, usize> = models
        .iter()
        .enumerate()
        .map(|(i, m)| (m.id, i))
        .collect();

    let curve_id_map: HashMap<i64, usize> = anim_curves
        .iter()
        .enumerate()
        .map(|(i, c)| (c.id, i))
        .collect();

    let curve_node_ids: HashMap<i64, usize> = anim_curve_nodes
        .iter()
        .enumerate()
        .map(|(i, n)| (n.id, i))
        .collect();

    // Bone parent hierarchy
    let mut bone_parents: HashMap<String, String> = HashMap::new();
    for &(child_id, parent_id) in &oo_connections {
        if let (Some(&ci), Some(&pi)) =
            (model_id_to_idx.get(&child_id), model_id_to_idx.get(&parent_id))
        {
            bone_parents.insert(models[ci].name.clone(), models[pi].name.clone());
        }
    }

    // AnimCurve → AnimCurveNode (OP: d|X, d|Y, d|Z)
    let mut cn_curves: HashMap<i64, Vec<(CurveChannel, usize)>> = HashMap::new();
    for (child_id, parent_id, prop) in &op_connections {
        if let Some(&curve_idx) = curve_id_map.get(child_id) {
            if curve_node_ids.contains_key(parent_id) {
                let ch = match prop.as_str() {
                    "d|X" => CurveChannel::X,
                    "d|Y" => CurveChannel::Y,
                    "d|Z" => CurveChannel::Z,
                    _ => continue,
                };
                cn_curves.entry(*parent_id).or_default().push((ch, curve_idx));
            }
        }
    }

    // AnimCurveNode → Model (OP: Lcl Translation/Rotation)
    let mut model_cn: HashMap<i64, Vec<(CurveProperty, i64)>> = HashMap::new();
    for (child_id, parent_id, prop) in &op_connections {
        if curve_node_ids.contains_key(child_id) && model_id_to_idx.contains_key(parent_id) {
            let cp = match prop.as_str() {
                "Lcl Translation" => CurveProperty::Translation,
                "Lcl Rotation" => CurveProperty::Rotation,
                _ => continue,
            };
            model_cn.entry(*parent_id).or_default().push((cp, *child_id));
        }
    }

    // Find global time range
    let mut min_time = f64::MAX;
    let mut max_time = f64::MIN;
    for curve in &anim_curves {
        for &t in &curve.key_times {
            let secs = t / FBX_TIME_UNIT;
            min_time = min_time.min(secs);
            max_time = max_time.max(secs);
        }
    }

    if min_time >= max_time {
        return Err(RetargetError::FbxParse("no animation data found".into()));
    }

    let duration = (max_time - min_time) as f32;
    let frame_count = (duration * SAMPLE_RATE).ceil() as usize + 1;
    let sample_times: Vec<f64> = (0..frame_count)
        .map(|i| min_time + (i as f64 / SAMPLE_RATE as f64))
        .collect();

    // Build bones
    let mut bones: HashMap<String, FbxBone> = HashMap::new();
    for model in &models {
        bones.insert(
            model.name.clone(),
            FbxBone {
                parent: bone_parents.get(&model.name).cloned(),
                pre_rotation: euler_to_quat_xyz(model.pre_rotation),
                rest_translation: model.rest_translation,
                rest_rotation_euler: model.rest_rotation,
                rotation_order: model.rotation_order,
            },
        );
    }

    // Build animation tracks
    let mut tracks: HashMap<String, FbxBoneTrack> = HashMap::new();

    for model in &models {
        let cns = match model_cn.get(&model.id) {
            Some(cn) => cn,
            None => continue,
        };

        let mut rot_curves: [Option<&RawAnimCurve>; 3] = [None, None, None];
        let mut trans_curves: [Option<&RawAnimCurve>; 3] = [None, None, None];

        for &(cp, cn_id) in cns {
            if let Some(channels) = cn_curves.get(&cn_id) {
                for &(ch, idx) in channels {
                    let slot = match ch {
                        CurveChannel::X => 0,
                        CurveChannel::Y => 1,
                        CurveChannel::Z => 2,
                    };
                    match cp {
                        CurveProperty::Rotation => rot_curves[slot] = Some(&anim_curves[idx]),
                        CurveProperty::Translation => trans_curves[slot] = Some(&anim_curves[idx]),
                    }
                }
            }
        }

        let has_rot = rot_curves.iter().any(|c| c.is_some());
        let has_trans = trans_curves.iter().any(|c| c.is_some());

        if !has_rot && !has_trans {
            continue;
        }

        let mut rotations = Vec::with_capacity(frame_count);
        let mut translations = Vec::with_capacity(frame_count);

        for &t in &sample_times {
            if has_rot {
                let rx = sample_curve(rot_curves[0], t, model.rest_rotation.x as f64);
                let ry = sample_curve(rot_curves[1], t, model.rest_rotation.y as f64);
                let rz = sample_curve(rot_curves[2], t, model.rest_rotation.z as f64);
                rotations.push(euler_to_quat(
                    Vec3::new(rx as f32, ry as f32, rz as f32),
                    model.rotation_order,
                ));
            }

            if has_trans {
                let tx = sample_curve(trans_curves[0], t, model.rest_translation.x as f64);
                let ty = sample_curve(trans_curves[1], t, model.rest_translation.y as f64);
                let tz = sample_curve(trans_curves[2], t, model.rest_translation.z as f64);
                translations.push(Vec3::new(tx as f32, ty as f32, tz as f32));
            }
        }

        if !has_rot {
            let rest = euler_to_quat(model.rest_rotation, model.rotation_order);
            rotations = vec![rest; frame_count];
        }
        if !has_trans {
            translations = vec![model.rest_translation; frame_count];
        }

        tracks.insert(model.name.clone(), FbxBoneTrack { rotations, translations });
    }

    Ok(FbxData { bones, tracks, duration, frame_count })
}

fn parse_model(node: &NodeHandle<'_>) -> Option<RawModel> {
    let attrs = node.attributes();
    let id = attrs.get(0)?.get_i64()?;
    let full_name = attrs.get(1)?.get_string()?;

    let name = full_name.split('\x00').next().unwrap_or(full_name).to_string();

    let mut pre_rotation = Vec3::ZERO;
    let mut rest_translation = Vec3::ZERO;
    let mut rest_rotation = Vec3::ZERO;
    let mut rotation_order: u8 = 0;

    if let Some(props) = node.first_child_by_name("Properties70") {
        for prop in props.children() {
            if prop.name() != "P" {
                continue;
            }
            let pa = prop.attributes();
            let prop_name = match pa.first().and_then(|a| a.get_string()) {
                Some(s) => s,
                None => continue,
            };

            match prop_name {
                "PreRotation" => {
                    pre_rotation = extract_vec3(pa, 4);
                }
                "Lcl Translation" => {
                    rest_translation = extract_vec3(pa, 4);
                }
                "Lcl Rotation" => {
                    rest_rotation = extract_vec3(pa, 4);
                }
                "RotationOrder" => {
                    rotation_order = pa.get(4).and_then(|a| a.get_i32()).unwrap_or(0) as u8;
                }
                _ => {}
            }
        }
    }

    Some(RawModel {
        id,
        name,
        pre_rotation,
        rest_translation,
        rest_rotation,
        rotation_order,
    })
}

fn parse_anim_curve(node: &NodeHandle<'_>) -> Option<RawAnimCurve> {
    let attrs = node.attributes();
    let id = attrs.get(0)?.get_i64()?;

    let mut key_times: Vec<f64> = Vec::new();
    let mut key_values: Vec<f32> = Vec::new();

    if let Some(kt_node) = node.first_child_by_name("KeyTime") {
        let ka = kt_node.attributes();
        if let Some(arr) = ka.get(0).and_then(|a| a.get_arr_i64()) {
            key_times = arr.iter().map(|&t| t as f64).collect();
        }
    }

    if let Some(kv_node) = node.first_child_by_name("KeyValueFloat") {
        let ka = kv_node.attributes();
        if let Some(arr) = ka.get(0).and_then(|a| a.get_arr_f32()) {
            key_values = arr.to_vec();
        }
        // Some FBX files use f64 for key values
        if key_values.is_empty() {
            if let Some(arr) = ka.get(0).and_then(|a| a.get_arr_f64()) {
                key_values = arr.iter().map(|&v| v as f32).collect();
            }
        }
    }

    if key_times.is_empty() || key_values.is_empty() {
        return None;
    }

    Some(RawAnimCurve { id, key_times, key_values })
}

fn parse_anim_curve_node(node: &NodeHandle<'_>) -> Option<RawAnimCurveNode> {
    let id = node.attributes().get(0)?.get_i64()?;
    Some(RawAnimCurveNode { id })
}

fn sample_curve(curve: Option<&RawAnimCurve>, t_secs: f64, default: f64) -> f64 {
    let curve = match curve {
        Some(c) => c,
        None => return default,
    };

    let t = t_secs * FBX_TIME_UNIT;

    if curve.key_times.is_empty() {
        return default;
    }
    if t <= curve.key_times[0] {
        return curve.key_values[0] as f64;
    }
    let last = curve.key_times.len() - 1;
    if t >= curve.key_times[last] {
        return curve.key_values[last] as f64;
    }

    // Binary search
    let mut lo = 0;
    let mut hi = last;
    while lo < hi - 1 {
        let mid = (lo + hi) / 2;
        if curve.key_times[mid] <= t {
            lo = mid;
        } else {
            hi = mid;
        }
    }

    let t0 = curve.key_times[lo];
    let t1 = curve.key_times[hi];
    let v0 = curve.key_values[lo] as f64;
    let v1 = curve.key_values[hi] as f64;

    let alpha = if (t1 - t0).abs() > f64::EPSILON {
        (t - t0) / (t1 - t0)
    } else {
        0.0
    };

    v0 + (v1 - v0) * alpha
}

pub fn euler_to_quat(degrees: Vec3, order: u8) -> Quat {
    let r = degrees * (std::f32::consts::PI / 180.0);
    match order {
        0 => Quat::from_euler(glam::EulerRot::XYZ, r.x, r.y, r.z),
        1 => Quat::from_euler(glam::EulerRot::XZY, r.x, r.z, r.y),
        2 => Quat::from_euler(glam::EulerRot::YZX, r.y, r.z, r.x),
        3 => Quat::from_euler(glam::EulerRot::YXZ, r.y, r.x, r.z),
        4 => Quat::from_euler(glam::EulerRot::ZXY, r.z, r.x, r.y),
        5 => Quat::from_euler(glam::EulerRot::ZYX, r.z, r.y, r.x),
        _ => Quat::from_euler(glam::EulerRot::XYZ, r.x, r.y, r.z),
    }
}

fn euler_to_quat_xyz(degrees: Vec3) -> Quat {
    euler_to_quat(degrees, 0)
}

fn extract_vec3(attrs: &[AttributeValue], start: usize) -> Vec3 {
    Vec3::new(
        attrs.get(start).and_then(|a| a.get_f64()).unwrap_or(0.0) as f32,
        attrs.get(start + 1).and_then(|a| a.get_f64()).unwrap_or(0.0) as f32,
        attrs.get(start + 2).and_then(|a| a.get_f64()).unwrap_or(0.0) as f32,
    )
}
