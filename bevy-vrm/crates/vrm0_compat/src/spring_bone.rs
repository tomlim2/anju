use crate::ConvertError;
use serde_json::{json, Value};
use std::collections::HashMap;

/// Convert VRM 0.x secondaryAnimation → VRMC_springBone extension.
///
/// bevy_vrm1 expects:
/// - `colliders`: flat array of `{node, shape}`
/// - `colliderGroups`: array of `{name?, colliders: [u64]}` (indices into colliders[])
/// - `springs`: array of `{name, joints, colliderGroups?: [usize]}` (indices into colliderGroups[])
pub fn convert(
    secondary_animation: &Value,
    nodes: &Value,
) -> Result<Value, ConvertError> {
    let nodes_arr = nodes.as_array().ok_or(ConvertError::MissingField("nodes"))?;

    // --- Colliders (flat) + ColliderGroups (index refs) ---
    let mut colliders = Vec::new();
    let mut collider_groups = Vec::new();

    if let Some(groups) = secondary_animation
        .get("colliderGroups")
        .and_then(|v| v.as_array())
    {
        for (gi, group) in groups.iter().enumerate() {
            let node = group.get("node").and_then(|v| v.as_u64()).unwrap_or(0);
            let group_colliders = group.get("colliders").and_then(|v| v.as_array());

            let mut indices = Vec::new();
            if let Some(cols) = group_colliders {
                for col in cols {
                    let idx = colliders.len();
                    let offset = col.get("offset").and_then(|v| v.as_object());
                    let (ox, oy, oz) = if let Some(o) = offset {
                        (
                            o.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0),
                            o.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0),
                            o.get("z").and_then(|v| v.as_f64()).unwrap_or(0.0),
                        )
                    } else {
                        (0.0, 0.0, 0.0)
                    };

                    let radius = col.get("radius").and_then(|v| v.as_f64()).unwrap_or(0.0);

                    colliders.push(json!({
                        "node": node,
                        "shape": {
                            "sphere": {
                                "offset": [ox, oy, -oz],
                                "radius": radius
                            }
                        }
                    }));
                    indices.push(json!(idx));
                }
            }

            collider_groups.push(json!({
                "name": format!("group_{}", gi),
                "colliders": indices,
            }));
        }
    }

    // --- Springs ---
    let mut springs = Vec::new();

    if let Some(bone_groups) = secondary_animation
        .get("boneGroups")
        .and_then(|v| v.as_array())
    {
        let children_map = build_children_map(nodes_arr);

        for (si, group) in bone_groups.iter().enumerate() {
            let comment = group.get("comment").and_then(|v| v.as_str()).unwrap_or("");
            let stiffness = group.get("stiffiness").and_then(|v| v.as_f64()).unwrap_or(1.0);
            let drag = group.get("dragForce").and_then(|v| v.as_f64()).unwrap_or(0.5);
            let hit_radius = group.get("hitRadius").and_then(|v| v.as_f64()).unwrap_or(0.02);
            let gravity_power = group.get("gravityPower").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let gravity_dir = group.get("gravityDir").and_then(|v| v.as_object());
            let (gx, gy, gz) = if let Some(g) = gravity_dir {
                (
                    g.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0),
                    g.get("y").and_then(|v| v.as_f64()).unwrap_or(-1.0),
                    g.get("z").and_then(|v| v.as_f64()).unwrap_or(0.0),
                )
            } else {
                (0.0, -1.0, 0.0)
            };

            let root_bones = group.get("bones").and_then(|v| v.as_array());

            let mut joints = Vec::new();
            if let Some(roots) = root_bones {
                for root in roots {
                    if let Some(root_idx) = root.as_u64() {
                        let chain = collect_chain(root_idx as usize, &children_map);
                        for node_idx in chain {
                            joints.push(json!({
                                "node": node_idx,
                                "hitRadius": hit_radius,
                                "stiffness": stiffness,
                                "gravityPower": gravity_power,
                                "gravityDir": [gx, gy, -gz],
                                "dragForce": drag,
                            }));
                        }
                    }
                }
            }

            // Reference collider groups by their index (into top-level colliderGroups[])
            let cg_refs: Option<Vec<Value>> = group
                .get("colliderGroups")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_u64().map(|i| json!(i)))
                        .collect()
                });

            if !joints.is_empty() {
                let name = if comment.is_empty() {
                    format!("spring_{}", si)
                } else {
                    comment.to_string()
                };

                let mut spring = json!({
                    "name": name,
                    "joints": joints,
                });
                if let Some(refs) = cg_refs {
                    spring["colliderGroups"] = json!(refs);
                }
                springs.push(spring);
            }
        }
    }

    Ok(json!({
        "specVersion": "1.0",
        "colliders": colliders,
        "colliderGroups": collider_groups,
        "springs": springs,
    }))
}

/// Build a map from node index → list of child indices.
fn build_children_map(nodes: &[Value]) -> HashMap<usize, Vec<usize>> {
    let mut map = HashMap::new();
    for (i, node) in nodes.iter().enumerate() {
        if let Some(children) = node.get("children").and_then(|v| v.as_array()) {
            let child_indices: Vec<usize> = children
                .iter()
                .filter_map(|v| v.as_u64().map(|n| n as usize))
                .collect();
            map.insert(i, child_indices);
        }
    }
    map
}

/// Follow single-child chains from a root node (typical spring bone structure).
fn collect_chain(root: usize, children_map: &HashMap<usize, Vec<usize>>) -> Vec<usize> {
    let mut chain = vec![root];
    let mut current = root;

    loop {
        match children_map.get(&current) {
            Some(children) if children.len() == 1 => {
                current = children[0];
                chain.push(current);
            }
            Some(children) if children.len() > 1 => {
                for &child in children {
                    chain.push(child);
                }
                break;
            }
            _ => break,
        }
    }

    chain
}
