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
        // Detect converted 0.x: vrm0_compat adds 180°Y rotation [0,1,0,0] to scene root nodes
        // Native VRM 1.0 files don't have this pattern
        if json_str.contains("\"rotation\":[0.0,1.0,0.0,0.0]") {
            VrmVersionTag::Vrm0
        } else {
            VrmVersionTag::Vrm1
        }
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

#[derive(Component, Clone, Copy, PartialEq, Eq)]
enum LoadedVrmVersion {
    Vrm0,
    Vrm1,
}

#[derive(Resource, Default)]
struct RetargetState {
    config_json: Option<String>,
    pending_anim: Option<cinev_retarget::RetargetedAnimation>,
    applied: bool,
}

#[derive(Resource)]
struct BoneVizState {
    enabled: bool,
    labels_spawned: bool,
}
impl Default for BoneVizState {
    fn default() -> Self {
        Self { enabled: true, labels_spawned: false }
    }
}

/// Debug: only apply retarget to hips (isolate hips rotation)
const HIPS_ONLY: bool = false;

/// Auto-load VRM and FBX on startup
const AUTO_LOAD_VRM: &str = "models/YouAre.vrm";
const AUTO_LOAD_FBX: &str = "/Users/younsoolim/Desktop/archive/untitled folder/notwww/vrm/25_06672_F_DNTSuperSukiShukiRush_260113.fbx";

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
        .configure_sets(PostUpdate, VrmSystemSets::SpringBone.run_if(|| false))
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
        .add_systems(Startup, (setup, auto_load_fbx))
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
    asset_server: Res<AssetServer>,
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

    // Auto-load VRM and FBX for quick iteration
    if !AUTO_LOAD_VRM.is_empty() {
        let full_path = format!("assets/{}", AUTO_LOAD_VRM);
        match fs::read(&full_path) {
            Ok(file_bytes) => {
                let vrm_version = detect_vrm_version(&file_bytes);
                let is_vrm0 = matches!(vrm_version, VrmVersionTag::Vrm0);
                // For 0.x: convert and save to .v1.vrm cache, load that instead
                let load_asset_path = if is_vrm0 {
                    log.push("[AUTO] VRM 0.x detected — converting...");
                    match vrm0_compat::convert(&file_bytes) {
                        Ok(converted) => {
                            let cache_path = full_path.replace(".vrm", ".v1.vrm");
                            let cache_asset = AUTO_LOAD_VRM.replace(".vrm", ".v1.vrm");
                            fs::write(&cache_path, &converted).ok();
                            log.push("[AUTO] VRM 0.x → 1.0 conversion done");
                            cache_asset
                        }
                        Err(e) => {
                            log.push(format!("[AUTO] VRM 0.x conversion failed: {}", e));
                            AUTO_LOAD_VRM.to_string()
                        }
                    }
                } else {
                    match vrm_version {
                        VrmVersionTag::Vrm1 => log.push("[AUTO] VRM 1.0 detected"),
                        _ => log.push("[AUTO] VRM version unknown — attempting load as 1.0"),
                    }
                    AUTO_LOAD_VRM.to_string()
                };
                let handle = asset_server.load::<VrmAsset>(&load_asset_path);
                let loaded_version = if is_vrm0 { LoadedVrmVersion::Vrm0 } else { LoadedVrmVersion::Vrm1 };
                let spawn_transform = if is_vrm0 {
                    Transform::from_rotation(Quat::from_rotation_y(std::f32::consts::PI))
                } else {
                    Transform::default()
                };
                commands.spawn((
                    loaded_version,
                    VrmHandle(handle),
                    spawn_transform,
                ));
                let tag = if is_vrm0 { "rotateVRM0" } else { "native1.0" };
                log.push(format!("[AUTO] VRM: {} ({})", load_asset_path, tag));
            }
            Err(e) => {
                log.push(format!("[AUTO] VRM file not found: {} — {}", full_path, e));
            }
        }
    }
}

fn auto_load_fbx(
    mut commands: Commands,
    mut retarget_state: ResMut<RetargetState>,
    mut log: ResMut<AppLog>,
) {
    if AUTO_LOAD_FBX.is_empty() { return; }

    let fbx_bytes = match fs::read(AUTO_LOAD_FBX) {
        Ok(b) => b,
        Err(e) => {
            log.push(format!("[AUTO] FBX read failed: {}", e));
            return;
        }
    };
    log.push(format!("[AUTO] FBX: {} ({:.1} MB)", AUTO_LOAD_FBX, fbx_bytes.len() as f64 / 1048576.0));

    let config_json = match fs::read_to_string("assets/retarget/cinev_female_body.json") {
        Ok(j) => j,
        Err(e) => {
            log.push(format!("[AUTO] config load failed: {}", e));
            return;
        }
    };
    retarget_state.config_json = Some(config_json.clone());

    let vrm_version = cinev_retarget::vrm_compat::VrmVersion::V1_0;
    match cinev_retarget::retarget(&fbx_bytes, &config_json, vrm_version) {
        Ok((anim, _diag)) => {
            log.push(format!("[AUTO] retarget: {} tracks, {:.1}s", anim.bone_tracks.len(), anim.duration_secs));
            retarget_state.pending_anim = Some(anim);
            retarget_state.applied = false;
        }
        Err(e) => {
            log.push(format!("[AUTO] retarget failed: {}", e));
            return;
        }
    }

    match cinev_retarget::compute_fbx_skeleton(&fbx_bytes) {
        Ok(skel) => {
            log.push(format!("[AUTO] FBX skeleton: {} bones", skel.bone_positions.len()));
            commands.insert_resource(FbxSkeletonViz { data: skel, start_time: 0.0 });
        }
        Err(e) => log.push(format!("[AUTO] FBX skeleton viz: {}", e)),
    }
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
    existing_vrm: Query<Entity, With<LoadedVrmVersion>>,
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
        let is_vrm0 = matches!(vrm_version, VrmVersionTag::Vrm0);
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
                log.push("[WARN] VRM version unknown — attempting load as 1.0");
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

        let loaded_version = if is_vrm0 { LoadedVrmVersion::Vrm0 } else { LoadedVrmVersion::Vrm1 };
        let spawn_transform = if is_vrm0 {
            Transform::from_rotation(Quat::from_rotation_y(std::f32::consts::PI))
        } else {
            Transform::default()
        };
        commands.spawn((
            loaded_version,
            VrmHandle(handle),
            spawn_transform,
        ));
        let tag = if is_vrm0 { "rotateVRM0" } else { "native1.0" };
        log.push(format!("[LOAD] VrmHandle spawned ({}) — waiting for init...", tag));
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
    vrm_version_query: Query<&LoadedVrmVersion>,
    time: Res<Time<Real>>,
) {
    if retarget_state.applied || retarget_state.pending_anim.is_none() {
        return;
    }

    if bone_query.is_empty() || player_query.is_empty() {
        return;
    }

    let anim = retarget_state.pending_anim.as_ref().unwrap();

    // VRM 0.x needs 180°Y change-of-basis (x,z negate) because scene parent has 180°Y
    let is_vrm0 = vrm_version_query.iter().next()
        .map(|v| *v == LoadedVrmVersion::Vrm0)
        .unwrap_or(false);

    // --- Collect VRM bone data from Bevy (version-independent) ---
    let mut bone_name_map: HashMap<String, Name> = HashMap::new();
    let mut bone_rest_local: HashMap<String, Quat> = HashMap::new();
    let mut bone_rest_global: HashMap<String, Quat> = HashMap::new();

    for (vrm_bone, name, rest_tf, rest_gtf) in &bone_query {
        bone_name_map.insert(vrm_bone.0.clone(), name.clone());
        bone_rest_local.insert(vrm_bone.0.clone(), rest_tf.rotation);
        bone_rest_global.insert(vrm_bone.0.clone(), rest_gtf.rotation());

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
            break;
        }
    }
    bone_name_map.insert("VRMC_vrm.root_bone".to_string(), vrm_root_name);
    bone_rest_local.insert("VRMC_vrm.root_bone".to_string(), root_rest_local);
    // Root's skeleton-space global = just its local rest (skeleton root, no parent in skeleton)
    // Do NOT use GlobalTransform which includes 180°Y scene parent
    bone_rest_global.insert("VRMC_vrm.root_bone".to_string(), root_rest_local);

    log.push(format!(
        "[ANIM] {} bones | root local=({:.2},{:.2},{:.2},{:.2}) global=({:.2},{:.2},{:.2},{:.2})",
        bone_name_map.len(),
        root_rest_local.x, root_rest_local.y, root_rest_local.z, root_rest_local.w,
        root_rest_global_rot.x, root_rest_global_rot.y, root_rest_global_rot.z, root_rest_global_rot.w,
    ));

    // Debug: log spine chain rest rotations
    for spine_name in &["hips", "spine", "chest", "upperChest", "neck"] {
        if let (Some(local), Some(global)) = (bone_rest_local.get(*spine_name), bone_rest_global.get(*spine_name)) {
            log.push(format!(
                "[REST] {} local=({:.3},{:.3},{:.3},{:.3}) global=({:.3},{:.3},{:.3},{:.3})",
                spine_name, local.x, local.y, local.z, local.w,
                global.x, global.y, global.z, global.w,
            ));
        }
    }

    // Scale correction: MetaHuman vs VRM height ratio
    // FBX pelvis height from skeleton viz data (Y component in Y-up space = height)
    let fbx_hips_height = fbx_viz.as_ref()
        .and_then(|v| v.data.bone_positions.get("DHIbody:pelvis"))
        .and_then(|p| p.first())
        .map(|p| p[1]) // Y component in Y-up space = height
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

    // three-vrm formula (from loadMixamoAnimation.js):
    //   result = parentRestWorld_yup * animLocal_yup * boneRestWorld_yup.inverse()
    //
    // Where:
    //   animLocal_zup = PreRotation * Lcl_Rotation_anim (= src_rest * track.rotations[i])
    //   *_yup = coord_rot * *_zup * coord_rot_inv
    //
    // For VRM 0.x: negate x,z of the resulting quaternion (forward axis flip -Z vs +Z)
    //
    // This formula produces VRM LOCAL rotation directly (not a delta on top of rest).

    // Compute hips rest offset: FBX pelvis rest (Y-up world) - VRM hips rest (local)
    // This compensates for different skeleton rest positions
    let hips_rest_offset = {
        let fbx_pelvis_rest = fbx_viz.as_ref()
            .and_then(|v| v.data.bone_positions.get("DHIbody:pelvis"))
            .and_then(|p| p.first())
            .map(|p| Vec3::new(p[0], p[1], p[2]));
        let fbx_root_rest = fbx_viz.as_ref()
            .and_then(|v| v.data.bone_positions.get("DHIbody:root"))
            .and_then(|p| p.first())
            .map(|p| Vec3::new(p[0], p[1], p[2]));
        let vrm_hips_rest = bone_query.iter()
            .find(|(vb, _, _, _)| vb.0 == "hips")
            .map(|(_, _, rt, _)| rt.translation)
            .unwrap_or(Vec3::ZERO);
        match (fbx_pelvis_rest, fbx_root_rest) {
            (Some(p), Some(r)) => (p - r) - vrm_hips_rest,
            _ => Vec3::ZERO,
        }
    };
    log.push(format!(
        "[ANIM] hips_rest_offset=({:.3},{:.3},{:.3})",
        hips_rest_offset.x, hips_rest_offset.y, hips_rest_offset.z,
    ));

    // Auto-detect A-pose corrections from FBX vs VRM bone directions at rest
    // VRM is T-pose (arms horizontal), FBX MetaHuman is A-pose (arms angled down ~40°)
    // Compute the rotation from VRM rest direction to FBX rest direction per arm bone
    let apose_corrections: HashMap<String, Quat> = {
        let mut corrections = HashMap::new();
        let arm_pairs: &[(&str, &str)] = &[
            ("leftShoulder", "leftUpperArm"),
            ("leftUpperArm", "leftLowerArm"),
            ("rightShoulder", "rightUpperArm"),
            ("rightUpperArm", "rightLowerArm"),
        ];

        if let Some(ref fbx) = fbx_viz {
            for &(bone_name, child_name) in arm_pairs {
                // VRM bone direction from RestGlobalTransform (skeleton space, no 180°Y)
                let vrm_pos = bone_query.iter()
                    .find(|(vb, _, _, _)| vb.0 == bone_name)
                    .map(|(_, _, _, rgt)| rgt.translation());
                let vrm_child_pos = bone_query.iter()
                    .find(|(vb, _, _, _)| vb.0 == child_name)
                    .map(|(_, _, _, rgt)| rgt.translation());

                // FBX bone direction at rest (frame 0, Y-up world space)
                let fbx_bone_name = anim.bone_tracks.iter()
                    .find(|t| t.vrm_bone_name == bone_name)
                    .map(|t| &t.src_bone_name);
                let fbx_child_name = anim.bone_tracks.iter()
                    .find(|t| t.vrm_bone_name == child_name)
                    .map(|t| &t.src_bone_name);

                let fbx_pos = fbx_bone_name
                    .and_then(|n| fbx.data.bone_positions.get(n))
                    .and_then(|p| p.first())
                    .map(|p| Vec3::new(p[0], p[1], p[2]));
                let fbx_child_pos = fbx_child_name
                    .and_then(|n| fbx.data.bone_positions.get(n))
                    .and_then(|p| p.first())
                    .map(|p| Vec3::new(p[0], p[1], p[2]));

                if let (Some(vp), Some(vcp), Some(fp), Some(fcp)) =
                    (vrm_pos, vrm_child_pos, fbx_pos, fbx_child_pos)
                {
                    // VRM 0.x: RestGlobalTransform includes 180°Y scene parent → undo by negating X,Z
                    // VRM 1.0: no scene parent rotation → use raw direction
                    let vrm_raw = (vcp - vp).normalize_or_zero();
                    let vrm_dir = if is_vrm0 {
                        Vec3::new(-vrm_raw.x, vrm_raw.y, -vrm_raw.z)
                    } else {
                        vrm_raw
                    };
                    let fbx_dir = (fcp - fp).normalize_or_zero();
                    let angle = vrm_dir.dot(fbx_dir).clamp(-1.0, 1.0).acos();

                    if angle > 0.05 {
                        // World-space rotation from VRM T-pose direction → FBX A-pose direction
                        let correction_world = Quat::from_rotation_arc(vrm_dir, fbx_dir);
                        // Convert to bone-local space
                        let bone_global = bone_rest_global.get(bone_name).copied().unwrap_or(Quat::IDENTITY);
                        let correction_local = bone_global.inverse() * correction_world * bone_global;

                        log.push(format!(
                            "[APOSE] {} diff={:.1}° vrm=({:.2},{:.2},{:.2}) fbx=({:.2},{:.2},{:.2})",
                            bone_name, angle.to_degrees(),
                            vrm_dir.x, vrm_dir.y, vrm_dir.z,
                            fbx_dir.x, fbx_dir.y, fbx_dir.z,
                        ));

                        corrections.insert(bone_name.to_string(), correction_local);
                    }
                }
            }
        }
        corrections
    };

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

        // three-vrm formula: parentRestWorld_yup * animLocal_yup * boneRestWorld_yup.inv()
        let parent_rest_yup = coord_rot * track.src_parent_rest_global * coord_rot_inv;
        let bone_rest_yup = coord_rot * track.src_rest_global * coord_rot_inv;
        let bone_rest_yup_inv = bone_rest_yup.inverse();

        // A-pose correction for this bone (if detected)
        let apose_correction = apose_corrections.get(&track.vrm_bone_name).copied();

        // VRM destination rest (for VRM 1.0 non-identity rest bones)
        let dst_rest_local = bone_rest_local.get(&track.vrm_bone_name).copied().unwrap_or(Quat::IDENTITY);
        let dst_rest_global = bone_rest_global.get(&track.vrm_bone_name).copied().unwrap_or(Quat::IDENTITY);
        let dst_rest_global_inv = dst_rest_global.inverse();

        let corrected_rotations: Vec<Quat> = (0..track.rotations.len())
            .map(|frame_idx| {
                let anim_local_zup = track.src_rest * track.rotations[frame_idx];
                let anim_local_yup = coord_rot * anim_local_zup * coord_rot_inv;

                // three-vrm: produces normalized (skeleton-space) rotation
                let normalized = (parent_rest_yup * anim_local_yup * bone_rest_yup_inv).normalize();

                // VRM spec full formula: dst_rest * inv(dst_rest_g) * normalized * dst_rest_g
                // Skip for VRM 0.x: bones have identity rest, but RestGlobalTransform includes
                // 180°Y scene parent which would corrupt the result
                let mut result = if is_vrm0 {
                    normalized
                } else {
                    (dst_rest_local * dst_rest_global_inv * normalized * dst_rest_global).normalize()
                };

                // Apply A-pose correction: rotate VRM T-pose → FBX A-pose rest orientation
                if let Some(correction) = apose_correction {
                    result = (result * correction).normalize();
                }

                // VRM 0.x Change of Basis: R180 * Q * R180^-1 = negate x,z
                if is_vrm0 {
                    Quat::from_xyzw(-result.x, result.y, -result.z, result.w)
                } else {
                    result
                }
            })
            .collect();

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

            // For hips: use FBX skeleton viz world positions directly
            // Compute delta from FBX rest, scale to VRM proportions, add to VRM rest
            let use_fbx_viz_pos = track.vrm_bone_name == "hips" && fbx_viz.is_some();
            let fbx_pelvis_positions = fbx_viz.as_ref()
                .and_then(|v| v.data.bone_positions.get("DHIbody:pelvis"));
            let fbx_root_positions = fbx_viz.as_ref()
                .and_then(|v| v.data.bone_positions.get("DHIbody:root"));
            let fbx_root_rotations = fbx_viz.as_ref()
                .and_then(|v| v.data.bone_rotations.get("DHIbody:root"));

            // FBX pelvis rest position in root-local space (frame 0)
            let fbx_hips_rest_local = if use_fbx_viz_pos {
                let pelvis_rest = fbx_pelvis_positions
                    .and_then(|p| p.first())
                    .map(|p| Vec3::new(p[0], p[1], p[2]))
                    .unwrap_or(Vec3::ZERO);
                let root_rest = fbx_root_positions
                    .and_then(|p| p.first())
                    .map(|p| Vec3::new(p[0], p[1], p[2]))
                    .unwrap_or(Vec3::ZERO);
                let root_rot_rest = fbx_root_rotations
                    .and_then(|r| r.first().copied())
                    .unwrap_or(Quat::IDENTITY);
                let root_rot_rest_yup = coord_rot * root_rot_rest * coord_rot_inv;
                root_rot_rest_yup.inverse() * (pelvis_rest - root_rest)
            } else {
                Vec3::ZERO
            };

            let local_translations: Vec<Vec3> = (0..translations.len())
                .map(|i| {
                    let delta = translations[i];
                    let scaled = delta * scale_ratio;

                    if is_root {
                        // VRM 0.x: negate X,Z for 180°Y parent; VRM 1.0: direct
                        let t = bone_rest_translation + scaled;
                        if is_vrm0 { Vec3::new(-t.x, t.y, -t.z) } else { t }
                    } else if use_fbx_viz_pos {
                        // Hips: FBX world → root-local, then delta from rest → scale → VRM rest
                        let pelvis_w = fbx_pelvis_positions
                            .and_then(|p| p.get(i))
                            .map(|p| Vec3::new(p[0], p[1], p[2]))
                            .unwrap_or(bone_rest_translation);
                        let root_w = fbx_root_positions
                            .and_then(|p| p.get(i))
                            .map(|p| Vec3::new(p[0], p[1], p[2]))
                            .unwrap_or(Vec3::ZERO);
                        let root_rot_zup = fbx_root_rotations
                            .and_then(|r| r.get(i).copied())
                            .unwrap_or(Quat::IDENTITY);
                        let root_rot_yup = coord_rot * root_rot_zup * coord_rot_inv;

                        // World offset → root-local (undo root rotation)
                        let local_offset = root_rot_yup.inverse() * (pelvis_w - root_w);
                        // Delta from FBX rest, scaled to VRM proportions
                        let motion_delta = (local_offset - fbx_hips_rest_local) * scale_ratio;
                        let result = bone_rest_translation + motion_delta;

                        // VRM 0.x: negate X,Z for 180°Y scene parent
                        if is_vrm0 { Vec3::new(-result.x, result.y, -result.z) } else { result }
                    } else {
                        bone_rest_translation + scaled
                    }
                })
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

    // Store clip index + FBX elapsed for synced playback
    let fbx_elapsed = fbx_viz.as_ref()
        .map(|viz| time.elapsed_secs_f64() - viz.start_time)
        .unwrap_or(0.0);
    commands.insert_resource(PendingPlayback { clip_index, fbx_elapsed });
}

#[derive(Resource)]
struct PendingPlayback {
    clip_index: AnimationNodeIndex,
    fbx_elapsed: f64,
}

fn start_playback(
    mut commands: Commands,
    pending: Option<Res<PendingPlayback>>,
    mut player_query: Query<&mut AnimationPlayer>,
) {
    let Some(pending) = pending else { return; };

    for mut player in &mut player_query {
        player.stop_all();
        let active = player.start(pending.clip_index);
        active.set_repeat(bevy::animation::RepeatAnimation::Forever);
        // Seek to FBX elapsed captured at clip creation time
        if pending.fbx_elapsed > 0.0 {
            active.seek_to(pending.fbx_elapsed as f32);
        }
    }

    commands.remove_resource::<PendingPlayback>();
}

/// Log root_bone and hips world transform every 60 frames
fn log_root_hips_world(
    root_q: Query<(&Name, &GlobalTransform), (With<AnimationPlayer>, Without<VrmBone>)>,
    bone_q: Query<(&VrmBone, &GlobalTransform)>,
    fbx_viz: Option<Res<FbxSkeletonViz>>,
    anim_player_query: Query<&AnimationPlayer>,
    _time: Res<Time>,
    mut frame_count: Local<u32>,
    mut log: ResMut<AppLog>,
) {
    *frame_count += 1;

    // --- VRM hips world position ---
    let mut vrm_hips_pos = Vec3::ZERO;
    for (vrm_bone, gtf) in &bone_q {
        if vrm_bone.0 == "hips" {
            vrm_hips_pos = gtf.translation();
        }
    }

    // --- FBX: root + pelvis world positions ---
    let Some(ref fbx) = fbx_viz else { return; };
    let skel = &fbx.data;
    if skel.frame_count == 0 { return; }

    let elapsed = _time.elapsed_secs_f64() - fbx.start_time;
    let anim_time = elapsed % skel.duration as f64;
    let frame = ((anim_time / skel.duration as f64) * skel.frame_count as f64) as usize;
    let frame = frame.min(skel.frame_count.saturating_sub(1));

    let fbx_pelvis_pos = skel.bone_positions.get("DHIbody:pelvis")
        .and_then(|p| p.get(frame))
        .map(|p| Vec3::new(p[0], p[1], p[2]))
        .unwrap_or(Vec3::ZERO);

    // FBX rotations for hips divergence check
    let coord_rot = Quat::from_rotation_x(-std::f32::consts::FRAC_PI_2);
    let coord_rot_inv = coord_rot.inverse();
    let fbx_root_rot_yup = skel.bone_rotations.get("DHIbody:root")
        .and_then(|r| r.get(frame).copied())
        .map(|r| coord_rot * r * coord_rot_inv)
        .unwrap_or(Quat::IDENTITY);
    let fbx_pelvis_rot_yup = skel.bone_rotations.get("DHIbody:pelvis")
        .and_then(|r| r.get(frame).copied())
        .map(|r| coord_rot * r * coord_rot_inv)
        .unwrap_or(Quat::IDENTITY);

    let hips_d = vrm_hips_pos - fbx_pelvis_pos;
    let hips_dist = hips_d.length();

    // Only log when hips diverges significantly
    if hips_dist > 0.03 {
        // VRM root/hips world rotations
        let vrm_root_rot = root_q.iter()
            .find(|(n, _)| n.as_str() == Vrm::ROOT_BONE)
            .map(|(_, gtf)| gtf.to_scale_rotation_translation().1)
            .unwrap_or(Quat::IDENTITY);
        let vrm_hips_rot = bone_q.iter()
            .find(|(vb, _)| vb.0 == "hips")
            .map(|(_, gtf)| gtf.to_scale_rotation_translation().1)
            .unwrap_or(Quat::IDENTITY);

        // Compare rotations: angle between VRM and FBX world rotations
        let root_rot_diff = (vrm_root_rot * fbx_root_rot_yup.inverse()).to_axis_angle();
        let hips_rot_diff = (vrm_hips_rot * fbx_pelvis_rot_yup.inverse()).to_axis_angle();

        // FBX pelvis local rotation (relative to root)
        let fbx_pelvis_local = fbx_root_rot_yup.inverse() * fbx_pelvis_rot_yup;
        // VRM hips local (relative to root in world)
        let vrm_hips_local = vrm_root_rot.inverse() * vrm_hips_rot;
        let local_diff = (vrm_hips_local * fbx_pelvis_local.inverse()).to_axis_angle();

        log.push(format!(
            "[DIVERGE] f={} t={:.2}s pos_d={:.3}m ({:.3},{:.3},{:.3})",
            frame, anim_time, hips_dist, hips_d.x, hips_d.y, hips_d.z,
        ));
        log.push(format!(
            "  root_rot_diff={:.1}° hips_rot_diff={:.1}° hips_local_diff={:.1}°",
            root_rot_diff.1.to_degrees(),
            hips_rot_diff.1.to_degrees(),
            local_diff.1.to_degrees(),
        ));
        log.push(format!(
            "  VRM hips_local=({:.3},{:.3},{:.3},{:.3}) FBX pelvis_local=({:.3},{:.3},{:.3},{:.3})",
            vrm_hips_local.x, vrm_hips_local.y, vrm_hips_local.z, vrm_hips_local.w,
            fbx_pelvis_local.x, fbx_pelvis_local.y, fbx_pelvis_local.z, fbx_pelvis_local.w,
        ));
    }

    // --- Limb bone comparison (every 30 frames) ---
    if *frame_count % 30 != 0 { return; }

    // Forward vector comparison: compare bone DIRECTION (parent→child) rather than full rotation.
    // VRM bones have identity rest → bone direction = parent→child translation direction.
    // FBX bones: use world position of bone and its child to get direction.
    // This comparison is meaningful across different skeleton rest poses.
    let fbx_child_map: &[(&str, &str, &str)] = &[
        // (vrm_bone, fbx_bone, fbx_child_for_direction)
        ("leftUpperLeg", "DHIbody:thigh_l", "DHIbody:calf_l"),
        ("leftLowerLeg", "DHIbody:calf_l", "DHIbody:foot_l"),
        ("leftUpperArm", "DHIbody:upperarm_l", "DHIbody:lowerarm_l"),
        ("leftLowerArm", "DHIbody:lowerarm_l", "DHIbody:hand_l"),
        ("spine", "DHIbody:spine_01", "DHIbody:spine_02"),
    ];

    for &(vrm_name, fbx_bone, fbx_child) in fbx_child_map {
        // VRM: bone world position from GlobalTransform (raw world space)
        let vrm_pos = bone_q.iter()
            .find(|(vb, _)| vb.0 == vrm_name)
            .map(|(_, gtf)| gtf.translation());

        // VRM: find child bone position to compute direction
        // Use known VRM hierarchy: leftUpperLeg→leftLowerLeg, etc.
        let vrm_child_name = match vrm_name {
            "leftUpperLeg" => "leftLowerLeg",
            "leftLowerLeg" => "leftFoot",
            "leftUpperArm" => "leftLowerArm",
            "leftLowerArm" => "leftHand",
            "spine" => "chest",
            _ => continue,
        };
        let vrm_child_pos = bone_q.iter()
            .find(|(vb, _)| vb.0 == vrm_child_name)
            .map(|(_, gtf)| gtf.translation());

        // FBX: bone positions (already Y-up, meters)
        let fbx_pos = skel.bone_positions.get(fbx_bone)
            .and_then(|p| p.get(frame))
            .map(|p| Vec3::new(p[0], p[1], p[2]));
        let fbx_child_pos = skel.bone_positions.get(fbx_child)
            .and_then(|p| p.get(frame))
            .map(|p| Vec3::new(p[0], p[1], p[2]));

        if let (Some(vp), Some(vcp), Some(fp), Some(fcp)) = (vrm_pos, vrm_child_pos, fbx_pos, fbx_child_pos) {
            let vrm_dir = (vcp - vp).normalize_or_zero();
            let fbx_dir = (fcp - fp).normalize_or_zero();
            let dot = vrm_dir.dot(fbx_dir).clamp(-1.0, 1.0);
            let angle = dot.acos().to_degrees();

            log.push(format!(
                "[LIMB] {} fwd_diff={:.1}° vrm=({:.2},{:.2},{:.2}) fbx=({:.2},{:.2},{:.2}) f={}",
                vrm_name, angle, vrm_dir.x, vrm_dir.y, vrm_dir.z, fbx_dir.x, fbx_dir.y, fbx_dir.z, frame,
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

    // FBX viz always runs on its own clock (independent of AnimationPlayer)
    let elapsed = time.elapsed_secs_f64() - fbx_viz.start_time;
    let anim_time = elapsed % skel.duration as f64;
    let frame = ((anim_time / skel.duration as f64) * skel.frame_count as f64) as usize;
    let frame = frame.min(skel.frame_count - 1);

    let offset = Vec3::new(1.5, 0.0, 0.0); // offset FBX skeleton to the right for comparison

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
