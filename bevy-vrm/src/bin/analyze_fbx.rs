//! FBX animation analyzer — pelvis, root, arm rotation/translation diagnostics
use cinev_retarget::glam::Quat;
use std::env;
use std::fs;

fn main() {
    let path = env::args().nth(1).unwrap_or_else(|| {
        eprintln!("Usage: analyze_fbx <path.fbx>");
        std::process::exit(1);
    });

    let data = fs::read(&path).expect("Failed to read FBX file");
    let fbx_data = cinev_retarget::fbx::parse(&data).expect("Failed to parse FBX");

    println!("=== FBX Analysis: {} ===", path);
    println!("Duration: {:.1}s, Frames: {}\n", fbx_data.duration, fbx_data.frame_count);

    // Analyze these bones
    // Print full hierarchy
    println!("=== Full Skeleton Hierarchy ===\n");
    // Build parent→children map
    let mut children_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    let mut roots: Vec<String> = Vec::new();
    for (name, bone) in &fbx_data.bones {
        match &bone.parent {
            Some(p) => children_map.entry(p.clone()).or_default().push(name.clone()),
            None => roots.push(name.clone()),
        }
    }
    roots.sort();
    fn print_tree(
        name: &str,
        bones: &std::collections::HashMap<String, cinev_retarget::fbx::FbxBone>,
        children: &std::collections::HashMap<String, Vec<String>>,
        tracks: &std::collections::HashMap<String, cinev_retarget::fbx::FbxBoneTrack>,
        depth: usize,
    ) {
        let indent = "  ".repeat(depth);
        let bone = bones.get(name);
        let pre_angle = bone.map(|b| b.pre_rotation.to_axis_angle().1.to_degrees()).unwrap_or(0.0);
        let lcl_rest = bone.map(|b| {
            cinev_retarget::fbx::euler_to_quat(b.rest_rotation_euler, b.rotation_order)
                .to_axis_angle().1.to_degrees()
        }).unwrap_or(0.0);
        let has_anim = tracks.contains_key(name);
        let trans = bone.map(|b| b.rest_translation).unwrap_or_default();
        println!("{}{} | PreRot={:.1}° LclRest={:.1}° trans=({:.1},{:.1},{:.1}) {}",
            indent, name, pre_angle, lcl_rest, trans.x, trans.y, trans.z,
            if has_anim { "✓anim" } else { "" });
        if let Some(kids) = children.get(name) {
            let mut sorted = kids.clone();
            sorted.sort();
            for kid in &sorted {
                print_tree(kid, bones, children, tracks, depth + 1);
            }
        }
    }
    for root in &roots {
        print_tree(root, &fbx_data.bones, &children_map, &fbx_data.tracks, 0);
    }
    println!();

    let targets: Vec<&str> = Vec::new(); // skip per-bone analysis

    for bone_name in &targets {
        let bone = match fbx_data.bones.get(*bone_name) {
            Some(b) => b,
            None => continue,
        };

        println!("=== {} ===", bone_name);
        println!("  parent: {:?}", bone.parent);
        println!("  PreRotation: ({:.4},{:.4},{:.4},{:.4}) angle={:.1}°",
            bone.pre_rotation.x, bone.pre_rotation.y, bone.pre_rotation.z, bone.pre_rotation.w,
            bone.pre_rotation.to_axis_angle().1.to_degrees());
        println!("  rest_rotation_euler: ({:.2},{:.2},{:.2})",
            bone.rest_rotation_euler.x, bone.rest_rotation_euler.y, bone.rest_rotation_euler.z);
        println!("  rest_translation: ({:.2},{:.2},{:.2})",
            bone.rest_translation.x, bone.rest_translation.y, bone.rest_translation.z);
        println!("  rotation_order: {}", bone.rotation_order);

        // Compute full local rest = PreRot * euler_to_quat(rest_rotation)
        let lcl_rest = cinev_retarget::fbx::euler_to_quat(bone.rest_rotation_euler, bone.rotation_order);
        let full_local = bone.pre_rotation * lcl_rest;
        println!("  Lcl_Rot_rest(quat): ({:.4},{:.4},{:.4},{:.4}) angle={:.1}°",
            lcl_rest.x, lcl_rest.y, lcl_rest.z, lcl_rest.w,
            lcl_rest.to_axis_angle().1.to_degrees());
        println!("  full_local_rest: ({:.4},{:.4},{:.4},{:.4}) angle={:.1}°",
            full_local.x, full_local.y, full_local.z, full_local.w,
            full_local.to_axis_angle().1.to_degrees());

        if let Some(track) = fbx_data.tracks.get(*bone_name) {
            println!("  Animation: {} rot frames, {} trans frames",
                track.rotations.len(), track.translations.len());

            // Rotation analysis
            let mut max_angle = 0.0f32;
            let mut max_frame = 0usize;
            let mut min_angle = f32::MAX;

            // Delta from rest
            let mut max_delta = 0.0f32;
            let mut max_delta_frame = 0usize;

            for (i, q) in track.rotations.iter().enumerate() {
                let q: Quat = *q;
                let angle = q.to_axis_angle().1.to_degrees().abs();
                if angle > max_angle { max_angle = angle; max_frame = i; }
                if angle < min_angle { min_angle = angle; }

                // Delta = difference from rest Lcl Rotation
                let delta_from_rest: Quat = lcl_rest.inverse() * q;
                let d = delta_from_rest.to_axis_angle().1.to_degrees().abs();
                if d > max_delta { max_delta = d; max_delta_frame = i; }
            }

            println!("  Lcl Rotation range: min={:.1}° max={:.1}° (frame {})", min_angle, max_angle, max_frame);
            println!("  Delta from rest range: max={:.1}° (frame {})", max_delta, max_delta_frame);

            // Print key frames
            let key_frames: Vec<usize> = vec![0, 1, max_frame, max_delta_frame];
            for &i in &key_frames {
                if let Some(q) = track.rotations.get(i) {
                    let q: Quat = *q;
                    let (axis, angle) = q.to_axis_angle();
                    let delta_from_rest: Quat = lcl_rest.inverse() * q;
                    let d_angle = delta_from_rest.to_axis_angle().1.to_degrees();
                    let angle_deg: f32 = angle.to_degrees();
                    println!("    frame[{}]: angle={:.1}° delta_from_rest={:.1}° axis=({:.3},{:.3},{:.3})",
                        i, angle_deg, d_angle, axis.x, axis.y, axis.z);
                }
            }

            // Translation analysis
            let rest_t = bone.rest_translation;
            let mut max_t_delta = 0.0f32;
            let mut max_t_frame = 0usize;
            for (i, t) in track.translations.iter().enumerate() {
                let delta = (*t - rest_t).length();
                if delta > max_t_delta { max_t_delta = delta; max_t_frame = i; }
            }
            if max_t_delta > 0.01 {
                println!("  Translation: max delta={:.1}cm (frame {})", max_t_delta, max_t_frame);
                println!("    rest=({:.1},{:.1},{:.1})", rest_t.x, rest_t.y, rest_t.z);
                if let Some(t) = track.translations.get(max_t_frame) {
                    println!("    frame[{}]=({:.1},{:.1},{:.1})", max_t_frame, t.x, t.y, t.z);
                }
            }
        } else {
            println!("  (no animation track)");
        }
        println!();
    }
}
