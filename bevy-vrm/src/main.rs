use bevy::animation::{AnimationTargetId, animated_field};
use bevy::gizmos::config::{DefaultGizmoConfigGroup, GizmoConfigStore};
use bevy::prelude::*;
use bevy::dev_tools::fps_overlay::{FpsOverlayConfig, FpsOverlayPlugin};
use bevy::diagnostic::{
    DiagnosticsStore, EntityCountDiagnosticsPlugin, FrameTimeDiagnosticsPlugin,
    SystemInformationDiagnosticsPlugin,
};
use bevy::math::curve::Interval;
use bevy_file_dialog::prelude::*;
use bevy_panorbit_camera::{PanOrbitCamera, PanOrbitCameraPlugin};
use bevy_vrm1::prelude::*;
use directories::ProjectDirs;
use std::collections::{HashMap, VecDeque};
use std::fs;
use std::path::PathBuf;

struct VrmLoad;
struct FbxLoad;

enum VrmVersionTag {
    Vrm0,
    Vrm1,
    Unknown,
}

fn detect_vrm_version(data: &[u8]) -> VrmVersionTag {
    if data.len() < 20 { return VrmVersionTag::Unknown; }
    let chunk_len = u32::from_le_bytes([data[12], data[13], data[14], data[15]]) as usize;
    let chunk_type = &data[16..20];
    if chunk_type != b"JSON" { return VrmVersionTag::Unknown; }
    if data.len() < 20 + chunk_len { return VrmVersionTag::Unknown; }
    let json_str = match std::str::from_utf8(&data[20..20 + chunk_len]) {
        Ok(s) => s,
        Err(_) => return VrmVersionTag::Unknown,
    };
    if json_str.contains("\"VRMC_vrm\"") {
        VrmVersionTag::Vrm1
    } else if json_str.contains("\"VRM\"") {
        VrmVersionTag::Vrm0
    } else {
        VrmVersionTag::Unknown
    }
}

#[derive(Resource)]
struct AppDataDir(PathBuf);

#[derive(Component)]
struct DebugPanel;

#[derive(Component)]
struct LogPanel;

#[derive(Component)]
struct LoadedVrm;

#[derive(Resource, Default)]
struct RetargetState {
    config_json: Option<String>,
    pending_anim: Option<cinev_retarget::RetargetedAnimation>,
    applied: bool,
}

#[derive(Resource, Default)]
struct BoneVizState {
    enabled: bool,
    labels_spawned: bool,
}

/// Debug: only apply retarget to hips (isolate hips rotation)
const HIPS_ONLY: bool = false;

/// Bones to log LEFT/RIGHT debug info for
const DEBUG_BONES: &[&str] = &["VRMC_vrm.root_bone", "hips", "spine", "chest", "leftUpperArm", "leftUpperLeg"];

#[derive(Component)]
struct BoneLabel;

#[derive(Resource)]
struct FbxSkeletonViz {
    data: cinev_retarget::FbxSkeletonFrames,
    start_time: f64,
}

#[derive(Resource)]
struct AppLog {
    lines: VecDeque<String>,
    max_lines: usize,
    visible: bool,
}

impl Default for AppLog {
    fn default() -> Self {
        Self {
            lines: VecDeque::new(),
            max_lines: 120,
            visible: true,
        }
    }
}

impl AppLog {
    fn push(&mut self, msg: impl Into<String>) {
        let msg = msg.into();
        info!("{}", msg);
        self.lines.push_back(msg);
        while self.lines.len() > self.max_lines {
            self.lines.pop_front();
        }
    }

    fn text(&self) -> String {
        self.lines.iter().cloned().collect::<Vec<_>>().join("\n")
    }
}

fn main() {
    let data_dir = ProjectDirs::from("", "", "bevy-vrm")
        .map(|dirs| dirs.data_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from("data"));

    let models_dir = data_dir.join("models");
    fs::create_dir_all(&models_dir).expect("Failed to create app data directory");
    fs::create_dir_all("assets/models").ok();

    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Bevy VRM".into(),
                resolution: (1280, 720).into(),
                ..default()
            }),
            ..default()
        }))
        .add_plugins(VrmPlugin)
        .add_plugins(PanOrbitCameraPlugin)
        .add_plugins(FpsOverlayPlugin {
            config: FpsOverlayConfig {
                text_config: TextFont {
                    font_size: 14.0,
                    ..default()
                },
                text_color: Color::srgba(0.0, 1.0, 0.0, 0.8),
                enabled: true,
                ..default()
            },
        })
        .add_plugins(EntityCountDiagnosticsPlugin::default())
        .add_plugins(SystemInformationDiagnosticsPlugin)
        .add_plugins(
            FileDialogPlugin::new()
                .with_load_file::<VrmLoad>()
                .with_load_file::<FbxLoad>(),
        )
        .insert_resource(AppDataDir(data_dir))
        .init_resource::<AppLog>()
        .init_resource::<RetargetState>()
        .init_resource::<BoneVizState>()
        .add_systems(Startup, setup)
        .add_systems(Update, (
            toggle_debug,
            toggle_log,
            update_debug_panel,
            update_log_panel,
            open_file_dialog,
            handle_vrm_loaded,
            handle_fbx_loaded,
            apply_retarget_animation,
            start_playback,
            log_root_hips_world,
            toggle_bone_viz,
            draw_bone_viz,
            camera_presets,
        ))
        .run();
}

fn setup(
    mut commands: Commands,
    mut log: ResMut<AppLog>,
    mut gizmo_config: ResMut<GizmoConfigStore>,
) {
    // Gizmos always render on top of mesh
    let (config, _) = gizmo_config.config_mut::<DefaultGizmoConfigGroup>();
    config.depth_bias = -1.0;
    commands.spawn((
        Camera3d::default(),
        Transform::from_xyz(0.0, 1.0, 3.0).looking_at(Vec3::new(0.0, 1.0, 0.0), Vec3::Y),
        PanOrbitCamera {
            focus: Vec3::new(0.0, 1.0, 0.0),
            radius: Some(3.0),
            ..default()
        },
    ));

    commands.spawn((
        DirectionalLight {
            illuminance: 10000.0,
            shadows_enabled: true,
            ..default()
        },
        Transform::from_rotation(Quat::from_euler(EulerRot::XYZ, -0.5, 0.5, 0.0)),
    ));

    commands.spawn((
        DebugPanel,
        Text::new(""),
        TextFont { font_size: 13.0, ..default() },
        TextColor(Color::srgba(0.0, 1.0, 0.0, 0.7)),
        Node {
            position_type: PositionType::Absolute,
            bottom: Val::Px(12.0),
            left: Val::Px(12.0),
            ..default()
        },
    ));

    commands.spawn((
        LogPanel,
        Text::new(""),
        TextFont { font_size: 11.0, ..default() },
        TextColor(Color::srgba(0.8, 0.8, 0.8, 0.8)),
        Node {
            position_type: PositionType::Absolute,
            top: Val::Px(40.0),
            right: Val::Px(12.0),
            max_width: Val::Px(500.0),
            ..default()
        },
    ));

    log.push("[INIT] O:VRM F:FBX G:bones 1:front 2:side 3:top 4:persp F3:stats F4:log");
}

fn open_file_dialog(
    mut commands: Commands,
    input: Res<ButtonInput<KeyCode>>,
    mut log: ResMut<AppLog>,
) {
    if input.just_pressed(KeyCode::KeyO) {
        log.push("[DIALOG] opening file picker...");
        commands
            .dialog()
            .set_title("Open VRM")
            .add_filter("VRM", &["vrm"])
            .load_file::<VrmLoad>();
    }
    if input.just_pressed(KeyCode::KeyF) {
        log.push("[DIALOG] opening FBX picker...");
        commands
            .dialog()
            .set_title("Open FBX Motion")
            .add_filter("FBX", &["fbx"])
            .load_file::<FbxLoad>();
    }
}

fn handle_vrm_loaded(
    mut commands: Commands,
    mut ev_loaded: MessageReader<DialogFileLoaded<VrmLoad>>,
    asset_server: Res<AssetServer>,
    app_data: Res<AppDataDir>,
    existing_vrm: Query<Entity, With<LoadedVrm>>,
    mut log: ResMut<AppLog>,
    mut retarget_state: ResMut<RetargetState>,
) {
    for ev in ev_loaded.read() {
        log.push(format!("[LOAD] {} ({:.1} MB)", ev.file_name, ev.contents.len() as f64 / 1048576.0));

        if ev.contents.len() < 4 || &ev.contents[0..4] != b"glTF" {
            log.push("[ERROR] not a valid glTF/VRM file");
            continue;
        }

        let vrm_version = detect_vrm_version(&ev.contents);
        let file_bytes = match &vrm_version {
            VrmVersionTag::Vrm1 => {
                log.push("[LOAD] VRM 1.0 detected");
                ev.contents.clone()
            }
            VrmVersionTag::Vrm0 => {
                log.push("[CONVERT] VRM 0.x detected — converting to 1.0...");
                match vrm0_compat::convert(&ev.contents) {
                    Ok(converted) => {
                        log.push(format!(
                            "[CONVERT] done ({:.1} MB → {:.1} MB)",
                            ev.contents.len() as f64 / 1048576.0,
                            converted.len() as f64 / 1048576.0
                        ));
                        converted
                    }
                    Err(e) => {
                        log.push(format!("[ERROR] conversion failed: {}", e));
                        continue;
                    }
                }
            }
            VrmVersionTag::Unknown => {
                log.push("[WARN] VRM version unknown — attempting load");
                ev.contents.clone()
            }
        };

        let dest_path = app_data.0.join("models").join(&ev.file_name);
        if let Err(e) = fs::write(&dest_path, &file_bytes) {
            log.push(format!("[ERROR] save to app data: {}", e));
            continue;
        }
        log.push(format!("[LOAD] saved: {}", dest_path.display()));

        let assets_path = PathBuf::from("assets/models").join(&ev.file_name);
        if let Err(e) = fs::write(&assets_path, &file_bytes) {
            log.push(format!("[ERROR] copy to assets: {}", e));
            continue;
        }
        log.push("[LOAD] copied to assets/models/");

        let count = existing_vrm.iter().count();
        for entity in &existing_vrm {
            commands.entity(entity).despawn();
        }
        if count > 0 {
            log.push(format!("[LOAD] despawned {} previous", count));
        }

        // Reset retarget applied state so animation can be re-applied to new VRM
        retarget_state.applied = false;

        let asset_path = format!("models/{}", ev.file_name);
        let handle = asset_server.load::<VrmAsset>(&asset_path);
        log.push(format!("[LOAD] asset_server.load('{}')", asset_path));

        commands.spawn((
            LoadedVrm,
            VrmHandle(handle),
        ));
        log.push("[LOAD] VrmHandle spawned — waiting for init...");
    }
}

fn handle_fbx_loaded(
    mut commands: Commands,
    mut ev_loaded: MessageReader<DialogFileLoaded<FbxLoad>>,
    mut retarget_state: ResMut<RetargetState>,
    mut log: ResMut<AppLog>,
    time: Res<Time<Real>>,
) {
    for ev in ev_loaded.read() {
        log.push(format!(
            "[FBX] {} ({:.1} MB)",
            ev.file_name,
            ev.contents.len() as f64 / 1048576.0
        ));

        if retarget_state.config_json.is_none() {
            match fs::read_to_string("assets/retarget/cinev_female_body.json") {
                Ok(json) => {
                    log.push("[RETARGET] loaded cinev_female_body config");
                    retarget_state.config_json = Some(json);
                }
                Err(e) => {
                    log.push(format!("[ERROR] config load failed: {}", e));
                    continue;
                }
            }
        }

        let config_json = retarget_state.config_json.as_ref().unwrap();
        let vrm_version = cinev_retarget::vrm_compat::VrmVersion::V1_0;

        match cinev_retarget::retarget(&ev.contents, config_json, vrm_version) {
            Ok((anim, diag)) => {
                // Write diagnostics
                let mut diag_text = String::new();
                diag_text.push_str(&format!("=== FBX Diagnostics: {} ===\n\n", ev.file_name));
                diag_text.push_str(&format!("All bones ({}):\n", diag.all_bones.len()));
                for b in &diag.all_bones { diag_text.push_str(&format!("  {}\n", b)); }
                diag_text.push_str(&format!("\nAnimated bones ({}):\n", diag.animated_bones.len()));
                for b in &diag.animated_bones { diag_text.push_str(&format!("  {}\n", b)); }
                diag_text.push_str(&format!("\nMatched direct ({}):\n", diag.matched_direct.len()));
                for (src, vrm) in &diag.matched_direct { diag_text.push_str(&format!("  {} → {}\n", src, vrm)); }
                diag_text.push_str(&format!("\nUnmatched config ({}):\n", diag.unmatched_config.len()));
                for b in &diag.unmatched_config { diag_text.push_str(&format!("  {}\n", b)); }
                diag_text.push_str(&format!("\nResult: {} tracks, {:.1}s\n", anim.bone_tracks.len(), anim.duration_secs));
                for track in &anim.bone_tracks {
                    diag_text.push_str(&format!("  {} — {} frames{}\n",
                        track.vrm_bone_name, track.rotations.len(),
                        if track.translations.is_some() { " +trans" } else { "" }
                    ));
                }
                fs::write("retarget_diag.txt", &diag_text).ok();

                log.push(format!(
                    "[RETARGET] {} matched, {} unmatched, {} tracks, {:.1}s",
                    diag.matched_direct.len(), diag.unmatched_config.len(),
                    anim.bone_tracks.len(), anim.duration_secs
                ));

                retarget_state.pending_anim = Some(anim);
                retarget_state.applied = false;

                // Compute FBX skeleton for visualization
                match cinev_retarget::compute_fbx_skeleton(&ev.contents) {
                    Ok(skel) => {
                        log.push(format!("[VIZ] FBX skeleton: {} bones, {} frames", skel.bone_positions.len(), skel.frame_count));
                        commands.insert_resource(FbxSkeletonViz {
                            data: skel,
                            start_time: time.elapsed_secs_f64(),
                        });
                    }
                    Err(e) => log.push(format!("[WARN] FBX skeleton viz: {}", e)),
                }
            }
            Err(e) => {
                log.push(format!("[ERROR] retarget failed: {}", e));
            }
        }
    }
}

/// Format quaternion as "axis=(x,y,z) angle=deg°" for debug
fn quat_axis_angle_str(q: Quat) -> String {
    let (axis, angle) = q.to_axis_angle();
    format!("axis=({:.3},{:.3},{:.3}) angle={:.1}°", axis.x, axis.y, axis.z, angle.to_degrees())
}

fn apply_retarget_animation(
    mut commands: Commands,
    mut retarget_state: ResMut<RetargetState>,
    mut log: ResMut<AppLog>,
    bone_query: Query<(&VrmBone, &Name, &RestTransform, &RestGlobalTransform)>,
    bone_hierarchy_query: Query<(&VrmBone, &ChildOf)>,
    all_entity_vrm: Query<(Entity, &VrmBone)>,
    root_bone_query: Query<(&Name, &Transform, &GlobalTransform), (With<AnimationPlayer>, Without<VrmBone>)>,
    player_query: Query<(Entity, &AnimationPlayer)>,
    mut animation_clips: ResMut<Assets<AnimationClip>>,
    mut animation_graphs: ResMut<Assets<AnimationGraph>>,
    fbx_viz: Option<Res<FbxSkeletonViz>>,
) {
    if retarget_state.applied || retarget_state.pending_anim.is_none() {
        return;
    }

    if bone_query.is_empty() || player_query.is_empty() {
        return;
    }

    let anim = retarget_state.pending_anim.as_ref().unwrap();

    // --- Collect VRM bone data from Bevy (version-independent) ---
    let mut bone_name_map: HashMap<String, Name> = HashMap::new();
    let mut bone_rest_local: HashMap<String, Quat> = HashMap::new();
    let mut bone_rest_global: HashMap<String, Quat> = HashMap::new();

    for (vrm_bone, name, rest_tf, rest_gtf) in &bone_query {
        bone_name_map.insert(vrm_bone.0.clone(), name.clone());
        bone_rest_local.insert(vrm_bone.0.clone(), rest_tf.rotation);
        bone_rest_global.insert(vrm_bone.0.clone(), rest_gtf.rotation());

        // Dump root/hips full rest data (only first time)
        if vrm_bone.0 == "hips" {
            log.push(format!(
                "[VRM] {} entity='{}' local_pos=({:.4},{:.4},{:.4}) local_rot=({:.4},{:.4},{:.4},{:.4}) global_pos=({:.4},{:.4},{:.4}) global_rot=({:.4},{:.4},{:.4},{:.4})",
                vrm_bone.0, name,
                rest_tf.translation.x, rest_tf.translation.y, rest_tf.translation.z,
                rest_tf.rotation.x, rest_tf.rotation.y, rest_tf.rotation.z, rest_tf.rotation.w,
                rest_gtf.translation().x, rest_gtf.translation().y, rest_gtf.translation().z,
                rest_gtf.rotation().x, rest_gtf.rotation().y, rest_gtf.rotation().z, rest_gtf.rotation().w,
            ));
        }
    }

    // Build VRM bone parent map from entity hierarchy
    // entity → vrm_bone_name for reverse lookup
    let mut entity_to_vrm: HashMap<Entity, String> = all_entity_vrm.iter()
        .map(|(e, vb)| (e, vb.0.clone()))
        .collect();
    // Also add root bone entity (it doesn't have VrmBone component)
    for (entity, player) in &player_query {
        let _ = player; // AnimationPlayer entity = root bone entity in bevy_vrm
        entity_to_vrm.insert(entity, "VRMC_vrm.root_bone".to_string());
    }
    // vrm_bone_name → parent vrm_bone_name
    let mut vrm_parent_map: HashMap<String, String> = HashMap::new();
    for (vrm_bone, child_of) in &bone_hierarchy_query {
        if let Some(parent_name) = entity_to_vrm.get(&child_of.0) {
            vrm_parent_map.insert(vrm_bone.0.clone(), parent_name.clone());
        }
    }

    // Root bone: use Transform (no RestTransform) + GlobalTransform for global rest
    let vrm_root_name = Name::new(Vrm::ROOT_BONE);
    let mut root_rest_local = Quat::IDENTITY;
    let mut root_rest_global_rot = Quat::IDENTITY;
    for (name, tf, gtf) in &root_bone_query {
        if name.as_str() == Vrm::ROOT_BONE {
            root_rest_local = tf.rotation;
            root_rest_global_rot = gtf.to_scale_rotation_translation().1;
            let (_, _, root_pos) = gtf.to_scale_rotation_translation();
            log.push(format!(
                "[VRM] ROOT entity='{}' local_pos=({:.4},{:.4},{:.4}) local_rot=({:.4},{:.4},{:.4},{:.4}) global_pos=({:.4},{:.4},{:.4}) global_rot=({:.4},{:.4},{:.4},{:.4})",
                name,
                tf.translation.x, tf.translation.y, tf.translation.z,
                tf.rotation.x, tf.rotation.y, tf.rotation.z, tf.rotation.w,
                root_pos.x, root_pos.y, root_pos.z,
                root_rest_global_rot.x, root_rest_global_rot.y, root_rest_global_rot.z, root_rest_global_rot.w,
            ));
            break;
        }
    }
    bone_name_map.insert("VRMC_vrm.root_bone".to_string(), vrm_root_name);
    bone_rest_local.insert("VRMC_vrm.root_bone".to_string(), root_rest_local);
    bone_rest_global.insert("VRMC_vrm.root_bone".to_string(), root_rest_global_rot);

    log.push(format!(
        "[ANIM] {} bones | root local=({:.2},{:.2},{:.2},{:.2}) global=({:.2},{:.2},{:.2},{:.2})",
        bone_name_map.len(),
        root_rest_local.x, root_rest_local.y, root_rest_local.z, root_rest_local.w,
        root_rest_global_rot.x, root_rest_global_rot.y, root_rest_global_rot.z, root_rest_global_rot.w,
    ));

    // Scale correction: MetaHuman vs VRM height ratio
    // FBX pelvis height from src_rest_global data (Z component in FBX Z-up = height)
    let fbx_hips_height = anim.bone_tracks.iter()
        .find(|t| t.vrm_bone_name == "hips")
        .map(|t| {
            // Pelvis rest_t.z = hip height in FBX cm
            // We stored it in the track — get from FBX bone data via diag
            // For now, use a known value from the FBX (pelvis Z = 93.9cm)
            0.939_f32 // meters
        })
        .unwrap_or(0.939);

    // VRM hips world Y position at rest
    let vrm_hips_height = bone_rest_global
        .get("hips")
        .map(|_| {
            // Get from RestGlobalTransform — but it's rotation only
            // Use the bone query to get world position
            bone_query.iter()
                .find(|(vb, _, _, _)| vb.0 == "hips")
                .map(|(_, _, _, rgt)| rgt.translation().y)
                .unwrap_or(1.0)
        })
        .unwrap_or(1.0);

    let scale_ratio = if fbx_hips_height > 0.01 {
        vrm_hips_height / fbx_hips_height
    } else {
        1.0
    };

    log.push(format!(
        "[ANIM] scale: FBX hips={:.3}m VRM hips={:.3}m ratio={:.3}",
        fbx_hips_height, vrm_hips_height, scale_ratio
    ));

    log.push(format!(
        "[ANIM] VRM root global: ({:.4},{:.4},{:.4},{:.4}) {}",
        root_rest_global_rot.x, root_rest_global_rot.y, root_rest_global_rot.z, root_rest_global_rot.w,
        quat_axis_angle_str(root_rest_global_rot),
    ));

    let mut clip = AnimationClip::default();
    let mut applied_count = 0;

    let duration = anim.duration_secs;
    let domain = match Interval::new(0.0, duration) {
        Ok(d) => d,
        Err(_) => {
            log.push("[ERROR] invalid animation duration");
            retarget_state.applied = true;
            return;
        }
    };

    // FBX Z-up → glTF Y-up coordinate rotation
    let coord_rot = Quat::from_rotation_x(-std::f32::consts::FRAC_PI_2);
    let coord_rot_inv = coord_rot.inverse();

    // FBX local delta approach:
    // For each bone at each frame, compute FBX local rotation from animated world rotations,
    // extract delta from rest, convert to Y-up, and apply to VRM local rest.
    //
    // fbx_local_anim = parent_world_anim.inv() * bone_world_anim
    // fbx_local_rest = parent_world_rest.inv() * bone_world_rest
    // delta_zup = fbx_local_rest.inv() * fbx_local_anim
    // vrm_local = vrm_local_rest * coord * delta_zup * coord_inv
    //
    // This avoids 180°Y propagation: each bone computed independently from FBX world data.

    let fbx_world_rots = fbx_viz.as_ref().map(|v| &v.data.bone_rotations);
    let fbx_hierarchy = fbx_viz.as_ref().map(|v| &v.data.hierarchy);

    for track in &anim.bone_tracks {
        let node_name = match bone_name_map.get(&track.vrm_bone_name) {
            Some(n) => n.clone(),
            None => continue,
        };

        let is_root = track.vrm_bone_name == "VRMC_vrm.root_bone";
        if HIPS_ONLY && !is_root && track.vrm_bone_name != "hips" {
            continue;
        }

        let target_id = AnimationTargetId::from_name(&node_name);

        let is_debug_bone = DEBUG_BONES.contains(&track.vrm_bone_name.as_str());

        let dist_rest_local = bone_rest_local
            .get(&track.vrm_bone_name)
            .copied()
            .unwrap_or(Quat::IDENTITY);

        // Look up FBX world rotations for this bone and its parent
        let fbx_bone_rots = fbx_world_rots
            .and_then(|r| r.get(&track.src_bone_name));
        let fbx_parent_name = fbx_hierarchy
            .and_then(|h| h.get(&track.src_bone_name));
        let fbx_parent_rots = fbx_parent_name
            .and_then(|pn| fbx_world_rots.and_then(|r| r.get(pn)));

        // Rest rotations (frame 0)
        let fbx_bone_rest = fbx_bone_rots.and_then(|r| r.first().copied());
        let fbx_parent_rest = fbx_parent_rots.and_then(|r| r.first().copied());
        let fbx_local_rest = match (fbx_parent_rest, fbx_bone_rest) {
            (Some(pr), Some(br)) => pr.inverse() * br,
            (None, Some(br)) => br, // root bone: no parent
            _ => track.src_rest_global, // fallback
        };

        // A-pose → T-pose offset
        let pose_offset = anim.rest_pose_offsets.get(&track.vrm_bone_name).map(|o| {
            Quat::from_euler(EulerRot::XYZ, o[0], o[1], o[2])
        });

        let corrected_rotations: Vec<Quat> = (0..track.rotations.len())
            .map(|frame_idx| {
                let fbx_bone_world = fbx_bone_rots.and_then(|r| r.get(frame_idx).copied());
                let fbx_parent_world = fbx_parent_rots.and_then(|r| r.get(frame_idx).copied());

                if let Some(bone_world) = fbx_bone_world {
                    // Compute FBX animated local rotation
                    let fbx_local_anim = match fbx_parent_world {
                        Some(pw) => pw.inverse() * bone_world,
                        None => bone_world, // root bone
                    };

                    // Delta from rest in Z-up bone-local frame
                    let delta_zup = fbx_local_rest.inverse() * fbx_local_anim;

                    // Convert delta to Y-up
                    let delta_yup = coord_rot * delta_zup * coord_rot_inv;

                    // VRM faces -Z (180°Y root), FBX faces +Z (in Y-up).
                    // Local frame difference: negate X and Z rotation axes
                    // (equivalent to 180°Y conjugation of the delta)
                    let delta_corrected = if is_root {
                        delta_yup // root bone: no correction needed
                    } else {
                        // 180°Y conjugation: negate x and z of quaternion
                        Quat::from_xyzw(-delta_yup.x, delta_yup.y, -delta_yup.z, delta_yup.w)
                    };

                    let mut result = (dist_rest_local * delta_corrected).normalize();

                    // Apply A-pose → T-pose offset
                    if let Some(offset) = pose_offset {
                        result = (result * offset).normalize();
                    }

                    if is_debug_bone && frame_idx < 3 {
                        let delta_angle = delta_zup.to_axis_angle().1.to_degrees();
                        let result_angle = result.to_axis_angle().1.to_degrees();
                        log.push(format!(
                            "[DBG]   frame[{}] delta={:.1}° result={:.1}° result=({:.3},{:.3},{:.3},{:.3})",
                            frame_idx, delta_angle, result_angle,
                            result.x, result.y, result.z, result.w,
                        ));
                    }

                    result
                } else {
                    // Fallback: use track data directly
                    let delta = track.rotations[frame_idx];
                    let src_local = track.src_rest * delta;
                    let src_local_gltf = coord_rot * src_local * coord_rot_inv;
                    let src_rest_gltf = coord_rot * track.src_rest_global * coord_rot_inv;
                    let parent_rest_gltf = coord_rot * track.src_parent_rest_global * coord_rot_inv;
                    let src_full_local_rest_gltf = parent_rest_gltf.inverse() * src_rest_gltf;
                    let delta_gltf = src_full_local_rest_gltf.inverse() * src_local_gltf;
                    (dist_rest_local * delta_gltf).normalize()
                }
            })
            .collect();

        if is_debug_bone {
            log.push(format!("[DBG] === {} ===", track.vrm_bone_name));
            log.push(format!(
                "[DBG]   fbx_bone: {}, parent_fbx: {:?}",
                track.src_bone_name, fbx_parent_name,
            ));
        }

        if corrected_rotations.len() >= 2 {
            match bevy::math::curve::SampleAutoCurve::new(domain, corrected_rotations) {
                Ok(curve) => {
                    clip.add_curve_to_target(
                        target_id,
                        AnimatableCurve::new(animated_field!(Transform::rotation), curve),
                    );
                    applied_count += 1;
                }
                Err(e) => {
                    log.push(format!("[WARN] rotation curve '{}': {:?}", track.vrm_bone_name, e));
                }
            }
        }

        // Translation curve
        if let Some(ref translations) = track.translations {
            // AnimationClip REPLACES Transform.translation, so we must include
            // the bone's rest translation + animation delta
            let bone_rest_translation = bone_query
                .iter()
                .find(|(vb, _, _, _)| vb.0 == track.vrm_bone_name)
                .map(|(_, _, rt, _)| rt.translation)
                .unwrap_or(Vec3::ZERO);

            let local_translations: Vec<Vec3> = translations
                .iter()
                .map(|&delta| bone_rest_translation + delta * scale_ratio)
                .collect();

            if local_translations.len() >= 2 {
                match bevy::math::curve::SampleAutoCurve::new(domain, local_translations) {
                    Ok(curve) => {
                        clip.add_curve_to_target(
                            target_id,
                            AnimatableCurve::new(animated_field!(Transform::translation), curve),
                        );
                    }
                    Err(e) => {
                        log.push(format!("[WARN] translation curve '{}': {:?}", track.vrm_bone_name, e));
                    }
                }
            }
        }
    }

    // Write debug log to file for analysis
    {
        let debug_text = log.lines.iter()
            .filter(|l| l.starts_with("[DBG]"))
            .cloned()
            .collect::<Vec<_>>()
            .join("\n");
        if !debug_text.is_empty() {
            fs::write("retarget_debug.txt", &debug_text).ok();
            log.push("[DBG] written to retarget_debug.txt");
        }
    }

    if applied_count == 0 {
        log.push("[WARN] no curves applied — bone names may not match");
        retarget_state.applied = true;
        return;
    }

    clip.set_duration(duration);

    // Create animation graph with single clip
    let clip_handle = animation_clips.add(clip);
    let (graph, clip_index) = AnimationGraph::from_clip(clip_handle);
    let graph_handle = animation_graphs.add(graph);

    // Find the AnimationPlayer entity and start playback
    for (player_entity, _) in &player_query {
        commands.entity(player_entity).insert(AnimationGraphHandle(graph_handle.clone()));
    }

    // Need to start playback after graph is attached — use a one-shot approach
    // by scheduling the play command. Actually, let's just get the player mutably.
    // We can't do that with the current query since we have &AnimationPlayer.
    // Instead, mark as applied and handle play in a separate check.
    retarget_state.applied = true;

    log.push(format!(
        "[ANIM] clip created: {} curves, {:.1}s — starting playback",
        applied_count, duration
    ));

    // Store clip index for playback
    commands.insert_resource(PendingPlayback(clip_index));
}

#[derive(Resource)]
struct PendingPlayback(AnimationNodeIndex);

fn start_playback(
    mut commands: Commands,
    pending: Option<Res<PendingPlayback>>,
    mut player_query: Query<&mut AnimationPlayer>,
) {
    let Some(pending) = pending else { return; };

    for mut player in &mut player_query {
        player.stop_all();
        let active = player.start(pending.0);
        active.set_repeat(bevy::animation::RepeatAnimation::Forever);
    }

    commands.remove_resource::<PendingPlayback>();
}

/// Log root_bone and hips world transform every 60 frames
fn log_root_hips_world(
    root_q: Query<(&Name, &Transform, &GlobalTransform), (With<AnimationPlayer>, Without<VrmBone>)>,
    bone_q: Query<(&VrmBone, &Transform, &GlobalTransform)>,
    mut frame_count: Local<u32>,
    mut log: ResMut<AppLog>,
) {
    *frame_count += 1;
    if *frame_count % 60 != 1 { return; }

    // Root bone
    for (name, tf, gtf) in &root_q {
        if name.as_str() == Vrm::ROOT_BONE {
            let (_, rot, pos) = gtf.to_scale_rotation_translation();
            let local_rot = tf.rotation;
            let (axis, angle) = rot.to_axis_angle();
            let (la, la_deg) = local_rot.to_axis_angle();
            log.push(format!(
                "[WORLD] root: pos=({:.2},{:.2},{:.2}) world_rot={:.1}° axis=({:.2},{:.2},{:.2}) local_rot={:.1}° local_axis=({:.2},{:.2},{:.2})",
                pos.x, pos.y, pos.z,
                angle.to_degrees(), axis.x, axis.y, axis.z,
                la_deg.to_degrees(), la.x, la.y, la.z,
            ));
        }
    }

    // Hips
    for (vrm_bone, tf, gtf) in &bone_q {
        if vrm_bone.0 == "hips" {
            let (_, rot, pos) = gtf.to_scale_rotation_translation();
            let local_rot = tf.rotation;
            let (axis, angle) = rot.to_axis_angle();
            let (la, la_deg) = local_rot.to_axis_angle();
            log.push(format!(
                "[WORLD] hips: pos=({:.2},{:.2},{:.2}) world_rot={:.1}° axis=({:.2},{:.2},{:.2}) local_rot={:.1}° local_axis=({:.2},{:.2},{:.2})",
                pos.x, pos.y, pos.z,
                angle.to_degrees(), axis.x, axis.y, axis.z,
                la_deg.to_degrees(), la.x, la.y, la.z,
            ));
        }
    }
}

fn toggle_debug(
    input: Res<ButtonInput<KeyCode>>,
    mut config: ResMut<FpsOverlayConfig>,
    mut panel_q: Query<&mut Visibility, With<DebugPanel>>,
) {
    if input.just_pressed(KeyCode::F3) {
        config.enabled = !config.enabled;
        for mut vis in &mut panel_q {
            *vis = if config.enabled { Visibility::Inherited } else { Visibility::Hidden };
        }
    }
}

fn toggle_log(
    input: Res<ButtonInput<KeyCode>>,
    mut log: ResMut<AppLog>,
    mut panel_q: Query<&mut Visibility, With<LogPanel>>,
) {
    if input.just_pressed(KeyCode::F4) {
        log.visible = !log.visible;
        for mut vis in &mut panel_q {
            *vis = if log.visible { Visibility::Inherited } else { Visibility::Hidden };
        }
    }
}

fn update_log_panel(
    log: Res<AppLog>,
    mut panel_q: Query<&mut Text, With<LogPanel>>,
) {
    if !log.is_changed() { return; }
    let Ok(mut text) = panel_q.single_mut() else { return; };
    **text = log.text();
}

fn update_debug_panel(
    diagnostics: Res<DiagnosticsStore>,
    meshes: Res<Assets<Mesh>>,
    images: Res<Assets<Image>>,
    materials: Res<Assets<StandardMaterial>>,
    mut panel_q: Query<&mut Text, (With<DebugPanel>, Without<LogPanel>)>,
) {
    let Ok(mut text) = panel_q.single_mut() else { return; };

    let entities = diagnostics
        .get(&EntityCountDiagnosticsPlugin::ENTITY_COUNT)
        .and_then(|d| d.smoothed()).unwrap_or(0.0);
    let frame_time = diagnostics
        .get(&FrameTimeDiagnosticsPlugin::FRAME_TIME)
        .and_then(|d| d.smoothed()).unwrap_or(0.0);
    let process_mem = diagnostics
        .get(&SystemInformationDiagnosticsPlugin::PROCESS_MEM_USAGE)
        .and_then(|d| d.smoothed()).unwrap_or(0.0);

    let mesh_count = meshes.len();
    let image_count = images.len();
    let material_count = materials.len();

    let mut image_bytes: u64 = 0;
    for (_, image) in images.iter() {
        image_bytes += image.width() as u64 * image.height() as u64 * 4;
    }
    let image_mb = image_bytes as f64 / (1024.0 * 1024.0);

    **text = format!(
        "frame: {:.1} ms | entities: {}\n\
         meshes: {} | textures: {} ({:.1} MB) | materials: {}\n\
         process mem: {:.1} GiB",
        frame_time, entities as u32,
        mesh_count, image_count, image_mb, material_count,
        process_mem,
    );
}

fn camera_presets(
    input: Res<ButtonInput<KeyCode>>,
    mut camera_q: Query<(&mut Transform, &mut PanOrbitCamera, &mut Projection)>,
) {
    let Some((mut tf, mut orbit, mut proj)) = camera_q.iter_mut().next() else { return; };

    let focus = Vec3::new(0.0, 1.0, 0.0);
    let dist = 5.0;

    // 1: Front ortho, 2: Side ortho, 3: Top ortho, 4: Perspective (reset)
    let mut set_ortho = |pos: Vec3, up: Vec3| {
        *tf = Transform::from_translation(pos).looking_at(focus, up);
        orbit.focus = focus;
        orbit.radius = Some(dist);
        orbit.enabled = false;
        *proj = Projection::Orthographic(OrthographicProjection {
            scaling_mode: bevy::camera::ScalingMode::Fixed { width: 4.0, height: 3.0 },
            ..OrthographicProjection::default_3d()
        });
    };

    if input.just_pressed(KeyCode::Digit1) {
        // Front: +Z looking at -Z
        set_ortho(Vec3::new(0.0, 1.0, dist), Vec3::Y);
    }
    if input.just_pressed(KeyCode::Digit2) {
        // Side: +X looking at -X
        set_ortho(Vec3::new(dist, 1.0, 0.0), Vec3::Y);
    }
    if input.just_pressed(KeyCode::Digit3) {
        // Top: +Y looking down
        set_ortho(Vec3::new(0.0, dist, 0.01), Vec3::Z);
    }
    if input.just_pressed(KeyCode::Digit4) {
        // Reset to perspective orbit
        *tf = Transform::from_xyz(0.0, 1.0, 3.0).looking_at(focus, Vec3::Y);
        orbit.focus = focus;
        orbit.radius = Some(3.0);
        orbit.enabled = true;
        *proj = Projection::Perspective(PerspectiveProjection::default());
    }
}

fn toggle_bone_viz(
    mut commands: Commands,
    input: Res<ButtonInput<KeyCode>>,
    mut state: ResMut<BoneVizState>,
    mut log: ResMut<AppLog>,
    labels: Query<Entity, With<BoneLabel>>,
    bone_query: Query<(Entity, &VrmBone, &GlobalTransform)>,
) {
    if input.just_pressed(KeyCode::KeyG) {
        state.enabled = !state.enabled;
        log.push(format!("[VIZ] bones {}", if state.enabled { "ON" } else { "OFF" }));

        if !state.enabled {
            // Despawn labels
            for entity in &labels {
                commands.entity(entity).despawn();
            }
            state.labels_spawned = false;
        }
    }

    // Spawn labels as children of bone entities (auto-tracks position)
    if state.enabled && !state.labels_spawned && !bone_query.is_empty() {
        for (entity, vrm_bone, _gtf) in &bone_query {
            let short_name = vrm_bone.0.as_str();
            let label = commands.spawn((
                BoneLabel,
                Text2d::new(short_name.to_string()),
                TextFont { font_size: 11.0, ..default() },
                TextColor(Color::srgba(1.0, 1.0, 0.5, 0.9)),
                Transform::from_translation(Vec3::Y * 0.02),
            )).id();
            commands.entity(entity).add_child(label);
        }
        state.labels_spawned = true;
    }
}

fn draw_bone_viz(
    state: Res<BoneVizState>,
    mut gizmos: Gizmos,
    bone_query: Query<(&VrmBone, &GlobalTransform)>,
    all_bones: Query<(&GlobalTransform, Option<&VrmBone>, Option<&Name>, &ChildOf)>,
    parent_transforms: Query<&GlobalTransform>,
    fbx_viz: Option<Res<FbxSkeletonViz>>,
    time: Res<Time<Real>>,
    anim_player_query: Query<&AnimationPlayer>,
) {
    if !state.enabled {
        return;
    }

    // --- VRM bones (green/yellow/blue/red) ---
    for (vrm_bone, gtf) in &bone_query {
        let pos = gtf.translation();

        let color = match vrm_bone.0.as_str() {
            s if s.contains("hips") || s.contains("spine") || s.contains("chest")
                || s.contains("Chest") || s.contains("Spine") => Color::srgb(0.0, 1.0, 0.0),
            s if s.contains("neck") || s.contains("head")
                || s.contains("Neck") || s.contains("Head") => Color::srgb(1.0, 1.0, 0.0),
            s if s.contains("left") || s.contains("Left") => Color::srgb(0.3, 0.5, 1.0),
            s if s.contains("right") || s.contains("Right") => Color::srgb(1.0, 0.3, 0.3),
            _ => Color::srgb(0.8, 0.8, 0.8),
        };

        gizmos.sphere(Isometry3d::from_translation(pos), 0.008, color);

        let rot = gtf.to_scale_rotation_translation().1;
        let axis_len = 0.03;
        gizmos.line(pos, pos + rot * Vec3::X * axis_len, Color::srgb(1.0, 0.0, 0.0));
        gizmos.line(pos, pos + rot * Vec3::Y * axis_len, Color::srgb(0.0, 1.0, 0.0));
        gizmos.line(pos, pos + rot * Vec3::Z * axis_len, Color::srgb(0.0, 0.0, 1.0));
    }

    for (gtf, vrm_bone, _name, child_of) in &all_bones {
        if vrm_bone.is_none() { continue; }
        if let Ok(parent_gtf) = parent_transforms.get(child_of.0) {
            gizmos.line(gtf.translation(), parent_gtf.translation(), Color::srgba(1.0, 1.0, 1.0, 0.4));
        }
    }

    // --- Ground grid ---
    let grid_color = Color::srgba(0.3, 0.3, 0.3, 0.5);
    let grid_size = 5;
    let grid_step = 0.5_f32;
    for i in -grid_size..=grid_size {
        let v = i as f32 * grid_step;
        let extent = grid_size as f32 * grid_step;
        gizmos.line(Vec3::new(v, 0.0, -extent), Vec3::new(v, 0.0, extent), grid_color);
        gizmos.line(Vec3::new(-extent, 0.0, v), Vec3::new(extent, 0.0, v), grid_color);
    }
    // Origin axes with arrow tips (Bevy: right-handed Y-up, +X right, +Y up, +Z forward/out)
    let axis_len = 0.5;
    let tip = 0.04;
    // X axis (red)
    gizmos.line(Vec3::ZERO, Vec3::X * axis_len, Color::srgb(1.0, 0.0, 0.0));
    gizmos.sphere(Isometry3d::from_translation(Vec3::X * axis_len), tip, Color::srgb(1.0, 0.0, 0.0));
    // Y axis (green)
    gizmos.line(Vec3::ZERO, Vec3::Y * axis_len, Color::srgb(0.0, 1.0, 0.0));
    gizmos.sphere(Isometry3d::from_translation(Vec3::Y * axis_len), tip, Color::srgb(0.0, 1.0, 0.0));
    // Z axis (blue)
    gizmos.line(Vec3::ZERO, Vec3::Z * axis_len, Color::srgb(0.0, 0.0, 1.0));
    gizmos.sphere(Isometry3d::from_translation(Vec3::Z * axis_len), tip, Color::srgb(0.0, 0.0, 1.0));

    // --- FBX source skeleton (cyan, offset +1.5m on X) ---
    // FBX positions are in UE Z-up space, convert to Y-up: (x, z, -y) * 0.01
    let Some(fbx_viz) = fbx_viz else { return; };
    let skel = &fbx_viz.data;
    if skel.frame_count == 0 { return; }

    // Sync FBX skeleton time with AnimationPlayer
    let anim_time: f64 = anim_player_query
        .iter()
        .next()
        .and_then(|player| {
            player.playing_animations().next().map(|(_, active)| {
                active.elapsed() as f64 % skel.duration as f64
            })
        })
        .unwrap_or_else(|| {
            let elapsed = time.elapsed_secs_f64() - fbx_viz.start_time;
            elapsed % skel.duration as f64
        });
    let frame = ((anim_time / skel.duration as f64) * skel.frame_count as f64) as usize;
    let frame = frame.min(skel.frame_count - 1);

    let offset = Vec3::ZERO; // overlay on VRM for comparison

    for (name, positions) in &skel.bone_positions {
        if let Some(pos) = positions.get(frame) {
            let p = Vec3::new(pos[0], pos[1], pos[2]) + offset;

            gizmos.sphere(Isometry3d::from_translation(p), 0.006, Color::srgb(0.0, 1.0, 1.0));

            if let Some(parent_name) = skel.hierarchy.get(name) {
                if let Some(parent_positions) = skel.bone_positions.get(parent_name) {
                    if let Some(pp) = parent_positions.get(frame) {
                        let pp = Vec3::new(pp[0], pp[1], pp[2]) + offset;
                        gizmos.line(p, pp, Color::srgba(0.0, 1.0, 1.0, 0.5));
                    }
                }
            }
        }
    }
}
