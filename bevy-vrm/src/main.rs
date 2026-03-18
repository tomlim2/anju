use bevy::prelude::*;
use bevy::dev_tools::fps_overlay::{FpsOverlayConfig, FpsOverlayPlugin};
use bevy::diagnostic::{
    DiagnosticsStore, EntityCountDiagnosticsPlugin, FrameTimeDiagnosticsPlugin,
    SystemInformationDiagnosticsPlugin,
};
use bevy_panorbit_camera::{PanOrbitCamera, PanOrbitCameraPlugin};
use bevy_vrm1::prelude::*;

fn main() {
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
        .add_systems(Startup, setup)
        .add_systems(Update, (toggle_debug, update_debug_panel))
        .run();
}

#[derive(Component)]
struct DebugPanel;

fn setup(mut commands: Commands, asset_server: Res<AssetServer>) {
    // Camera with orbit controls
    commands.spawn((
        Camera3d::default(),
        Transform::from_xyz(0.0, 1.0, 3.0).looking_at(Vec3::new(0.0, 1.0, 0.0), Vec3::Y),
        PanOrbitCamera {
            focus: Vec3::new(0.0, 1.0, 0.0),
            radius: Some(3.0),
            ..default()
        },
    ));

    // Directional light
    commands.spawn((
        DirectionalLight {
            illuminance: 10000.0,
            shadows_enabled: true,
            ..default()
        },
        Transform::from_rotation(Quat::from_euler(EulerRot::XYZ, -0.5, 0.5, 0.0)),
    ));

    // Load VRM model
    commands.spawn(VrmHandle(asset_server.load("models/test.vrm")));

    // Debug panel (bottom-left)
    commands.spawn((
        DebugPanel,
        Text::new(""),
        TextFont {
            font_size: 13.0,
            ..default()
        },
        TextColor(Color::srgba(0.0, 1.0, 0.0, 0.7)),
        Node {
            position_type: PositionType::Absolute,
            bottom: Val::Px(12.0),
            left: Val::Px(12.0),
            ..default()
        },
    ));

    info!("Bevy VRM — F3: toggle debug overlay");
}

fn toggle_debug(
    input: Res<ButtonInput<KeyCode>>,
    mut config: ResMut<FpsOverlayConfig>,
    mut panel_q: Query<&mut Visibility, With<DebugPanel>>,
) {
    if input.just_pressed(KeyCode::F3) {
        config.enabled = !config.enabled;
        for mut vis in &mut panel_q {
            *vis = if config.enabled {
                Visibility::Inherited
            } else {
                Visibility::Hidden
            };
        }
    }
}

fn update_debug_panel(
    diagnostics: Res<DiagnosticsStore>,
    meshes: Res<Assets<Mesh>>,
    images: Res<Assets<Image>>,
    materials: Res<Assets<StandardMaterial>>,
    mut panel_q: Query<&mut Text, With<DebugPanel>>,
) {
    let Ok(mut text) = panel_q.single_mut() else {
        return;
    };

    let entities = diagnostics
        .get(&EntityCountDiagnosticsPlugin::ENTITY_COUNT)
        .and_then(|d| d.smoothed())
        .unwrap_or(0.0);

    let frame_time = diagnostics
        .get(&FrameTimeDiagnosticsPlugin::FRAME_TIME)
        .and_then(|d| d.smoothed())
        .unwrap_or(0.0);

    let process_mem = diagnostics
        .get(&SystemInformationDiagnosticsPlugin::PROCESS_MEM_USAGE)
        .and_then(|d| d.smoothed())
        .unwrap_or(0.0);

    let mesh_count = meshes.len();
    let image_count = images.len();
    let material_count = materials.len();

    // Estimate image memory (width * height * 4 bytes assumed)
    let mut image_bytes: u64 = 0;
    for (_, image) in images.iter() {
        image_bytes += image.width() as u64 * image.height() as u64 * 4;
    }
    let image_mb = image_bytes as f64 / (1024.0 * 1024.0);

    **text = format!(
        "frame: {:.1} ms | entities: {}\n\
         meshes: {} | textures: {} ({:.1} MB) | materials: {}\n\
         process mem: {:.1} GiB",
        frame_time,
        entities as u32,
        mesh_count,
        image_count,
        image_mb,
        material_count,
        process_mem,
    );
}
