use std::fs;
use std::io::BufReader;

fn main() {
    let path = std::env::args().nth(1).expect("usage: diag <fbx_path>");
    let data = fs::read(&path).expect("failed to read file");

    // Check FBX GlobalSettings for coordinate system
    check_global_settings(&data);

    // Parse FBX directly to get hierarchy
    let fbx = cinev_retarget::fbx::parse(&data).expect("FBX parse failed");

    println!("\n=== Skeleton Hierarchy ===\n");

    let mut roots: Vec<&String> = Vec::new();
    for (name, bone) in &fbx.bones {
        if bone.parent.is_none() {
            roots.push(name);
        }
    }
    roots.sort();

    fn print_tree(
        name: &str,
        bones: &std::collections::HashMap<String, cinev_retarget::fbx::FbxBone>,
        depth: usize,
    ) {
        let bone = &bones[name];
        let pre = bone.pre_rotation;
        let indent = "  ".repeat(depth);
        println!(
            "{}{}  pre=({:.3},{:.3},{:.3},{:.3})  t=({:.1},{:.1},{:.1})  order={}",
            indent, name,
            pre.x, pre.y, pre.z, pre.w,
            bone.rest_translation.x, bone.rest_translation.y, bone.rest_translation.z,
            bone.rotation_order,
        );

        let mut children: Vec<&String> = bones
            .iter()
            .filter(|(_, b)| b.parent.as_deref() == Some(name))
            .map(|(n, _)| n)
            .collect();
        children.sort();
        for child in children {
            print_tree(child, bones, depth + 1);
        }
    }

    for root in &roots {
        print_tree(root, &fbx.bones, 0);
    }

    println!("\n=== Animated bones: {} ===", fbx.tracks.len());

    // Dump first 5 frames of root and pelvis animation
    let prefix = "DHIbody:";
    for bone_name in &["root", "pelvis", "spine_01", "thigh_l"] {
        let fbx_name = format!("{}{}", prefix, bone_name);
        println!("\n--- {} animation (first 5 frames) ---", bone_name);

        if let Some(track) = fbx.tracks.get(&fbx_name) {
            for i in 0..5.min(track.rotations.len()) {
                let r = track.rotations[i];
                let t = track.translations[i];
                // Compute rotation angle in degrees
                let angle_deg = r.to_axis_angle().1.to_degrees();
                println!(
                    "  f{}: rot=({:.4},{:.4},{:.4},{:.4}) angle={:.1}° | trans=({:.1},{:.1},{:.1})",
                    i, r.x, r.y, r.z, r.w, angle_deg, t.x, t.y, t.z
                );
            }
        } else {
            println!("  (no animation track)");
        }
    }
}

fn check_global_settings(data: &[u8]) {
    use fbxcel::pull_parser::any::AnyParser;
    use fbxcel::tree::v7400::Loader;

    let cursor = std::io::Cursor::new(data);
    let reader = BufReader::new(cursor);

    let mut parser = match AnyParser::from_seekable_reader(reader) {
        Ok(AnyParser::V7400(p)) => p,
        _ => { println!("[WARN] cannot parse FBX for GlobalSettings"); return; }
    };

    let (tree, _) = match Loader::new().load(&mut parser) {
        Ok(t) => t,
        Err(_) => { println!("[WARN] cannot load FBX tree"); return; }
    };

    let root = tree.root();
    println!("=== FBX GlobalSettings ===\n");

    for node in root.children() {
        if node.name() != "GlobalSettings" { continue; }
        for child in node.children() {
            if child.name() != "Properties70" { continue; }
            for prop in child.children() {
                if prop.name() != "P" { continue; }
                let attrs = prop.attributes();
                let name = attrs.first().and_then(|a| a.get_string()).unwrap_or("");
                match name {
                    "UpAxis" | "UpAxisSign" | "FrontAxis" | "FrontAxisSign"
                    | "CoordAxis" | "CoordAxisSign" | "OriginalUpAxis" | "OriginalUpAxisSign"
                    | "UnitScaleFactor" | "OriginalUnitScaleFactor" => {
                        // Value is at index 4
                        let val = attrs.get(4)
                            .map(|a| {
                                if let Some(i) = a.get_i32() { format!("{}", i) }
                                else if let Some(f) = a.get_f64() { format!("{}", f) }
                                else { format!("{:?}", a) }
                            })
                            .unwrap_or_default();
                        println!("  {} = {}", name, val);
                    }
                    _ => {}
                }
            }
        }
    }

    println!("\n  Interpretation:");
    println!("  UpAxis: 0=X, 1=Y, 2=Z");
    println!("  FrontAxis: 0=X, 1=Y, 2=Z");
    println!("  CoordAxis: 0=X, 1=Y, 2=Z");
    println!("  Sign: 1=positive, -1=negative");
}
