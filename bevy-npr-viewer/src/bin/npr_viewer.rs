use bevy::prelude::*;
use bevy_egui::{EguiContexts, EguiPlugin, EguiPrimaryContextPass, egui};
use bevy_panorbit_camera::{PanOrbitCamera, PanOrbitCameraPlugin};
use bevy_vrm1::prelude::*;
use npr_shaders::{
    NprShaderPlugin, OutlineOf, OutlineParams, ShaderLibrary, ToonParams,
    outline::OutlineMaterial,
    toon::ToonMaterial,
};
use serde::{Deserialize, Serialize};
use std::fs;

// ── Resources ──

#[derive(Resource)]
struct Turntable {
    speed: f32,
    enabled: bool,
}

impl Default for Turntable {
    fn default() -> Self {
        Self {
            speed: 0.3,
            enabled: true,
        }
    }
}

#[derive(Resource)]
struct SceneSettings {
    bg_color: [f32; 3],
    light_yaw: f32,
    light_pitch: f32,
    outline_enabled: bool,
    gui_visible: bool,
}

impl Default for SceneSettings {
    fn default() -> Self {
        Self {
            bg_color: [0.15, 0.15, 0.18],
            light_yaw: 0.5_f32.atan2(0.8),
            light_pitch: 1.0_f32.atan2((0.5_f32 * 0.5 + 0.8 * 0.8).sqrt()),
            outline_enabled: true,
            gui_visible: true,
        }
    }
}

// ── Marker components ──

#[derive(Component)]
struct VrmModel;

#[derive(Component)]
struct MainLight;

#[derive(Component)]
struct ToonReplaced;


// ── Preset serialization ──

#[derive(Serialize, Deserialize)]
struct Preset {
    name: String,
    shader_index: usize,
    toon: ToonParams,
    outline: OutlineParams,
    outline_enabled: bool,
    turntable_speed: f32,
    bg_color: [f32; 3],
}

// ── App ──

fn main() {
    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "NPR Shader Viewer".into(),
                resolution: (1280, 720).into(),
                ..default()
            }),
            ..default()
        }))
        .add_plugins(VrmPlugin)
        .configure_sets(PostUpdate, VrmSystemSets::SpringBone.run_if(|| false))
        .add_plugins(PanOrbitCameraPlugin)
        .add_plugins(EguiPlugin::default())
        .add_plugins(NprShaderPlugin)
        .init_resource::<Turntable>()
        .init_resource::<SceneSettings>()
        .insert_resource(ClearColor(Color::srgb(0.15, 0.15, 0.18)))
        .add_systems(Startup, setup_scene)
        .add_systems(Update, (
            replace_vrm_materials,
            spawn_outlines,
            turntable_rotate,
            keyboard_input,
            update_bg_color,
            update_light_direction,
            sync_outline_visibility,
        ))
        .add_systems(EguiPrimaryContextPass, shader_gui)
        .run();
}

// ── Setup ──

fn setup_scene(
    mut commands: Commands,
    asset_server: Res<AssetServer>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut toon_assets: ResMut<Assets<ToonMaterial>>,
    library: Res<ShaderLibrary>,
) {
    // Camera
    commands.spawn((
        Camera3d::default(),
        Transform::from_xyz(0.0, 1.0, 3.0).looking_at(Vec3::new(0.0, 1.0, 0.0), Vec3::Y),
        PanOrbitCamera {
            focus: Vec3::new(0.0, 1.0, 0.0),
            ..default()
        },
    ));

    // Directional light
    commands.spawn((
        DirectionalLight {
            illuminance: 10000.0,
            shadows_enabled: false,
            ..default()
        },
        Transform::from_rotation(Quat::from_euler(
            EulerRot::YXZ,
            0.5_f32.atan2(0.8),
            -1.0_f32.atan2((0.5_f32 * 0.5 + 0.8 * 0.8).sqrt()),
            0.0,
        )),
        MainLight,
    ));

    // Global ambient light
    commands.insert_resource(GlobalAmbientLight {
        color: Color::WHITE,
        brightness: 300.0,
        ..default()
    });

    // Test sphere with ToonMaterial
    commands.spawn((
        Mesh3d(meshes.add(bevy::math::primitives::Sphere::new(0.5).mesh().ico(5).unwrap())),
        MeshMaterial3d(toon_assets.add(ToonMaterial {
            params: library.active().toon_params.clone(),
        })),
        Transform::from_xyz(0.0, 1.0, 0.0),
        ToonReplaced,
    ));

    // Auto-load default VRM if exists
    let default_vrm = "assets/models/default.vrm";
    if std::path::Path::new(default_vrm).exists() {
        let handle = asset_server.load::<VrmAsset>("models/default.vrm");
        commands.spawn((VrmHandle(handle), VrmModel, Transform::default()));
    }
}

// ── Material replacement: MToonMaterial → ToonMaterial ──

fn replace_vrm_materials(
    mut commands: Commands,
    query: Query<(Entity, &MeshMaterial3d<MToonMaterial>, &Mesh3d), Without<ToonReplaced>>,
    mut toon_assets: ResMut<Assets<ToonMaterial>>,
    mut mesh_assets: ResMut<Assets<Mesh>>,
    library: Res<ShaderLibrary>,
) {
    for (entity, _mtoon_handle, mesh3d) in query.iter() {
        // Clone mesh without morph targets to avoid pipeline layout mismatch.
        // Our custom material doesn't support morph target bindings.
        if let Some(src_mesh) = mesh_assets.get(&mesh3d.0) {
            if src_mesh.has_morph_targets() {
                let mut clean = Mesh::new(
                    src_mesh.primitive_topology(),
                    src_mesh.asset_usage,
                );
                // Copy standard vertex attributes, skip skinning/morph
                for (attr_id, attr_data) in src_mesh.attributes() {
                    if *attr_id == Mesh::ATTRIBUTE_JOINT_INDEX
                        || *attr_id == Mesh::ATTRIBUTE_JOINT_WEIGHT
                    {
                        continue;
                    }
                    clean.insert_attribute(attr_id.clone(), attr_data.clone());
                }
                if let Some(indices) = src_mesh.indices() {
                    clean.insert_indices(indices.clone());
                }
                let clean_handle = mesh_assets.add(clean);
                commands.entity(entity).insert(Mesh3d(clean_handle));
            }
        }

        let toon = ToonMaterial {
            params: library.active().toon_params.clone(),
        };

        let handle = toon_assets.add(toon);
        commands
            .entity(entity)
            .remove::<MeshMaterial3d<MToonMaterial>>()
            .remove::<MorphWeights>()
            .remove::<bevy::mesh::skinning::SkinnedMesh>()
            .insert(MeshMaterial3d(handle))
            .insert(ToonReplaced);
    }
}

// ── Outline spawning: duplicate mesh entities with OutlineMaterial ──

fn spawn_outlines(
    mut commands: Commands,
    query: Query<(Entity, &Mesh3d, &Transform), (With<ToonReplaced>, Without<OutlineOf>)>,
    existing_outlines: Query<&OutlineOf>,
    mut outline_assets: ResMut<Assets<OutlineMaterial>>,
    library: Res<ShaderLibrary>,
    settings: Res<SceneSettings>,
) {
    let outlined: std::collections::HashSet<Entity> =
        existing_outlines.iter().map(|o| o.0).collect();

    for (entity, mesh, transform) in query.iter() {
        if outlined.contains(&entity) {
            continue;
        }

        let outline_handle = outline_assets.add(OutlineMaterial {
            params: library.active().outline_params.clone(),
        });

        let vis = if settings.outline_enabled {
            Visibility::Visible
        } else {
            Visibility::Hidden
        };

        commands.spawn((
            Mesh3d(mesh.0.clone()),
            MeshMaterial3d(outline_handle),
            *transform,
            OutlineOf(entity),
            vis,
        ));
    }
}

// ── Turntable ──

fn turntable_rotate(
    time: Res<Time>,
    turntable: Res<Turntable>,
    mut query: Query<&mut Transform, With<VrmModel>>,
) {
    if !turntable.enabled {
        return;
    }
    for mut tf in query.iter_mut() {
        tf.rotate_y(turntable.speed * time.delta_secs());
    }
}

// ── Keyboard ──

fn keyboard_input(
    keys: Res<ButtonInput<KeyCode>>,
    mut turntable: ResMut<Turntable>,
    mut settings: ResMut<SceneSettings>,
    mut library: ResMut<ShaderLibrary>,
    asset_server: Res<AssetServer>,
    mut commands: Commands,
) {
    if keys.just_pressed(KeyCode::KeyT) {
        turntable.enabled = !turntable.enabled;
    }
    if keys.just_pressed(KeyCode::KeyS) {
        settings.gui_visible = !settings.gui_visible;
    }
    if keys.just_pressed(KeyCode::BracketLeft) {
        library.prev();
    }
    if keys.just_pressed(KeyCode::BracketRight) {
        library.next();
    }
    if keys.just_pressed(KeyCode::KeyO) {
        if let Ok(entries) = fs::read_dir("assets/models") {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().is_some_and(|e| e == "vrm") {
                    let rel = path.strip_prefix("assets").unwrap_or(&path);
                    let asset_path = rel.to_string_lossy().to_string();
                    let handle = asset_server.load::<VrmAsset>(&asset_path);
                    commands.spawn((VrmHandle(handle), VrmModel, Transform::default()));
                    break;
                }
            }
        }
    }
}

// ── Background color ──

fn update_bg_color(settings: Res<SceneSettings>, mut clear: ResMut<ClearColor>) {
    let [r, g, b] = settings.bg_color;
    clear.0 = Color::srgb(r, g, b);
}

// ── Light direction ──

fn update_light_direction(
    settings: Res<SceneSettings>,
    mut query: Query<&mut Transform, With<MainLight>>,
) {
    for mut tf in query.iter_mut() {
        *tf = Transform::from_rotation(Quat::from_euler(
            EulerRot::YXZ,
            settings.light_yaw,
            -settings.light_pitch,
            0.0,
        ));
    }
}

// ── Outline visibility sync ──

fn sync_outline_visibility(
    settings: Res<SceneSettings>,
    mut query: Query<&mut Visibility, With<OutlineOf>>,
) {
    let vis = if settings.outline_enabled {
        Visibility::Visible
    } else {
        Visibility::Hidden
    };
    for mut v in query.iter_mut() {
        *v = vis;
    }
}

// ── egui GUI ──

fn shader_gui(
    mut contexts: EguiContexts,
    mut library: ResMut<ShaderLibrary>,
    mut turntable: ResMut<Turntable>,
    mut settings: ResMut<SceneSettings>,
    mut toon_assets: ResMut<Assets<ToonMaterial>>,
    mut outline_assets: ResMut<Assets<OutlineMaterial>>,
    toon_query: Query<&MeshMaterial3d<ToonMaterial>>,
    outline_query: Query<&MeshMaterial3d<OutlineMaterial>, With<OutlineOf>>,
) {
    if !settings.gui_visible {
        return;
    }

    let Ok(ctx) = contexts.ctx_mut() else { return };

    egui::SidePanel::left("shader_panel")
        .default_width(280.0)
        .show(ctx, |ui| {
            // ── Shader selector ──
            ui.heading("SHADER");
            ui.horizontal(|ui| {
                if ui.button("<").clicked() {
                    library.prev();
                }
                ui.label(&library.active().name);
                if ui.button(">").clicked() {
                    library.next();
                }
            });
            ui.separator();

            // ── Toon params ──
            let mut params = library.active().toon_params.clone();
            let mut toon_changed = false;

            if let Some(handle) = toon_query.iter().next() {
                if let Some(mat) = toon_assets.get(&handle.0) {
                    params = mat.params.clone();
                }
            }

            ui.heading("TOON");
            let mut base = [params.base_color.x, params.base_color.y, params.base_color.z];
            if ui.horizontal(|ui| {
                ui.label("Base Color");
                ui.color_edit_button_rgb(&mut base).changed()
            }).inner {
                params.base_color = Vec4::new(base[0], base[1], base[2], 1.0);
                toon_changed = true;
            }

            let mut shadow = [params.shadow_color.x, params.shadow_color.y, params.shadow_color.z];
            if ui.horizontal(|ui| {
                ui.label("Shadow Color");
                ui.color_edit_button_rgb(&mut shadow).changed()
            }).inner {
                params.shadow_color = Vec4::new(shadow[0], shadow[1], shadow[2], 1.0);
                toon_changed = true;
            }

            let mut bands = params.bands as i32;
            if ui.add(egui::Slider::new(&mut bands, 1..=5).text("Bands")).changed() {
                params.bands = bands as u32;
                toon_changed = true;
            }

            if ui.add(egui::Slider::new(&mut params.softness, 0.0..=0.5).text("Softness")).changed() {
                toon_changed = true;
            }

            if ui.add(egui::Slider::new(&mut params.rim_power, 0.0..=10.0).text("Rim Power")).changed() {
                toon_changed = true;
            }

            let mut rim = [params.rim_color.x, params.rim_color.y, params.rim_color.z];
            let mut rim_a = params.rim_color.w;
            ui.horizontal(|ui| {
                ui.label("Rim Color");
                if ui.color_edit_button_rgb(&mut rim).changed() {
                    toon_changed = true;
                }
            });
            if ui.add(egui::Slider::new(&mut rim_a, 0.0..=1.0).text("Rim Alpha")).changed() {
                toon_changed = true;
            }
            if toon_changed {
                params.rim_color = Vec4::new(rim[0], rim[1], rim[2], rim_a);
            }

            if toon_changed {
                for handle in toon_query.iter() {
                    if let Some(mat) = toon_assets.get_mut(&handle.0) {
                        mat.params = params.clone();
                    }
                }
            }

            ui.separator();

            // ── Outline params ──
            ui.heading("OUTLINE");
            ui.checkbox(&mut settings.outline_enabled, "Enabled");

            let mut o_params = library.active().outline_params.clone();
            let mut outline_changed = false;

            if let Some(handle) = outline_query.iter().next() {
                if let Some(mat) = outline_assets.get(&handle.0) {
                    o_params = mat.params.clone();
                }
            }

            if ui.add(egui::Slider::new(&mut o_params.outline_width, 0.0..=0.02).text("Width")).changed() {
                outline_changed = true;
            }

            let mut oc = [o_params.outline_color.x, o_params.outline_color.y, o_params.outline_color.z];
            if ui.horizontal(|ui| {
                ui.label("Color");
                ui.color_edit_button_rgb(&mut oc).changed()
            }).inner {
                o_params.outline_color = Vec4::new(oc[0], oc[1], oc[2], 1.0);
                outline_changed = true;
            }

            if outline_changed {
                for handle in outline_query.iter() {
                    if let Some(mat) = outline_assets.get_mut(&handle.0) {
                        mat.params = o_params.clone();
                    }
                }
            }

            ui.separator();

            // ── Scene ──
            ui.heading("SCENE");
            ui.checkbox(&mut turntable.enabled, "Turntable");
            ui.add(egui::Slider::new(&mut turntable.speed, 0.0..=2.0).text("Speed"));
            ui.horizontal(|ui| {
                ui.label("BG Color");
                ui.color_edit_button_rgb(&mut settings.bg_color);
            });
            ui.add(egui::Slider::new(&mut settings.light_yaw, -std::f32::consts::PI..=std::f32::consts::PI).text("Light Yaw"));
            ui.add(egui::Slider::new(&mut settings.light_pitch, 0.0..=std::f32::consts::FRAC_PI_2).text("Light Pitch"));

            ui.separator();

            // ── Presets ──
            ui.horizontal(|ui| {
                if ui.button("Save Preset").clicked() {
                    save_preset(&params, &o_params, &settings, &turntable, &library);
                }
                if ui.button("Load Preset").clicked() {
                    if let Some(preset) = load_preset("assets/presets/anime-classic.json") {
                        apply_preset(
                            preset,
                            &mut library,
                            &mut turntable,
                            &mut settings,
                            &mut toon_assets,
                            &mut outline_assets,
                            &toon_query,
                            &outline_query,
                        );
                    }
                }
                if ui.button("Reset").clicked() {
                    let defaults = &library.entries[library.active_index];
                    let dp = defaults.toon_params.clone();
                    for handle in toon_query.iter() {
                        if let Some(mat) = toon_assets.get_mut(&handle.0) {
                            mat.params = dp.clone();
                        }
                    }
                    let odp = defaults.outline_params.clone();
                    for handle in outline_query.iter() {
                        if let Some(mat) = outline_assets.get_mut(&handle.0) {
                            mat.params = odp.clone();
                        }
                    }
                }
            });

            ui.separator();
            ui.small("O: load | T: turntable | S: panel | [/]: shader | R: reset");
        });
}

// ── Preset I/O ──

fn save_preset(
    toon: &ToonParams,
    outline: &OutlineParams,
    settings: &SceneSettings,
    turntable: &Turntable,
    library: &ShaderLibrary,
) {
    let preset = Preset {
        name: library.active().name.clone(),
        shader_index: library.active_index,
        toon: toon.clone(),
        outline: outline.clone(),
        outline_enabled: settings.outline_enabled,
        turntable_speed: turntable.speed,
        bg_color: settings.bg_color,
    };
    if let Ok(json) = serde_json::to_string_pretty(&preset) {
        let filename = format!(
            "assets/presets/{}.json",
            preset.name.to_lowercase().replace(' ', "-")
        );
        fs::create_dir_all("assets/presets").ok();
        fs::write(&filename, json).ok();
        info!("Preset saved: {}", filename);
    }
}

fn load_preset(path: &str) -> Option<Preset> {
    let data = fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

fn apply_preset(
    preset: Preset,
    library: &mut ResMut<ShaderLibrary>,
    turntable: &mut ResMut<Turntable>,
    settings: &mut ResMut<SceneSettings>,
    toon_assets: &mut ResMut<Assets<ToonMaterial>>,
    outline_assets: &mut ResMut<Assets<OutlineMaterial>>,
    toon_query: &Query<&MeshMaterial3d<ToonMaterial>>,
    outline_query: &Query<&MeshMaterial3d<OutlineMaterial>, With<OutlineOf>>,
) {
    if preset.shader_index < library.entries.len() {
        library.active_index = preset.shader_index;
    }
    turntable.speed = preset.turntable_speed;
    settings.outline_enabled = preset.outline_enabled;
    settings.bg_color = preset.bg_color;

    for handle in toon_query.iter() {
        if let Some(mat) = toon_assets.get_mut(&handle.0) {
            mat.params = preset.toon.clone();
        }
    }
    for handle in outline_query.iter() {
        if let Some(mat) = outline_assets.get_mut(&handle.0) {
            mat.params = preset.outline.clone();
        }
    }
    info!("Preset loaded: {}", preset.name);
}
