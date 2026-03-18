use bevy::prelude::*;
use bevy_panorbit_camera::{PanOrbitCamera, PanOrbitCameraPlugin};
use bevy_vrm1::prelude::*;

fn main() {
    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Shotloom R&D — VRM Viewer".into(),
                resolution: (1280, 720).into(),
                ..default()
            }),
            ..default()
        }))
        .add_plugins(VrmPlugin)
        .add_plugins(PanOrbitCameraPlugin)
        .add_systems(Startup, setup)
        .run();
}

fn setup(mut commands: Commands, asset_server: Res<AssetServer>) {
    // Camera with orbit controls (LMB rotate, RMB pan, scroll zoom)
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

    // Load VRM model (place .vrm file in assets/models/)
    commands.spawn(VrmHandle(asset_server.load("models/test.vrm")));

    info!("Shotloom R&D — LMB: rotate, RMB: pan, Scroll: zoom");
}
