use std::fs;

fn main() {
    let path = std::env::args().nth(1).expect("usage: diag <fbx_path>");
    let data = fs::read(&path).expect("failed to read file");

    // Parse FBX directly to get hierarchy
    let fbx = cinev_retarget::fbx::parse(&data).expect("FBX parse failed");

    println!("=== Skeleton Hierarchy: {} ===\n", path);

    // Find root bones (no parent)
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
            "{}{}  pre_rot=({:.1}, {:.1}, {:.1}, {:.1})  rest_t=({:.1}, {:.1}, {:.1})",
            indent, name,
            pre.x, pre.y, pre.z, pre.w,
            bone.rest_translation.x, bone.rest_translation.y, bone.rest_translation.z,
        );

        // Find children
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
}
